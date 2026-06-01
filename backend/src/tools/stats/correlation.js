import * as ss from "simple-statistics";

/**
 * Korelasyon & Regresyon
 * SPSS karşılığı: Analyze → Correlate / Regression
 */

// ── Pearson Korelasyonu ───────────────────────────────────────────────────────
export function pearsonCorrelation(x, y) {
  const [cx, cy] = cleanPairs(x, y);
  const n = cx.length;
  if (n < 3) throw new Error("En az 3 çift gözlem gerekli.");

  const r = ss.sampleCorrelation(cx, cy);
  const t = r * Math.sqrt((n - 2) / (1 - r * r));
  const pValue = 2 * tPValue(Math.abs(t), n - 2);

  // %95 CI (Fisher z dönüşümü)
  const z   = Math.atanh(r);
  const sez = 1 / Math.sqrt(n - 3);
  const ci  = { lower: round(Math.tanh(z - 1.96 * sez)), upper: round(Math.tanh(z + 1.96 * sez)) };

  return {
    test:        "Pearson Korelasyon",
    n,
    r:           round(r),
    r2:          round(r * r),
    t:           round(t),
    df:          n - 2,
    pValue:      round(pValue, 4),
    significant: pValue < 0.05,
    ci95:        ci,
    effectSize:  correlationLabel(Math.abs(r)),
    interpret:   `r=${round(r)}, p=${round(pValue, 3)}${pValue < 0.05 ? " *" : " ns"}`
  };
}

// ── Spearman Korelasyonu ──────────────────────────────────────────────────────
export function spearmanCorrelation(x, y) {
  const [cx, cy] = cleanPairs(x, y);
  const n = cx.length;
  if (n < 3) throw new Error("En az 3 çift gözlem gerekli.");

  const rankX = toRanks(cx);
  const rankY = toRanks(cy);
  const rho   = ss.sampleCorrelation(rankX, rankY);
  const t     = rho * Math.sqrt((n - 2) / (1 - rho * rho));
  const pValue = 2 * tPValue(Math.abs(t), n - 2);

  return {
    test:        "Spearman Korelasyon",
    n,
    rho:         round(rho),
    rho2:        round(rho * rho),
    t:           round(t),
    df:          n - 2,
    pValue:      round(pValue, 4),
    significant: pValue < 0.05,
    effectSize:  correlationLabel(Math.abs(rho)),
    interpret:   `ρ=${round(rho)}, p=${round(pValue, 3)}${pValue < 0.05 ? " *" : " ns"}`
  };
}

// ── Basit Lineer Regresyon ────────────────────────────────────────────────────
export function linearRegression(x, y) {
  const [cx, cy] = cleanPairs(x, y);
  const n = cx.length;
  if (n < 3) throw new Error("En az 3 gözlem gerekli.");

  const reg   = ss.linearRegression(cx.map((v, i) => [v, cy[i]]));
  const B1    = reg.m;  // slope
  const B0    = reg.b;  // intercept

  const yPred = cx.map(v => B0 + B1 * v);
  const SSres = cy.reduce((s, v, i) => s + (v - yPred[i]) ** 2, 0);
  const SStot = cy.reduce((s, v) => s + (v - ss.mean(cy)) ** 2, 0);
  const R2    = 1 - SSres / SStot;
  const adjR2 = 1 - (1 - R2) * (n - 1) / (n - 2);

  const MSres = SSres / (n - 2);
  const SXX   = cx.reduce((s, v) => s + (v - ss.mean(cx)) ** 2, 0);
  const seB1  = Math.sqrt(MSres / SXX);
  const seB0  = Math.sqrt(MSres * (1 / n + ss.mean(cx) ** 2 / SXX));

  const tB1 = B1 / seB1;
  const tB0 = B0 / seB0;
  const pB1 = 2 * tPValue(Math.abs(tB1), n - 2);
  const pB0 = 2 * tPValue(Math.abs(tB0), n - 2);

  // ANOVA tablosu
  const SSreg = SStot - SSres;
  const F     = (SSreg / 1) / (SSres / (n - 2));
  const pF    = fPValue(F, 1, n - 2);

  return {
    test:        "Basit Lineer Regresyon",
    n,
    intercept:   { B: round(B0), SE: round(seB0), t: round(tB0), p: round(pB0, 4) },
    slope:       { B: round(B1), SE: round(seB1), t: round(tB1), p: round(pB1, 4) },
    R2:          round(R2),
    adjR2:       round(adjR2),
    F:           round(F),
    pModel:      round(pF, 4),
    significant: pF < 0.05,
    equation:    `Y = ${round(B0)} + ${round(B1)} × X`,
    interpret:   `R²=${round(R2)}, F(1,${n-2})=${round(F)}, p=${round(pF, 3)}${pF < 0.05 ? " *" : " ns"}`
  };
}

