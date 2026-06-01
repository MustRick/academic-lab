import { useState, useEffect } from 'react'
import { statisticsAPI } from '@/api'
import { useDataStore, useStatsStore } from '@/store'
import { PageHeader, AgentRunning, EmptyState, ResultCard, PValueBadge, StatBox } from '@/components/ui'
import { SaveBar, SavedBadge } from '@/components/ui/SaveBar'
import { OUTPUT_TYPES, listOutputs, getOutput, loadDatasetRows } from '@/lib/outputs'
import toast from 'react-hot-toast'

const TD = {
  shapiro_wilk:{label:'Shapiro-Wilk',cat:'Normallik'}, kolmogorov_smirnov:{label:'Kolmogorov-Smirnov',cat:'Normallik'},
  descriptive_stats:{label:'Tanımlayıcı İstatistik',cat:'Tanımlayıcı'},
  independent_t_test:{label:'Bağımsız t-testi',cat:'Karşılaştırma'},
  independent_samples_t_test:{label:'Bağımsız t-testi',cat:'Karşılaştırma'},
  mann_whitney_u:{label:'Mann-Whitney U',cat:'Karşılaştırma'},
  paired_t_test:{label:'Eşleştirilmiş t-testi',cat:'Karşılaştırma'},
  one_way_anova:{label:'One-Way ANOVA',cat:'Karşılaştırma'},
  kruskal_wallis:{label:'Kruskal-Wallis',cat:'Karşılaştırma'},
  chi_square:{label:'Ki-Kare',cat:'Kategorik'},
  chi_square_test:{label:'Ki-Kare',cat:'Kategorik'},
  fisher_exact:{label:"Fisher's Exact",cat:'Kategorik'},
  fisher_exact_test:{label:"Fisher's Exact",cat:'Kategorik'},
  pearson_correlation:{label:'Pearson Korelasyon',cat:'Korelasyon'},
  spearman_correlation:{label:'Spearman Korelasyon',cat:'Korelasyon'},
  linear_regression:{label:'Lineer Regresyon',cat:'Regresyon'},
  logistic_regression:{label:'Lojistik Regresyon',cat:'Regresyon'},
  kaplan_meier:{label:'Kaplan-Meier',cat:'Survival'},
  log_rank_test:{label:'Log-Rank Testi',cat:'Survival'},
  cox_regression:{label:'Cox Regresyon',cat:'Survival'},
}
const CC = {Normallik:'bg-gray-100 text-gray-600',Tanımlayıcı:'bg-brand-50 text-brand-600',Karşılaştırma:'bg-blue-50 text-blue-700',Kategorik:'bg-amber-50 text-amber-700',Korelasyon:'bg-green-50 text-green-700',Regresyon:'bg-purple-50 text-purple-700',Survival:'bg-red-50 text-red-600'}

// ── Dataset Seçici ────────────────────────────────────────────────────────────
function DatasetSelector({ onLoad }) {
  const [datasets, setDatasets] = useState([])
  const [selected, setSelected] = useState('')
  const [loading, setLoading]   = useState(false)
  const [fetching, setFetching] = useState(false)

  useEffect(() => {
    setFetching(true)
    listOutputs(OUTPUT_TYPES.DATASET)
      .then(setDatasets)
      .catch(() => {})
      .finally(() => setFetching(false))
  }, [])

  const handleLoad = async () => {
    if (!selected) return
    setLoading(true)
    try {
      const record = await getOutput(selected)
      const rows   = await loadDatasetRows(record.id)
      const schema = { ...record.result, rows }
      onLoad(schema, record)
      toast.success(`"${record.title}" yüklendi — ${rows.length} satır`)
    } catch (e) {
      toast.error('Dataset yüklenemedi: ' + (e.message || ''))
    } finally { setLoading(false) }
  }

  if (fetching) return (
    <div className="flex items-center gap-2 text-xs text-gray-400 py-3">
      <div className="w-3 h-3 border border-gray-300 border-t-brand-400 rounded-full animate-spin" />
      Kayıtlı datasetler yükleniyor...
    </div>
  )

  if (!datasets.length) return (
    <div className="flex items-center gap-2 text-xs text-gray-400 py-3">
      <i className="ti ti-inbox text-sm" />
      Henüz kaydedilmiş dataset yok —{' '}
      <a href="/app/data" className="text-brand-600 hover:underline">Veri Girişine git</a>
    </div>
  )

  return (
    <div className="flex items-end gap-2">
      <div className="flex-1">
        <label className="label">Analiz edilecek dataset</label>
        <select className="input" value={selected} onChange={e => setSelected(e.target.value)}>
          <option value="">Dataset seç...</option>
          {datasets.map(d => (
            <option key={d.id} value={d.id}>
              {d.title}
              {d.summary ? ` — ${d.summary}` : ''}
              {' · '}{new Date(d.created_at).toLocaleDateString('tr-TR')}
            </option>
          ))}
        </select>
      </div>
      <button onClick={handleLoad} disabled={!selected || loading}
        className="flex items-center gap-1.5 px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-800 transition-colors disabled:opacity-40">
        {loading
          ? <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          : <i className="ti ti-database-import text-sm" />
        }
        Yükle ve Analiz Et
      </button>
    </div>
  )
}

