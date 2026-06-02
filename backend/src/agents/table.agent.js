import { createClient } from '@supabase/supabase-js'

const OLD_FORMAT_WARNING = 'Bu kayıt eski formatta oluşturulmuş. Tablo oluşturmak için İstatistik sayfasında analizi yeniden çalıştırıp kaydedin.'

function scopedSupabase(token) {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } }
  })
}

async function loadStatisticsRecord(db, id, userId) {
  const { data, error } = await db
    .from('research_outputs')
    .select('*')
    .eq('id', id)
    .eq('type', 'statistics')
    .eq('user_id', userId)
    .single()

  if (error) throw new Error(`İstatistik kaydı okunamadı: ${error.message}`)
  if (!data) throw new Error('İstatistik kaydı bulunamadı.')
  return data
}

async function loadRows(db, sourceDatasetId) {
  const { data, error } = await db
    .from('dataset_rows')
    .select('row_index, data')
    .eq('output_id', sourceDatasetId)
    .order('row_index')

  if (error) throw new Error(`Dataset satırları okunamadı: ${error.message}`)
  return (data || []).map(row => row.data)
}

function statPayload(record) {
  const result = record?.result || {}
  const payload = record?.payload || {}
  return {
    sourceDatasetId: result.sourceDatasetId || payload.sourceDatasetId || null,
    schema: result.schema || payload.schema || { studyTitle: record.title, columns: [] },
    statisticalResults: result.results || [],
    n: result.n || null
  }
}

function label(schema, key) {
  return schema?.columns?.find(c => c.key === key)?.label || key || '—'
}

function number(value, digits = 2) {
  const n = Number(value)
  return Number.isFinite(n) ? n.toFixed(digits) : '—'
}

function pvalue(result) {
  return result?.pValue ?? result?.p_value ?? result?.p ?? null
}

function pformat(value) {
  const p = Number(value)
  if (!Number.isFinite(p)) return '—'
  return p < 0.001 ? '<0.001' : p.toFixed(3)
}

function values(rows, key) {
  return rows.map(row => row[key]).filter(v => v !== null && v !== undefined && v !== '')
}

function numericValues(rows, key) {
  return values(rows, key).map(Number).filter(Number.isFinite)
}

function stats(nums) {
  if (!nums.length) return null
  const sorted = [...nums].sort((a, b) => a - b)
  const n = nums.length
  const mean = nums.reduce((sum, value) => sum + value, 0) / n
  const sd = Math.sqrt(nums.reduce((sum, value) => sum + ((value - mean) ** 2), 0) / Math.max(n - 1, 1))
  const q = pct => sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * pct))]
  return { n, mean, sd, median: q(0.5), q1: q(0.25), q3: q(0.75), iqr: q(0.75) - q(0.25) }
}

function groupedStats(rows, groupKey, valueKey) {
  const groups = [...new Set(values(rows, groupKey).map(String))]
  return groups.map(group => {
    const nums = rows.filter(row => String(row[groupKey]) === group).map(row => Number(row[valueKey])).filter(Number.isFinite)
    const s = stats(nums)
    return s ? { group, ...s } : null
  }).filter(Boolean)
}

function tableBase(id, kind, title, columns, rows, statistics = {}, footnotes = []) {
  return {
    id,
    kind,
    title,
    caption: title,
    columns,
    rows,
    statistics,
    footnotes,
    downloadUrls: {}
  }
}