// ── Binary Lojistik Regresyon ─────────────────────────────────────────────────
export function logisticRegression(X, y, maxIter = 100, lr = 0.01) {
  // X: [[x1,x2,...], ...], y: [0,1,...]
  const n = y.length;
  const p = X[0].length;

  // Design matrix'e intercept ekle
  const Xb = X.map(row => [1, ...row]);
  let beta = new Array(p + 1).fill(0);

  // Gradient descent (Newton-Raphson yaklaşımı)
  for (let iter = 0; iter < maxIter; iter++) {
    const probs = Xb.map(row => sigmoid(dot(beta, row)));
    const grad  = new Array(p + 1).fill(0);

    for (let j = 0; j <= p; j++) {
      for (let i = 0; i < n; i++) {
        grad[j] += (probs[i] - y[i]) * Xb[i][j];
      }
      grad[j] /= n;
    }
    beta = beta.map((b, j) => b - lr * grad[j]);
  }

  const probs = Xb.map(row => sigmoid(dot(beta, row)));

  // Log-likelihood
  const llFull = probs.reduce((s, p, i) =>
    s + y[i] * Math.log(p + 1e-15) + (1 - y[i]) * Math.log(1 - p + 1e-15), 0);

  const pNull = ss.mean(y);
  const llNull = n * (pNull * Math.log(pNull + 1e-15) + (1 - pNull) * Math.log(1 - pNull + 1e-15));

  // -2LL, Nagelkerke R²
  const G2       = -2 * (llNull - llFull);
  const nagelkerke = (1 - Math.exp((llNull - llFull) * 2 / n)) /
                     (1 - Math.exp(llNull * 2 / n));

  // SE ve OR için Hessian diyagonali
  const W    = probs.map(p => p * (1 - p));
  const info = new Array(p + 1).fill(0).map(() => new Array(p + 1).fill(0));
  for (let i = 0; i < n; i++)
    for (let j = 0; j <= p; j++)
      for (let k = 0; k <= p; k++)
        info[j][k] += W[i] * Xb[i][j] * Xb[i][k];

  const seArr = invertDiag(info).map(v => Math.sqrt(Math.max(v, 0)));

  const coefficients = beta.map((b, j) => {
    const se   = seArr[j];
    const z    = b / se;
    const pVal = 2 * (1 - normalCDF(Math.abs(z)));
    const OR   = Math.exp(b);
    return {
      name:   j === 0 ? "Intercept" : `X${j}`,
      B:      round(b),
      SE:     round(se),
      z:      round(z),
      p:      round(pVal, 4),
      OR:     round(OR),
      orCI95: { lower: round(Math.exp(b - 1.96 * se)), upper: round(Math.exp(b + 1.96 * se)) },
      sig:    pVal < 0.05 ? "*" : "ns"
    };
  });

  return {
    test:         "Binary Lojistik Regresyon",
    n,
    coefficients,
    G2:           round(G2),
    dfModel:      p,
    pModel:       round(chiSquarePValue(G2, p), 4),
    nagelkerkeR2: round(nagelkerke),
    interpret:    `χ²(${p})=${round(G2)}, p=${round(chiSquarePValue(G2, p), 3)}, R²N=${round(nagelkerke)}`
  };
}

// ── Yardımcı ─────────────────────────────────────────────────────────────────
function cleanPairs(x, y) {
  const pairs = x.map((v, i) => [v, y[i]])
    .filter(([a, b]) => a !== null && b !== null && !isNaN(a) && !isNaN(b));
  return [pairs.map(p => p[0]), pairs.map(p => p[1])];
}

