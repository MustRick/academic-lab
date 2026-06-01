import * as ss from "simple-statistics";

/**
 * Karşılaştırma Testleri
 * SPSS karşılığı: Analyze → Compare Means
 */

// ── Bağımsız Örneklem t-testi ─────────────────────────────────────────────────
export function independentTTest(group1, group2) {
  const g1 = clean(group1), g2 = clean(group2);
  const n1 = g1.length, n2 = g2.length;

  if (n1 < 2 || n2 < 2) throw new Error("Her grup için en az 2 gözlem gerekli.");

  const mean1 = ss.mean(g1), mean2 = ss.mean(g2);
  const var1  = ss.variance(g1), var2 = ss.variance(g2);
  const sd1   = Math.sqrt(var1),  sd2 = Math.sqrt(var2);

  // Levene testi yerine F-testi ile varyans homojenliği
  const fStat = var1 > var2 ? var1 / var2 : var2 / var1;
  const equalVar = fStat < 4; // basit kural

  let t, df;
  if (equalVar) {
    // Pooled variance (equal variances assumed)
    const sp2 = ((n1 - 1) * var1 + (n2 - 1) * var2) / (n1 + n2 - 2);
    t  = (mean1 - mean2) / Math.sqrt(sp2 * (1 / n1 + 1 / n2));
    df = n1 + n2 - 2;
  } else {
    // Welch t-testi (equal variances NOT assumed)
    const se = Math.sqrt(var1 / n1 + var2 / n2);
    t  = (mean1 - mean2) / se;
    df = (var1 / n1 + var2 / n2) ** 2 /
         ((var1 / n1) ** 2 / (n1 - 1) + (var2 / n2) ** 2 / (n2 - 1));
  }

  const pValue = 2 * tPValue(Math.abs(t), df);
  const cohensD = (mean1 - mean2) / pooledSD(g1, g2);

  return {
    test:        equalVar ? "Bağımsız t-testi (Equal Variances)" : "Welch t-testi",
    n1, n2,
    mean1:       round(mean1), mean2: round(mean2),
    sd1:         round(sd1),   sd2:   round(sd2),
    meanDiff:    round(mean1 - mean2),
    t:           round(t),
    df:          round(df),
    pValue:      round(pValue, 4),
    significant: pValue < 0.05,
    cohensD:     round(cohensD),
    effectSize:  effectLabel(Math.abs(cohensD)),
    interpret:   `t(${round(df)})=${round(t)}, p=${round(pValue, 3)}${pValue < 0.05 ? " *" : " ns"}`
  };
}

// ── Bağımlı (Eşleştirilmiş) t-testi ──────────────────────────────────────────
export function pairedTTest(before, after) {
  const b = clean(before), a = clean(after);
  if (b.length !== a.length) throw new Error("Grup boyutları eşit olmalı.");
  const n = b.length;
  if (n < 2) throw new Error("En az 2 çift gözlem gerekli.");

  const diffs = b.map((v, i) => v - a[i]);
  const meanD = ss.mean(diffs);
  const sdD   = ss.standardDeviation(diffs);
  const t     = meanD / (sdD / Math.sqrt(n));
  const df    = n - 1;
  const pValue = 2 * tPValue(Math.abs(t), df);
  const cohensD = meanD / sdD;

  return {
    test:        "Eşleştirilmiş t-testi",
    n,
    meanBefore:  round(ss.mean(b)),
    meanAfter:   round(ss.mean(a)),
    meanDiff:    round(meanD),
    sdDiff:      round(sdD),
    t:           round(t),
    df,
    pValue:      round(pValue, 4),
    significant: pValue < 0.05,
    cohensD:     round(cohensD),
    effectSize:  effectLabel(Math.abs(cohensD)),
    interpret:   `t(${df})=${round(t)}, p=${round(pValue, 3)}${pValue < 0.05 ? " *" : " ns"}`
  };
}