function table1(test, rows, schema, index) {
  const variables = [test.columns?.outcome || test.columns?.variable].filter(Boolean)
  const cols = ['Değişken', 'Özet', 'Eksik n', 'Eksik %']
  const outRows = variables.map(key => {
    const column = schema.columns?.find(c => c.key === key)
    const vals = values(rows, key)
    const miss = rows.length - vals.length
    const nums = column?.type === 'number' ? numericValues(rows, key) : []
    let summary = '—'
    if (nums.length) {
      const s = stats(nums)
      summary = `${number(s.mean)} ± ${number(s.sd)}; medyan ${number(s.median)} [${number(s.q1)}-${number(s.q3)}]`
    } else if (vals.length) {
      summary = [...new Set(vals.map(String))].slice(0, 6).map(v => {
        const count = vals.filter(x => String(x) === v).length
        return `${v}: ${count} (${number((count / vals.length) * 100, 1)}%)`
      }).join(', ')
    }
    return { 'Değişken': label(schema, key), 'Özet': summary, 'Eksik n': miss, 'Eksik %': number((miss / Math.max(rows.length, 1)) * 100, 1) }
  })
  return tableBase(`table1_${index}`, 'table1', 'Table 1 — Hasta özellikleri', cols, outRows, { n: rows.length }, ['Sürekli değişkenler ortalama ± SS ve medyan [IQR] olarak özetlendi.'])
}

function groupComparison(test, rows, schema, index, mode) {
  const groupKey = test.columns?.group
  const outcomeKey = test.columns?.outcome
  const groups = groupedStats(rows, groupKey, outcomeKey)
  const isMedian = ['mann_whitney_u', 'kruskal_wallis'].includes(test.testName)
  const cols = isMedian
    ? ['Grup', 'n', 'Medyan', 'IQR', mode === 'multi' ? 'H' : 'U', 'p']
    : ['Grup', 'n', 'Ortalama', 'SS', mode === 'multi' ? 'F' : 'Ortalama farkı', 't / sd', 'p', "Cohen's d"]
  const result = test.result || {}
  const rowsOut = groups.map((g, idx) => {
    if (isMedian) {
      return {
        'Grup': g.group,
        'n': g.n,
        'Medyan': number(g.median),
        'IQR': `${number(g.q1)}-${number(g.q3)}`,
        [mode === 'multi' ? 'H' : 'U']: idx === 0 ? number(result.H ?? result.statistic ?? result.U) : '',
        'p': idx === 0 ? pformat(pvalue(result)) : ''
      }
    }
    const diff = groups.length >= 2 ? groups[0].mean - groups[1].mean : result.meanDifference
    return {
      'Grup': g.group,
      'n': g.n,
      'Ortalama': number(g.mean),
      'SS': number(g.sd),
      [mode === 'multi' ? 'F' : 'Ortalama farkı']: idx === 0 ? number(mode === 'multi' ? (result.F ?? result.statistic) : diff) : '',
      't / sd': idx === 0 ? `${number(result.t ?? result.statistic)} / ${number(result.df ?? result.degreesOfFreedom, 1)}` : '',
      'p': idx === 0 ? pformat(pvalue(result)) : '',
      "Cohen's d": idx === 0 ? number(result.cohensD ?? result.effectSize) : ''
    }
  })
  const title = `${label(schema, groupKey)} gruplarına göre ${label(schema, outcomeKey)}`
  return tableBase(`group_${index}`, isMedian ? 'median_group_comparison' : 'mean_group_comparison', title, cols, rowsOut, result, ['p değerleri ilgili istatistiksel teste göre raporlandı.'])
}

function pairedTable(test, rows, schema, index) {
  const beforeKey = test.columns?.before
  const afterKey = test.columns?.after
  const before = stats(numericValues(rows, beforeKey)) || {}
  const after = stats(numericValues(rows, afterKey)) || {}
  const result = test.result || {}
  const cols = ['Ölçüm', 'n', 'Ortalama', 'SS', 'Fark', 'p']
  return tableBase(`paired_${index}`, 'paired_t_test', `${label(schema, beforeKey)} - ${label(schema, afterKey)} önce-sonra özeti`, cols, [
    { 'Ölçüm': label(schema, beforeKey), 'n': before.n || '—', 'Ortalama': number(before.mean), 'SS': number(before.sd), 'Fark': number(result.meanDifference), 'p': pformat(pvalue(result)) },
    { 'Ölçüm': label(schema, afterKey), 'n': after.n || '—', 'Ortalama': number(after.mean), 'SS': number(after.sd), 'Fark': '', 'p': '' }
  ], result, ['Eşleştirilmiş t-testi kullanıldı.'])
}

