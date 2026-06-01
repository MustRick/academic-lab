import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";

import { statsDecisionPrompt, statsInterpretPrompt } from "./prompts/statistics.prompt.js";
import { runStatTool } from "../tools/stats/index.js";
import { shapiroWilk } from "../tools/stats/normality.js";

const llm = new ChatOpenAI({
  model: "deepseek-v4-flash",
  temperature: 0,
  apiKey: process.env.DEEPSEEK_API_KEY,
  configuration: { baseURL: process.env.DEEPSEEK_BASE_URL }
});

function safeJson(text) {
  try { return JSON.parse(text); } catch {
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) return null;
    try { return JSON.parse(m[0]); } catch { return null; }
  }
}

// ── ADIM 1: Normallik testlerini otomatik çalıştır ────────────────────────────
function runNormalityChecks(columnData) {
  const results = {};
  for (const [key, col] of Object.entries(columnData)) {
    if (col.type !== "number") continue;
    const nums = col.values.filter(v => v !== null && !isNaN(Number(v))).map(Number);
    if (nums.length < 3) {
      results[key] = { tested: false, reason: "n < 3" };
      continue;
    }
    try {
      const sw = shapiroWilk(nums);
      results[key] = {
        tested:  true,
        W:       sw.W,
        pValue:  sw.pValue,
        normal:  sw.normal,
        n:       nums.length,
        label:   col.label
      };
    } catch {
      results[key] = { tested: false, reason: "test hatası" };
    }
  }
  return results;
}

// ── ADIM 2: LLM'den test önerisi al ──────────────────────────────────────────
export async function recommendTests(payload) {
  const { columnData, n, studyType, groupCandidates, outcomeCandidates } = payload;

  // Normallik testlerini çalıştır
  const normalityResults = runNormalityChecks(columnData);

  // Kolon özetini hazırla
  const columnSummary = Object.entries(columnData).map(([key, col]) => ({
    key,
    label:    col.label,
    type:     col.type,
    n:        col.values.filter(v => v !== null).length,
    unique:   col.type === "category" ? [...new Set(col.values.filter(Boolean))].length : null,
    options:  col.options,
    normality: normalityResults[key] || null
  }));

  const response = await llm.invoke([
    new SystemMessage(statsDecisionPrompt),
    new HumanMessage(
      `Veri yapısı:\n` +
      `- n = ${n}\n` +
      `- Çalışma tipi: ${studyType}\n` +
      `- Grup kolonları: ${groupCandidates.join(", ") || "yok"}\n` +
      `- Outcome kolonları: ${outcomeCandidates.join(", ") || "yok"}\n\n` +
      `Kolonlar:\n${JSON.stringify(columnSummary, null, 2)}\n\n` +
      `Normallik sonuçları:\n${JSON.stringify(normalityResults, null, 2)}`
    )
  ]);

  const recommendation = safeJson(response.content);
  if (!recommendation) throw new Error("Test önerisi alınamadı.");

  return {
    success:          true,
    normalityResults,
    recommendation,
    awaitingApproval: true   // kullanıcı onayı bekleniyor
  };
}

// ── ADIM 3: Onaylanan testleri çalıştır ──────────────────────────────────────
export async function runApprovedTests(payload, approvedTests) {
  const { columnData } = payload;
  const results = [];

  for (const test of approvedTests) {
    try {
      const result = await _executeTest(test, columnData);
      const interpretation = await _interpretResult(result, test);

      results.push({
        testName:       test.testName,
        displayName:    test.displayName,
        columns:        test.columns,
        result,
        interpretation,
        status:         "completed"
      });
    } catch (err) {
      results.push({
        testName:    test.testName,
        displayName: test.displayName,
        status:      "error",
        error:       err.message
      });
    }
  }

  return {
    success:    true,
    studyTitle: payload.studyTitle,
    n:          payload.n,
    results,
    completedAt: new Date().toISOString()
  };
}

