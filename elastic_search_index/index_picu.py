#!/usr/bin/env python3
"""
PICU JSONL -> Elasticsearch indexleyici
Amaç: klinik_seyir_tedavi ve yogun_bakim_notlari uzerinde kelime bazli tarama,
sonuc olarak manuel inceleme icin hasta tanimlayicilarini (basvuru_no, dosya_no, ad) dondurmek.

Kurulum:
    pip install "elasticsearch>=8,<9"   # ES 9 icin de calisir, surumu sunucuna esitle

Kullanim:
    python index_picu.py --file cikti.jsonl --recreate          # index olustur + doldur
    python index_picu.py --search "diyaliz" --field yogun_bakim_notlari
    python index_picu.py --search "konvulziyon" --mode phrase    # tum klinik alanlarda
"""

import argparse, json, sys, hashlib
from elasticsearch import Elasticsearch, helpers

# ----------------------------------------------------------------------
# 1) ANALYZER + MAPPING  --  tasarimin kalbi burasi
# ----------------------------------------------------------------------
# Iki analyzer sunuyorum, cunku bu bir precision/recall takasi:
#   tr_klinik : turkish_lowercase + asciifolding (govde-koklemesi YOK)
#               -> "BÖBREK" ~ "bobrek" ~ "böbrek"; ama "idrarda" != "idrar"
#               -> daha yuksek PRECISION, terimi yazdigin gibi arar
#   tr_kok    : ustune turkish_stemmer -> "idrar/idrarda/idrari" tek koke iner
#               -> daha yuksek RECALL, ama "renal tx" gibi terimlerde asiri
#                  budama / yanlis kok riski (ilac isimleri en cok zarar gorur)
# Klinik tarama + manuel inceleme is akisinda: tarama RECALL odaklidir
# (hastayi kacirmamak > fazladan birkac hastayi elemek), bu yuzden default
# sorgu .kok alt-alanini da OR'lar. Karari sana birakacak sekilde ikisini de
# index'liyorum.

INDEX_SETTINGS = {
    "settings": {
        "number_of_shards": 1,          # 8.4k kayit tek shard'a fazlasiyla sigar
        "number_of_replicas": 0,        # tek dugum / lokal VPS icin
        "analysis": {
            "filter": {
                "tr_stop":   {"type": "stop", "stopwords": "_turkish_"},
                "tr_lower":  {"type": "lowercase", "language": "turkish"},  # İ->i, I->ı dogru
                "tr_stemmer":{"type": "stemmer", "language": "turkish"},
            },
            "analyzer": {
                # Kelime bazli, kok-budamasiz: ne yazarsan onu (diakritik-bagimsiz) arar
                "tr_klinik": {
                    "type": "custom",
                    "tokenizer": "standard",
                    "filter": ["tr_lower", "asciifolding", "tr_stop"],
                },
                # Kok-budamali: cekim eklerini eritir, recall'u acar
                "tr_kok": {
                    "type": "custom",
                    "tokenizer": "standard",
                    "filter": ["tr_lower", "asciifolding", "tr_stop", "tr_stemmer"],
                },
            },
        },
    },
    "mappings": {
        "dynamic": "strict",   # sema disi alan girerse hata ver; sessizce yutma
        "properties": {
            # --- tanimlayicilar (tam eslesme / filtre icin keyword) ---
            "dosya":      {"type": "keyword"},   # "_dosya" -> nokta sorunsuz olsun diye yeniden adlandiriyorum
            "sablon":     {"type": "keyword"},
            "hasta_adi":  {"type": "keyword",
                           "fields": {"ara": {"type": "text", "analyzer": "tr_klinik"}}},
            "dosya_no":   {"type": "keyword"},
            "basvuru_no": {"type": "keyword"},
            "tc_kimlik":  {"type": "keyword"},
            "telefon":    {"type": "keyword"},

            # --- klinik serbest metin alanlari ---
            # array'ler "\n" ile birlestiriliyor; analyzed text + .kok alt-alani
            # copy_to ile hepsi tek "tum_metin" alaninda toplaniyor (alan-agnostik tarama)
            "klinik_seyir_tedavi": {
                "type": "text", "analyzer": "tr_klinik",
                "fields": {"kok": {"type": "text", "analyzer": "tr_kok"}},
                "copy_to": "tum_metin",
            },
            "yogun_bakim_notlari": {
                "type": "text", "analyzer": "tr_klinik",
                "fields": {"kok": {"type": "text", "analyzer": "tr_kok"}},
                "copy_to": "tum_metin",
            },
            "konsultasyon": {
                "type": "text", "analyzer": "tr_klinik",
                "fields": {"kok": {"type": "text", "analyzer": "tr_kok"}},
                "copy_to": "tum_metin",
            },
            "tum_metin": {                       # birlesik tarama alani
                "type": "text", "analyzer": "tr_klinik",
                "fields": {"kok": {"type": "text", "analyzer": "tr_kok"}},
            },

            # --- orijinal _flags (sayisal alanlar filtrelenebilir olsun) ---
            "flags": {
                "properties": {
                    "metin_bos":               {"type": "boolean"},
                    "ad_yok":                  {"type": "boolean"},
                    "dosyano_yok":             {"type": "boolean"},
                    "basvuruno_yok":           {"type": "boolean"},
                    "dosyano_format":          {"type": "boolean"},
                    "basvuru_dosyaadi_uyumsuz":{"type": "boolean"},
                    "kst_n":  {"type": "integer"},
                    "ybn_n":  {"type": "integer"},
                    "kons_n": {"type": "integer"},
                }
            },
        },
    },
}