function correlationTable(test, schema, index) {
  const result = test.result || {}
  const isSpearman = test.testName === 'spearman_correlation'
  const coef = result.rho ?? result.r ?? result.correlation
  const cols = ['Değişken 1', 'Değişken 2', isSpearman ? 'rho' : 'r', '%95 GA', 'p']
  return tableBase(`corr_${index}`, test.testName, `${label(schema, test.columns?.x)} ve ${label(schema, test.columns?.y)} korelasyonu`, cols, [{
    'Değişken 1': label(schema, test.columns?.x),
    'Değişken 2': label(schema, test.columns?.y),
    [isSpearman ? 'rho' : 'r']: number(coef, 3),
    '%95 GA': result.ciLow || result.ci_low ? `${number(result.ciLow ?? result.ci_low)}-${number(result.ciHigh ?? result.ci_high)}` : '—',
    'p': pformat(pvalue(result))
  }], result)
}

function crosstabTable(test, rows, schema, index) {
  const rowKey = test.columns?.row
  const colKey = test.columns?.col
  const rowVals = [...new Set(values(rows, rowKey).map(String))]
  const colVals = [...new Set(values(rows, colKey).map(String))]
  const cols = [label(schema, rowKey), ...colVals, 'Toplam', 'Test', 'p']
  const result = test.result || {}
  const outRows = rowVals.map((rv, idx) => {
    const row = { [label(schema, rowKey)]: rv }
    const total = rows.filter(item => String(item[rowKey]) === rv).length
    colVals.forEach(cv => {
      const count = rows.filter(item => String(item[rowKey]) === rv && String(item[colKey]) === cv).length
      row[cv] = `${count} (${number((count / Math.max(total, 1)) * 100, 1)}%)`
    })
    row.Toplam = total
    row.Test = idx === 0 ? number(result.chiSquare ?? result.statistic ?? result.oddsRatio) : ''
    row.p = idx === 0 ? pformat(pvalue(result)) : ''
    return row
  })
  return tableBase(`cross_${index}`, test.testName === 'fisher_exact' ? 'fisher_2x2' : 'chi_square_crosstab', `${label(schema, rowKey)} x ${label(schema, colKey)}`, cols, outRows, result, ['Hücreler n (%) olarak gösterildi.'])
}

function regressionTable(test, schema, index) {
  const result = test.result || {}
  const predictor = test.columns?.predictor || test.columns?.covariate || test.columns?.predictors?.[0] || 'predictor'
  const isLogistic = test.testName === 'logistic_regression'
  const isCox = test.testName === 'cox_regression'
  const estimateCol = isCox ? 'HR' : isLogistic ? 'OR' : 'β'
  const estimate = result.hazardRatio ?? result.HR ?? result.oddsRatio ?? result.OR ?? result.beta ?? result.coefficient ?? 0
  const se = result.se ?? result.standardError ?? ''
  const low = result.ciLow ?? result.ci_low
  const high = result.ciHigh ?? result.ci_high
  const cols = ['Değişken', estimateCol, 'Standart hata', '%95 GA', 'p']
  return tableBase(`reg_${index}`, test.testName, `${estimateCol} tablosu`, cols, [{
    'Değişken': label(schema, predictor),
    [estimateCol]: number(estimate, 3),
    'Standart hata': number(se, 3),
    '%95 GA': low !== undefined || high !== undefined ? `${number(low, 3)}-${number(high, 3)}` : '—',
    'p': pformat(pvalue(result))
  }], result)
}

