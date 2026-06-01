import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { Client } from "@elastic/elasticsearch";

import { patientScanSystemPrompt } from "./prompts/patientScan.prompt.js";

const llm = new ChatOpenAI({
  model: "deepseek-v4-flash",
  temperature: 0,
  apiKey: process.env.DEEPSEEK_API_KEY,
  configuration: {
    baseURL: process.env.DEEPSEEK_BASE_URL
  }
});

const elastic = new Client({
  node: process.env.ELASTICSEARCH_URL || "http://localhost:9200"
});

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) {
      return { keywords: [] };
    }
    return JSON.parse(match[0]);
  }
}

export async function run(input) {
  const humanMessage =
    typeof input === "string"
      ? input
      : input.message || input.query || input.text || "";

  const response = await llm.invoke([
    new SystemMessage(patientScanSystemPrompt),
    new HumanMessage(humanMessage)
  ]);

  const parsed = safeJsonParse(response.content);

  const keywords = parsed.keywords || [];

  if (keywords.length === 0) {
    return {
      success: false,
      message: "Aranacak kelime bulunamadı.",
      keywords: [],
      hastaCount: 0,
      basvuruNumbers: []
    };
  }

  const shouldQueries = keywords.flatMap((keyword) => [
    // Exact + Turkish stemming
    { match: { klinik_seyir_tedavi:       { query: keyword, operator: "or" } } },
    { match: { "klinik_seyir_tedavi.kok": { query: keyword, operator: "or" } } },
    { match: { yogun_bakim_notlari:       { query: keyword, operator: "or" } } },
    { match: { "yogun_bakim_notlari.kok": { query: keyword, operator: "or" } } },

    // Fuzzy: yazım hatası toleransı (ekstra/eksik harf, x↔ks karışımı)
    { fuzzy: { klinik_seyir_tedavi: { value: keyword, fuzziness: "AUTO", prefix_length: 3 } } },
    { fuzzy: { yogun_bakim_notlari: { value: keyword, fuzziness: "AUTO", prefix_length: 3 } } },
  ]);

  const result = await elastic.search({
    index: process.env.PATIENT_INDEX || "picu_kayit",
    size: 1000,
    query: {
      bool: {
        should: shouldQueries,
        minimum_should_match: 1
      }
    },
    _source: [
      "basvuru_no",
      "dosya_no",
      "hasta_adi",
      "sablon"
    ],
    highlight: {
      fields: {
        klinik_seyir_tedavi: {},
        "klinik_seyir_tedavi.kok": {},
        yogun_bakim_notlari: {},
        "yogun_bakim_notlari.kok": {}
      },
      fragment_size: 160,
      number_of_fragments: 1
    }
  });

  const patients = result.hits.hits.map((hit) => ({
    id: hit._id,
    score: hit._score,
    basvuruNo: hit._source.basvuru_no,
    dosyaNo: hit._source.dosya_no,
    hastaAdi: hit._source.hasta_adi,
    sablon: hit._source.sablon,
    highlight: hit.highlight || null
  }));

  const basvuruNumbers = [
    ...new Set(
      patients
        .map((patient) => patient.basvuruNo)
        .filter(Boolean)
    )
  ];

  return {
    success: true,
    intent: parsed.intent || "patient_search",
    keywords,
    hastaCount: basvuruNumbers.length,
    basvuruNumbers,
    patients
  };
}

export default {
  run
};