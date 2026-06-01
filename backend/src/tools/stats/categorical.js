/**
 * Kategorik Testler
 * SPSS karşılığı: Analyze → Descriptive Statistics → Crosstabs
 */

// ── Chi-Square ────────────────────────────────────────────────────────────────
export function chiSquare(observed) {
    // observed: 2D array [[a,b],[c,d]] veya RxC matris
    const rows = observed.length;
    const cols = observed[0].length;
    const N = observed.flat().reduce((s, v) => s + v, 0);
  
    if (N === 0) throw new Error("Toplam gözlem sayısı 0.");
  
    const rowSums = observed.map(row => row.reduce((s, v) => s + v, 0));
    const colSums = Array.from({ length: cols }, (_, j) =>
      observed.reduce((s, row) => s + row[j], 0)
    );
  
    let chiSq = 0;
    const expected = [];
    let minExpected = Infinity;
  
    for (let i = 0; i < rows; i++) {
      expected[i] = [];
      for (let j = 0; j < cols; j++) {
        const e = (rowSums[i] * colSums[j]) / N;
        expected[i][j] = round(e);
        if (e < minExpected) minExpected = e;
        chiSq += (observed[i][j] - e) ** 2 / e;
      }
    }
  
    const df = (rows - 1) * (cols - 1);
    const pValue = chiSquarePValue(chiSq, df);
  
    // Yates düzeltmesi (2x2 için)
    let chiSqYates = null;
    if (rows === 2 && cols === 2) {
      const [[a, b], [c, d]] = observed;
      chiSqYates = N * (Math.abs(a * d - b * c) - N / 2) ** 2 /
                   ((a + b) * (c + d) * (a + c) * (b + d));
    }
  
    // Cramér's V (etki büyüklüğü)
    const cramersV = Math.sqrt(chiSq / (N * Math.min(rows - 1, cols - 1)));
  
    const warning = minExpected < 5
      ? `⚠️ Beklenen frekans < 5 olan hücre var (min=${round(minExpected, 1)}). Fisher testi önerilebilir.`
      : null;
  
    return {
      test:         "Chi-Square",
      chiSquare:    round(chiSq),
      chiSquareYates: chiSqYates !== null ? round(chiSqYates) : null,
      df,
      pValue:       round(pValue, 4),
      significant:  pValue < 0.05,
      cramersV:     round(cramersV),
      effectSize:   cramersVLabel(cramersV, Math.min(rows, cols) - 1),
      expected,
      N,
      warning,
      interpret:    `χ²(${df})=${round(chiSq)}, p=${round(pValue, 3)}${pValue < 0.05 ? " *" : " ns"}`
    };
  }
  
  // ── Fisher Exact (2x2) ────────────────────────────────────────────────────────
  export function fisherExact(a, b, c, d) {
    // 2x2 tablo: [[a,b],[c,d]]
    const n = a + b + c + d;
    const r1 = a + b, r2 = c + d;
    const c1 = a + c, c2 = b + d;
  
    if ([a, b, c, d].some(v => v < 0)) throw new Error("Negatif değer olamaz.");
  
    // Tam olasılık hesabı
    const pExact = _fisherP(a, b, c, d, n, r1, r2, c1, c2);
  
    // Olasılık oranı (OR)
    const OR = (a * d) / (b * c);
    const lnOR = Math.log(OR);
    const seOR = Math.sqrt(1/a + 1/b + 1/c + 1/d);
    const orCI = { lower: round(Math.exp(lnOR - 1.96 * seOR)), upper: round(Math.exp(lnOR + 1.96 * seOR)) };
  
    return {
      test:        "Fisher Exact",
      table:       [[a, b], [c, d]],
      n:           n,
      pValue:      round(pExact, 4),
      significant: pExact < 0.05,
      OR:          round(OR),
      orCI95:      orCI,
      interpret:   `Fisher p=${round(pExact, 3)}${pExact < 0.05 ? " *" : " ns"}, OR=${round(OR)} [${orCI.lower}-${orCI.upper}]`
    };
  }
  
  function _fisherP(a, b, c, d, n, r1, r2, c1, c2) {
    const pObs = _hypergeo(a, r1, c1, n);
    let pSum = 0;
    const aMin = Math.max(0, r1 + c1 - n);
    const aMax = Math.min(r1, c1);
    for (let i = aMin; i <= aMax; i++) {
      const p = _hypergeo(i, r1, c1, n);
      if (p <= pObs + 1e-10) pSum += p;
    }
    return Math.min(1, pSum);
  }
  
  function _hypergeo(k, r1, c1, n) {
    return Math.exp(
      logFactorial(r1) + logFactorial(n - r1) +
      logFactorial(c1) + logFactorial(n - c1) -
      logFactorial(n) - logFactorial(k) -
      logFactorial(r1 - k) - logFactorial(c1 - k) -
      logFactorial(n - r1 - c1 + k)
    );
  }
  
  // ── McNemar (eşleştirilmiş 2x2) ──────────────────────────────────────────────
  export function mcNemar(before, after) {
    // before/after: [0,1] dizileri veya 2x2 tablo [[a,b],[c,d]]
    let a, b, c, d;
  
    if (Array.isArray(before[0])) {
      // Direkt tablo
      [[a, b], [c, d]] = before;
    } else {
      // Çiftlerden tablo oluştur
      if (before.length !== after.length) throw new Error("Eşit uzunlukta dizi gerekli.");
      a = before.filter((v, i) => v === 1 && after[i] === 1).length;
      b = before.filter((v, i) => v === 1 && after[i] === 0).length;
      c = before.filter((v, i) => v === 0 && after[i] === 1).length;
      d = before.filter((v, i) => v === 0 && after[i] === 0).length;
    }
  
    const n = a + b + c + d;
    // Yates düzeltmeli McNemar
    const chiSq = (Math.abs(b - c) - 1) ** 2 / (b + c);
    const pValue = chiSquarePValue(chiSq, 1);
  
    // Tam McNemar (küçük b+c için)
    const pExact = (b + c) < 25 ? 2 * binomialTail(Math.min(b, c), b + c, 0.5) : null;
  
    return {
      test:        "McNemar",
      table:       [[a, b], [c, d]],
      b, c,
      n,
      chiSquare:   round(chiSq),
      pValue:      round(pValue, 4),
      pExact:      pExact !== null ? round(pExact, 4) : null,
      significant: pValue < 0.05,
      interpret:   `χ²(1)=${round(chiSq)}, p=${round(pValue, 3)}${pValue < 0.05 ? " *" : " ns"}`
    };
  }
  
  // ── Yardımcı ─────────────────────────────────────────────────────────────────
  function chiSquarePValue(x, df) {
    return 1 - regularizedGamma(df / 2, x / 2);
  }
  
  function regularizedGamma(a, x) {
    if (x <= 0) return 0;
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
  
  const _logFact = [0];
  function logFactorial(n) {
    if (n < 0) return Infinity;
    while (_logFact.length <= n) _logFact.push(_logFact[_logFact.length - 1] + Math.log(_logFact.length));
    return _logFact[n];
  }
  
  function binomialTail(k, n, p) {
    let sum = 0;
    for (let i = 0; i <= k; i++) {
      sum += Math.exp(logFactorial(n) - logFactorial(i) - logFactorial(n - i) +
                      i * Math.log(p) + (n - i) * Math.log(1 - p));
    }
    return sum;
  }
  
  function cramersVLabel(v, minDim) {
    // Cohen (1988) eşikleri minDim'e göre
    const [s, m, l] = minDim === 1 ? [0.1, 0.3, 0.5] :
                      minDim === 2 ? [0.07, 0.21, 0.35] : [0.06, 0.17, 0.29];
    if (v >= l) return "Büyük";
    if (v >= m) return "Orta";
    if (v >= s) return "Küçük";
    return "Önemsiz";
  }
  
  function round(v, d = 4) {
    return Math.round(v * 10 ** d) / 10 ** d;
  }