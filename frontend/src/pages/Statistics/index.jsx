import { useState, useEffect } from 'react'
import { statisticsAPI } from '@/api'
import { useDataStore, useStatsStore } from '@/store'
import { PageHeader, AgentRunning, ResultCard, PValueBadge, StatBox } from '@/components/ui'
import { SaveBar, SavedBadge } from '@/components/ui/SaveBar'
import { OUTPUT_TYPES, listOutputs, getOutput, loadDatasetRows } from '@/lib/outputs'
import toast from 'react-hot-toast'

// ── Test display map ──────────────────────────────────────────────────────────
const TD = {
  shapiro_wilk:{label:'Shapiro-Wilk',cat:'Normallik'},
  descriptive_stats:{label:'Tanımlayıcı İstatistik',cat:'Tanımlayıcı'},
  independent_t_test:{label:'Bağımsız t-testi',cat:'Karşılaştırma'},
  independent_samples_t_test:{label:'Bağımsız t-testi',cat:'Karşılaştırma'},
  mann_whitney_u:{label:'Mann-Whitney U',cat:'Karşılaştırma'},
  paired_t_test:{label:'Eşleştirilmiş t-testi',cat:'Karşılaştırma'},
  one_way_anova:{label:'One-Way ANOVA',cat:'Karşılaştırma'},
  anova:{label:'One-Way ANOVA',cat:'Karşılaştırma'},
  kruskal_wallis:{label:'Kruskal-Wallis',cat:'Karşılaştırma'},
  chi_square:{label:'Ki-Kare',cat:'Kategorik'},
  chi_square_test:{label:'Ki-Kare',cat:'Kategorik'},
  fisher_exact:{label:"Fisher's Exact",cat:'Kategorik'},
  fisher_exact_test:{label:"Fisher's Exact",cat:'Kategorik'},
  fishers_exact_test:{label:"Fisher's Exact",cat:'Kategorik'},
  fishers_exact:{label:"Fisher's Exact",cat:'Kategorik'},
  pearson_correlation:{label:'Pearson Korelasyon',cat:'Korelasyon'},
  spearman_correlation:{label:'Spearman Korelasyon',cat:'Korelasyon'},
  linear_regression:{label:'Lineer Regresyon',cat:'Regresyon'},
  logistic_regression:{label:'Lojistik Regresyon',cat:'Regresyon'},
  kaplan_meier:{label:'Kaplan-Meier',cat:'Survival'},
  log_rank_test:{label:'Log-Rank Testi',cat:'Survival'},
  cox_regression:{label:'Cox Regresyon',cat:'Survival'},
}
const TYPE_OPTIONS = [
  { value: 'number',   label: 'Sayısal',   color: 'bg-blue-50 text-blue-700' },
  { value: 'category', label: 'Kategorik', color: 'bg-amber-50 text-amber-700' },
  { value: 'boolean',  label: 'Binary',    color: 'bg-brand-50 text-brand-600' },
  { value: 'string',   label: 'Metin',     color: 'bg-gray-100 text-gray-600' },
]

// ── Adım 1: Dataset Seçici ────────────────────────────────────────────────────
function DatasetSelector({ onLoad }) {
  const [datasets, setDatasets] = useState([])
  const [selected, setSelected] = useState('')
  const [loading, setLoading]   = useState(false)
  const [fetching, setFetching] = useState(true)

  useEffect(() => {
    listOutputs(OUTPUT_TYPES.DATASET).then(setDatasets).catch(() => {}).finally(() => setFetching(false))
  }, [])

  const handleLoad = async () => {
    if (!selected) return
    setLoading(true)
    try {
      const record = await getOutput(selected)
      const rows   = await loadDatasetRows(record.id)
      onLoad({ ...record.result, rows }, record)
      toast.success(`"${record.title}" yüklendi — ${rows.length} satır`)
    } catch (e) { toast.error('Dataset yüklenemedi: ' + (e.message || '')) }
    finally { setLoading(false) }
  }

  if (fetching) return (
    <div className="text-xs text-gray-400 py-2 flex items-center gap-2">
      <div className="w-3 h-3 border border-gray-300 border-t-brand-400 rounded-full animate-spin" />
      Yükleniyor...
    </div>
  )

  if (!datasets.length) return (
    <div className="text-xs text-gray-400 flex items-center gap-1.5 py-2">
      <i className="ti ti-inbox text-sm" />
      Kayıtlı dataset yok —{' '}
      <a href="/app/data" className="text-brand-600 hover:underline">Veri Girişine git</a>
    </div>
  )

  return (
    <div className="flex items-end gap-2">
      <div className="flex-1">
        <label className="label">Dataset seç</label>
        <select className="input" value={selected} onChange={e => setSelected(e.target.value)}>
          <option value="">Dataset seç...</option>
          {datasets.map(d => (
            <option key={d.id} value={d.id}>
              {d.title}{d.summary ? ` — ${d.summary}` : ''} · {new Date(d.created_at).toLocaleDateString('tr-TR')}
            </option>
          ))}
        </select>
      </div>
      <button onClick={handleLoad} disabled={!selected || loading}
        className="flex items-center gap-1.5 px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-800 transition-colors disabled:opacity-40">
        {loading
          ? <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          : <i className="ti ti-download text-sm" />
        }
        Yükle
      </button>
    </div>
  )
}

