import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";

import * as XLSX from "xlsx";
import mammoth from "mammoth";
import fs from "fs";
import path from "path";

import {
  dataSchemaPrompt,
  dataParsePrompt,
  dataValidationPrompt
} from "./prompts/data.prompt.js";

const llm = new ChatOpenAI({
  model: "deepseek-v4-flash",
  temperature: 0,
  apiKey: process.env.DEEPSEEK_API_KEY,
  configuration: { baseURL: process.env.DEEPSEEK_BASE_URL }
});

// Vision için OpenAI gpt-4o
const visionLlm = new ChatOpenAI({
  model: "gpt-4o",
  temperature: 0,
  apiKey: process.env.OPENAI_API_KEY
});

function safeJson(text) {
  try { return JSON.parse(text); } catch {
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) return null;
    try { return JSON.parse(m[0]); } catch { return null; }
  }
}

// ── MOD 1: Sıfırdan portföy şeması oluştur ───────────────────────────────────
export async function createSchema(studyDescription) {
  if (!studyDescription) throw new Error("Çalışma açıklaması gerekli.");

  const response = await llm.invoke([
    new SystemMessage(dataSchemaPrompt),
    new HumanMessage(
      `Bu araştırma için uygun veri portföyü şemasını oluştur:\n\n"${studyDescription}"\n\n` +
      `PICU (Pediatrik Yoğun Bakım) çalışması olduğunu göz önünde bulundur. ` +
      `Standart klinik değişkenleri ve çalışmaya özgü değişkenleri ekle.`
    )
  ]);

  const schema = safeJson(response.content);
  if (!schema) throw new Error("Şema oluşturulamadı.");

  // Varsayılan boş satır ekle
  schema.rows = [];
  schema.createdAt = new Date().toISOString();
  schema.mode = "created";

  return { success: true, schema };
}

// ── MOD 2a: Excel/CSV parse ───────────────────────────────────────────────────
export async function parseExcel(filePath) {
  const ext = path.extname(filePath).toLowerCase();

  let workbook;
  if (ext === ".csv") {
    const csvContent = fs.readFileSync(filePath, "utf-8");
    workbook = XLSX.read(csvContent, { type: "string" });
  } else {
    workbook = XLSX.readFile(filePath);
  }

  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rawData = XLSX.utils.sheet_to_json(sheet, { defval: null });

  if (rawData.length === 0) throw new Error("Dosyada veri bulunamadı.");

  // Kolon tiplerini otomatik tahmin et
  const columns = Object.keys(rawData[0]);
  const detectedTypes = {};

  for (const col of columns) {
    const values = rawData.map(r => r[col]).filter(v => v !== null);
    if (values.length === 0) { detectedTypes[col] = "string"; continue; }

    const numericCount = values.filter(v => !isNaN(Number(v))).length;
    const uniqueCount  = new Set(values).size;

    if (numericCount / values.length > 0.8) {
      detectedTypes[col] = "number";
    } else if (uniqueCount <= 10 && values.length > 10) {
      detectedTypes[col] = "category";
    } else {
      detectedTypes[col] = "string";
    }
  }

  // Schema formatına dönüştür
  const schema = {
    studyTitle:  "İçe Aktarılan Veri",
    studyType:   "retrospektif",
    columns: columns.map(col => ({
      key:      _toSnakeCase(col),
      label:    col,
      type:     detectedTypes[col],
      required: false,
      options:  detectedTypes[col] === "category"
        ? [...new Set(rawData.map(r => r[col]).filter(Boolean))].slice(0, 20)
        : undefined
    })),
    rows:      rawData.map(row => {
      const newRow = {};
      for (const col of columns) {
        newRow[_toSnakeCase(col)] = row[col];
      }
      return newRow;
    }),
    createdAt: new Date().toISOString(),
    mode:      "imported"
  };

  return { success: true, schema, rowCount: rawData.length };
}