ARRAY_FIELDS = ["klinik_seyir_tedavi", "yogun_bakim_notlari", "konsultasyon"]


# ----------------------------------------------------------------------
# 2) KAYIT -> DOKUMAN donusumu
# ----------------------------------------------------------------------
def _join(arr):
    """Array'i tek metne cevir; None/bos elemanlari at."""
    if not isinstance(arr, list):
        return ""
    return "\n".join(s.strip() for s in arr if s and str(s).strip())


def make_doc_id(rec):
    """Idempotent ID: _dosya kullanilir.
    DIKKAT: basvuru_no _id YAPILMAZ -> ayni basvuru_no birden cok PDF'e bagli
    (8424 kayitta 549 basvuru_no tekrari = 666 kayit ezilir/kaybolurdu).
    _dosya bu veride %100 benzersiz; dogru kanonik anahtar odur.
    Yeniden indexleme ayni dokumanin uzerine yazar (cift kayit olmaz)."""
    fid = rec.get("_dosya")
    if fid:
        return str(fid)
    return hashlib.md5(json.dumps(rec, sort_keys=True).encode()).hexdigest()


def to_doc(rec):
    return {
        "dosya":      rec.get("_dosya"),
        "sablon":     rec.get("sablon"),
        "hasta_adi":  rec.get("hasta_adi"),
        "dosya_no":   rec.get("dosya_no"),
        "basvuru_no": rec.get("basvuru_no"),
        "tc_kimlik":  rec.get("tc_kimlik"),
        "telefon":    rec.get("telefon"),
        "klinik_seyir_tedavi": _join(rec.get("klinik_seyir_tedavi")),
        "yogun_bakim_notlari": _join(rec.get("yogun_bakim_notlari")),
        "konsultasyon":        _join(rec.get("konsultasyon")),
        "flags": rec.get("_flags", {}),
    }


def actions(path, index):
    with open(path, encoding="utf-8") as fh:
        for ln, line in enumerate(fh, 1):
            line = line.strip()
            if not line:
                continue
            try:
                rec = json.loads(line)
            except json.JSONDecodeError as e:
                print(f"[UYARI] satir {ln} atlandi (bozuk JSON): {e}", file=sys.stderr)
                continue
            yield {"_index": index, "_id": make_doc_id(rec), "_source": to_doc(rec)}


# ----------------------------------------------------------------------
# 3) INDEXLEME
# ----------------------------------------------------------------------
def create_index(es, index, recreate):
    if es.indices.exists(index=index):
        if recreate:
            es.indices.delete(index=index)
            print(f"[i] '{index}' silindi (recreate).")
        else:
            print(f"[i] '{index}' zaten var, mapping degismedi.")
            return
    es.indices.create(index=index, **INDEX_SETTINGS)
    print(f"[i] '{index}' olusturuldu (tr_klinik + tr_kok analyzer).")