// ── Ana sayfa ─────────────────────────────────────────────────────────────────
export default function Statistics() {
  const { schema, setSchema } = useDataStore()
  const { recommendation, normalityResults, approvedTests, results, status,
          setRecommendation, toggleTest, setResults, setStatus, reset } = useStatsStore()
  const [busy, setBusy] = useState(false)

  const normalizeTestName = (name) => {
    const map = {
      independent_samples_t_test: 'independent_t_test',
      independent_t_test: 'independent_t_test',
      mann_whitney_u: 'mann_whitney_u',
      paired_t_test: 'paired_t_test',
      one_way_anova: 'one_way_anova',
      anova: 'one_way_anova',
      kruskal_wallis: 'kruskal_wallis',
      chi_square_test: 'chi_square',
      chi_square: 'chi_square',
      fisher_exact_test: 'fisher_exact',
      fisher_exact: 'fisher_exact',
      pearson_correlation: 'pearson_correlation',
      spearman_correlation: 'spearman_correlation',
      linear_regression: 'linear_regression',
      logistic_regression: 'logistic_regression',
      kaplan_meier: 'kaplan_meier',
      log_rank_test: 'log_rank_test',
      cox_regression: 'cox_regression',
      shapiro_wilk: 'shapiro_wilk',
      kolmogorov_smirnov: 'kolmogorov_smirnov',
      descriptive_stats: 'descriptive_stats',
    }
    return map[name] || name
  }

  const payload = () => ({
    columnData: Object.fromEntries(schema.columns.map(c => [c.key, {
      label:c.label, type:c.type,
      values:schema.rows.map(r => r[c.key]??null),
      options:c.options||null
    }])),
    n: schema.rows.length,
    studyType: schema.studyType||'retrospektif',
    studyTitle: schema.studyTitle||'Çalışma',
    groupCandidates: schema.columns.filter(c => c.type==='category'||c.type==='boolean').map(c => c.key),
    outcomeCandidates: schema.columns.filter(c => c.type==='number').map(c => c.key)
  })

  const handleDatasetLoad = (loadedSchema) => {
    setSchema(loadedSchema)
    reset()
  }

  const handleStart = async () => {
    if (!schema) return
    setBusy(true); setStatus('recommending')
    try {
      const data = await statisticsAPI.recommend(payload())

      let rec  = data.recommendation || data
      let norm = data.normalityResults || data.normality || null

      // recommendedTests → tests normalize
      if (rec.recommendedTests && !rec.tests) rec = { ...rec, tests: rec.recommendedTests }
      if (Array.isArray(rec)) rec = { tests: rec, rationale: '' }
      if (!rec.tests && data.tests) rec = { ...rec, tests: data.tests }
      if (!rec.tests) rec = { tests: [], rationale: JSON.stringify(rec).slice(0, 300) }
      if (!Array.isArray(rec.tests)) rec.tests = []

      // Her test için displayName / reason normalize
      rec.tests = rec.tests.map(t => ({
        ...t,
        testName: t.testName,
        displayName: t.displayName || t.label || t.testName,
        reason: t.reason || t.rationale || '',
        columns: t.columns || {}
      }))

      setRecommendation(rec, norm)
      toast.success(rec.tests.length + ' test önerildi.')
    } catch (e) {
      toast.error('Hata: ' + (e.message || ''))
      setStatus('error')
    }
    finally { setBusy(false) }
  }

  const normalizeColumns = (testName, cols) => {
    const norm = normalizeTestName(testName)
    if (!cols) return {}
    if (norm === 'pearson_correlation' || norm === 'spearman_correlation') {
      return { x: cols.var1 || cols.x, y: cols.var2 || cols.y }
    }
    if (norm === 'chi_square' || norm === 'fisher_exact') {
      return { row: cols.row || cols.r1, col: cols.col || cols.column || cols.c1 }
    }
    if (
      norm === 'independent_t_test' ||
      norm === 'mann_whitney_u' ||
      norm === 'one_way_anova' ||
      norm === 'kruskal_wallis'
    ) {
      return {
        group: cols.group || cols.row || cols.factor || cols.independent,
        outcome: cols.outcome || cols.variable || cols.dependent || cols.depended,
      }
    }
    if (norm === 'paired_t_test') {
      return {
        before: cols.before || cols.pre || cols.x,
        after: cols.after || cols.post || cols.y,
      }
    }
    if (norm === 'log_rank_test') {
      return {
        group: cols.group || cols.row || cols.factor,
        time: cols.time || cols.duration,
        event: cols.event || cols.status,
      }
    }
    if (norm === 'cox_regression') {
      return {
        time: cols.time || cols.duration,
        event: cols.event || cols.status,
        covariate: cols.covariate || cols.predictor || cols.x,
      }
    }
    if (norm === 'linear_regression') {
      return {
        predictor: cols.predictor || cols.x || cols.var1,
        outcome: cols.outcome || cols.y || cols.var2,
      }
    }
    if (norm === 'logistic_regression') {
      return {
        outcome:    cols.outcome || cols.dependent,
        predictors: cols.predictors || (cols.predictor ? [cols.predictor] : cols.independents || [])
      }
    }
    return cols
  }

  const enrichedPayload = () => {
    const p = payload()
    Object.values(p.columnData).forEach(col => {
      if (col.type === 'category' || col.type === 'boolean') {
        const uniq = [...new Set(col.values.filter(v => v !== null))]
        if (uniq.length === 2) {
          col.encoded = col.values.map(v => v === uniq[0] ? 0 : v === uniq[1] ? 1 : null)
          col.encodingMap = { [uniq[0]]: 0, [uniq[1]]: 1 }
        }
      }
    })
    return p
  }

  const handleRun = async () => {
    if (!approvedTests.length) { toast.error('En az bir test seçin.'); return }
    setStatus('running')
    try {
      const testObjects = (recommendation?.tests || [])
        .filter(t => approvedTests.includes(t.testName))
        .map(t => ({
          testName: normalizeTestName(t.testName),
          displayName: t.displayName || t.label || t.testName,
          columns: normalizeColumns(t.testName, t.columns),
          reason: t.reason || t.rationale || ''
        }))
        .filter(t => t.testName)
      const data = await statisticsAPI.run(enrichedPayload(), testObjects)
      setResults(data)
      toast.success(`${data.results?.length||0} test tamamlandı!`)
    } catch (e) { toast.error('Analiz hatası: '+(e.message||'')); setStatus('error') }
  }

  const handleLoadStats = (saved) => { setResults(saved); setStatus('done') }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <PageHeader
        icon="ti-chart-bar"
        title="İstatistik Analizi"
        subtitle={schema
          ? `${schema.studyTitle||'Çalışma'} — n=${schema.rows.length}, ${schema.columns.length} değişken`
          : 'Dataset seç ve analiz başlat'
        }
        actions={
          <div className="flex items-center gap-2">
            <SavedBadge type={OUTPUT_TYPES.STATISTICS} />
            {schema && status==='done' && (
              <button className="btn-secondary text-xs" onClick={() => { reset(); setSchema(null) }}>
                <i className="ti ti-refresh text-sm" />Yeni Analiz
              </button>
            )}
            {schema && status==='idle' && (
              <button className="btn-primary" onClick={handleStart} disabled={busy}>
                <i className="ti ti-sparkles text-sm" />{busy ? 'Hazırlanıyor...' : 'Analiz Başlat'}
              </button>
            )}
            {schema && status==='awaiting' && (
              <button className="btn-primary" onClick={handleRun} disabled={!approvedTests.length}>
                <i className="ti ti-player-play text-sm" />{approvedTests.length} Testi Çalıştır
              </button>
            )}
          </div>
        }
      />

      {/* ── BÖLÜM 1: Dataset Seçici ── */}
      <div className="card mb-5">
        <div className="flex items-center gap-2 mb-3">
          <i className="ti ti-table text-brand-600" />
          <span className="section-title">Dataset Seç</span>
          {schema && (
            <span className="badge bg-green-50 text-green-700 ml-auto">
              <i className="ti ti-circle-check text-xs mr-1" />
              {schema.studyTitle||'Dataset'} yüklü
            </span>
          )}
        </div>
        <DatasetSelector onLoad={handleDatasetLoad} />

        {schema && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <div className="grid grid-cols-4 gap-3">
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <div className="text-xl font-medium text-brand-600">{schema.rows.length}</div>
                <div className="text-xs text-gray-500 mt-0.5">Hasta</div>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <div className="text-xl font-medium text-blue-600">{schema.columns.filter(c=>c.type==='number').length}</div>
                <div className="text-xs text-gray-500 mt-0.5">Sayısal değişken</div>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <div className="text-xl font-medium text-amber-600">{schema.columns.filter(c=>c.type==='category'||c.type==='boolean').length}</div>
                <div className="text-xs text-gray-500 mt-0.5">Kategorik değişken</div>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <div className="text-xl font-medium text-green-600">{schema.columns.length}</div>
                <div className="text-xs text-gray-500 mt-0.5">Toplam değişken</div>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {schema.columns.map(c => (
                <span key={c.key} className={`badge text-xs ${
                  c.type==='number' ? 'bg-blue-50 text-blue-700' :
                  c.type==='category' ? 'bg-amber-50 text-amber-700' :
                  c.type==='boolean' ? 'bg-brand-50 text-brand-600' :
                  'bg-gray-100 text-gray-600'
                }`}>
                  {c.label}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── BÖLÜM 2: Kayıtlı istatistik analizi yükle ── */}
      <div className="card mb-5">
        <div className="flex items-center gap-2 mb-3">
          <i className="ti ti-history text-gray-500" />
          <span className="section-title">Kayıtlı Analiz Yükle</span>
        </div>
        <SavedStatsLoader onLoad={handleLoadStats} />
      </div>

      {/* ── Status indicators ── */}
      {(status==='recommending' || busy) && <AgentRunning message="Normallik testleri çalıştırılıyor, uygun testler seçiliyor..." />}
      {status==='running' && <AgentRunning message="Seçilen testler çalıştırılıyor ve yorumlanıyor..." />}

      {/* ── Normallik sonuçları ── */}
      {normalityResults && (
        <ResultCard title="Normallik Testleri (Shapiro-Wilk)" className="mb-4">
          <table className="w-full text-xs">
            <thead><tr className="border-b border-gray-100">
              {['Değişken','n','W','p değeri','Dağılım'].map(h => (
                <th key={h} className="text-left py-2 px-2 text-gray-500 font-medium">{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {Object.entries(normalityResults).map(([k,r]) => (
                <tr key={k} className="border-b border-gray-50">
                  <td className="py-2 px-2 font-medium text-gray-700">{r.label||k}</td>
                  <td className="py-2 px-2 text-gray-500">{r.n||'—'}</td>
                  <td className="py-2 px-2 text-gray-500">{r.W?.toFixed(4)||'—'}</td>
                  <td className="py-2 px-2"><PValueBadge p={r.pValue} /></td>
                  <td className="py-2 px-2">
                    {r.tested
                      ? <span className={`badge ${r.normal?'bg-green-50 text-green-700':'bg-amber-50 text-amber-700'}`}>
                          {r.normal ? 'Normal' : 'Non-parametrik'}
                        </span>
                      : <span className="text-gray-400">{r.reason||'—'}</span>
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ResultCard>
      )}

      {/* ── Test onay adımı ── */}
      {status==='awaiting' && recommendation?.tests && (
        <ResultCard title="Önerilen Testler — Onaylayarak çalıştır" className="mb-4">
          {(recommendation.analysisStrategy || recommendation.rationale) && (
            <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 mb-4">
              <div className="text-xs font-medium text-blue-700 mb-1">Analiz Stratejisi</div>
              <p className="text-xs text-blue-700 leading-relaxed">{recommendation.analysisStrategy || recommendation.rationale}</p>
            </div>
          )}
          {recommendation.warnings?.length > 0 && (
            <div className="bg-amber-50 border border-amber-100 rounded-lg p-3 mb-4">
              <div className="text-xs font-medium text-amber-700 mb-1">Uyarılar</div>
              <ul className="space-y-1">
                {recommendation.warnings.map((w,i) => (
                  <li key={i} className="text-xs text-amber-700 flex gap-1.5">
                    <i className="ti ti-alert-triangle text-[11px] mt-0.5 flex-shrink-0" />{w}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="space-y-2">
            {recommendation.tests.map(test => {
              const meta = TD[test.testName] || { label: test.displayName || test.testName, cat: 'Diğer' }
              const ok   = approvedTests.includes(test.testName)
              return (
                <div key={test.testName + (test.columns ? JSON.stringify(test.columns) : '')} onClick={() => toggleTest(test.testName)}
                  className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${ok?'border-brand-300 bg-brand-50':'border-gray-100 bg-gray-50 opacity-60'}`}>
                  <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${ok?'border-brand-600 bg-brand-600':'border-gray-300'}`}>
                    {ok && <i className="ti ti-check text-white text-[10px]" />}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-800">{meta.label}</span>
                      <span className={`badge text-[10px] ${CC[meta.cat]||'bg-gray-100 text-gray-600'}`}>{meta.cat}</span>
                    </div>
                    {test.reason && <div className="text-xs text-gray-400 mt-0.5">{test.reason}</div>}
                  </div>
                </div>
              )
            })}
          </div>
          <div className="mt-4 pt-3 border-t border-gray-100 flex justify-between items-center">
            <span className="text-xs text-gray-400">{approvedTests.length} / {recommendation?.tests?.length||0} test seçili</span>
            <button className="btn-primary" onClick={handleRun} disabled={!approvedTests.length}>
              <i className="ti ti-player-play text-sm" />Çalıştır
            </button>
          </div>
        </ResultCard>
      )}

      {/* ── Sonuçlar ── */}
      {status==='done' && results && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3 mb-2">
            <StatBox label="Çalıştırılan Test"  value={results.results?.length||0} color="brand" />
            <StatBox label="Tamamlanan"          value={results.results?.filter(r=>r.status==='completed').length||0} color="green" />
            <StatBox label="Hatalı"              value={results.results?.filter(r=>r.status==='error').length||0} color="red" />
          </div>

          {results.results?.map((r,i) => (
            <ResultCard key={i} title={TD[r.testName]?.label||r.testName}>
              {r.status==='error'
                ? <div className="text-sm text-red-600 bg-red-50 rounded-lg p-3"><i className="ti ti-alert-circle mr-2" />{r.error}</div>
                : <div className="grid grid-cols-2 gap-4">
                    <div>
                      {r.result && Object.entries(r.result).map(([k,v]) =>
                        typeof v !== 'object' && (
                          <div key={k} className="flex justify-between text-xs py-1 border-b border-gray-50">
                            <span className="text-gray-400 capitalize">{k.replace(/_/g,' ')}</span>
                            <span className="font-medium text-gray-700">
                              {k.toLowerCase().includes('p') && !k.includes('precision')
                                ? <PValueBadge p={v} />
                                : typeof v==='number' ? v.toFixed(4) : String(v)
                              }
                            </span>
                          </div>
                        )
                      )}
                    </div>
                    {r.interpretation && (
                      <div className="bg-gray-50 rounded-xl p-3">
                        <div className="text-xs font-medium text-gray-500 mb-2">Agent Yorumu</div>
                        {(r.interpretation.conclusion || r.interpretation.summary) && (
                          <p className="text-sm font-medium text-gray-800 mb-2">
                            {r.interpretation.conclusion || r.interpretation.summary}
                          </p>
                        )}
                        {r.interpretation.clinical_relevance && (
                          <p className="text-xs text-gray-600 mb-2">{r.interpretation.clinical_relevance}</p>
                        )}
                        {(r.interpretation.reporting_format || r.interpretation.apa_format) && (
                          <div className="mt-2 p-2 bg-white rounded-lg border border-gray-100">
                            <div className="text-[10px] text-gray-400 mb-0.5">Raporlama</div>
                            <span className="text-xs font-mono text-gray-700">
                              {r.interpretation.reporting_format || r.interpretation.apa_format}
                            </span>
                          </div>
                        )}
                        {!r.interpretation.conclusion && !r.interpretation.summary && (
                          <div className="space-y-1">
                            {Object.entries(r.interpretation)
                              .filter(([k,v]) => typeof v === 'string' && v && k !== 'raw')
                              .map(([k,v]) => (
                                <div key={k}>
                                  <span className="text-[10px] text-gray-400 capitalize">{k.replace(/_/g,' ')}: </span>
                                  <span className="text-xs text-gray-700">{v}</span>
                                </div>
                              ))
                            }
                          </div>
                        )}
                        {r.interpretation.raw && !r.interpretation.conclusion && (
                          <p className="text-xs text-gray-600 whitespace-pre-wrap">{r.interpretation.raw}</p>
                        )}
                      </div>
                    )}
                  </div>
              }
            </ResultCard>
          ))}

          <SaveBar
            type={OUTPUT_TYPES.STATISTICS}
            title={`İstatistik: ${schema?.studyTitle||'Analiz'} — ${new Date().toLocaleDateString('tr-TR')}`}
            query={schema?.studyTitle}
            payload={{ studyTitle: schema?.studyTitle }}
            result={results}
            summary={`${results.results?.filter(r=>r.status==='completed').length||0} test — n=${results.n}`}
          />
        </div>
      )}

      {/* ── Boş durum ── */}
      {status==='idle' && !schema && (
        <EmptyState icon="ti-chart-bar" title="Dataset seçilmedi"
          description="Yukarıdan kayıtlı bir dataset seçin veya önce Veri Girişi sayfasında veri yükleyip kaydedin." />
      )}
      {status==='idle' && schema && (
        <EmptyState icon="ti-chart-bar" title="Analiz başlatılmadı"
          description={`n=${schema.rows.length} satır yüklü. Sağ üstteki 'Analiz Başlat' butonuna basın.`} />
      )}
    </div>
  )
}

// ── Kayıtlı istatistik yükleyici ─────────────────────────────────────────────
function SavedStatsLoader({ onLoad }) {
  const [items, setItems]       = useState([])
  const [selected, setSelected] = useState('')
  const [loading, setLoading]   = useState(false)

  useEffect(() => {
    listOutputs(OUTPUT_TYPES.STATISTICS)
      .then(setItems)
      .catch(() => {})
  }, [])

  const handleLoad = async () => {
    if (!selected) return
    setLoading(true)
    try {
      const record = await getOutput(selected)
      onLoad(record.result)
      toast.success(`"${record.title}" yüklendi`)
    } catch (e) { toast.error('Yükleme hatası') }
    finally { setLoading(false) }
  }

  if (!items.length) return (
    <div className="text-xs text-gray-400 flex items-center gap-1.5">
      <i className="ti ti-inbox text-sm" />Henüz kaydedilmiş analiz yok
    </div>
  )

  return (
    <div className="flex items-end gap-2">
      <div className="flex-1">
        <select className="input" value={selected} onChange={e => setSelected(e.target.value)}>
          <option value="">Önceki analizlerden seç...</option>
          {items.map(item => (
            <option key={item.id} value={item.id}>
              {item.is_pinned ? '📌 ' : ''}{item.title}
              {item.summary ? ` — ${item.summary}` : ''}
              {' · '}{new Date(item.created_at).toLocaleDateString('tr-TR')}
            </option>
          ))}
        </select>
      </div>
      <button onClick={handleLoad} disabled={!selected || loading}
        className="flex items-center gap-1.5 px-3 py-2 bg-brand-50 text-brand-600 border border-brand-200 rounded-lg text-sm font-medium hover:bg-brand-100 transition-colors disabled:opacity-40">
        {loading
          ? <div className="w-3.5 h-3.5 border-2 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
          : <i className="ti ti-download text-sm" />
        }
        Yükle
      </button>
    </div>
  )
}