// ── MOD 2b: Word/PDF metin parse ─────────────────────────────────────────────
export async function parseDocument(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  let text = "";

  if (ext === ".docx") {
    const result = await mammoth.extractRawText({ path: filePath });
    text = result.value;
  } else if (ext === ".txt") {
    text = fs.readFileSync(filePath, "utf-8");
  } else {
    throw new Error(`${ext} formatı için pdf-parse veya Vision kullanın.`);
  }

  if (!text.trim()) throw new Error("Dosyadan metin çıkarılamadı.");

  const response = await llm.invoke([
    new SystemMessage(dataParsePrompt),
    new HumanMessage(
      `Aşağıdaki metinden veri tablosunu çıkar:\n\n${text.slice(0, 8000)}`
    )
  ]);

  const parsed = safeJson(response.content);
  if (!parsed) throw new Error("Belge parse edilemedi.");

  const schema = {
    studyTitle: "Belgeden Çıkarılan Veri",
    studyType:  "retrospektif",
    columns: parsed.columns.map(col => ({
      key:      _toSnakeCase(col),
      label:    col,
      type:     parsed.detectedTypes?.[col] || "string",
      required: false
    })),
    rows:      parsed.rows.map(row => {
      const newRow = {};
      for (const col of parsed.columns) {
        newRow[_toSnakeCase(col)] = row[col] ?? null;
      }
      return newRow;
    }),
    createdAt: new Date().toISOString(),
    mode:      "parsed_document"
  };

  return { success: true, schema, rowCount: parsed.rows.length };
}

// ── MOD 2c: Görüntü/Fotoğraf (Vision) parse ──────────────────────────────────
export async function parseImage(filePath) {
  const ext     = path.extname(filePath).toLowerCase();
  const allowed = [".jpg", ".jpeg", ".png", ".webp", ".gif"];
  if (!allowed.includes(ext)) throw new Error("Desteklenmeyen görüntü formatı.");

  const imageBuffer  = fs.readFileSync(filePath);
  const base64Image  = imageBuffer.toString("base64");
  const mediaTypeMap = {
    ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
    ".png": "image/png",  ".webp": "image/webp", ".gif": "image/gif"
  };
  const mediaType = mediaTypeMap[ext];

  const response = await visionLlm.invoke([
    new HumanMessage({
      content: [
        {
          type: "image_url",
          image_url: { url: `data:${mediaType};base64,${base64Image}` }
        },
        {
          type: "text",
          text: `Bu görüntüdeki tablo veya veriyi JSON formatında çıkar.\n\n${dataParsePrompt}`
        }
      ]
    })
  ]);

  const parsed = safeJson(response.content);
  if (!parsed) throw new Error("Görüntüden veri çıkarılamadı.");

  const schema = {
    studyTitle: "Görüntüden Çıkarılan Veri",
    studyType:  "retrospektif",
    columns: (parsed.columns || []).map(col => ({
      key:      _toSnakeCase(col),
      label:    col,
      type:     parsed.detectedTypes?.[col] || "string",
      required: false
    })),
    rows: (parsed.rows || []).map(row => {
      const newRow = {};
      for (const col of parsed.columns || []) {
        newRow[_toSnakeCase(col)] = row[col] ?? null;
      }
      return newRow;
    }),
    createdAt: new Date().toISOString(),
    mode:      "parsed_image"
  };

  return { success: true, schema, rowCount: parsed.rows?.length || 0 };
}