// ── Adım 2: Variable View (SPSS tarzı) ───────────────────────────────────────
function VariableView({ schema, varMeta, onMetaChange, normalityResults, onRunAnalysis, running }) {

  const uniqueCount = (colKey) => {
    const vals = schema.rows.map(r => r[colKey]).filter(v => v !== null && v !== undefined && v !== '')
    return new Set(vals).size
  }

  const selectedVars  = Object.entries(varMeta).filter(([,m]) => m.selected).map(([k]) => k)
  const dependents    = Object.entries(varMeta).filter(([,m]) => m.role === 'dependent').map(([k]) => k)
  const independents  = Object.entries(varMeta).filter(([,m]) => m.role === 'independent').map(([k]) => k)

  // Otomatik test önerisi
  const suggestTest = () => {
    if (selectedVars.length < 2) return null
    const selCols = selectedVars.map(k => ({ key: k, ...varMeta[k], col: schema.columns.find(c => c.key === k) }))
    const numVars = selCols.filter(v => v.type === 'number')
    const catVars = selCols.filter(v => v.type === 'category' || v.type === 'boolean')

    if (numVars.length === 2 && catVars.length === 0) {
      return { type: 'correlation', label: 'Korelasyon Analizi', desc: 'İki sayısal değişken → Pearson veya Spearman', icon: 'ti-chart-dots', color: 'bg-green-50 text-green-700 border-green-200' }
    }
    if (numVars.length === 1 && catVars.length === 1) {
      const n = uniqueCount(catVars[0].key)
      const catLabel = catVars[0].col?.label || catVars[0].key
      const numLabel = numVars[0].col?.label || numVars[0].key
      if (n === 2) return { type: 'compare_2', label: '2 Grup Karşılaştırma', desc: `${catLabel} (2 grup) → ${numLabel} karşılaştır`, icon: 'ti-chart-bar', color: 'bg-blue-50 text-blue-700 border-blue-200' }
      if (n >= 3) return { type: 'compare_multi', label: `${n} Grup Karşılaştırma`, desc: `${catLabel} (${n} grup) → ${numLabel} karşılaştır`, icon: 'ti-chart-bar', color: 'bg-blue-50 text-blue-700 border-blue-200' }
    }
    // Sayısal + kategorik (farklı sıra) — aynı mantık
    if (numVars.length >= 1 && catVars.length >= 1) {
      const n = uniqueCount(catVars[0].key)
      const catLabel = catVars[0].col?.label || catVars[0].key
      const numLabel = numVars[0].col?.label || numVars[0].key
      if (n === 2) return { type: 'compare_2', label: '2 Grup Karşılaştırma', desc: `${catLabel} (2 grup) → ${numLabel} karşılaştır`, icon: 'ti-chart-bar', color: 'bg-blue-50 text-blue-700 border-blue-200' }
      if (n >= 3) return { type: 'compare_multi', label: `${n} Grup Karşılaştırma`, desc: `${catLabel} (${n} grup) → ${numLabel} karşılaştır`, icon: 'ti-chart-bar', color: 'bg-blue-50 text-blue-700 border-blue-200' }
    }
    if (numVars.length === 0 && catVars.length === 2) {
      return { type: 'categorical', label: 'Kategorik İlişki', desc: 'İki kategorik değişken → Ki-Kare veya Fisher', icon: 'ti-grid-dots', color: 'bg-amber-50 text-amber-700 border-amber-200' }
    }
    if (numVars.length >= 2 && dependents.length === 1) {
      return { type: 'regression', label: 'Regresyon', desc: `${dependents[0]} outcome, ${independents.length} bağımsız değişken`, icon: 'ti-trending-up', color: 'bg-purple-50 text-purple-700 border-purple-200' }
    }
    if (selectedVars.length >= 1 && numVars.length >= 1) {
      return { type: 'descriptive', label: 'Tanımlayıcı İstatistik', desc: `${selectedVars.length} değişken için özet istatistik`, icon: 'ti-list', color: 'bg-brand-50 text-brand-600 border-brand-200' }
    }
    return null
  }

  const suggestion = suggestTest()

  return (
    <div>
      {/* Variable View tablosu */}
      <div className="overflow-x-auto rounded-xl border border-gray-100 mb-4">
        <table className="w-full text-xs">
          <thead className="bg-gray-50 sticky top-0">
            <tr>
              <th className="text-left py-2.5 px-3 text-gray-500 font-medium w-8">
                <input type="checkbox"
                  checked={selectedVars.length === schema.columns.length}
                  onChange={e => schema.columns.forEach(c => onMetaChange(c.key, 'selected', e.target.checked))}
                  className="rounded" />
              </th>
              <th className="text-left py-2.5 px-3 text-gray-500 font-medium">Değişken</th>
              <th className="text-left py-2.5 px-3 text-gray-500 font-medium">Veri Tipi</th>
              <th className="text-left py-2.5 px-3 text-gray-500 font-medium">Rol</th>
              <th className="text-left py-2.5 px-3 text-gray-500 font-medium">n</th>
              <th className="text-left py-2.5 px-3 text-gray-500 font-medium">Unique</th>
              <th className="text-left py-2.5 px-3 text-gray-500 font-medium">Normallik</th>
            </tr>
          </thead>
          <tbody>
            {schema.columns.map((col, i) => {
              const meta  = varMeta[col.key] || {}
              const norm  = normalityResults?.[col.key]
              const uniq  = uniqueCount(col.key)
              const vals  = schema.rows.map(r => r[col.key]).filter(v => v !== null && v !== '')
              const isSelected = meta.selected

              return (
                <tr key={col.key}
                  className={`border-b border-gray-50 transition-colors ${isSelected ? 'bg-brand-50/40' : 'hover:bg-gray-50/50'}`}>

                  {/* Checkbox */}
                  <td className="py-2 px-3">
                    <input type="checkbox" checked={!!isSelected}
                      onChange={e => onMetaChange(col.key, 'selected', e.target.checked)}
                      className="rounded accent-brand-600" />
                  </td>

                  {/* İsim */}
                  <td className="py-2 px-3">
                    <div className="font-medium text-gray-800">{col.label}</div>
                    <div className="text-[10px] text-gray-400 font-mono">{col.key}</div>
                  </td>

                  {/* Veri tipi dropdown */}
                  <td className="py-2 px-3">
                    <select
                      value={meta.type || col.type}
                      onChange={e => onMetaChange(col.key, 'type', e.target.value)}
                      className="text-xs border border-gray-200 rounded-md px-2 py-1 bg-white focus:outline-none focus:border-brand-400"
                    >
                      {TYPE_OPTIONS.map(t => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                  </td>

                  {/* Rol */}
                  <td className="py-2 px-3">
                    <div className="flex gap-1">
                      {[
                        { value: 'dependent',   label: 'Bağımlı',   short: 'Y' },
                        { value: 'independent', label: 'Bağımsız',  short: 'X' },
                        { value: 'none',        label: 'Yok',       short: '—' },
                      ].map(r => (
                        <button key={r.value}
                          onClick={() => onMetaChange(col.key, 'role', r.value)}
                          title={r.label}
                          className={`w-6 h-6 rounded text-[10px] font-bold transition-colors ${
                            (meta.role || 'none') === r.value
                              ? r.value === 'dependent'   ? 'bg-purple-600 text-white'
                              : r.value === 'independent' ? 'bg-blue-600 text-white'
                              : 'bg-gray-200 text-gray-600'
                              : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                          }`}>
                          {r.short}
                        </button>
                      ))}
                    </div>
                  </td>

                  {/* n */}
                  <td className="py-2 px-3 text-gray-500">{vals.length}</td>

                  {/* Unique */}
                  <td className="py-2 px-3 text-gray-500">
                    {(meta.type || col.type) !== 'number'
                      ? <span className="text-amber-600 font-medium">{uniq}</span>
                      : <span className="text-gray-400">—</span>
                    }
                  </td>

                  {/* Normallik */}
                  <td className="py-2 px-3">
                    {norm?.tested ? (
                      <div className="flex items-center gap-1.5">
                        <span className={`badge text-[10px] ${norm.normal ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
                          {norm.normal ? 'Normal' : 'Non-normal'}
                        </span>
                        <span className="text-[10px] text-gray-400">p={norm.pValue?.toFixed(3)}</span>
                      </div>
                    ) : (meta.type || col.type) === 'number' ? (
                      <span className="text-[10px] text-gray-300">—</span>
                    ) : (
                      <span className="text-[10px] text-gray-300">N/A</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Seçim özeti + test önerisi */}
      {selectedVars.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <i className="ti ti-check-box text-brand-600" />
            <span><b className="text-gray-700">{selectedVars.length}</b> değişken seçildi:</span>
            {selectedVars.map(k => {
              const col = schema.columns.find(c => c.key === k)
              const m = varMeta[k] || {}
              return (
                <span key={k} className={`px-2 py-0.5 rounded-full border text-[11px] ${
                  m.role === 'dependent' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                  m.role === 'independent' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                  'bg-gray-100 text-gray-600 border-gray-200'
                }`}>
                  {col?.label}
                  {m.role === 'dependent' && <span className="ml-1 opacity-60">(Y)</span>}
                  {m.role === 'independent' && <span className="ml-1 opacity-60">(X)</span>}
                </span>
              )
            })}
          </div>

          {/* Test önerisi */}
          {suggestion && (
            <div className={`flex items-center justify-between p-3.5 rounded-xl border ${suggestion.color}`}>
              <div className="flex items-center gap-3">
                <i className={`ti ${suggestion.icon} text-lg`} />
                <div>
                  <div className="text-sm font-medium">{suggestion.label}</div>
                  <div className="text-xs opacity-70 mt-0.5">{suggestion.desc}</div>
                </div>
              </div>
              <button onClick={() => onRunAnalysis(suggestion.type, selectedVars, varMeta)}
                disabled={running}
                className="flex items-center gap-2 px-4 py-2 bg-white/80 rounded-lg text-sm font-medium hover:bg-white transition-colors border border-current/20 disabled:opacity-40">
                {running
                  ? <div className="w-3.5 h-3.5 border-2 border-current/30 border-t-current rounded-full animate-spin" />
                  : <i className="ti ti-sparkles text-sm" />
                }
                {running ? 'Çalışıyor...' : 'Bu Testi Çalıştır'}
              </button>
            </div>
          )}

          {!suggestion && selectedVars.length >= 2 && (
            <div className="flex items-center gap-2 p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-500">
              <i className="ti ti-info-circle text-sm" />
              Seçilen değişken kombinasyonu için uygun test bulunamadı. Veri tiplerini veya rolleri düzenleyin.
            </div>
          )}


        </div>
      )}

      {selectedVars.length === 0 && (
        <div className="text-xs text-gray-400 flex items-center gap-2 py-2">
          <i className="ti ti-checkbox text-sm" />
          Analiz etmek istediğiniz değişkenleri seçin (checkbox)
        </div>
      )}
    </div>
  )
}

// ── Manuel Test Seçici ───────────────────────────────────────────────────────
// ── Test Dialog (SPSS tarzı) ──────────────────────────────────────────────────
function TestDialog({ test, schema, varMeta, normalityResults, onRun, onClose }) {
  const allVars = schema.columns.map(c => ({
    key: c.key,
    label: c.label,
    type: varMeta[c.key]?.type || c.type,
  }))

  // Her test için alan tanımları
  const getFields = () => {
    switch (test.id) {
      case 'compare_2':
      case 'compare_2_nonparam':
      case 'compare_multi':
      case 'compare_multi_nonparam':
        return [
          { key: 'outcome', label: 'Test Değişkeni', desc: 'Karşılaştırılacak sayısal değişken', multi: false, accepts: ['number'] },
          { key: 'group',   label: 'Gruplama Değişkeni', desc: 'Grupları tanımlayan kategorik değişken', multi: false, accepts: ['category','boolean'] },
        ]
      case 'correlation':
        return [
          { key: 'x', label: '1. Değişken', desc: 'Sayısal', multi: false, accepts: ['number'] },
          { key: 'y', label: '2. Değişken', desc: 'Sayısal', multi: false, accepts: ['number'] },
        ]
      case 'paired':
        return [
          { key: 'before', label: 'Önce (1. ölçüm)', desc: 'Sayısal', multi: false, accepts: ['number'] },
          { key: 'after',  label: 'Sonra (2. ölçüm)', desc: 'Sayısal', multi: false, accepts: ['number'] },
        ]
      case 'regression':
        return [
          { key: 'outcome',    label: 'Bağımlı Değişken (Y)', desc: 'Sayısal outcome', multi: false, accepts: ['number'] },
          { key: 'predictors', label: 'Bağımsız Değişkenler (X)', desc: 'Birden fazla seçilebilir', multi: true, accepts: ['number','category','boolean'] },
        ]
      case 'regression_logistic':
        return [
          { key: 'outcome',    label: 'Bağımlı Değişken (Y)', desc: 'Binary/Kategorik (2 kategori)', multi: false, accepts: ['category','boolean'] },
          { key: 'predictors', label: 'Bağımsız Değişkenler (X)', desc: 'Birden fazla seçilebilir', multi: true, accepts: ['number','category','boolean'] },
        ]
      case 'categorical':
        return [
          { key: 'row', label: 'Satır Değişkeni', desc: 'Kategorik', multi: false, accepts: ['category','boolean'] },
          { key: 'col', label: 'Sütun Değişkeni', desc: 'Kategorik', multi: false, accepts: ['category','boolean'] },
        ]
      case 'kaplan_meier':
        return [
          { key: 'time',  label: 'Zaman Değişkeni', desc: 'Sayısal (gün, ay vb.)', multi: false, accepts: ['number'] },
          { key: 'event', label: 'Event Değişkeni', desc: 'Binary (0=sansürlü, 1=event)', multi: false, accepts: ['number','boolean'] },
        ]
      case 'log_rank':
        return [
          { key: 'time',  label: 'Zaman Değişkeni', desc: 'Sayısal', multi: false, accepts: ['number'] },
          { key: 'event', label: 'Event Değişkeni', desc: 'Binary (0/1)', multi: false, accepts: ['number','boolean'] },
          { key: 'group', label: 'Gruplama Değişkeni', desc: 'Kategorik (2 grup)', multi: false, accepts: ['category','boolean'] },
        ]
      case 'cox':
        return [
          { key: 'time',      label: 'Zaman Değişkeni', desc: 'Sayısal', multi: false, accepts: ['number'] },
          { key: 'event',     label: 'Event Değişkeni', desc: 'Binary (0/1)', multi: false, accepts: ['number','boolean'] },
          { key: 'covariate', label: 'Kovaryat', desc: 'Sağkalıma etkisi test edilecek sayısal değişken', multi: false, accepts: ['number','boolean'] },
        ]
      case 'descriptive':
        return [
          { key: 'variables', label: 'Değişkenler', desc: 'Birden fazla seçilebilir', multi: true, accepts: ['number','category','boolean','string'] },
        ]
      default:
        return [
          { key: 'outcome', label: 'Değişken', desc: 'Herhangi', multi: false, accepts: ['number','category','boolean','string'] },
        ]
    }
  }

  const fields = getFields()
  const [assignments, setAssignments] = useState({})

  const assign = (fieldKey, varKey, isMulti) => {
    setAssignments(prev => {
      if (isMulti) {
        const arr = prev[fieldKey] || []
        return { ...prev, [fieldKey]: arr.includes(varKey) ? arr.filter(v => v !== varKey) : [...arr, varKey] }
      }
      return { ...prev, [fieldKey]: prev[fieldKey] === varKey ? null : varKey }
    })
  }

  const isAssigned = (varKey) => {
    return Object.values(assignments).some(v =>
      Array.isArray(v) ? v.includes(varKey) : v === varKey
    )
  }

  const isNormal = (k) => normalityResults?.[k]?.normal !== false

  const getTestLabel = () => {
    if (test.id === 'compare_2' || test.id === 'compare_2_nonparam' || test.id === 'compare_multi' || test.id === 'compare_multi_nonparam') {
      const outcome = assignments.outcome
      const group   = assignments.group
      if (outcome && group) {
        const groupUniq = new Set(schema.rows.map(r => r[group]).filter(Boolean)).size
        const multi = groupUniq >= 3
        if (test.forceNonParam || test.id.endsWith('_nonparam')) {
          return multi ? 'Kruskal-Wallis' : 'Mann-Whitney U'
        }
        return multi
          ? (isNormal(outcome) ? 'One-Way ANOVA' : 'Kruskal-Wallis')
          : (isNormal(outcome) ? 'Bağımsız t-testi' : 'Mann-Whitney U')
      }
    }
    if (test.id === 'correlation') {
      const v1 = assignments.x, v2 = assignments.y
      if (v1 && v2) return (isNormal(v1) && isNormal(v2)) ? 'Pearson Korelasyon' : 'Spearman Korelasyon'
    }
    return test.label
  }

  const canRun = fields.every(f => {
    const val = assignments[f.key]
    if (f.multi) return Array.isArray(val) && val.length > 0
    return val != null && val !== ''
  })

  const handleRun = () => {
    const cols = {}
    fields.forEach(f => { cols[f.key] = assignments[f.key] })
    const runType = test.forceNonParam ? `${test.id}_nonparam` : test.id
    onRun(runType === 'regression_logistic' ? 'regression_logistic' : runType, assignments, varMeta, cols)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h3 className="text-base font-semibold text-gray-900">{test.label}</h3>
            <p className="text-xs text-gray-400 mt-0.5">{test.desc}</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
            <i className="ti ti-x text-gray-500 text-sm" />
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* Sol: Değişken listesi */}
          <div className="w-56 border-r border-gray-100 flex flex-col">
            <div className="px-3 py-2 bg-gray-50 border-b border-gray-100">
              <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Değişkenler</div>
            </div>
            <div className="flex-1 overflow-y-auto py-1">
              {allVars.map(v => {
                const used = isAssigned(v.key)
                return (
                  <div key={v.key}
                    className={`flex items-center gap-2 px-3 py-1.5 text-xs transition-colors ${used ? 'opacity-40' : 'hover:bg-gray-50 cursor-pointer'}`}>
                    <div className={`w-2 h-2 rounded-sm flex-shrink-0 ${
                      v.type === 'number' ? 'bg-blue-400' :
                      v.type === 'category' ? 'bg-amber-400' :
                      'bg-brand-400'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-700 truncate">{v.label}</div>
                    </div>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded ${
                      v.type === 'number' ? 'bg-blue-50 text-blue-600' :
                      v.type === 'category' ? 'bg-amber-50 text-amber-600' :
                      'bg-brand-50 text-brand-600'
                    }`}>
                      {v.type === 'number' ? 'Say' : v.type === 'category' ? 'Kat' : 'Bin'}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Sağ: Alan slotları */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {fields.map(field => {
              const assigned   = assignments[field.key]
              const hasValue   = field.multi ? (Array.isArray(assigned) && assigned.length > 0) : !!assigned
              const acceptedVars = allVars.filter(v => field.accepts.includes(v.type))

              return (
                <div key={field.key}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div>
                      <label className="text-xs font-semibold text-gray-700">{field.label}</label>
                      <span className="text-[10px] text-gray-400 ml-2">{field.desc}</span>
                    </div>
                    {!hasValue && <span className="text-[10px] text-red-400">Boş</span>}
                    {hasValue && <span className="text-[10px] text-green-600 flex items-center gap-1"><i className="ti ti-check text-[10px]" />Seçildi</span>}
                  </div>

                  {/* Slot */}
                  <div className={`border-2 border-dashed rounded-xl p-2 min-h-[44px] transition-colors ${hasValue ? 'border-brand-300 bg-brand-50/30' : 'border-gray-200 bg-gray-50/50'}`}>
                    {/* Atanmış değişkenler */}
                    {field.multi && Array.isArray(assigned) && assigned.map(k => {
                      const v = allVars.find(x => x.key === k)
                      return (
                        <span key={k} className="inline-flex items-center gap-1 m-0.5 px-2 py-1 bg-brand-600 text-white rounded-lg text-xs">
                          {v?.label || k}
                          <button onClick={() => assign(field.key, k, true)} className="ml-0.5 opacity-70 hover:opacity-100">
                            <i className="ti ti-x text-[10px]" />
                          </button>
                        </span>
                      )
                    })}
                    {!field.multi && assigned && (
                      <span className="inline-flex items-center gap-1 m-0.5 px-2 py-1 bg-brand-600 text-white rounded-lg text-xs">
                        {allVars.find(v => v.key === assigned)?.label || assigned}
                        <button onClick={() => assign(field.key, assigned, false)} className="ml-0.5 opacity-70 hover:opacity-100">
                          <i className="ti ti-x text-[10px]" />
                        </button>
                      </span>
                    )}
                    {!hasValue && <span className="text-[10px] text-gray-300 px-1">Değişken seçin...</span>}
                  </div>

                  {/* Eklenebilir değişkenler */}
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {acceptedVars
                      .filter(v => field.multi
                        ? !(Array.isArray(assigned) && assigned.includes(v.key))
                        : assigned !== v.key
                      )
                      .filter(v => !isAssigned(v.key) || (field.multi && Array.isArray(assigned) && assigned.includes(v.key)))
                      .map(v => (
                        <button key={v.key}
                          onClick={() => assign(field.key, v.key, field.multi)}
                          className="flex items-center gap-1 px-2 py-1 bg-white border border-gray-200 rounded-lg text-xs text-gray-600 hover:border-brand-400 hover:text-brand-600 transition-colors">
                          <i className="ti ti-plus text-[10px]" />{v.label}
                        </button>
                      ))
                    }
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between bg-gray-50/50">
          <div className="text-xs text-gray-500 flex items-center gap-1.5">
            <i className="ti ti-sparkles text-brand-500" />
            {canRun ? (
              <span>Seçilen teste göre: <b className="text-gray-700">{getTestLabel()}</b></span>
            ) : (
              <span>Tüm alanları doldurun</span>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="btn-secondary text-xs py-1.5">İptal</button>
            <button onClick={handleRun} disabled={!canRun}
              className="btn-primary text-xs py-1.5 disabled:opacity-40">
              <i className="ti ti-player-play text-xs" />Analizi Çalıştır
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

const MANUAL_TESTS = [
  {
    group: 'Karşılaştırma',
    color: 'bg-blue-50 text-blue-700',
    tests: [
      { id: 'compare_2',     label: 'Bağımsız t-testi / Mann-Whitney U', desc: '2 grup × 1 sayısal değişken', needs: '1 kategorik (2 grup) + 1 sayısal',
        check: (n, c, sel) => n >= 1 && c >= 1 },
      { id: 'compare_multi', label: 'ANOVA / Kruskal-Wallis',             desc: '3+ grup × 1 sayısal değişken', needs: '1 kategorik (3+ grup) + 1 sayısal',
        check: (n, c, sel) => n >= 1 && c >= 1 },
      { id: 'paired',        label: 'Eşleştirilmiş t-testi / Wilcoxon',  desc: 'Aynı hastanın iki ölçümü', needs: '2 sayısal değişken (önce/sonra)',
        check: (n, c, sel) => n >= 2 },
    ]
  },
  {
    group: 'Korelasyon & Regresyon',
    color: 'bg-green-50 text-green-700',
    tests: [
      { id: 'correlation',   label: 'Korelasyon (Pearson / Spearman)',    desc: 'İki sayısal değişken arası ilişki', needs: '2 sayısal değişken',
        check: (n, c, sel) => n >= 2 },
      { id: 'regression',    label: 'Lineer Regresyon',                   desc: 'Sayısal outcome + 1+ bağımsız değişken', needs: '1 bağımlı (Y) + 1+ bağımsız (X)',
        check: (n, c, sel) => n >= 2 },
      { id: 'regression',    label: 'Lojistik Regresyon',                 desc: 'Binary outcome + 1+ bağımsız değişken', needs: '1 binary bağımlı (Y) + 1+ X', forceLogistic: true,
        check: (n, c, sel) => c >= 1 && n >= 1 },
    ]
  },
  {
    group: 'Kategorik',
    color: 'bg-amber-50 text-amber-700',
    tests: [
      { id: 'categorical',   label: "Ki-Kare / Fisher's Exact",           desc: 'İki kategorik değişken arası ilişki', needs: '2 kategorik değişken',
        check: (n, c, sel) => c >= 2 },
    ]
  },
  {
    group: 'Survival',
    color: 'bg-red-50 text-red-600',
    tests: [
      { id: 'kaplan_meier',  label: 'Kaplan-Meier',                       desc: 'Sağkalım eğrisi', needs: '1 zaman + 1 event (0/1) değişkeni',
        check: (n, c, sel) => n >= 2 },
      { id: 'log_rank',      label: 'Log-Rank Testi',                     desc: 'İki grubun sağkalım karşılaştırması', needs: '1 zaman + 1 event + 1 grup değişkeni',
        check: (n, c, sel) => n >= 2 && c >= 1 },
    ]
  },
  {
    group: 'Tanımlayıcı',
    color: 'bg-brand-50 text-brand-600',
    tests: [
      { id: 'descriptive',   label: 'Tanımlayıcı İstatistik',             desc: 'Ortalama, medyan, SS, min, max', needs: 'Herhangi sayısal değişken',
        check: (n, c, sel) => sel >= 1 },
    ]
  },
]

function ManualTestPicker({ selectedVars, varMeta, schema, normalityResults, onRunAnalysis, running }) {
  const [open, setOpen]           = useState(false)
  const [activeDialog, setActiveDialog] = useState(null)  // { test, ... }

  const numCount = selectedVars.filter(k => (varMeta[k]?.type || 'number') === 'number').length
  const catCount = selectedVars.filter(k => ['category','boolean'].includes(varMeta[k]?.type || '')).length
  const selCount = selectedVars.length

  const handleDialogRun = (suggestionType, assignments, meta, cols) => {
    // assignments'tan selectedVars benzeri bir liste oluştur
    const allAssigned = Object.values(assignments).flat().filter(Boolean)
    const uniqueVars  = [...new Set(allAssigned)]

    // varMeta'yı assignments'a göre güncelle
    const updatedMeta = { ...meta }

    onRunAnalysis(suggestionType, uniqueVars, updatedMeta, cols)
  }

  return (
    <div className="mt-2">
      <button onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 text-xs text-gray-500 hover:text-brand-600 transition-colors">
        <i className={`ti ${open ? 'ti-chevron-up' : 'ti-chevron-down'} text-sm`} />
        {open ? 'Test listesini kapat' : 'Farklı bir test seç (ANOVA, Regresyon, Kaplan-Meier...)'}
      </button>

      {open && (
        <div className="mt-3 border border-gray-100 rounded-xl overflow-hidden">
          {MANUAL_TESTS.map(group => (
            <div key={group.group}>
              <div className={`px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider ${group.color}`}>
                {group.group}
              </div>
              {group.tests.map((test, i) => {
                const compatible = test.check ? test.check(numCount, catCount, selCount) : true
                const testObj    = { ...test, id: test.forceLogistic ? 'regression_logistic' : test.id }

                return (
                  <button key={i}
                    onClick={() => { setActiveDialog(testObj); setOpen(false) }}
                    disabled={running}
                    className={[
                      'w-full flex items-start justify-between px-4 py-2.5 border-t border-gray-50 text-left transition-all duration-300 disabled:opacity-40',
                      compatible ? 'animate-pulse-green' : 'animate-pulse-red'
                    ].join(' ')}
                  >
                    <div className="flex items-start gap-2.5">
                      <div className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${compatible ? 'bg-green-500' : 'bg-red-400'}`} />
                      <div>
                        <div className={`text-sm font-medium ${compatible ? 'text-green-800' : 'text-red-700 opacity-70'}`}>
                          {test.label}
                        </div>
                        <div className={`text-xs mt-0.5 ${compatible ? 'text-green-600' : 'text-red-400'}`}>
                          {test.desc}
                        </div>
                      </div>
                    </div>
                    <div className={`text-[10px] text-right ml-4 flex-shrink-0 mt-0.5 ${compatible ? 'text-green-600 font-medium' : 'text-red-300'}`}>
                      {test.needs}
                    </div>
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      )}

      {/* SPSS Dialog */}
      {activeDialog && (
        <TestDialog
          test={activeDialog}
          schema={schema}
          varMeta={varMeta}
          normalityResults={normalityResults}
          onRun={handleDialogRun}
          onClose={() => setActiveDialog(null)}
        />
      )}
    </div>
  )
}

// ── Test Paneli (SPSS menü tarzı sağ sidebar) ───────────────────────────────
const TEST_CATEGORIES = [
  {
    id: 'compare', label: 'Karşılaştırma', icon: 'ti-chart-bar', color: '#378ADD',
    tests: [
      { id: 'compare_2',     label: 'Bağımsız t-testi\nMann-Whitney U',  short: 't / MW',   needs: { num: 1, cat: 1 } },
      { id: 'compare_multi', label: 'ANOVA\nKruskal-Wallis',              short: 'ANOVA',    needs: { num: 1, cat: 1 } },
      { id: 'paired',        label: 'Eşleştirilmiş t-testi',              short: 'Paired',   needs: { num: 2 } },
    ]
  },
  {
    id: 'corr', label: 'Korelasyon & Regresyon', icon: 'ti-trending-up', color: '#1D9E75',
    tests: [
      { id: 'correlation',         label: 'Pearson Korelasyon\nSpearman',         short: 'r',       needs: { num: 2 } },
      { id: 'regression',          label: 'Lineer Regresyon',                      short: 'LinReg',  needs: { num: 2 } },
      { id: 'regression_logistic', label: 'Lojistik Regresyon',                    short: 'LogReg',  needs: { num: 1, cat: 1 } },
      { id: 'cox',                 label: 'Cox Regresyon',                          short: 'Cox',     needs: { num: 2, cat: 1 } },
    ]
  },
  {
    id: 'cat', label: 'Kategorik', icon: 'ti-grid-dots', color: '#BA7517',
    tests: [
      { id: 'categorical', label: "Ki-Kare\nFisher's Exact", short: 'χ²', needs: { cat: 2 } },
    ]
  },
  {
    id: 'survival', label: 'Survival', icon: 'ti-heartbeat', color: '#D4537E',
    tests: [
      { id: 'kaplan_meier', label: 'Kaplan-Meier',    short: 'KM',  needs: { num: 2 } },
      { id: 'log_rank',     label: 'Log-Rank Testi',  short: 'LR',  needs: { num: 2, cat: 1 } },
    ]
  },
  {
    id: 'desc', label: 'Tanımlayıcı', icon: 'ti-list', color: '#534AB7',
    tests: [
      { id: 'descriptive', label: 'Tanımlayıcı İstatistik', short: 'Desc', needs: { num: 1 } },
    ]
  },
  {
    id: 'nonpar', label: 'Non-Parametrik', icon: 'ti-wave-sine', color: '#0891b2',
    tests: [
      { id: 'compare_2',     label: 'Mann-Whitney U',      short: 'MW',  needs: { num: 1, cat: 1 }, forceNonParam: true },
      { id: 'compare_multi', label: 'Kruskal-Wallis',      short: 'KW',  needs: { num: 1, cat: 1 }, forceNonParam: true },
    ]
  },
]

function TestPanel({ schema, varMeta, normalityResults, onRunAnalysis, running }) {
  const [openCats, setOpenCats]     = useState({ compare: true, corr: true })
  const [activeDialog, setActiveDialog] = useState(null)

  const numCount = schema ? Object.values(varMeta).filter(m => m?.type === 'number').length : 0
  const catCount = schema ? Object.values(varMeta).filter(m => ['category','boolean'].includes(m?.type)).length : 0

  const compatible = (needs) => {
    if (needs.num && numCount < needs.num) return false
    if (needs.cat && catCount < needs.cat) return false
    return true
  }

  const allVarsMeta = schema ? Object.fromEntries(schema.columns.map(c => [c.key, varMeta[c.key] || { type: c.type, role: 'none', selected: false }])) : {}

  return (
    <div className="h-full flex flex-col bg-white border border-gray-100 rounded-xl overflow-hidden">
      <div className="px-3 py-2.5 bg-gray-50 border-b border-gray-100 flex-shrink-0">
        <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
          <i className="ti ti-test-pipe text-sm" />Test Paneli
        </div>
        {!schema && <div className="text-[10px] text-gray-300 mt-0.5">Dataset yükle</div>}
      </div>

      <div className="flex-1 overflow-y-auto py-1">
        {TEST_CATEGORIES.map(cat => {
          const isOpen = openCats[cat.id] !== false
          return (
            <div key={cat.id}>
              {/* Category header */}
              <button
                onClick={() => setOpenCats(o => ({ ...o, [cat.id]: !isOpen }))}
                className="w-full flex items-center justify-between px-3 py-2 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <i className={`ti ${cat.icon} text-sm`} style={{ color: cat.color }} />
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">{cat.label}</span>
                </div>
                <i className={`ti ${isOpen ? 'ti-chevron-up' : 'ti-chevron-down'} text-[10px] text-gray-400`} />
              </button>

              {isOpen && cat.tests.map((test, i) => {
                const ok = schema && compatible(test.needs)
                const testObj = { ...test, label: test.label.replace('\n', ' / '), desc: '' }

                return (
                  <button key={i}
                    onClick={() => schema && setActiveDialog(testObj)}
                    disabled={running || !schema}
                    className={`w-full text-left px-3 py-2 border-t border-gray-50 transition-all
                      ${!schema ? 'opacity-30 cursor-not-allowed' :
                        ok ? 'hover:bg-green-50/60 cursor-pointer' : 'hover:bg-red-50/40 cursor-pointer opacity-60'}
                    `}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${ok && schema ? 'bg-green-500' : 'bg-red-300'}`} />
                        <span className="text-xs text-gray-700 leading-snug whitespace-pre-line">{test.label}</span>
                      </div>
                      <span className="text-[9px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-mono flex-shrink-0">{test.short}</span>
                    </div>
                  </button>
                )
              })}
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div className="px-3 py-2 border-t border-gray-100 bg-gray-50/50 flex gap-3 flex-shrink-0">
        <div className="flex items-center gap-1 text-[9px] text-gray-400">
          <div className="w-1.5 h-1.5 rounded-full bg-green-500" />Uyumlu
        </div>
        <div className="flex items-center gap-1 text-[9px] text-gray-400">
          <div className="w-1.5 h-1.5 rounded-full bg-red-300" />Değişken eksik
        </div>
      </div>

      {/* Dialog */}
      {activeDialog && schema && (
        <TestDialog
          test={activeDialog}
          schema={schema}
          varMeta={allVarsMeta}
          normalityResults={normalityResults}
          onRun={(type, assignments, meta, cols) => {
            const allAssigned = Object.values(assignments).flat().filter(Boolean)
            onRunAnalysis(type, [...new Set(allAssigned)], meta, cols)
            setActiveDialog(null)
          }}
          onClose={() => setActiveDialog(null)}
        />
      )}
    </div>
  )
}

// ── Ana sayfa ─────────────────────────────────────────────────────────────────
export default function Statistics() {
  const { schema, setSchema } = useDataStore()
  const { results, status, setRecommendation, setResults, setStatus, reset } = useStatsStore()
  const [varMeta, setVarMeta]     = useState({})   // { colKey: { selected, type, role } }
  const [activeDialog, setActiveDialog] = useState(null)
  const [normLoading, setNormLoading] = useState(false)
  const [busy, setBusy]           = useState(false)
  const [sourceDataset, setSourceDataset] = useState(null)

  // Dataset yüklenince varMeta'yı başlat ve normallik çalıştır
  // Dialog'dan gelen analizi çalıştır
  const handleDialogRun = (suggestionType, assignments, meta, cols) => {
    const allAssigned = Object.values(assignments).flat().filter(Boolean)
    const uniqueVars  = [...new Set(allAssigned)]
    handleRunAnalysis(suggestionType, uniqueVars, meta, cols)
    setActiveDialog(null)
  }

  const handleDatasetLoad = async (loadedSchema, record = null) => {
    setSchema(loadedSchema)
    reset()
    setSourceDataset(record ? {
      id: record.id,
      title: record.title,
      version: record.updated_at || record.created_at || null
    } : null)

    // varsayılan meta
    const meta = {}
    loadedSchema.columns.forEach(c => {
      meta[c.key] = { selected: false, type: c.type, role: 'none' }
    })
    setVarMeta(meta)

    // Normallik testlerini otomatik çalıştır
    setNormLoading(true)
    try {
      const payload = {
        columnData: Object.fromEntries(loadedSchema.columns.map(c => [c.key, {
          label: c.label, type: c.type,
          values: loadedSchema.rows.map(r => r[c.key] ?? null),
          options: null
        }])),
        n: loadedSchema.rows.length,
        studyType: 'retrospektif',
        studyTitle: loadedSchema.studyTitle || 'Çalışma',
        groupCandidates: loadedSchema.columns.filter(c => c.type === 'category' || c.type === 'boolean').map(c => c.key),
        outcomeCandidates: loadedSchema.columns.filter(c => c.type === 'number').map(c => c.key)
      }
      const data = await statisticsAPI.recommend(payload)
      setRecommendation({ tests: [] }, data.normalityResults || {})
    } catch (_) {}
    finally { setNormLoading(false) }
  }

  const onMetaChange = (colKey, field, value) => {
    setVarMeta(prev => ({
      ...prev,
      [colKey]: { ...prev[colKey], [field]: value }
    }))
  }

  // Normallik: store'dan al
  const normResults = useStatsStore(s => s.normalityResults)

  const buildColumnData = () => {
    const cd = {}
    schema.columns.forEach(c => {
      const effectiveType = varMeta[c.key]?.type || c.type
      cd[c.key] = {
        label: c.label,
        type: effectiveType,
        values: schema.rows.map(r => r[c.key] ?? null),
        options: null
      }
      // Encode kategorik/binary kolonları
      if (effectiveType === 'category' || effectiveType === 'boolean') {
        const vals = cd[c.key].values
        const uniq = [...new Set(vals.filter(v => v !== null && v !== undefined && v !== ''))]
        if (uniq.length === 2) {
          cd[c.key].encoded = vals.map(v => v === uniq[0] ? 0 : v === uniq[1] ? 1 : null)
          cd[c.key].encodingMap = { [uniq[0]]: 0, [uniq[1]]: 1 }
        }
      }
    })
    return cd
  }

  const handleRunAnalysis = async (suggestionType, selectedVars, meta, dialogCols = null) => {
    if (!schema) return
    setBusy(true); setStatus('running')

    const columnData = buildColumnData()
    const basePayload = {
      columnData,
      n: schema.rows.length,
      studyType: schema.studyType || 'retrospektif',
      studyTitle: schema.studyTitle || 'Çalışma',
      groupCandidates: schema.columns.filter(c => c.type === 'category' || c.type === 'boolean').map(c => c.key),
      outcomeCandidates: schema.columns.filter(c => c.type === 'number').map(c => c.key)
    }

    const isNormal = (k) => normResults?.[k]?.normal !== false
    const numVars  = selectedVars.filter(k => (meta[k]?.type || 'number') === 'number')
    const catVars  = selectedVars.filter(k => ['category','boolean'].includes(meta[k]?.type || ''))
    const depVar   = selectedVars.find(k => meta[k]?.role === 'dependent')
    const indVars  = selectedVars.filter(k => meta[k]?.role === 'independent')
    const encodeBinaryColumn = (key) => {
      const col = columnData[key]
      if (!col) return false
      const uniq = [...new Set(col.values.filter(v => v !== null && v !== undefined && v !== ''))]
      if (uniq.length !== 2) return false
      columnData[key] = {
        ...col,
        values: col.values.map(v => v === uniq[0] ? 0 : v === uniq[1] ? 1 : null),
        type: 'number',
        encodingMap: { [uniq[0]]: 0, [uniq[1]]: 1 }
      }
      return true
    }

    let testsToRun = []

    // Dialog'dan gelen column atamaları varsa direkt kullan
    if (dialogCols && Object.keys(dialogCols).length > 0) {
      const testNameMap = {
        'compare_2':          null,  // aşağıda hesaplanacak
        'compare_2_nonparam': 'mann_whitney_u',
        'compare_multi':      null,
        'compare_multi_nonparam': 'kruskal_wallis',
        'correlation':        null,
        'paired':             'paired_t_test',
        'regression':         'linear_regression',
        'regression_logistic':'logistic_regression',
        'categorical':        null,
        'kaplan_meier':       'kaplan_meier',
        'log_rank':           'log_rank_test',
        'cox':                'cox_regression',
        'descriptive':        'descriptive_stats',
      }

      let testName = testNameMap[suggestionType]

      if (suggestionType === 'compare_2' || suggestionType === 'compare_multi') {
        const outcome = dialogCols.outcome
        const group   = dialogCols.group
        if (outcome && group) {
          const groupUniq = new Set(schema.rows.map(r => r[group]).filter(Boolean)).size
          const multi = groupUniq >= 3
          testName = multi
            ? (isNormal(outcome) ? 'one_way_anova' : 'kruskal_wallis')
            : (isNormal(outcome) ? 'independent_t_test' : 'mann_whitney_u')
        }
      }
      if (suggestionType === 'correlation') {
        const v1 = dialogCols.x, v2 = dialogCols.y
        testName = (isNormal(v1) && isNormal(v2)) ? 'pearson_correlation' : 'spearman_correlation'
      }
      if (suggestionType === 'categorical') {
        const u1 = new Set(schema.rows.map(r => r[dialogCols.row]).filter(Boolean)).size
        const u2 = new Set(schema.rows.map(r => r[dialogCols.col]).filter(Boolean)).size
        testName = (u1 <= 2 && u2 <= 2) ? 'fisher_exact' : 'chi_square'
      }
      if (suggestionType === 'regression_logistic') {
        testName = 'logistic_regression'
        encodeBinaryColumn(dialogCols.outcome)
        ;(dialogCols.predictors || []).forEach(encodeBinaryColumn)
      }
      if (suggestionType === 'kaplan_meier' || suggestionType === 'log_rank' || suggestionType === 'cox') {
        encodeBinaryColumn(dialogCols.event)
      }
      if (suggestionType === 'cox') {
        encodeBinaryColumn(dialogCols.covariate)
      }
      if (testName) {
        // Descriptive stats: variables array → bir test per değişken
        if (suggestionType === 'descriptive' && dialogCols.variables) {
          const vars = Array.isArray(dialogCols.variables) ? dialogCols.variables : [dialogCols.variables]
          testsToRun = vars.map(v => ({
            testName: 'descriptive_stats',
            displayName: `Tanımlayıcı: ${schema.columns.find(c => c.key === v)?.label || v}`,
            columns: { outcome: v },
            reason: 'Tanımlayıcı istatistik'
          }))
        } else {
          testsToRun = [{
            testName,
            displayName: TD[testName]?.label || testName,
            columns: dialogCols,
            reason: 'Manuel seçim'
          }]
        }
        // Direkt çalıştır
        try {
          const data = await statisticsAPI.run(basePayload, testsToRun)
          if (data.results) {
            data.results = data.results.map((r, i) => ({
              ...r, columns: r.columns || testsToRun[i]?.columns || {},
              reason: testsToRun[i]?.reason || '', displayName: testsToRun[i]?.displayName || r.testName,
            }))
          }
          data.normalityResults = normResults
          setResults(data); setStatus('done')
          toast.success(`${data.results?.filter(r => r.status === 'completed').length || 0} test tamamlandı!`)
        } catch (e) {
          toast.error('Analiz hatası: ' + (e.message || '')); setStatus('error')
        } finally { setBusy(false) }
        return
      }
    }

    if (suggestionType === 'correlation') {
      const numSelected = selectedVars.filter(k => (varMeta[k]?.type || 'number') === 'number')
      if (numSelected.length < 2) {
        toast.error('Korelasyon için 2 sayısal değişken seçin.')
        setBusy(false); setStatus('idle'); return
      }
      const [v1, v2] = numSelected
      const usePearson = isNormal(v1) && isNormal(v2)
      testsToRun = [{
        testName: usePearson ? 'pearson_correlation' : 'spearman_correlation',
        displayName: usePearson ? 'Pearson Korelasyon' : 'Spearman Korelasyon',
        columns: { x: v1, y: v2 },
        reason: usePearson ? 'Her iki değişken normal → Pearson' : 'Non-normal → Spearman'
      }]
    } else if (suggestionType === 'compare_2' || suggestionType === 'compare_multi' || suggestionType === 'compare_2_nonparam' || suggestionType === 'compare_multi_nonparam') {
      const numSelected = selectedVars.filter(k => (varMeta[k]?.type || 'number') === 'number')
      const catSelected = selectedVars.filter(k => ['category','boolean'].includes(varMeta[k]?.type || ''))

      if (!numSelected.length || !catSelected.length) {
        toast.error('Bir sayısal + bir kategorik değişken seçin.')
        setBusy(false); setStatus('idle'); return
      }

      const outcome = numSelected[0]
      const group   = catSelected[0]
      const groupUniq = new Set(schema.rows.map(r => r[group]).filter(v => v !== null && v !== undefined && v !== '')).size

      if (groupUniq < 2) {
        toast.error(`"${group}" değişkeninde sadece 1 grup var.`)
        setBusy(false); setStatus('idle'); return
      }

      const forceNonParam = suggestionType.endsWith('_nonparam')
      const useMulti = suggestionType === 'compare_multi' || suggestionType === 'compare_multi_nonparam' || groupUniq >= 3
      testsToRun = [{
        testName: useMulti
          ? (forceNonParam || !isNormal(outcome) ? 'kruskal_wallis' : 'one_way_anova')
          : (forceNonParam || !isNormal(outcome) ? 'mann_whitney_u' : 'independent_t_test'),
        displayName: useMulti
          ? (forceNonParam || !isNormal(outcome) ? 'Kruskal-Wallis' : 'One-Way ANOVA')
          : (forceNonParam || !isNormal(outcome) ? 'Mann-Whitney U' : 'Bağımsız t-testi'),
        columns: { group, outcome },
        reason: forceNonParam
          ? `${groupUniq} grup, manuel non-parametrik seçim`
          : `${groupUniq} grup, ${isNormal(outcome) ? 'normal → parametrik' : 'non-normal → non-parametrik'}`
      }]
    } else if (suggestionType === 'categorical') {
      const catSelected = selectedVars.filter(k => ['category','boolean'].includes(varMeta[k]?.type || ''))
      if (catSelected.length < 2) {
        toast.error('Kategorik analiz için 2 kategorik değişken seçin.')
        setBusy(false); setStatus('idle'); return
      }
      const [c1, c2] = catSelected
      const u1 = new Set(schema.rows.map(r => r[c1]).filter(Boolean)).size
      const u2 = new Set(schema.rows.map(r => r[c2]).filter(Boolean)).size
      const use2x2 = u1 <= 2 && u2 <= 2
      testsToRun = [{
        testName: use2x2 ? 'fisher_exact' : 'chi_square',
        displayName: use2x2 ? "Fisher's Exact Test" : 'Ki-Kare Testi',
        columns: { row: c1, col: c2 },
        reason: use2x2 ? '2×2 tablo → Fisher' : 'Çok kategorili → Ki-Kare'
      }]
    } else if (suggestionType === 'regression') {
      const outcome   = depVar || numVars[0]
      const predictors = indVars.length ? indVars : numVars.filter(k => k !== outcome)
      const isLinear  = (meta[outcome]?.type || 'number') === 'number'

      // Encode outcome if categorical
      if (!isLinear && columnData[outcome]) {
        const col  = columnData[outcome]
        const uniq = [...new Set(col.values.filter(v => v !== null && v !== undefined && v !== ''))]
        if (uniq.length === 2) {
          columnData[outcome] = {
            ...col,
            values: col.values.map(v => v === uniq[0] ? 0 : v === uniq[1] ? 1 : null),
            type: 'number',
            encodingMap: { [uniq[0]]: 0, [uniq[1]]: 1 }
          }
        }
      }
      testsToRun = [{
        testName: isLinear ? 'linear_regression' : 'logistic_regression',
        displayName: isLinear ? 'Lineer Regresyon' : 'Lojistik Regresyon',
        columns: isLinear ? { predictor: predictors[0], outcome } : { outcome, predictors },
        reason: isLinear ? 'Sayısal outcome → Lineer' : 'Kategorik outcome → Lojistik'
      }]
    } else if (suggestionType === 'descriptive') {
      testsToRun = selectedVars.map(v => ({
        testName: 'descriptive_stats',
        displayName: `Tanımlayıcı: ${schema.columns.find(c => c.key === v)?.label || v}`,
        columns: { outcome: v },
        reason: 'Tanımlayıcı istatistik'
      }))

    } else if (suggestionType === 'paired') {
      const numSelected = selectedVars.filter(k => (varMeta[k]?.type || 'number') === 'number')
      if (numSelected.length < 2) {
        toast.error('Eşleştirilmiş t-testi için 2 sayısal değişken seçin (örn. önce/sonra ölçüm).')
        setBusy(false); setStatus('idle'); return
      }
      const [v1, v2] = numSelected
      testsToRun = [{
        testName: 'paired_t_test',
        displayName: 'Eşleştirilmiş t-testi',
        columns: { before: v1, after: v2 },
        reason: isNormal(v1) && isNormal(v2)
          ? 'Tekrarlı ölçüm karşılaştırması'
          : 'Backend Wilcoxon desteklemediği için eşleştirilmiş t-testi çalıştırıldı'
      }]

    } else if (suggestionType === 'regression_logistic') {
      const outcome   = depVar || selectedVars[0]
      const predictors = indVars.length ? indVars : selectedVars.filter(k => k !== outcome)
      encodeBinaryColumn(outcome)
      predictors.forEach(encodeBinaryColumn)
      testsToRun = [{
        testName: 'logistic_regression',
        displayName: 'Lojistik Regresyon',
        columns: { outcome, predictors: predictors.length ? predictors : [selectedVars[1]] },
        reason: 'Binary outcome → Lojistik Regresyon'
      }]

    } else if (suggestionType === 'kaplan_meier') {
      // Zaman değişkeni + event değişkeni seçilmeli
      const timeVar  = numVars[0]  || selectedVars[0]
      const eventVar = numVars[1]  || selectedVars[1]
      encodeBinaryColumn(eventVar)
      testsToRun = [{
        testName: 'kaplan_meier',
        displayName: 'Kaplan-Meier',
        columns: { time: timeVar, event: eventVar },
        reason: 'Sağkalım analizi'
      }]

    } else if (suggestionType === 'log_rank') {
      const timeVar  = numVars[0] || selectedVars[0]
      const eventVar = numVars[1] || selectedVars[1]
      const groupVar = catVars[0] || selectedVars[2]
      encodeBinaryColumn(eventVar)
      testsToRun = [{
        testName: 'log_rank_test',
        displayName: 'Log-Rank Testi',
        columns: { time: timeVar, event: eventVar, group: groupVar },
        reason: 'Gruplar arası sağkalım karşılaştırması'
      }]
    } else if (suggestionType === 'cox') {
      const timeVar = numVars[0] || selectedVars[0]
      const eventVar = catVars[0] || numVars[1] || selectedVars[1]
      const covariateVar = numVars.find(k => k !== timeVar && k !== eventVar) || selectedVars[2]
      encodeBinaryColumn(eventVar)
      encodeBinaryColumn(covariateVar)
      testsToRun = [{
        testName: 'cox_regression',
        displayName: 'Cox Regresyon',
        columns: { time: timeVar, event: eventVar, covariate: covariateVar },
        reason: 'Sağkalıma etki eden kovaryat analizi'
      }]
    }

    if (!testsToRun.length) {
      toast.error('Bu analiz için çalıştırılacak geçerli test bulunamadı.')
      setBusy(false)
      setStatus('idle')
      return
    }

    try {
      const data = await statisticsAPI.run(basePayload, testsToRun)
      if (data.results) {
        data.results = data.results.map((r, i) => ({
          ...r,
          columns:     r.columns     || testsToRun[i]?.columns || {},
          reason:      r.reason      || testsToRun[i]?.reason  || '',
          displayName: r.displayName || testsToRun[i]?.displayName || r.testName,
        }))
      }
      data.normalityResults = normResults
      setResults(data)
      setStatus('done')
      toast.success(`${data.results?.filter(r => r.status === 'completed').length || 0} test tamamlandı!`)
    } catch (e) {
      toast.error('Analiz hatası: ' + (e.message || ''))
      setStatus('error')
    } finally { setBusy(false) }
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-gray-50">
      {/* Top bar */}
      <div className="px-6 pt-5 pb-3 bg-gray-50 flex-shrink-0">
        <PageHeader
          icon="ti-chart-bar"
          title="İstatistik Analizi"
          subtitle={schema
            ? `${schema.studyTitle || 'Çalışma'} — n=${schema.rows.length}, ${schema.columns.length} değişken`
            : 'Dataset seç ve analiz yap'
          }
          actions={
            <div className="flex items-center gap-2">
              <SavedBadge type={OUTPUT_TYPES.STATISTICS} />
              {(schema || status === 'done') && (
                <button className="btn-secondary text-xs" onClick={() => { reset(); setSchema(null); setVarMeta({}); setSourceDataset(null) }}>
                  <i className="ti ti-refresh text-sm" />Sıfırla
                </button>
              )}
            </div>
          }
        />
      </div>

      {/* 3-column body */}
      <div className="flex flex-1 min-h-0 px-6 pb-6 gap-4">

        {/* ── Sütun 1: Dataset + Variable View (480px) ── */}
        <div className="w-[460px] flex-shrink-0 flex flex-col gap-3 overflow-y-auto">

          <div className="card">
            <div className="flex items-center gap-2 mb-3">
              <i className="ti ti-table text-brand-600 text-sm" />
              <span className="section-title">Dataset</span>
            </div>
            <DatasetSelector onLoad={handleDatasetLoad} />
          </div>

          {schema && (
            <div className="card">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <i className="ti ti-table-options text-brand-600 text-sm" />
                  <span className="section-title">Variable View</span>
                </div>
                {normLoading && (
                  <div className="flex items-center gap-1.5 text-xs text-amber-600">
                    <div className="w-3 h-3 border-2 border-amber-300 border-t-amber-600 rounded-full animate-spin" />
                    Normallik hesaplanıyor...
                  </div>
                )}
              </div>
              {(status === 'running' || busy)
                ? <AgentRunning message="Test çalıştırılıyor ve yorumlanıyor..." />
                : <VariableView
                    schema={schema}
                    varMeta={varMeta}
                    onMetaChange={onMetaChange}
                    normalityResults={normResults}
                    onRunAnalysis={handleRunAnalysis}
                    running={busy}
                  />
              }
            </div>
          )}

          {!schema && (
            <div className="card">
              <SavedStatsLoader onLoad={(saved) => { setResults(saved); setStatus('done') }} />
            </div>
          )}
        </div>

        {/* ── Sütun 2: Test Paneli (240px) ── */}
        <div className="w-60 flex-shrink-0">
          <TestPanel
            schema={schema}
            varMeta={varMeta}
            normalityResults={normResults}
            onRunAnalysis={handleRunAnalysis}
            running={busy}
          />
        </div>

        {/* ── Sütun 3: Sonuçlar ── */}
        <div className="flex-1 min-w-0 overflow-y-auto space-y-4">

          {status === 'done' && results && (
            <>
              <div className="grid grid-cols-3 gap-3">
                <StatBox label="Çalıştırılan Test" value={results.results?.length||0} color="brand" />
                <StatBox label="Tamamlanan"         value={results.results?.filter(r=>r.status==='completed').length||0} color="green" />
                <StatBox label="Hatalı"             value={results.results?.filter(r=>r.status==='error').length||0} color="red" />
              </div>

              {results.results?.map((r,i) => (
                <ResultCard key={i} title={
                  <div className="flex items-center gap-2 flex-wrap">
                    <span>{TD[r.testName]?.label || r.displayName || r.testName}</span>
                    {r.reason && (
                      <span className="text-[11px] bg-brand-50 text-brand-600 px-2 py-0.5 rounded-full border border-brand-100 font-normal">
                        {r.reason}
                      </span>
                    )}
                    {r.columns && Object.entries(r.columns).map(([role, col]) => col && !Array.isArray(col) && (
                      <span key={role} className="text-[11px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                        <span className="text-gray-400">{role}:</span> <span className="font-medium">{col}</span>
                      </span>
                    ))}
                  </div>
                }>
                  {r.status === 'error'
                    ? <div className="text-sm text-red-600 bg-red-50 rounded-lg p-3 flex items-center gap-2">
                        <i className="ti ti-alert-circle" />{r.error}
                      </div>
                    : <div className="grid grid-cols-2 gap-4">
                        <div>
                          {r.result && Object.entries(r.result).map(([k,v]) =>
                            typeof v !== 'object' && (
                              <div key={k} className="flex justify-between text-xs py-1 border-b border-gray-50">
                                <span className="text-gray-400 capitalize">{k.replace(/_/g,' ')}</span>
                                <span className="font-medium text-gray-700">
                                  {k.toLowerCase().includes('pvalue') || k === 'pValue'
                                    ? <PValueBadge p={v} />
                                    : typeof v === 'number' ? v.toFixed(4) : String(v)
                                  }
                                </span>
                              </div>
                            )
                          )}
                        </div>
                        {r.interpretation && (
                          <div className="bg-gray-50 rounded-xl p-3 space-y-2">
                            <div className="text-xs font-medium text-gray-500">Agent Yorumu</div>
                            {(r.interpretation.conclusion || r.interpretation.interpretation) && (
                              <p className="text-sm font-medium text-gray-800">
                                {r.interpretation.conclusion || r.interpretation.interpretation}
                              </p>
                            )}
                            {r.interpretation.suggestedReporting && (
                              <div className="p-2 bg-white rounded-lg border border-gray-100">
                                <div className="text-[10px] text-gray-400 mb-0.5">Raporlama (APA)</div>
                                <span className="text-xs text-gray-700">{r.interpretation.suggestedReporting}</span>
                              </div>
                            )}
                            {r.interpretation.limitations && (
                              <div className="p-2 bg-amber-50 rounded-lg border border-amber-100">
                                <div className="text-[10px] text-amber-600 mb-0.5">Kısıtlamalar</div>
                                <span className="text-xs text-amber-700">{r.interpretation.limitations}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                  }
                </ResultCard>
              ))}

              <div className="flex items-center justify-between pt-2">
                <button onClick={() => { setStatus('idle'); setResults(null) }} className="btn-secondary text-xs">
                  <i className="ti ti-plus text-sm" />Yeni Analiz
                </button>
              </div>

              <SaveBar
                type={OUTPUT_TYPES.STATISTICS}
                title={`İstatistik: ${schema?.studyTitle||'Analiz'} — ${new Date().toLocaleDateString('tr-TR')}`}
                query={schema?.studyTitle}
                payload={{
                  sourceDatasetId: sourceDataset?.id || null,
                  sourceDatasetTitle: sourceDataset?.title || schema?.studyTitle || null,
                  sourceDatasetVersion: sourceDataset?.version || null,
                  schema: {
                    studyTitle: schema?.studyTitle || 'Çalışma',
                    columns: schema?.columns || []
                  },
                  studyTitle: schema?.studyTitle || 'Çalışma'
                }}
                result={{
                  ...results,
                  sourceDatasetId: sourceDataset?.id || null,
                  sourceDatasetTitle: sourceDataset?.title || schema?.studyTitle || null,
                  sourceDatasetVersion: sourceDataset?.version || null,
                  schema: {
                    studyTitle: schema?.studyTitle || 'Çalışma',
                    columns: schema?.columns || []
                  },
                  n: schema?.rows?.length || results.n,
                  results: (results.results || []).map(r => ({
                    testName: r.testName,
                    displayName: r.displayName,
                    status: r.status,
                    columns: r.columns || {},
                    result: r.result || null,
                    interpretation: r.interpretation || null,
                    reason: r.reason || '',
                    error: r.error || null
                  }))
                }}
                summary={`${results.results?.filter(r=>r.status==='completed').length||0} test — n=${schema?.rows?.length || results.n}`}
              />
            </>
          )}

          {!results && !busy && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center text-gray-400">
                <i className="ti ti-chart-bar text-5xl mb-3 opacity-20 block" />
                <div className="text-sm">Soldaki Variable View'dan değişken seçin</div>
                <div className="text-xs mt-1">veya sağdaki test panelinden analiz başlatın</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* SPSS Dialog */}
      {activeDialog && (
        <TestDialog
          test={activeDialog}
          schema={schema}
          varMeta={varMeta}
          normalityResults={normResults}
          onRun={handleDialogRun}
          onClose={() => setActiveDialog(null)}
        />
      )}
    </div>
  )
}


// ── Kayıtlı analiz yükleyici ──────────────────────────────────────────────────
function SavedStatsLoader({ onLoad }) {
  const [items, setItems]       = useState([])
  const [selected, setSelected] = useState('')
  const [loading, setLoading]   = useState(false)

  useEffect(() => { listOutputs(OUTPUT_TYPES.STATISTICS).then(setItems).catch(() => {}) }, [])

  if (!items.length) return (
    <div className="text-xs text-gray-400 flex items-center gap-1.5">
      <i className="ti ti-inbox text-sm" />Henüz kaydedilmiş analiz yok
    </div>
  )

  const handleLoad = async () => {
    if (!selected) return
    setLoading(true)
    try {
      const record = await getOutput(selected)
      onLoad(record.result)
      toast.success(`"${record.title}" yüklendi`)
    } catch { toast.error('Yükleme hatası') }
    finally { setLoading(false) }
  }

  return (
    <div>
      <div className="section-title mb-3">Kayıtlı Analiz Yükle</div>
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
          {loading ? <div className="w-3.5 h-3.5 border-2 border-brand-200 border-t-brand-600 rounded-full animate-spin" /> : <i className="ti ti-download text-sm" />}
          Yükle
        </button>
      </div>
    </div>
  )
}
