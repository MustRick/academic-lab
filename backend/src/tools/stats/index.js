/**
 * SPSS-equivalent Statistics Library
 * LangGraph tool formatında — DeepSeek doğrudan çağırabilir
 *
 * Kullanım:
 *   import { statisticsTools, runStatTool } from "./tools/stats/index.js";
 *
 * LangGraph agent'a bağlamak için:
 *   const tools = statisticsTools;
 *   const agent = createReactAgent({ llm, tools, prompt: ... });
 */

import { tool } from "@langchain/core/tools";
import { z } from "zod";

import { descriptiveStats }                        from "./descriptive.js";
import { shapiroWilk, kolmogorovSmirnov }          from "./normality.js";
import { independentTTest, pairedTTest,
         mannWhitneyU, oneWayANOVA,
         kruskalWallis }                           from "./comparison.js";
import { chiSquare, fisherExact, mcNemar }         from "./categorical.js";
import { pearsonCorrelation, spearmanCorrelation,
         linearRegression, logisticRegression }    from "./correlation.js";
import { kaplanMeier, logRankTest, coxRegression } from "./survival.js";

// ── LangGraph Tool Tanımları ──────────────────────────────────────────────────

export const statisticsTools = [

  // 1. Tanımlayıcı İstatistik
  tool(
    ({ data }) => JSON.stringify(descriptiveStats(data)),
    {
      name: "descriptive_stats",
      description: "Tanımlayıcı istatistik hesapla: mean, median, SD, IQR, min, max, skewness, kurtosis, %95 CI. SPSS: Analyze → Descriptive Statistics.",
      schema: z.object({
        data: z.array(z.number()).describe("Sayısal veri dizisi")
      })
    }
  ),

  // 2. Shapiro-Wilk
  tool(
    ({ data }) => JSON.stringify(shapiroWilk(data)),
    {
      name: "shapiro_wilk",
      description: "Shapiro-Wilk normallik testi. n≤50 için önerilir. Normal dağılım var mı? SPSS: Analyze → Explore → Normality Tests.",
      schema: z.object({
        data: z.array(z.number()).describe("Test edilecek veri dizisi")
      })
    }
  ),

  // 3. Kolmogorov-Smirnov
  tool(
    ({ data }) => JSON.stringify(kolmogorovSmirnov(data)),
    {
      name: "kolmogorov_smirnov",
      description: "Kolmogorov-Smirnov normallik testi (Lilliefors düzeltmeli). Büyük örnekler için.",
      schema: z.object({
        data: z.array(z.number()).describe("Test edilecek veri dizisi")
      })
    }
  ),

  // 4. Bağımsız t-testi
  tool(
    ({ group1, group2 }) => JSON.stringify(independentTTest(group1, group2)),
    {
      name: "independent_t_test",
      description: "Bağımsız örneklem t-testi (Welch veya pooled). İki grup ortalama karşılaştırması. Parametrik. SPSS: Analyze → Compare Means → Independent Samples T Test.",
      schema: z.object({
        group1: z.array(z.number()).describe("Birinci grup verileri"),
        group2: z.array(z.number()).describe("İkinci grup verileri")
      })
    }
  ),

  // 5. Eşleştirilmiş t-testi
  tool(
    ({ before, after }) => JSON.stringify(pairedTTest(before, after)),
    {
      name: "paired_t_test",
      description: "Eşleştirilmiş (bağımlı) t-testi. Aynı grupta öncesi-sonrası karşılaştırma. SPSS: Paired Samples T Test.",
      schema: z.object({
        before: z.array(z.number()).describe("Ölçüm öncesi verileri"),
        after:  z.array(z.number()).describe("Ölçüm sonrası verileri")
      })
    }
  ),

  // 6. Mann-Whitney U
  tool(
    ({ group1, group2 }) => JSON.stringify(mannWhitneyU(group1, group2)),
    {
      name: "mann_whitney_u",
      description: "Mann-Whitney U testi. Non-parametrik iki grup karşılaştırması. Normal dağılım yoksa t-testi yerine kullan. SPSS: Nonparametric → Independent Samples.",
      schema: z.object({
        group1: z.array(z.number()).describe("Birinci grup verileri"),
        group2: z.array(z.number()).describe("İkinci grup verileri")
      })
    }
  ),

  // 7. One-Way ANOVA
  tool(
    ({ groups }) => JSON.stringify(oneWayANOVA(groups)),
    {
      name: "one_way_anova",
      description: "Tek yönlü ANOVA. İkiden fazla grup ortalaması karşılaştırması. Parametrik. SPSS: Analyze → Compare Means → One-Way ANOVA.",
      schema: z.object({
        groups: z.array(z.array(z.number())).describe("Her grup için veri dizisi: [[g1], [g2], [g3]]")
      })
    }
  ),

  // 8. Kruskal-Wallis
  tool(
    ({ groups }) => JSON.stringify(kruskalWallis(groups)),
    {
      name: "kruskal_wallis",
      description: "Kruskal-Wallis H testi. Non-parametrik çoklu grup karşılaştırması. ANOVA alternatifi. SPSS: Nonparametric → K Independent Samples.",
      schema: z.object({
        groups: z.array(z.array(z.number())).describe("Her grup için veri dizisi: [[g1], [g2], [g3]]")
      })
    }
  ),

  // 9. Chi-Square
  tool(
    ({ observed }) => JSON.stringify(chiSquare(observed)),
    {
      name: "chi_square",
      description: "Ki-kare bağımsızlık testi. Kategorik değişkenler arası ilişki. SPSS: Analyze → Descriptive Statistics → Crosstabs.",
      schema: z.object({
        observed: z.array(z.array(z.number())).describe("Gözlenen frekans tablosu: [[a,b],[c,d]]")
      })
    }
  ),

  // 10. Fisher Exact
  tool(
    ({ a, b, c, d }) => JSON.stringify(fisherExact(a, b, c, d)),
    {
      name: "fisher_exact",
      description: "Fisher's Exact testi. 2x2 tablo, beklenen frekans < 5 olduğunda chi-square yerine kullan. SPSS: Crosstabs → Exact.",
      schema: z.object({
        a: z.number().describe("Sol üst hücre"),
        b: z.number().describe("Sağ üst hücre"),
        c: z.number().describe("Sol alt hücre"),
        d: z.number().describe("Sağ alt hücre")
      })
    }
  ),

  // 11. McNemar
  tool(
    ({ before, after }) => JSON.stringify(mcNemar(before, after)),
    {
      name: "mcnemar",
      description: "McNemar testi. Eşleştirilmiş kategorik veriler. Öncesi-sonrası oran karşılaştırması. SPSS: Nonparametric → 2 Related Samples.",
      schema: z.object({
        before: z.array(z.number()).describe("Önceki ölçümler [0 veya 1]"),
        after:  z.array(z.number()).describe("Sonraki ölçümler [0 veya 1]")
      })
    }
  ),

  // 12. Pearson Korelasyon
  tool(
    ({ x, y }) => JSON.stringify(pearsonCorrelation(x, y)),
    {
      name: "pearson_correlation",
      description: "Pearson r korelasyon katsayısı. Sürekli değişkenler arası lineer ilişki. Normal dağılım varsayımı var. SPSS: Analyze → Correlate → Bivariate.",
      schema: z.object({
        x: z.array(z.number()).describe("Birinci değişken"),
        y: z.array(z.number()).describe("İkinci değişken")
      })
    }
  ),

  // 13. Spearman Korelasyon
  tool(
    ({ x, y }) => JSON.stringify(spearmanCorrelation(x, y)),
    {
      name: "spearman_correlation",
      description: "Spearman ρ sıra korelasyonu. Non-parametrik korelasyon. Normal dağılım yoksa Pearson yerine kullan. SPSS: Analyze → Correlate → Bivariate (Spearman).",
      schema: z.object({
        x: z.array(z.number()).describe("Birinci değişken"),
        y: z.array(z.number()).describe("İkinci değişken")
      })
    }
  ),

  // 14. Lineer Regresyon
  tool(
    ({ x, y }) => JSON.stringify(linearRegression(x, y)),
    {
      name: "linear_regression",
      description: "Basit lineer regresyon. Sürekli bağımlı değişken tahmini. R², β katsayıları, F testi. SPSS: Analyze → Regression → Linear.",
      schema: z.object({
        x: z.array(z.number()).describe("Bağımsız değişken (predictor)"),
        y: z.array(z.number()).describe("Bağımlı değişken (outcome)")
      })
    }
  ),

  // 15. Lojistik Regresyon
  tool(
    ({ X, y }) => JSON.stringify(logisticRegression(X, y)),
    {
      name: "logistic_regression",
      description: "Binary lojistik regresyon. İkili bağımlı değişken (0/1). OR, %95 CI, Nagelkerke R². SPSS: Analyze → Regression → Binary Logistic.",
      schema: z.object({
        X: z.array(z.array(z.number())).describe("Bağımsız değişkenler matrisi: [[x1,x2], [x1,x2], ...]"),
        y: z.array(z.number()).describe("Bağımlı değişken [0 veya 1]")
      })
    }
  ),

  // 16. Kaplan-Meier
  tool(
    ({ times, events, groupLabel }) => JSON.stringify(kaplanMeier(times, events, groupLabel)),
    {
      name: "kaplan_meier",
      description: "Kaplan-Meier sağkalım analizi. Medyan sağkalım, sağkalım tablosu, %95 CI. SPSS: Analyze → Survival → Kaplan-Meier.",
      schema: z.object({
        times:      z.array(z.number()).describe("Sağkalım süreleri (gün/ay/yıl)"),
        events:     z.array(z.number()).describe("Olay göstergesi: 1=olay, 0=sansürlü"),
        groupLabel: z.string().optional().describe("Grup adı")
      })
    }
  ),

  // 17. Log-rank Testi
  tool(
    ({ times1, events1, times2, events2 }) =>
      JSON.stringify(logRankTest(times1, events1, times2, events2)),
    {
      name: "log_rank_test",
      description: "Log-rank testi. İki Kaplan-Meier eğrisini karşılaştırır. SPSS: Kaplan-Meier → Compare Factor Levels.",
      schema: z.object({
        times1:  z.array(z.number()).describe("Grup 1 sağkalım süreleri"),
        events1: z.array(z.number()).describe("Grup 1 olay göstergesi"),
        times2:  z.array(z.number()).describe("Grup 2 sağkalım süreleri"),
        events2: z.array(z.number()).describe("Grup 2 olay göstergesi")
      })
    }
  ),

  // 18. Cox Regresyon
  tool(
    ({ times, events, covariate }) =>
      JSON.stringify(coxRegression(times, events, covariate)),
    {
      name: "cox_regression",
      description: "Cox proportional hazards regresyon. Hazard ratio (HR) ve %95 CI. Sağkalıma etki eden faktör analizi. SPSS: Analyze → Survival → Cox Regression.",
      schema: z.object({
        times:     z.array(z.number()).describe("Sağkalım süreleri"),
        events:    z.array(z.number()).describe("Olay göstergesi: 1=olay, 0=sansürlü"),
        covariate: z.array(z.number()).describe("Kovaryat değerleri")
      })
    }
  )
];

// ── Doğrudan çağrım (agent olmadan) ──────────────────────────────────────────
export async function runStatTool(toolName, params) {
  const t = statisticsTools.find(t => t.name === toolName);
  if (!t) throw new Error(`Bilinmeyen tool: ${toolName}`);
  return JSON.parse(await t.invoke(params));
}

export default statisticsTools;