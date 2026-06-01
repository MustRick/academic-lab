import * as ss from "simple-statistics";

/**
 * Normallik Testleri
 * SPSS karşılığı: Analyze → Descriptive Statistics → Explore → Normality Tests
 */

// ── Shapiro-Wilk (n ≤ 50 için güvenilir) ─────────────────────────────────────
export function shapiroWilk(data) {
  const arr = data.filter(v => v !== null && v !== undefined && !isNaN(v));
  const n = arr.length;

  if (n < 3)  throw new Error("Shapiro-Wilk için minimum 3 gözlem gerekli.");
  if (n > 5000) throw new Error("n > 5000 için K-S veya Anderson-Darling kullanın.");

  const sorted = [...arr].sort((a, b) => a - b);
  const mean = ss.mean(arr);

  // Shapiro-Wilk W istatistiği — Royston (1992) yaklaşımı
  const W = _computeW(sorted, n);
  const { statistic: zScore, pValue } = _roystonApprox(W, n);

  return {
    test:      "Shapiro-Wilk",
    n,
    W:         round(W),
    pValue:    round(pValue, 4),
    zScore:    round(zScore, 4),
    normal:    pValue > 0.05,
    interpret: pValue > 0.05
      ? `p=${round(pValue, 3)} > 0.05 → Normal dağılım REDDEDİLEMEZ`
      : `p=${round(pValue, 3)} < 0.05 → Normal dağılım REDDEDİLİR`,
    recommendation: pValue > 0.05
      ? "Parametrik testler kullanılabilir (t-test, ANOVA)"
      : "Non-parametrik testler önerilir (Mann-Whitney, Kruskal-Wallis)"
  };
}

function _computeW(sorted, n) {
  const mean = sorted.reduce((a, b) => a + b, 0) / n;
  const SS = sorted.reduce((s, x) => s + (x - mean) ** 2, 0);

  // Beklenen normal skor katsayıları (m vektörü)
  const m = sorted.map((_, i) => _normalQuantile((i + 1 - 0.375) / (n + 0.25)));
  const mNorm = Math.sqrt(m.reduce((s, v) => s + v * v, 0));
  const a = m.map(v => v / mNorm);

  // W = (Σ a_i * x_(i))^2 / SS
  const half = Math.floor(n / 2);
  let b = 0;
  for (let i = 0; i < half; i++) {
    b += a[n - 1 - i] * (sorted[n - 1 - i] - sorted[i]);
  }
  return (b * b) / SS;
}

function _roystonApprox(W, n) {
  // Royston (1992) normal approximation
  const lnW = Math.log(1 - W);
  const lnN = Math.log(n);

  let mu, sigma;
  if (n <= 11) {
    const gamma = -2.273 + 0.459 * lnN;
    mu    = 0;
    sigma = Math.exp(-1.2725 + 1.0521 * lnN);
    const z = (lnW - gamma) / sigma;
    return { statistic: z, pValue: 1 - _normalCDF(z) };
  } else {
    mu    = 0.0038915 * lnN ** 3 - 0.083751 * lnN ** 2 - 0.31082 * lnN - 1.5861;
    sigma = Math.exp(0.0030302 * lnN ** 2 - 0.082676 * lnN - 0.4803);
    const z = (lnW - mu) / sigma;
    return { statistic: z, pValue: 1 - _normalCDF(z) };
  }
}

// ── Kolmogorov-Smirnov (büyük örnekler için) ─────────────────────────────────
export function kolmogorovSmirnov(data) {
  const arr = data.filter(v => v !== null && v !== undefined && !isNaN(v));
  const n = arr.length;

  if (n < 5) throw new Error("K-S testi için minimum 5 gözlem gerekli.");

  const sorted = [...arr].sort((a, b) => a - b);
  const mean = ss.mean(arr);
  const sd   = ss.standardDeviation(arr);

  let Dmax = 0;
  for (let i = 0; i < n; i++) {
    const empirical = (i + 1) / n;
    const theoretical = _normalCDF((sorted[i] - mean) / sd);
    const D = Math.abs(empirical - theoretical);
    if (D > Dmax) Dmax = D;
  }

  // Lilliefors düzeltmeli p değeri yaklaşımı
  const pValue = _lillieforsP(Dmax, n);

  return {
    test:      "Kolmogorov-Smirnov (Lilliefors)",
    n,
    D:         round(Dmax, 4),
    pValue:    round(pValue, 4),
    normal:    pValue > 0.05,
    interpret: pValue > 0.05
      ? `p=${round(pValue, 3)} > 0.05 → Normal dağılım REDDEDİLEMEZ`
      : `p=${round(pValue, 3)} < 0.05 → Normal dağılım REDDEDİLİR`,
  };
}

function _lillieforsP(D, n) {
  // Lilliefors kritik değer tablosu interpolasyonu
  const sqrtN = Math.sqrt(n);
  const T = (D - 0.01) * (sqrtN + 0.12 + 0.11 / sqrtN);
  if (T < 0.302) return 0.20;
  if (T < 0.338) return 0.15;
  if (T < 0.375) return 0.10;
  if (T < 0.430) return 0.05;
  if (T < 0.491) return 0.025;
  if (T < 0.587) return 0.01;
  return 0.001;
}

// ── Yardımcı fonksiyonlar ─────────────────────────────────────────────────────
function _normalCDF(z) {
  return 0.5 * (1 + erf(z / Math.SQRT2));
}

function _normalQuantile(p) {
  // Rational approximation (Abramowitz & Stegun)
  if (p <= 0) return -8;
  if (p >= 1) return  8;
  const a = [2.515517, 0.802853, 0.010328];
  const b = [1.432788, 0.189269, 0.001308];
  const sign = p < 0.5 ? -1 : 1;
  const q = p < 0.5 ? p : 1 - p;
  const t = Math.sqrt(-2 * Math.log(q));
  const num = a[0] + a[1] * t + a[2] * t * t;
  const den = 1 + b[0] * t + b[1] * t * t + b[2] * t * t * t;
  return sign * (t - num / den);
}

function erf(x) {
  const t = 1 / (1 + 0.3275911 * Math.abs(x));
  const poly = t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))));
  const result = 1 - poly * Math.exp(-x * x);
  return x >= 0 ? result : -result;
}

function round(v, d = 4) {
  return Math.round(v * 10 ** d) / 10 ** d;
}