// ── Mann-Whitney U testi ──────────────────────────────────────────────────────
export function mannWhitneyU(group1, group2) {
  const g1 = clean(group1), g2 = clean(group2);
  const n1 = g1.length, n2 = g2.length;

  if (n1 < 3 || n2 < 3) throw new Error("Her grup için en az 3 gözlem gerekli.");

  // Rank hesabı
  const all = [...g1.map(v => ({ v, g: 1 })), ...g2.map(v => ({ v, g: 2 }))];
  all.sort((a, b) => a.v - b.v);
  assignRanks(all);

  const R1 = all.filter(x => x.g === 1).reduce((s, x) => s + x.rank, 0);
  const U1 = R1 - n1 * (n1 + 1) / 2;
  const U2 = n1 * n2 - U1;
  const U  = Math.min(U1, U2);

  // Normal yaklaşım (n > 20)
  const meanU  = n1 * n2 / 2;
  const sigmaU = Math.sqrt(n1 * n2 * (n1 + n2 + 1) / 12);
  const z      = (U - meanU) / sigmaU;
  const pValue = 2 * (1 - normalCDF(Math.abs(z)));

  // Rank-biserial korelasyon (etki büyüklüğü)
  const r = 1 - 2 * U / (n1 * n2);

  return {
    test:        "Mann-Whitney U",
    n1, n2,
    median1:     round(ss.median(g1)),
    median2:     round(ss.median(g2)),
    U:           round(U),
    z:           round(z),
    pValue:      round(pValue, 4),
    significant: pValue < 0.05,
    r:           round(r),
    effectSize:  effectLabelR(Math.abs(r)),
    interpret:   `U=${round(U)}, z=${round(z)}, p=${round(pValue, 3)}${pValue < 0.05 ? " *" : " ns"}`
  };
}

// ── One-Way ANOVA ─────────────────────────────────────────────────────────────
export function oneWayANOVA(groups) {
  if (groups.length < 2) throw new Error("En az 2 grup gerekli.");
  const cleaned = groups.map(clean);
  const k = cleaned.length;
  const N = cleaned.reduce((s, g) => s + g.length, 0);

  const grandMean = ss.mean(cleaned.flat());

  const SSB = cleaned.reduce((s, g) => {
    return s + g.length * (ss.mean(g) - grandMean) ** 2;
  }, 0);

  const SSW = cleaned.reduce((s, g) => {
    const m = ss.mean(g);
    return s + g.reduce((s2, v) => s2 + (v - m) ** 2, 0);
  }, 0);

  const dfB  = k - 1;
  const dfW  = N - k;
  const MSB  = SSB / dfB;
  const MSW  = SSW / dfW;
  const F    = MSB / MSW;
  const pValue = fPValue(F, dfB, dfW);
  const etaSq = SSB / (SSB + SSW);

  // Grup istatistikleri
  const groupStats = cleaned.map((g, i) => ({
    group: i + 1,
    n:     g.length,
    mean:  round(ss.mean(g)),
    sd:    round(ss.standardDeviation(g))
  }));

  return {
    test:        "One-Way ANOVA",
    k, N,
    F:           round(F),
    dfBetween:   dfB,
    dfWithin:    dfW,
    MSBetween:   round(MSB),
    MSWithin:    round(MSW),
    pValue:      round(pValue, 4),
    significant: pValue < 0.05,
    etaSquared:  round(etaSq),
    effectSize:  etaSq >= 0.14 ? "Büyük" : etaSq >= 0.06 ? "Orta" : "Küçük",
    groupStats,
    postHocNote: pValue < 0.05 ? "Post-hoc test önerilir (Tukey veya Bonferroni)" : null,
    interpret:   `F(${dfB},${dfW})=${round(F)}, p=${round(pValue, 3)}${pValue < 0.05 ? " *" : " ns"}`
  };
}

// ── Kruskal-Wallis ────────────────────────────────────────────────────────────
export function kruskalWallis(groups) {
  if (groups.length < 2) throw new Error("En az 2 grup gerekli.");
  const cleaned = groups.map(clean);
  const k = cleaned.length;

  const all = cleaned.flatMap((g, gi) => g.map(v => ({ v, g: gi })));
  all.sort((a, b) => a.v - b.v);
  assignRanks(all);

  const N = all.length;
  const H_num = cleaned.reduce((s, g, gi) => {
    const Rg = all.filter(x => x.g === gi).reduce((s2, x) => s2 + x.rank, 0);
    return s + Rg ** 2 / g.length;
  }, 0);

  const H = (12 / (N * (N + 1))) * H_num - 3 * (N + 1);
  const df = k - 1;
  const pValue = chiSquarePValue(H, df);

  const groupStats = cleaned.map((g, i) => ({
    group:  i + 1,
    n:      g.length,
    median: round(ss.median(g)),
    iqr:    round(ss.interquartileRange(g))
  }));

  return {
    test:        "Kruskal-Wallis",
    k, N,
    H:           round(H),
    df,
    pValue:      round(pValue, 4),
    significant: pValue < 0.05,
    groupStats,
    postHocNote: pValue < 0.05 ? "Post-hoc test önerilir (Dunn testi)" : null,
    interpret:   `H(${df})=${round(H)}, p=${round(pValue, 3)}${pValue < 0.05 ? " *" : " ns"}`
  };
}

// ── Yardımcı ─────────────────────────────────────────────────────────────────
function assignRanks(sortedArr) {
  let i = 0;
  while (i < sortedArr.length) {
    let j = i;
    while (j < sortedArr.length - 1 && sortedArr[j + 1].v === sortedArr[i].v) j++;
    const avgRank = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) sortedArr[k].rank = avgRank;
    i = j + 1;
  }
}