// ── MOD 3: Veri doğrulama ─────────────────────────────────────────────────────
export async function validateData(schema) {
  const { columns, rows } = schema;

  if (!rows || rows.length === 0) {
    return {
      success: true,
      validation: {
        totalRows: 0,
        issues: [],
        summary: { readyForAnalysis: false, message: "Veri girilmemiş." }
      }
    };
  }

  // Temel validasyonları JS'de yap (LLM'e gitme)
  const issues = [];
  const missingByColumn = {};

  for (const col of columns) {
    const values    = rows.map(r => r[col.key]);
    const nullCount = values.filter(v => v === null || v === undefined || v === "").length;
    missingByColumn[col.key] = nullCount / rows.length;

    if (missingByColumn[col.key] > 0.2) {
      issues.push({
        column:      col.key,
        type:        "missing",
        severity:    missingByColumn[col.key] > 0.5 ? "error" : "warning",
        message:     `%${Math.round(missingByColumn[col.key] * 100)} eksik veri`,
        affectedRows: values.map((v, i) => (v === null || v === "" ? i : -1)).filter(i => i >= 0)
      });
    }

    // Sayısal outlier (±3 SD)
    if (col.type === "number") {
      const nums = values.filter(v => v !== null && !isNaN(Number(v))).map(Number);
      if (nums.length > 5) {
        const mean = nums.reduce((a, b) => a + b, 0) / nums.length;
        const sd   = Math.sqrt(nums.reduce((s, v) => s + (v - mean) ** 2, 0) / nums.length);
        const outlierRows = values.map((v, i) => (Math.abs(Number(v) - mean) > 3 * sd ? i : -1)).filter(i => i >= 0);
        if (outlierRows.length > 0) {
          issues.push({
            column:      col.key,
            type:        "outlier",
            severity:    "warning",
            message:     `${outlierRows.length} aykırı değer (±3 SD)`,
            affectedRows: outlierRows
          });
        }
      }

      // Min/max kontrolü
      if (col.min !== undefined || col.max !== undefined) {
        const outOfRange = values.map((v, i) => {
          const n = Number(v);
          if (isNaN(n)) return -1;
          if (col.min !== undefined && n < col.min) return i;
          if (col.max !== undefined && n > col.max) return i;
          return -1;
        }).filter(i => i >= 0);

        if (outOfRange.length > 0) {
          issues.push({
            column:      col.key,
            type:        "logic_error",
            severity:    "error",
            message:     `Geçersiz değer: min=${col.min}, max=${col.max}`,
            affectedRows: outOfRange
          });
        }
      }
    }
  }

  const errorCount   = issues.filter(i => i.severity === "error").length;
  const warningCount = issues.filter(i => i.severity === "warning").length;

  return {
    success: true,
    validation: {
      totalRows: rows.length,
      issues,
      summary: {
        missingByColumn,
        errorCount,
        warningCount,
        readyForAnalysis: errorCount === 0,
        message: errorCount > 0
          ? `${errorCount} hata düzeltilmeli`
          : warningCount > 0
          ? `${warningCount} uyarı var, analiz başlatılabilir`
          : "Veri temiz, analiz için hazır"
      }
    }
  };
}

// ── MOD 4: Analize gönder — statistics.agent için payload hazırla ─────────────
export function prepareForAnalysis(schema) {
  const { columns, rows } = schema;

  if (!rows || rows.length === 0) {
    return { success: false, message: "Veri yok." };
  }

  // Her kolon için veri dizisi çıkar
  const columnData = {};
  for (const col of columns) {
    columnData[col.key] = {
      label:  col.label,
      type:   col.type,
      values: rows.map(r => r[col.key] ?? null),
      options: col.options || null
    };
  }

  // Gruplama önerileri (category kolonları)
  const groupCandidates = columns
    .filter(c => c.type === "category" || c.type === "boolean")
    .map(c => c.key);

  // Outcome adayları (number kolonları)
  const outcomeCandidates = columns
    .filter(c => c.type === "number")
    .map(c => c.key);

  return {
    success:          true,
    studyTitle:       schema.studyTitle,
    studyType:        schema.studyType,
    n:                rows.length,
    columnData,
    groupCandidates,
    outcomeCandidates,
    readyAt:          new Date().toISOString()
  };
}

// ── Ana run fonksiyonu (Express controller için) ──────────────────────────────
export async function run(input) {
  const { mode, studyDescription, filePath, schema } = input;

  switch (mode) {
    case "create":
      return createSchema(studyDescription);

    case "excel":
    case "csv":
      return parseExcel(filePath);

    case "document":
    case "word":
    case "pdf":
      return parseDocument(filePath);

    case "image":
    case "photo":
      return parseImage(filePath);

    case "validate":
      return validateData(schema);

    case "prepare":
      return prepareForAnalysis(schema);

    default:
      return { success: false, message: `Bilinmeyen mod: ${mode}` };
  }
}

// ── Yardımcı ─────────────────────────────────────────────────────────────────
function _toSnakeCase(str) {
  return String(str)
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_çğışöü]/g, "")
    .slice(0, 40);
}

export default { run, createSchema, parseExcel, parseDocument, parseImage, validateData, prepareForAnalysis };