function toRanks(arr) {
  const indexed = arr.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v);
  const ranks = new Array(arr.length);
  let i = 0;
  while (i < indexed.length) {
    let j = i;
    while (j < indexed.length - 1 && indexed[j + 1].v === indexed[i].v) j++;
    const r = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) ranks[indexed[k].i] = r;
    i = j + 1;
  }
  return ranks;
}

function sigmoid(x) { return 1 / (1 + Math.exp(-x)); }
function dot(a, b)   { return a.reduce((s, v, i) => s + v * b[i], 0); }

function invertDiag(M) {
  // Diyagonal yaklaşım (tam inverse yerine)
  return M.map((row, i) => row[i] > 0 ? 1 / row[i] : 0);
}

function tPValue(t, df) {
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

function correlationLabel(r) {
  if (r >= 0.9) return "Çok güçlü";
  if (r >= 0.7) return "Güçlü";
  if (r >= 0.5) return "Orta";
  if (r >= 0.3) return "Zayıf";
  return "Önemsiz";
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

function incompleteBeta(a, b, x) {
  if (x === 0) return 0; if (x === 1) return 1;
  const lbeta = gammaLn(a) + gammaLn(b) - gammaLn(a + b);
  return Math.exp(Math.log(x) * a + Math.log(1-x) * b - lbeta) / a * betaCF(a, b, x);
}

function betaCF(a, b, x) {
  const qab = a+b, qap = a+1, qam = a-1;
  let c = 1, d = 1 - qab*x/qap; if (Math.abs(d) < 1e-30) d = 1e-30; d = 1/d; let h = d;
  for (let m = 1; m <= 200; m++) {
    const m2 = 2*m;
    let aa = m*(b-m)*x/((qam+m2)*(a+m2));
    d = 1+aa*d; if (Math.abs(d)<1e-30) d=1e-30; c = 1+aa/c; if (Math.abs(c)<1e-30) c=1e-30;
    d = 1/d; h *= d*c;
    aa = -(a+m)*(qab+m)*x/((a+m2)*(qap+m2));
    d = 1+aa*d; if (Math.abs(d)<1e-30) d=1e-30; c = 1+aa/c; if (Math.abs(c)<1e-30) c=1e-30;
    d = 1/d; const del = d*c; h *= del; if (Math.abs(del-1) < 3e-7) break;
  }
  return h;
}

function regularizedGamma(a, x) {
  if (x <= 0) return 0;
  if (x < a+1) return gammaSeries(a, x);
  return 1 - gammaCF(a, x);
}

function gammaSeries(a, x) {
  let ap = a, del = 1/a, sum = del;
  for (let i = 0; i < 200; i++) { ap++; del *= x/ap; sum += del; if (Math.abs(del) < Math.abs(sum)*3e-7) break; }
  return sum * Math.exp(-x + a*Math.log(x) - gammaLn(a));
}

function gammaCF(a, x) {
  let b = x+1-a, c = 1e30, d = 1/b, h = d;
  for (let i = 1; i <= 200; i++) {
    const an = -i*(i-a); b += 2;
    d = an*d+b; if (Math.abs(d)<1e-30) d=1e-30;
    c = b+an/c; if (Math.abs(c)<1e-30) c=1e-30;
    d = 1/d; const del = d*c; h *= del; if (Math.abs(del-1) < 3e-7) break;
  }
  return Math.exp(-x + a*Math.log(x) - gammaLn(a)) * h;
}

function gammaLn(x) {
  const cof = [76.18009172947146,-86.50532032941677,24.01409824083091,
               -1.231739572450155,0.1208650973866179e-2,-0.5395239384953e-5];
  let y = x, tmp = x+5.5; tmp -= (x+0.5)*Math.log(tmp); let ser = 1.000000000190015;
  for (const c of cof) { y++; ser += c/y; }
  return -tmp + Math.log(2.5066282746310005*ser/x);
}

function round(v, d = 4) { return Math.round(v * 10**d) / 10**d; }