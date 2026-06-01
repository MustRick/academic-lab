/**
 * Sağkalım Analizi
 * SPSS karşılığı: Analyze → Survival → Kaplan-Meier / Cox Regression
 */

// ── Kaplan-Meier ──────────────────────────────────────────────────────────────
export function kaplanMeier(times, events, groupLabel = "Grup") {
    // times:  [t1, t2, ...]   — sağkalım süreleri
    // events: [1, 0, 1, ...]  — 1=olay, 0=sansürlü
  
    const n = times.length;
    if (n < 2) throw new Error("En az 2 gözlem gerekli.");
  
    // Benzersiz olay zamanları
    const eventTimes = times
      .filter((_, i) => events[i] === 1)
      .filter((v, i, arr) => arr.indexOf(v) === i)
      .sort((a, b) => a - b);
  
    let nRisk = n;
    let S     = 1.0;
    let varSum = 0;  // Greenwood variance
  
    const table = [];
    let prevTime = 0;
  
    for (const t of eventTimes) {
      // Bu zamana kadar olan sansürlüleri çıkar
      const censored = times.filter((v, i) => v > prevTime && v <= t && events[i] === 0).length;
      nRisk -= censored;
  
      const nEvent = times.filter((v, i) => v === t && events[i] === 1).length;
      const prob   = 1 - nEvent / nRisk;
      S *= prob;
      varSum += nEvent / (nRisk * (nRisk - nEvent));
  
      const seS = S * Math.sqrt(varSum);
      table.push({
        time:     t,
        nRisk,
        nEvent,
        nCensored: censored,
        survival: round(S),
        se:       round(seS),
        ci95Lower: round(Math.max(0, S - 1.96 * seS)),
        ci95Upper: round(Math.min(1, S + 1.96 * seS))
      });
  
      nRisk -= nEvent;
      prevTime = t;
    }
  
    // Medyan sağkalım (S < 0.5 olan ilk zaman)
    const medianRow = table.find(r => r.survival <= 0.5);
    const median    = medianRow ? medianRow.time : null;
  
    // 6 aylık ve 12 aylık sağkalım
    const s6  = _survivalAt(table, 6);
    const s12 = _survivalAt(table, 12);
    const s24 = _survivalAt(table, 24);
  
    return {
      test:          "Kaplan-Meier",
      group:         groupLabel,
      n,
      nEvents:       events.filter(e => e === 1).length,
      nCensored:     events.filter(e => e === 0).length,
      medianSurvival: median,
      survivalAt:    { "6mo": s6, "12mo": s12, "24mo": s24 },
      table,
      interpret:     `n=${n}, olay=${events.filter(e=>e===1).length}, medyan sağkalım=${median ?? "ulaşılmadı"}`
    };
  }
  
  // ── Log-rank Testi (iki grup karşılaştırma) ───────────────────────────────────
  export function logRankTest(times1, events1, times2, events2) {
    const allTimes = [...times1, ...times2]
      .filter((_, i) => [...events1, ...events2][i] === 1 ||
        [...events1, ...events2].indexOf(1) !== -1)
      .filter((v, i, arr) => arr.indexOf(v) === i)
      .sort((a, b) => a - b);
  
    let O1 = 0, E1 = 0, O2 = 0, E2 = 0;
    let variance = 0;
  
    for (const t of allTimes) {
      const n1t = times1.filter((v, i) => v >= t).length;
      const n2t = times2.filter((v, i) => v >= t).length;
      const d1t = times1.filter((v, i) => v === t && events1[i] === 1).length;
      const d2t = times2.filter((v, i) => v === t && events2[i] === 1).length;
      const nt  = n1t + n2t;
      const dt  = d1t + d2t;
  
      if (nt < 2 || dt === 0) continue;
  
      const e1t = (n1t * dt) / nt;
      O1 += d1t; E1 += e1t;
      O2 += d2t; E2 += dt - e1t;
      variance += (n1t * n2t * dt * (nt - dt)) / (nt * nt * (nt - 1));
    }
  
    const chiSq  = variance > 0 ? (O1 - E1) ** 2 / variance : 0;
    const pValue = chiSquarePValue(chiSq, 1);
  
    return {
      test:        "Log-rank",
      group1:      { observed: O1, expected: round(E1) },
      group2:      { observed: O2, expected: round(E2) },
      chiSquare:   round(chiSq),
      df:          1,
      pValue:      round(pValue, 4),
      significant: pValue < 0.05,
      interpret:   `χ²(1)=${round(chiSq)}, p=${round(pValue, 3)}${pValue < 0.05 ? " *" : " ns"}`
    };
  }
  
  // ── Cox Proportional Hazards (tek değişken) ───────────────────────────────────
  export function coxRegression(times, events, covariate, maxIter = 50, lr = 0.1) {
    const n = times.length;
    if (n < 5) throw new Error("Cox regresyon için en az 5 gözlem gerekli.");
  
    const eventTimes = times
      .filter((_, i) => events[i] === 1)
      .filter((v, i, arr) => arr.indexOf(v) === i)
      .sort((a, b) => a - b);
  
    let beta = 0;
  
    for (let iter = 0; iter < maxIter; iter++) {
      let score = 0, info = 0;
  
      for (const t of eventTimes) {
        const riskSet = times.map((v, i) => ({ t: v, e: events[i], x: covariate[i] }))
                            .filter(s => s.t >= t);
  
        const expBx = riskSet.map(s => Math.exp(beta * s.x));
        const sum0  = expBx.reduce((a, b) => a + b, 0);
        const sum1  = riskSet.reduce((s, r, i) => s + r.x * expBx[i], 0);
        const sum2  = riskSet.reduce((s, r, i) => s + r.x ** 2 * expBx[i], 0);
  
        const eventX = riskSet.filter(s => s.t === t && s.e === 1).reduce((s, r) => s + r.x, 0);
        const nEvent = riskSet.filter(s => s.t === t && s.e === 1).length;
  
        score += eventX - nEvent * sum1 / sum0;
        info  += nEvent * (sum2 / sum0 - (sum1 / sum0) ** 2);
      }
  
      if (Math.abs(info) < 1e-10) break;
      const step = score / info;
      beta += step;
      if (Math.abs(step) < 1e-6) break;
    }
  
    const se     = _coxSE(times, events, covariate, beta, eventTimes);
    const z      = beta / se;
    const pValue = 2 * (1 - normalCDF(Math.abs(z)));
    const HR     = Math.exp(beta);
    const hrCI   = { lower: round(Math.exp(beta - 1.96 * se)), upper: round(Math.exp(beta + 1.96 * se)) };
  
    return {
      test:        "Cox Proportional Hazards",
      n,
      nEvents:     events.filter(e => e === 1).length,
      beta:        round(beta),
      SE:          round(se),
      z:           round(z),
      pValue:      round(pValue, 4),
      significant: pValue < 0.05,
      HR:          round(HR),
      hrCI95:      hrCI,
      interpret:   `HR=${round(HR)} [${hrCI.lower}-${hrCI.upper}], p=${round(pValue, 3)}${pValue < 0.05 ? " *" : " ns"}`
    };
  }
  
  // ── Yardımcı ─────────────────────────────────────────────────────────────────
  function _survivalAt(table, time) {
    const row = [...table].reverse().find(r => r.time <= time);
    return row ? round(row.survival) : 1.0;
  }
  
  function _coxSE(times, events, cov, beta, eventTimes) {
    let info = 0;
    for (const t of eventTimes) {
      const riskSet = times.map((v, i) => ({ t: v, e: events[i], x: cov[i] })).filter(s => s.t >= t);
      const expBx   = riskSet.map(s => Math.exp(beta * s.x));
      const sum0    = expBx.reduce((a, b) => a + b, 0);
      const sum1    = riskSet.reduce((s, r, i) => s + r.x * expBx[i], 0);
      const sum2    = riskSet.reduce((s, r, i) => s + r.x ** 2 * expBx[i], 0);
      const nEvent  = riskSet.filter(s => s.t === t && s.e === 1).length;
      info += nEvent * (sum2 / sum0 - (sum1 / sum0) ** 2);
    }
    return info > 0 ? 1 / Math.sqrt(info) : 0;
  }
  
  function chiSquarePValue(x, df) {
    return 1 - regularizedGamma(df / 2, x / 2);
  }
  
  function normalCDF(z) {
    return 0.5 * (1 + erf(z / Math.SQRT2));
  }
  
  function erf(x) {
    const t = 1 / (1 + 0.3275911 * Math.abs(x));
    const p = t*(0.254829592+t*(-0.284496736+t*(1.421413741+t*(-1.453152027+t*1.061405429))));
    const r = 1 - p * Math.exp(-x*x);
    return x >= 0 ? r : -r;
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