function pooledSD(g1, g2) {
  const n1 = g1.length, n2 = g2.length;
  return Math.sqrt(((n1 - 1) * ss.variance(g1) + (n2 - 1) * ss.variance(g2)) / (n1 + n2 - 2));
}

function tPValue(t, df) {
  // Beta fonksiyonu ile t-dağılımı kuyruğu
  const x = df / (df + t * t);
  return 0.5 * incompleteBeta(df / 2, 0.5, x);
}

function fPValue(F, df1, df2) {
  const x = df2 / (df2 + df1 * F);
  return incompleteBeta(df2 / 2, df1 / 2, x);
}

function chiSquarePValue(x, df) {
  return 1 - regularizedGamma(df / 2, x / 2);
}

function incompleteBeta(a, b, x) {
  if (x === 0) return 0;
  if (x === 1) return 1;
  const lbeta = gammaLn(a) + gammaLn(b) - gammaLn(a + b);
  const front = Math.exp(Math.log(x) * a + Math.log(1 - x) * b - lbeta) / a;
  return front * betaCF(a, b, x);
}

function betaCF(a, b, x) {
  const MAX_ITER = 200, EPS = 3e-7;
  const qab = a + b, qap = a + 1, qam = a - 1;
  let c = 1, d = 1 - qab * x / qap;
  if (Math.abs(d) < 1e-30) d = 1e-30;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= MAX_ITER; m++) {
    const m2 = 2 * m;
    let aa = m * (b - m) * x / ((qam + m2) * (a + m2));
    d = 1 + aa * d; if (Math.abs(d) < 1e-30) d = 1e-30;
    c = 1 + aa / c; if (Math.abs(c) < 1e-30) c = 1e-30;
    d = 1 / d; h *= d * c;
    aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
    d = 1 + aa * d; if (Math.abs(d) < 1e-30) d = 1e-30;
    c = 1 + aa / c; if (Math.abs(c) < 1e-30) c = 1e-30;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < EPS) break;
  }
  return h;
}

function regularizedGamma(a, x) {
  if (x < 0) return 0;
  if (x === 0) return 0;
  if (x < a + 1) return gammaSeries(a, x);
  return 1 - gammaCF(a, x);
}

function gammaSeries(a, x) {
  let ap = a, del = 1 / a, sum = del;
  for (let i = 0; i < 200; i++) {
    ap++; del *= x / ap; sum += del;
    if (Math.abs(del) < Math.abs(sum) * 3e-7) break;
  }
  return sum * Math.exp(-x + a * Math.log(x) - gammaLn(a));
}

function gammaCF(a, x) {
  let b = x + 1 - a, c = 1e30, d = 1 / b, h = d;
  for (let i = 1; i <= 200; i++) {
    const an = -i * (i - a);
    b += 2; d = an * d + b; if (Math.abs(d) < 1e-30) d = 1e-30;
    c = b + an / c; if (Math.abs(c) < 1e-30) c = 1e-30;
    d = 1 / d; const del = d * c; h *= del;
    if (Math.abs(del - 1) < 3e-7) break;
  }
  return Math.exp(-x + a * Math.log(x) - gammaLn(a)) * h;
}

function gammaLn(x) {
  const cof = [76.18009172947146,-86.50532032941677,24.01409824083091,
               -1.231739572450155,0.1208650973866179e-2,-0.5395239384953e-5];
  let y = x, tmp = x + 5.5;
  tmp -= (x + 0.5) * Math.log(tmp);
  let ser = 1.000000000190015;
  for (const c of cof) { y++; ser += c / y; }
  return -tmp + Math.log(2.5066282746310005 * ser / x);
}

function normalCDF(z) {
  return 0.5 * (1 + erf(z / Math.SQRT2));
}

function erf(x) {
  const t = 1 / (1 + 0.3275911 * Math.abs(x));
  const p = t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))));
  const r = 1 - p * Math.exp(-x * x);
  return x >= 0 ? r : -r;
}

function effectLabel(d) {
  if (d >= 0.8) return "Büyük (d≥0.8)";
  if (d >= 0.5) return "Orta (d≥0.5)";
  if (d >= 0.2) return "Küçük (d≥0.2)";
  return "Önemsiz (d<0.2)";
}

function effectLabelR(r) {
  if (r >= 0.5) return "Büyük (r≥0.5)";
  if (r >= 0.3) return "Orta (r≥0.3)";
  if (r >= 0.1) return "Küçük (r≥0.1)";
  return "Önemsiz (r<0.1)";
}

function clean(arr) {
  return arr.filter(v => v !== null && v !== undefined && !isNaN(v));
}

function round(v, d = 4) {
  return Math.round(v * 10 ** d) / 10 ** d;
}