function survivalTable(test, rows, schema, index) {
  const timeKey = test.columns?.time
  const groupKey = test.columns?.group
  const groups = groupKey ? [...new Set(values(rows, groupKey).map(String))] : ['Tüm hastalar']
  const cols = ['Grup', 'n', 'Medyan sağkalım', 'Riskte n', 'p']
  const result = test.result || {}
  const outRows = groups.map((group, idx) => {
    const groupRows = groupKey ? rows.filter(row => String(row[groupKey]) === group) : rows
    const s = stats(groupRows.map(row => Number(row[timeKey])).filter(Number.isFinite)) || {}
    return { 'Grup': group, 'n': groupRows.length, 'Medyan sağkalım': number(result.medianSurvival ?? s.median), 'Riskte n': groupRows.length, 'p': idx === 0 ? pformat(pvalue(result)) : '' }
  })
  return tableBase(`survival_${index}`, test.testName, test.testName === 'log_rank_test' ? 'Grup bazlı sağkalım karşılaştırması' : 'Kaplan-Meier risk table', cols, outRows, result)
}

function missingTable(rows, schema) {
  const cols = ['Değişken', 'Eksik n', 'Eksik %']
  const outRows = (schema.columns || []).map(column => {
    const present = values(rows, column.key).length
    const missing = rows.length - present
    return { 'Değişken': column.label || column.key, 'Eksik n': missing, 'Eksik %': number((missing / Math.max(rows.length, 1)) * 100, 1) }
  })
  return tableBase('missing_data', 'missing_data', 'Eksik veri analizi', cols, outRows, { n: rows.length })
}

function buildTables(statisticalResults, rows, schema) {
  const tables = []
  statisticalResults.filter(test => test.status !== 'error').forEach((test, index) => {
    if (test.testName === 'descriptive_stats') tables.push(table1(test, rows, schema, index))
    if (test.testName === 'independent_t_test') tables.push(groupComparison(test, rows, schema, index, 'two'))
    if (test.testName === 'mann_whitney_u') tables.push(groupComparison(test, rows, schema, index, 'two'))
    if (['one_way_anova', 'anova'].includes(test.testName)) tables.push(groupComparison(test, rows, schema, index, 'multi'))
    if (test.testName === 'kruskal_wallis') tables.push(groupComparison(test, rows, schema, index, 'multi'))
    if (test.testName === 'paired_t_test') tables.push(pairedTable(test, rows, schema, index))
    if (['pearson_correlation', 'spearman_correlation'].includes(test.testName)) tables.push(correlationTable(test, schema, index))
    if (['chi_square', 'chi_square_test', 'fisher_exact', 'fisher_exact_test'].includes(test.testName)) tables.push(crosstabTable(test, rows, schema, index))
    if (['linear_regression', 'logistic_regression', 'cox_regression'].includes(test.testName)) tables.push(regressionTable(test, schema, index))
    if (['kaplan_meier', 'log_rank_test'].includes(test.testName)) tables.push(survivalTable(test, rows, schema, index))
  })
  if (rows.length && schema.columns?.length) tables.push(missingTable(rows, schema))
  return tables
}

export const run = async (body, context = {}) => {
  const { statisticsOutputId } = body || {}
  const { user, token } = context

  if (!user?.id || !token) throw new Error('Kimlik doğrulama gerekli.')
  if (!statisticsOutputId) throw new Error('statisticsOutputId zorunlu.')

  const db = scopedSupabase(token)
  const record = await loadStatisticsRecord(db, statisticsOutputId, user.id)
  const payload = statPayload(record)

  if (!payload.sourceDatasetId) {
    return { success: false, warnings: [OLD_FORMAT_WARNING], tables: [] }
  }

  const rows = await loadRows(db, payload.sourceDatasetId)
  const tables = buildTables(payload.statisticalResults, rows, payload.schema)

  return {
    success: true,
    statisticsOutputId,
    sourceDatasetId: payload.sourceDatasetId,
    statisticalResults: payload.statisticalResults,
    schema: payload.schema,
    rowCount: rows.length,
    tables,
    warnings: []
  }
}
