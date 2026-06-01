import * as ss from "simple-statistics";

/**
 * Tanımlayıcı istatistik
 * SPSS karşılığı: Analyze → Descriptive Statistics → Descriptives / Frequencies
 */
export function descriptiveStats(data) {
  const arr = data.filter(v => v !== null && v !== undefined && !isNaN(v));
  if (arr.length === 0) throw new Error("Geçerli veri yok.");

  const sorted = [...arr].sort((a, b) => a - b);
  const n = arr.length;
  const mean = ss.mean(arr);
  const median = ss.median(arr);
  const sd = n > 1 ? ss.standardDeviation(arr) : 0;
  const variance = n > 1 ? ss.variance(arr) : 0;
  const min = ss.min(arr);
  const max = ss.max(arr);
  const q1 = ss.quantile(sorted, 0.25);
  const q3 = ss.quantile(sorted, 0.75);
  const iqr = q3 - q1;
  const sem = sd / Math.sqrt(n);
  const skewness = ss.sampleSkewness(arr);
  const kurtosis = ss.sampleKurtosis(arr);

  // %95 güven aralığı (t dağılımı)
  const tCrit = tCritical(n - 1, 0.025);
  const ciLower = mean - tCrit * sem;
  const ciUpper = mean + tCrit * sem;

  return {
    n,
    mean:     round(mean),
    median:   round(median),
    sd:       round(sd),
    variance: round(variance),
    sem:      round(sem),
    min:      round(min),
    max:      round(max),
    range:    round(max - min),
    q1:       round(q1),
    q3:       round(q3),
    iqr:      round(iqr),
    skewness: round(skewness),
    kurtosis: round(kurtosis),
    ci95:     { lower: round(ciLower), upper: round(ciUpper) },
    // SPSS format özet
    summary:  `n=${n}, Ort±SS: ${round(mean)}±${round(sd)}, Medyan [IQR]: ${round(median)} [${round(q1)}-${round(q3)}]`
  };
}

// t kritik değeri (iki kuyruklu)
function tCritical(df, alpha) {
  // Wilson-Hilferty yaklaşımı
  if (df <= 0) return 1.96;
  const z = 1.96;
  return z + (z ** 3 + z) / (4 * df);
}

function round(v, d = 4) {
  return Math.round(v * 10 ** d) / 10 ** d;
}