// ── ADIM 4: Tek test çalıştır ─────────────────────────────────────────────────
async function _executeTest(test, columnData) {
  const { testName, columns } = test;

  const getValues = key =>
    columnData[key]?.values
      .filter(v => v !== null && v !== undefined)
      .map(v => (columnData[key].type === "number" ? Number(v) : v)) || [];

  switch (testName) {

    case "descriptive_stats": {
      const vals = getValues(columns.outcome || columns.variable);
      return runStatTool("descriptive_stats", { data: vals });
    }

    case "shapiro_wilk": {
      const vals = getValues(columns.variable);
      return runStatTool("shapiro_wilk", { data: vals });
    }

    case "kolmogorov_smirnov": {
      const vals = getValues(columns.variable);
      return runStatTool("kolmogorov_smirnov", { data: vals });
    }

    case "independent_t_test":
    case "mann_whitney_u": {
      const groupCol   = columnData[columns.group];
      const outcomeCol = columnData[columns.outcome];
      const groups     = [...new Set(groupCol.values.filter(Boolean))].slice(0, 2);

      if (groups.length < 2) throw new Error("Grup kolonu en az 2 değer içermeli.");

      const g1 = groupCol.values
        .map((v, i) => (v === groups[0] ? Number(outcomeCol.values[i]) : null))
        .filter(v => v !== null && !isNaN(v));
      const g2 = groupCol.values
        .map((v, i) => (v === groups[1] ? Number(outcomeCol.values[i]) : null))
        .filter(v => v !== null && !isNaN(v));

      return runStatTool(testName, { group1: g1, group2: g2 });
    }

    case "paired_t_test": {
      const before = getValues(columns.before);
      const after  = getValues(columns.after);
      return runStatTool("paired_t_test", { before, after });
    }

    case "one_way_anova":
    case "kruskal_wallis": {
      const groupCol   = columnData[columns.group];
      const outcomeCol = columnData[columns.outcome];
      const groups     = [...new Set(groupCol.values.filter(Boolean))];

      const groupArrays = groups.map(g =>
        groupCol.values
          .map((v, i) => (v === g ? Number(outcomeCol.values[i]) : null))
          .filter(v => v !== null && !isNaN(v))
      );

      return runStatTool(testName, { groups: groupArrays });
    }

    case "chi_square": {
      // 2x2 kontenjans tablosu oluştur
      const rowCol = columnData[columns.row];
      const colCol = columnData[columns.col];
      const rowCats = [...new Set(rowCol.values.filter(Boolean))].slice(0, 10);
      const colCats = [...new Set(colCol.values.filter(Boolean))].slice(0, 10);

      const observed = rowCats.map(r =>
        colCats.map(c =>
          rowCol.values.filter((v, i) => v === r && colCol.values[i] === c).length
        )
      );

      return runStatTool("chi_square", { observed });
    }

    case "fisher_exact": {
      const rowCol = columnData[columns.row];
      const colCol = columnData[columns.col];
      const rowCats = [...new Set(rowCol.values.filter(Boolean))].slice(0, 2);
      const colCats = [...new Set(colCol.values.filter(Boolean))].slice(0, 2);

      const a = rowCol.values.filter((v, i) => v === rowCats[0] && colCol.values[i] === colCats[0]).length;
      const b = rowCol.values.filter((v, i) => v === rowCats[0] && colCol.values[i] === colCats[1]).length;
      const c = rowCol.values.filter((v, i) => v === rowCats[1] && colCol.values[i] === colCats[0]).length;
      const d = rowCol.values.filter((v, i) => v === rowCats[1] && colCol.values[i] === colCats[1]).length;

      return runStatTool("fisher_exact", { a, b, c, d });
    }

    case "pearson_correlation":
    case "spearman_correlation": {
      const x = getValues(columns.x);
      const y = getValues(columns.y);
      return runStatTool(testName, { x, y });
    }

    case "linear_regression": {
      const x = getValues(columns.predictor);
      const y = getValues(columns.outcome);
      return runStatTool("linear_regression", { x, y });
    }

    case "logistic_regression": {
      const predictors = Array.isArray(columns.predictors)
        ? columns.predictors
        : [columns.predictor];
      const X = columnData[predictors[0]].values.map((_, i) =>
        predictors.map(p => Number(columnData[p].values[i]))
      ).filter(row => row.every(v => !isNaN(v)));

      const y = getValues(columns.outcome).map(v => Number(v));
      return runStatTool("logistic_regression", { X, y });
    }

    case "kaplan_meier": {
      const times  = getValues(columns.time);
      const events = getValues(columns.event);
      return runStatTool("kaplan_meier", { times, events, groupLabel: columns.groupLabel || "Tüm hastalar" });
    }

    case "log_rank_test": {
      const groupCol  = columnData[columns.group];
      const timeCol   = columnData[columns.time];
      const eventCol  = columnData[columns.event];
      const groups    = [...new Set(groupCol.values.filter(Boolean))].slice(0, 2);

      const times1  = groupCol.values.map((v, i) => v === groups[0] ? Number(timeCol.values[i])  : null).filter(v => v !== null);
      const events1 = groupCol.values.map((v, i) => v === groups[0] ? Number(eventCol.values[i]) : null).filter(v => v !== null);
      const times2  = groupCol.values.map((v, i) => v === groups[1] ? Number(timeCol.values[i])  : null).filter(v => v !== null);
      const events2 = groupCol.values.map((v, i) => v === groups[1] ? Number(eventCol.values[i]) : null).filter(v => v !== null);

      return runStatTool("log_rank_test", { times1, events1, times2, events2 });
    }

    case "cox_regression": {
      const times     = getValues(columns.time);
      const events    = getValues(columns.event);
      const covariate = getValues(columns.covariate);
      return runStatTool("cox_regression", { times, events, covariate });
    }

    default:
      throw new Error(`Bilinmeyen test: ${testName}`);
  }
}

// ── ADIM 5: Sonucu yorumla ────────────────────────────────────────────────────
async function _interpretResult(result, test) {
  const response = await llm.invoke([
    new SystemMessage(statsInterpretPrompt),
    new HumanMessage(
      `Test: ${test.displayName}\n` +
      `Sonuç: ${JSON.stringify(result, null, 2)}`
    )
  ]);

  return safeJson(response.content) || { raw: response.content };
}

// ── Ana run fonksiyonu ────────────────────────────────────────────────────────
export async function run(input) {
  const { mode, payload, approvedTests } = input;

  switch (mode) {
    // Mod 1: Test öner (kullanıcı onayı bekleniyor)
    case "recommend":
      return recommendTests(payload);

    // Mod 2: Onaylanan testleri çalıştır
    case "run":
      if (!approvedTests || approvedTests.length === 0) {
        return { success: false, message: "Onaylanmış test yok." };
      }
      return runApprovedTests(payload, approvedTests);

    // Mod 3: Tek test çalıştır (direkt)
    case "single": {
      const { testName, columns, columnData } = input;
      const fakeTest = { testName, displayName: testName, columns };
      const result   = await _executeTest(fakeTest, columnData);
      const interp   = await _interpretResult(result, fakeTest);
      return { success: true, testName, result, interpretation: interp };
    }

    default:
      return { success: false, message: `Bilinmeyen mod: ${mode}` };
  }
}

export default { run, recommendTests, runApprovedTests };