def bulk_index(es, path, index):
    ok = err = 0
    for success, info in helpers.streaming_bulk(
        es, actions(path, index), chunk_size=500, raise_on_error=False
    ):
        if success:
            ok += 1
        else:
            err += 1
            if err <= 5:
                print(f"[HATA] {info}", file=sys.stderr)
    es.indices.refresh(index=index)
    print(f"[i] Tamamlandi: {ok} basarili, {err} hatali.")


# ----------------------------------------------------------------------
# 4) KELIME BAZLI TARAMA  --  manuel inceleme icin tanimlayici dondurur
# ----------------------------------------------------------------------
def search(es, index, terms, field, mode, size, recall):
    """
    terms : str | list[str]  -> bosluklu coklu kelime girilebilir
    field : 'tum_metin' (default) | 'klinik_seyir_tedavi' | 'yogun_bakim_notlari' | 'konsultasyon'
    mode  : 'any'    -> kelimelerden herhangi biri (OR)
            'all'    -> hepsi gecmeli (AND)
            'phrase' -> bitisik ifade ("status epileptikus")
    recall: True ise kok-budamali (.kok) alani da OR'lanir -> daha genis tarama
    """
    if isinstance(terms, str):
        terms = terms.strip()
    q_text = terms if isinstance(terms, str) else " ".join(terms)

    base = [field]
    if recall:
        base.append(f"{field}.kok")   # cekim eklerini de yakala

    if mode == "phrase":
        should = [{"match_phrase": {f: q_text}} for f in base]
    else:
        op = "and" if mode == "all" else "or"
        should = [{"match": {f: {"query": q_text, "operator": op}}} for f in base]

    body = {
        "size": size,
        "query": {"bool": {"should": should, "minimum_should_match": 1}},
        # tarama ciktisinda metnin tamamini cekmeye gerek yok; tanimlayici + skor yeter
        "_source": ["basvuru_no", "dosya_no", "hasta_adi", "sablon"],
        "highlight": {"fields": {f: {} for f in base},
                      "fragment_size": 160, "number_of_fragments": 1},
    }
    res = es.search(index=index, **body)
    hits = res["hits"]["hits"]
    total = res["hits"]["total"]["value"]
    print(f"\n[i] '{q_text}' icin {total} kayit (gosterilen: {len(hits)})  alan={field} mod={mode} recall={recall}\n")
    for h in hits:
        s = h["_source"]
        frag = ""
        if "highlight" in h:
            frag = next(iter(h["highlight"].values()))[0].replace("\n", " ")
        print(f"  basvuru={s.get('basvuru_no')}  dosya={s.get('dosya_no')}  "
              f"ad={s.get('hasta_adi')}  skor={h['_score']:.2f}")
        if frag:
            print(f"     … {frag} …")
    return hits


# ----------------------------------------------------------------------
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--host", default="http://localhost:9200")
    ap.add_argument("--index", default="picu_kayit")
    ap.add_argument("--file", default="cikti.jsonl")
    ap.add_argument("--recreate", action="store_true",
                    help="varsa index'i sil ve yeniden olustur (mapping degisikligi icin sart)")
    ap.add_argument("--no-load", action="store_true", help="sadece index olustur, doldurma")
    ap.add_argument("--search", help="aranacak kelime(ler)")
    ap.add_argument("--field", default="tum_metin",
                    choices=["tum_metin", "klinik_seyir_tedavi", "yogun_bakim_notlari", "konsultasyon"])
    ap.add_argument("--mode", default="any", choices=["any", "all", "phrase"])
    ap.add_argument("--size", type=int, default=20)
    ap.add_argument("--precision", action="store_true",
                    help="kok-budamayi kapat (sadece tam yazim) -> precision modu")
    # auth gerekiyorsa:
    ap.add_argument("--user"); ap.add_argument("--password"); ap.add_argument("--ca")
    args = ap.parse_args()

    kw = {}
    if args.user:
        kw["basic_auth"] = (args.user, args.password)
    if args.ca:
        kw["ca_certs"] = args.ca
    es = Elasticsearch(args.host, **kw)

    if args.search:
        search(es, args.index, args.search, args.field, args.mode,
               args.size, recall=not args.precision)
        return

    create_index(es, args.index, args.recreate)
    if not args.no_load:
        bulk_index(es, args.file, args.index)


if __name__ == "__main__":
    main()