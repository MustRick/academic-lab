import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { getLibraryContext } from "../services/library.service.js";

const PUBMED_BASE = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";
const SEMANTIC_SCHOLAR_SEARCH =
  "https://api.semanticscholar.org/graph/v1/paper/search";

const MAX_PUBMED_RESULTS = 25;
const MAX_SEMANTIC_RESULTS = 50;

const llm = process.env.DEEPSEEK_API_KEY
  ? new ChatOpenAI({
      model: "deepseek-v4-flash",
      temperature: 0.2,
      apiKey: process.env.DEEPSEEK_API_KEY,
      configuration: {
        baseURL: process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com/v1"
      }
    })
  : null;

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

function stripTags(value = "") {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function xmlValue(xml, tag) {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i"));
  return match ? stripTags(match[1]) : "";
}

function xmlValues(xml, tag) {
  return [...xml.matchAll(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "gi"))]
    .map(match => stripTags(match[1]))
    .filter(Boolean);
}

function classifyEvidence(paper) {
  const text = [
    paper.title,
    paper.abstract,
    paper.journal,
    ...(paper.publicationTypes || [])
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (/meta[-\s]?analysis|systematic review|cochrane/.test(text)) {
    return { level: "meta-analysis", rank: 1, label: "Meta-analiz / Sistematik derleme" };
  }
  if (
    /randomi[sz]ed|randomised|randomized|controlled trial|\brct\b|clinical trial/.test(text)
  ) {
    return { level: "rct", rank: 2, label: "Randomize kontrollü çalışma" };
  }
  if (/cohort|prospective|retrospective|longitudinal|follow[-\s]?up/.test(text)) {
    return { level: "cohort", rank: 3, label: "Kohort çalışma" };
  }
  if (/case report|case series|olgu|vaka/.test(text)) {
    return { level: "case", rank: 4, label: "Olgu / vaka serisi" };
  }
  return { level: "other", rank: 5, label: "Diğer / sınıflandırılamayan" };
}

function normalizePaper(paper) {
  const evidence = classifyEvidence(paper);
  return {
    source: paper.source,
    title: paper.title || "Başlık yok",
    year: paper.year || null,
    authors: paper.authors || [],
    journal: paper.journal || "",
    abstract: paper.abstract || "",
    url: paper.url || "",
    pmid: paper.pmid || null,
    pmcid: paper.pmcid || null,
    doi: paper.doi || null,
    semanticScholarId: paper.semanticScholarId || null,
    citationCount: paper.citationCount ?? null,
    publicationTypes: paper.publicationTypes || [],
    evidenceLevel: evidence.level,
    evidenceLabel: evidence.label,
    evidenceRank: evidence.rank,
    fullTextStatus: paper.pmcid ? "open_access_candidate" : "abstract_only"
  };
}

function dedupePapers(papers) {
  const seen = new Map();

  for (const paper of papers.map(normalizePaper)) {
    const key =
      paper.doi?.toLowerCase() ||
      paper.pmid ||
      paper.title.toLowerCase().replace(/\W+/g, " ").trim();

    if (!key) continue;

    const existing = seen.get(key);
    if (!existing) {
      seen.set(key, paper);
      continue;
    }

    seen.set(key, {
      ...existing,
      source: [...new Set([existing.source, paper.source].join(",").split(","))].join(","),
      abstract: existing.abstract || paper.abstract,
      authors: existing.authors.length ? existing.authors : paper.authors,
      journal: existing.journal || paper.journal,
      url: existing.url || paper.url,
      pmid: existing.pmid || paper.pmid,
      pmcid: existing.pmcid || paper.pmcid,
      doi: existing.doi || paper.doi,
      semanticScholarId: existing.semanticScholarId || paper.semanticScholarId,
      citationCount: Math.max(existing.citationCount || 0, paper.citationCount || 0) || null,
      publicationTypes: [...new Set([...existing.publicationTypes, ...paper.publicationTypes])],
      fullTextStatus: existing.pmcid || paper.pmcid ? "open_access_candidate" : "abstract_only"
    });
  }

  return [...seen.values()].sort((a, b) => {
    if (a.evidenceRank !== b.evidenceRank) return a.evidenceRank - b.evidenceRank;
    return (b.year || 0) - (a.year || 0);
  });
}

function evidenceSummary(papers) {
  const levels = {
    "meta-analysis": [],
    rct: [],
    cohort: [],
    case: [],
    other: []
  };

  for (const paper of papers) {
    levels[paper.evidenceLevel]?.push({
      title: paper.title,
      year: paper.year,
      source: paper.source,
      url: paper.url
    });
  }

  return {
    counts: Object.fromEntries(Object.entries(levels).map(([key, items]) => [key, items.length])),
    levels
  };
}

async function fetchJson(url, options = {}) {
  const res = await fetch(url, options);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

async function fetchText(url, options = {}) {
  const res = await fetch(url, options);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.text();
}

async function searchPubMed(query) {
  const searchUrl = new URL(`${PUBMED_BASE}/esearch.fcgi`);
  searchUrl.searchParams.set("db", "pubmed");
  searchUrl.searchParams.set("term", query);
  searchUrl.searchParams.set("retmax", String(MAX_PUBMED_RESULTS));
  searchUrl.searchParams.set("retmode", "json");
  searchUrl.searchParams.set("sort", "relevance");

  const searchData = await fetchJson(searchUrl);
  const ids = searchData.esearchresult?.idlist || [];
  if (!ids.length) return [];

  const fetchUrl = new URL(`${PUBMED_BASE}/efetch.fcgi`);
  fetchUrl.searchParams.set("db", "pubmed");
  fetchUrl.searchParams.set("id", ids.join(","));
  fetchUrl.searchParams.set("retmode", "xml");

  const xml = await fetchText(fetchUrl);
  const articles = [...xml.matchAll(/<PubmedArticle>([\s\S]*?)<\/PubmedArticle>/gi)].map(
    match => match[1]
  );

  return articles.map(article => {
    const pmid = xmlValue(article, "PMID");
    const publicationTypes = xmlValues(article, "PublicationType");
    const authors = [...article.matchAll(/<Author\b[^>]*>([\s\S]*?)<\/Author>/gi)]
      .map(match => {
        const authorXml = match[1];
        const lastName = xmlValue(authorXml, "LastName");
        const foreName = xmlValue(authorXml, "ForeName") || xmlValue(authorXml, "Initials");
        return [foreName, lastName].filter(Boolean).join(" ");
      })
      .filter(Boolean);
    const year =
      Number(xmlValue(article, "Year")) ||
      Number((xmlValue(article, "MedlineDate").match(/\d{4}/) || [])[0]) ||
      null;
    const doi =
      [...article.matchAll(/<ArticleId IdType="doi">([\s\S]*?)<\/ArticleId>/gi)]
        .map(match => stripTags(match[1]))[0] || null;
    const pmcid =
      [...article.matchAll(/<ArticleId IdType="pmc">([\s\S]*?)<\/ArticleId>/gi)]
        .map(match => stripTags(match[1]))[0] || null;

    return {
      source: "PubMed",
      title: xmlValue(article, "ArticleTitle"),
      year,
      authors,
      journal: xmlValue(article, "Title"),
      abstract: xmlValues(article, "AbstractText").join(" "),
      url: pmid ? `https://pubmed.ncbi.nlm.nih.gov/${pmid}/` : "",
      pmid,
      pmcid,
      doi,
      publicationTypes
    };
  });
}

async function searchSemanticScholar(query) {
  const url = new URL(SEMANTIC_SCHOLAR_SEARCH);
  url.searchParams.set("query", query);
  url.searchParams.set("limit", String(MAX_SEMANTIC_RESULTS));
  url.searchParams.set(
    "fields",
    "paperId,title,abstract,year,venue,url,authors,externalIds,citationCount,publicationTypes"
  );

  const data = await fetchJson(url);
  return (data.data || []).map(paper => {
    const pmcId =
      paper.externalIds?.PMC ||
      paper.externalIds?.PMCID ||
      paper.externalIds?.PubMedCentral ||
      null;
    const pmcid = pmcId ? String(pmcId).trim().replace(/^PMC/i, "PMC") : null;

    return {
      source: "Semantic Scholar",
      title: paper.title,
      year: paper.year || null,
      authors: (paper.authors || []).map(author => author.name).filter(Boolean),
      journal: paper.venue || "",
      abstract: paper.abstract || "",
      url: paper.url || "",
      pmid: paper.externalIds?.PubMed || null,
      pmcid,
      doi: paper.externalIds?.DOI || null,
      semanticScholarId: paper.paperId || null,
      citationCount: paper.citationCount ?? null,
      publicationTypes: paper.publicationTypes || []
    };
  });
}

function fallbackSummary(query, papers, evidenceLevels, errors = []) {
  const counts = evidenceLevels.counts;
  const strongest =
    counts["meta-analysis"] > 0
      ? "meta-analiz / sistematik derleme"
      : counts.rct > 0
        ? "randomize kontrollü çalışma"
        : counts.cohort > 0
          ? "kohort çalışma"
          : counts.case > 0
            ? "olgu düzeyi kanıt"
            : "sınıflandırılamayan çalışmalar";

  return {
    query,
    totalPapers: papers.length,
    strongestEvidence: strongest,
    conclusion:
      papers.length > 0
        ? `${papers.length} çalışma bulundu. En güçlü mevcut kanıt kategorisi: ${strongest}.`
        : "PubMed ve Semantic Scholar aramasında uygun çalışma bulunamadı.",
    limitations: [
      "Bu sınıflandırma başlık, özet ve yayın tipi alanlarından otomatik çıkarılmıştır.",
      "Tam metin kalite değerlendirmesi, bias riski ve GRADE analizi ayrıca yapılmalıdır.",
      ...errors
    ]
  };
}

async function analyzeWithDeepSeek(query, papers, evidenceLevels, errors = []) {
  if (!llm) return fallbackSummary(query, papers, evidenceLevels, errors);

  const compactPapers = papers.slice(0, 16).map((paper, index) => ({
    index: index + 1,
    title: paper.title,
    year: paper.year,
    source: paper.source,
    journal: paper.journal,
    publicationTypes: paper.publicationTypes,
    evidenceLevel: paper.evidenceLevel,
    abstract: paper.abstract?.slice(0, 1200)
  }));

  const response = await llm.invoke([
    new SystemMessage(
      `Klinik akademik literatür analiz uzmanısın. Yanıtı sadece geçerli JSON olarak döndür.
Kanıt hiyerarşisi: meta-analysis > rct > cohort > case > other.`
    ),
    new HumanMessage(
      JSON.stringify({
        task:
          "Bu arama sonuçlarını kanıt düzeyine göre analiz et. Kısa, klinik odaklı ve ihtiyatlı ol.",
        query,
        evidenceLevels: evidenceLevels.counts,
        papers: compactPapers,
        requiredOutput: {
          totalPapers: "number",
          strongestEvidence: "string",
          conclusion: "string",
          keyFindings: ["string"],
          limitations: ["string"],
          recommendedReadingOrder: ["paper index or title"]
        }
      })
    )
  ]);

  const parsed = safeJsonParse(response.content);
  return parsed || {
    ...fallbackSummary(query, papers, evidenceLevels, errors),
    raw: response.content
  };
}

export async function run(input) {
  const query =
    typeof input === "string"
      ? input
      : input?.query || input?.message || input?.text || "";

  if (!query.trim()) {
    return {
      success: false,
      papers: [],
      summary: "Arama sorgusu boş.",
      evidenceLevels: evidenceSummary([])
    };
  }

  const [pubmedResult, semanticResult] = await Promise.allSettled([
    searchPubMed(query),
    searchSemanticScholar(query)
  ]);

  const errors = [];
  if (pubmedResult.status === "rejected") {
    errors.push(`PubMed hatası: ${pubmedResult.reason.message}`);
  }
  if (semanticResult.status === "rejected") {
    errors.push(`Semantic Scholar hatası: ${semanticResult.reason.message}`);
  }

  const papers = dedupePapers([
    ...(pubmedResult.status === "fulfilled" ? pubmedResult.value : []),
    ...(semanticResult.status === "fulfilled" ? semanticResult.value : [])
  ]);
  const evidenceLevels = evidenceSummary(papers);
  const libraryContext = await getLibraryContext({ query }).catch(() => null);

  try {
    const summary = await analyzeWithDeepSeek(query, papers, evidenceLevels, errors);
    return {
      success: errors.length < 2,
      papers,
      summary,
      evidenceLevels,
      libraryContext
    };
  } catch (err) {
    return {
      success: errors.length < 2,
      papers,
      summary: fallbackSummary(query, papers, evidenceLevels, [
        ...errors,
        `DeepSeek analiz hatası: ${err.message}`
      ]),
      evidenceLevels,
      libraryContext
    };
  }
}

export default { run };
