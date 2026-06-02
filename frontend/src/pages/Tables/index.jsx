import { useEffect, useMemo, useState } from 'react'
import { tablesAPI } from '@/api'
import { EmptyState, PageHeader, StatBox } from '@/components/ui'
import { SaveBar, SavedBadge } from '@/components/ui/SaveBar'
import { OUTPUT_TYPES, deleteOutput, getOutput, listOutputs } from '@/lib/outputs'
import toast from 'react-hot-toast'

const OLD_FORMAT_WARNING = 'Bu kayıt eski formatta oluşturulmuş. Tablo oluşturmak için İstatistik sayfasında analizi yeniden çalıştırıp kaydedin.'

const TABLE_KIND_LABELS = {
  table1: 'Table 1',
  mean_group_comparison: 'Grup ortalamaları',
  median_group_comparison: 'Medyan / IQR',
  paired_t_test: 'Önce-sonra',
  pearson_correlation: 'Pearson',
  spearman_correlation: 'Spearman',
  chi_square_crosstab: 'Çapraz tablo',
  fisher_2x2: '2 x 2 tablo',
  linear_regression: 'Lineer regresyon',
  logistic_regression: 'OR tablosu',
  cox_regression: 'HR tablosu',
  kaplan_meier: 'Kaplan-Meier',
  log_rank_test: 'Log-rank',
  missing_data: 'Eksik veri'
}

function requestSpecs(results = []) {
  return results.map((test, index) => ({ testName: test.testName, columns: test.columns || {}, sourceIndex: index }))
}

function normalizeTables(tables = []) {
  return tables.map((table, index) => ({
    id: table.id || `table_${index}`,
    kind: table.kind || 'table',
    title: table.title || `Tablo ${index + 1}`,
    caption: table.caption || table.title || '',
    columns: table.columns || [],
    rows: table.rows || [],
    statistics: table.statistics || {},
    footnotes: table.footnotes || [],
    downloadUrls: table.downloadUrls || {},
    visibleColumns: table.columns || [],
    visibleRows: (table.rows || []).map((_, i) => i),
    decimals: 2,
    pFormat: 'threshold',
    summaryMode: 'mean_sd',
    categoricalMode: 'n_percent',
    showMissing: true,
    groupVariable: '',
    referenceCategory: '',
    testFootnote: true
  }))
}

function formatCell(value, table, column = '') {
  if (value === null || value === undefined || value === '') return '—'
  const text = String(value)
  if (!table.showMissing && column.toLowerCase().includes('eksik')) return null
  if (table.categoricalMode === 'n_only' && /\d+\s*\([^)]+%\)/u.test(text)) return text.replace(/\s*\([^)]+%\)/gu, '')
  if (table.summaryMode === 'mean_sd' && text.includes(';')) return text.split(';')[0].trim()
  if (table.summaryMode === 'median_iqr' && text.includes('medyan')) return text.split('medyan').pop().trim()
  if (column.toLowerCase() === 'p') {
    const p = Number(text)
    if (!Number.isFinite(p)) return text
    return table.pFormat === 'threshold' && p < 0.001 ? '<0.001' : p.toFixed(3)
  }
  const numeric = Number(text)
  if (Number.isFinite(numeric) && !Number.isInteger(numeric)) return numeric.toFixed(table.decimals)
  return text
}

function tableToCsv(table) {
  const columns = (table.visibleColumns || table.columns).filter(col => table.showMissing || !col.toLowerCase().includes('eksik'))
  const rows = table.rows.filter((_, i) => table.visibleRows.includes(i))
  return [
    columns.join(','),
    ...rows.map(row => columns.map(col => `"${String(formatCell(row[col], table, col) ?? '').replace(/"/g, '""')}"`).join(','))
  ].join('\n')
}

function download(content, filename, type) {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function slug(value) {
  return (value || 'tablo').toLowerCase().replace(/[^a-z0-9ğüşöçıİĞÜŞÖÇ]+/gi, '-').replace(/^-|-$/g, '')
}

function htmlTable(table) {
  const columns = (table.visibleColumns || table.columns).filter(col => table.showMissing || !col.toLowerCase().includes('eksik'))
  const rows = table.rows.filter((_, i) => table.visibleRows.includes(i))
  return `
    <table border="1" cellspacing="0" cellpadding="6">
      <caption>${table.caption || table.title}</caption>
      <thead><tr>${columns.map(col => `<th>${col}</th>`).join('')}</tr></thead>
      <tbody>${rows.map(row => `<tr>${columns.map(col => `<td>${formatCell(row[col], table, col) ?? ''}</td>`).join('')}</tr>`).join('')}</tbody>
    </table>
    ${table.footnotes?.length ? `<p>${table.footnotes.join('<br/>')}</p>` : ''}
  `
}

function TablePreview({ table }) {
  const columns = (table.visibleColumns || table.columns).filter(col => table.showMissing || !col.toLowerCase().includes('eksik'))
  const rows = table.rows.filter((_, i) => table.visibleRows.includes(i))

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <caption className="caption-top text-left text-xs text-gray-500 pb-2">{table.caption}</caption>
        <thead>
          <tr className="border-b border-gray-100">
            {columns.map(col => <th key={col} className="text-left py-2 px-2 text-gray-500 font-semibold whitespace-nowrap">{col}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-gray-50">
              {columns.map(col => <td key={col} className="py-2 px-2 text-gray-700 align-top">{formatCell(row[col], table, col) ?? '—'}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
      {!!table.footnotes?.length && (
        <div className="mt-3 text-[11px] text-gray-400 space-y-1">
          {table.footnotes.map((note, i) => <div key={i}>{i + 1}. {note}</div>)}
        </div>
      )}
    </div>
  )
}

function TableCard({ table, index, total, selected, onSelect, onUpdate, onDelete, onMove }) {
  const filename = slug(table.title)

  const copy = async () => {
    await navigator.clipboard.writeText(tableToCsv(table))
    toast.success('Tablo kopyalandı')
  }

  const exportCsv = () => download(tableToCsv(table), `${filename}.csv`, 'text/csv;charset=utf-8')
  const exportExcel = () => download(`<html><body>${htmlTable(table)}</body></html>`, `${filename}.xls`, 'application/vnd.ms-excel;charset=utf-8')
  const exportWord = () => download(`<html><body><h3>${table.title}</h3>${htmlTable(table)}</body></html>`, `${filename}.doc`, 'application/msword;charset=utf-8')

  return (
    <div className={`card ${selected ? 'ring-1 ring-brand-300' : ''}`}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <button onClick={onSelect} className="text-left min-w-0">
          <div className="text-sm font-medium text-gray-800 truncate">{table.title}</div>
          <div className="text-[11px] text-gray-400 mt-0.5">{TABLE_KIND_LABELS[table.kind] || table.kind} · {table.rows.length} satır</div>
        </button>
        <div className="flex flex-wrap justify-end gap-1">
          <button className="btn-secondary text-[10px] py-1 px-2" onClick={onSelect}><i className="ti ti-edit text-xs" />Düzenle</button>
          <button className="btn-secondary text-[10px] py-1 px-2" onClick={copy}><i className="ti ti-copy text-xs" />Kopyala</button>
          <button className="btn-secondary text-[10px] py-1 px-2" disabled={index === 0} onClick={() => onMove(index, index - 1)}><i className="ti ti-arrow-up text-xs" /></button>
          <button className="btn-secondary text-[10px] py-1 px-2" disabled={index === total - 1} onClick={() => onMove(index, index + 1)}><i className="ti ti-arrow-down text-xs" /></button>
          <button className="btn-secondary text-[10px] py-1 px-2 text-red-600" onClick={onDelete}><i className="ti ti-trash text-xs" />Sil</button>
        </div>
      </div>

      <TablePreview table={table} />

      <div className="flex items-center justify-end gap-1 mt-3 pt-2 border-t border-gray-50">
        <button onClick={exportCsv} className="px-2 py-1 text-[10px] rounded bg-gray-50 text-gray-600 hover:bg-brand-50 hover:text-brand-600">CSV indir</button>
        <button onClick={exportExcel} className="px-2 py-1 text-[10px] rounded bg-gray-50 text-gray-600 hover:bg-brand-50 hover:text-brand-600">Excel indir</button>
        <button onClick={exportWord} className="px-2 py-1 text-[10px] rounded bg-gray-50 text-gray-600 hover:bg-brand-50 hover:text-brand-600">Word uyumlu indir</button>
      </div>
    </div>
  )
}

function SettingsPanel({ table, onUpdate }) {
  if (!table) {
    return (
      <div className="h-full bg-white border border-gray-100 rounded-xl p-4 text-xs text-gray-400">
        Düzenlemek için bir tablo seçin.
      </div>
    )
  }

  const toggleColumn = col => {
    const current = table.visibleColumns || table.columns
    onUpdate({ visibleColumns: current.includes(col) ? current.filter(c => c !== col) : [...current, col] })
  }

  const toggleRow = index => {
    const current = table.visibleRows || table.rows.map((_, i) => i)
    onUpdate({ visibleRows: current.includes(index) ? current.filter(i => i !== index) : [...current, index] })
  }

  return (
    <div className="h-full bg-white border border-gray-100 rounded-xl overflow-hidden flex flex-col">
      <div className="px-4 py-3 border-b border-gray-100">
        <div className="section-title">Tablo ayarları</div>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div>
          <label className="label">Tablo başlığı</label>
          <input className="input" value={table.title} onChange={e => onUpdate({ title: e.target.value })} />
        </div>
        <div>
          <label className="label">Caption</label>
          <textarea className="input min-h-[72px]" value={table.caption} onChange={e => onUpdate({ caption: e.target.value })} />
        </div>
        <div>
          <label className="label">Dipnotlar</label>
          <textarea className="input min-h-[78px]" value={(table.footnotes || []).join('\n')} onChange={e => onUpdate({ footnotes: e.target.value.split('\n').filter(Boolean) })} />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="label">Ondalık</label>
            <input className="input" type="number" min="0" max="6" value={table.decimals} onChange={e => onUpdate({ decimals: Number(e.target.value) })} />
          </div>
          <div>
            <label className="label">p-değeri</label>
            <select className="input" value={table.pFormat} onChange={e => onUpdate({ pFormat: e.target.value })}>
              <option value="threshold">Eşikli</option>
              <option value="fixed">Sabit</option>
            </select>
          </div>
        </div>

        <div>
          <label className="label">Özet biçimi</label>
          <select className="input" value={table.summaryMode} onChange={e => onUpdate({ summaryMode: e.target.value })}>
            <option value="mean_sd">Ortalama ± SS</option>
            <option value="median_iqr">Medyan [IQR]</option>
          </select>
        </div>

        <div>
          <label className="label">Kategorik veriler</label>
          <select className="input" value={table.categoricalMode} onChange={e => onUpdate({ categoricalMode: e.target.value })}>
            <option value="n_percent">n (%)</option>
            <option value="n_only">Sadece n</option>
          </select>
        </div>

        <label className="flex items-center gap-2 text-xs text-gray-600">
          <input type="checkbox" checked={table.showMissing} onChange={e => onUpdate({ showMissing: e.target.checked })} />
          Eksik veri sütunu
        </label>
        <label className="flex items-center gap-2 text-xs text-gray-600">
          <input type="checkbox" checked={table.testFootnote} onChange={e => onUpdate({ testFootnote: e.target.checked })} />
          İstatistiksel test dipnotu
        </label>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="label">Grup değişkeni</label>
            <input className="input" value={table.groupVariable} onChange={e => onUpdate({ groupVariable: e.target.value })} placeholder="örn. group" />
          </div>
          <div>
            <label className="label">Referans kategori</label>
            <input className="input" value={table.referenceCategory} onChange={e => onUpdate({ referenceCategory: e.target.value })} />
          </div>
        </div>

        <div>
          <div className="label">Gösterilecek sütunlar</div>
          <div className="space-y-1 max-h-36 overflow-y-auto border border-gray-100 rounded-lg p-2">
            {table.columns.map(col => (
              <label key={col} className="flex items-center gap-2 text-xs text-gray-600">
                <input type="checkbox" checked={(table.visibleColumns || []).includes(col)} onChange={() => toggleColumn(col)} />
                {col}
              </label>
            ))}
          </div>
        </div>

        <div>
          <div className="label">Gösterilecek satırlar</div>
          <div className="space-y-1 max-h-36 overflow-y-auto border border-gray-100 rounded-lg p-2">
            {table.rows.map((row, index) => (
              <label key={index} className="flex items-center gap-2 text-xs text-gray-600">
                <input type="checkbox" checked={(table.visibleRows || []).includes(index)} onChange={() => toggleRow(index)} />
                Satır {index + 1}: {Object.values(row)[0] ?? ''}
              </label>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Tables() {
  const [statsItems, setStatsItems] = useState([])
  const [tableSets, setTableSets] = useState([])
  const [selectedStatsId, setSelectedStatsId] = useState('')
  const [selectedTableSetId, setSelectedTableSetId] = useState('')
  const [loadedStats, setLoadedStats] = useState(null)
  const [tables, setTables] = useState([])
  const [activeId, setActiveId] = useState(null)
  const [loading, setLoading] = useState(false)
  const [warnings, setWarnings] = useState([])

  useEffect(() => {
    listOutputs(OUTPUT_TYPES.STATISTICS).then(setStatsItems).catch(e => toast.error('Analiz kayıtları yüklenemedi: ' + (e.message || '')))
    listOutputs(OUTPUT_TYPES.TABLES).then(setTableSets).catch(() => {})
  }, [])

  const activeTable = tables.find(t => t.id === activeId) || tables[0] || null
  const requests = useMemo(() => requestSpecs(loadedStats?.result?.results || []), [loadedStats])

  const updateTable = (id, updates) => {
    setTables(prev => prev.map(table => table.id === id ? { ...table, ...updates } : table))
  }

  const moveTable = (from, to) => {
    setTables(prev => {
      const next = [...prev]
      const [item] = next.splice(from, 1)
      next.splice(to, 0, item)
      return next
    })
  }

  const loadAnalysis = async () => {
    if (!selectedStatsId) return
    setLoading(true)
    setWarnings([])
    try {
      const record = await getOutput(selectedStatsId)
      const sourceDatasetId = record.result?.sourceDatasetId || record.payload?.sourceDatasetId
      if (!sourceDatasetId) {
        setLoadedStats(record)
        setTables([])
        setWarnings([OLD_FORMAT_WARNING])
        toast.error(OLD_FORMAT_WARNING)
        return
      }
      const nextRequests = requestSpecs(record.result?.results || [])
      const response = await tablesAPI.generate({
        statisticsOutputId: record.id,
        sourceDatasetId,
        statisticalResults: record.result?.results || [],
        requests: nextRequests
      })
      const normalized = normalizeTables(response.tables || [])
      setLoadedStats(record)
      setTables(normalized)
      setActiveId(normalized[0]?.id || null)
      setWarnings(response.warnings || [])
      toast.success(`${normalized.length} tablo oluşturuldu`)
    } catch (e) {
      toast.error('Tablolar oluşturulamadı: ' + (e.message || ''))
    } finally {
      setLoading(false)
    }
  }

  const loadTableSet = async () => {
    if (!selectedTableSetId) return
    try {
      const record = await getOutput(selectedTableSetId)
      const normalized = normalizeTables(record.result?.tables || [])
      setTables(normalized)
      setActiveId(normalized[0]?.id || null)
      toast.success(`"${record.title}" yüklendi`)
    } catch (e) {
      toast.error('Tablo seti yüklenemedi: ' + (e.message || ''))
    }
  }

  const deleteTableSet = async () => {
    if (!selectedTableSetId) return
    try {
      await deleteOutput(selectedTableSetId)
      setTableSets(prev => prev.filter(item => item.id !== selectedTableSetId))
      setSelectedTableSetId('')
      toast.success('Tablo seti silindi')
    } catch (e) {
      toast.error('Silme hatası: ' + (e.message || ''))
    }
  }

  const testCount = loadedStats?.result?.results?.length || 0

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-gray-50">
      <div className="px-6 pt-5 pb-3 bg-gray-50 flex-shrink-0">
        <PageHeader
          icon="ti-table-options"
          title="Tablolar"
          subtitle="Kayıtlı istatistiksel analizlerden otomatik tablo setleri"
          actions={<SavedBadge type={OUTPUT_TYPES.TABLES} />}
        />

        <div className="card">
          <div className="grid grid-cols-[1fr_auto_1fr_auto_auto] gap-3 items-end">
            <div>
              <label className="label">Kayıtlı İstatistiksel Analiz</label>
              <select className="input" value={selectedStatsId} onChange={e => setSelectedStatsId(e.target.value)}>
                <option value="">Analiz seç...</option>
                {statsItems.map(item => (
                  <option key={item.id} value={item.id}>
                    {item.is_pinned ? '📌 ' : ''}{item.title}{item.summary ? ` — ${item.summary}` : ''}
                  </option>
                ))}
              </select>
            </div>
            <button className="btn-primary" onClick={loadAnalysis} disabled={!selectedStatsId || loading}>
              {loading ? <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <i className="ti ti-download text-sm" />}
              Yükle
            </button>
            <div>
              <label className="label">Kayıtlı tablo seti</label>
              <select className="input" value={selectedTableSetId} onChange={e => setSelectedTableSetId(e.target.value)}>
                <option value="">Tablo seti seç...</option>
                {tableSets.map(item => (
                  <option key={item.id} value={item.id}>
                    {item.is_pinned ? '📌 ' : ''}{item.title}{item.summary ? ` — ${item.summary}` : ''}
                  </option>
                ))}
              </select>
            </div>
            <button className="btn-secondary" onClick={loadTableSet} disabled={!selectedTableSetId}>
              <i className="ti ti-folder-open text-sm" />Yükle
            </button>
            <button className="btn-secondary text-red-600" onClick={deleteTableSet} disabled={!selectedTableSetId}>
              <i className="ti ti-trash text-sm" />Sil
            </button>
          </div>

          {!!warnings.length && (
            <div className="mt-3 space-y-2">
              {warnings.map((warning, i) => (
                <div key={i} className="text-sm text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                  <i className="ti ti-alert-circle mr-1" />{warning}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-[260px_minmax(0,1fr)_320px] gap-4 flex-1 min-h-0 px-6 pb-6">
        <aside className="bg-white border border-gray-100 rounded-xl overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-gray-100">
            <div className="section-title">Tablo türleri ve öneriler</div>
          </div>
          <div className="p-3 space-y-2 overflow-y-auto">
            {tables.length ? tables.map(table => (
              <button key={table.id} onClick={() => setActiveId(table.id)}
                className={`w-full text-left px-3 py-2 rounded-lg border text-xs transition-colors ${activeTable?.id === table.id ? 'border-brand-200 bg-brand-50 text-brand-700' : 'border-gray-100 text-gray-600 hover:bg-gray-50'}`}>
                <div className="font-medium">{TABLE_KIND_LABELS[table.kind] || table.kind}</div>
                <div className="text-[10px] opacity-70 mt-0.5 truncate">{table.title}</div>
              </button>
            )) : (
              <div className="text-xs text-gray-400 p-2">Analiz yüklenince uygun tablolar burada listelenir.</div>
            )}
          </div>
        </aside>

        <main className="min-w-0 overflow-y-auto space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <StatBox label="Yüklenen test" value={testCount} color="brand" />
            <StatBox label="Oluşturulan tablo" value={tables.length} color="green" />
          </div>

          {tables.length ? (
            <>
              {tables.map((table, index) => (
                <TableCard
                  key={table.id}
                  table={table}
                  index={index}
                  total={tables.length}
                  selected={activeTable?.id === table.id}
                  onSelect={() => setActiveId(table.id)}
                  onUpdate={updates => updateTable(table.id, updates)}
                  onDelete={() => setTables(prev => prev.filter(item => item.id !== table.id))}
                  onMove={moveTable}
                />
              ))}

              <SaveBar
                type={OUTPUT_TYPES.TABLES}
                title={`Tablolar: ${loadedStats?.title || 'Analiz'} — ${new Date().toLocaleDateString('tr-TR')}`}
                payload={{
                  statisticsOutputId: loadedStats?.id,
                  sourceDatasetId: loadedStats?.result?.sourceDatasetId,
                  requests
                }}
                result={{
                  statisticsOutputId: loadedStats?.id,
                  sourceDatasetId: loadedStats?.result?.sourceDatasetId,
                  sourceStatisticsTitle: loadedStats?.title,
                  tableCount: tables.length,
                  tables
                }}
                summary={`${tables.length} tablo — ${[...new Set(tables.map(t => TABLE_KIND_LABELS[t.kind] || t.kind))].join(', ')}`}
              />
            </>
          ) : (
            <EmptyState
              icon="ti-table-options"
              title={loading ? 'Tablolar hazırlanıyor' : 'Kayıtlı analiz seçin'}
              description={loading ? 'Analiz kaydı üzerinden tablo seti oluşturuluyor.' : 'Ham dataset seçimi yoktur; önce kaydedilmiş bir istatistiksel analiz yükleyin.'}
            />
          )}
        </main>

        <aside className="min-h-0">
          <SettingsPanel table={activeTable} onUpdate={updates => activeTable && updateTable(activeTable.id, updates)} />
        </aside>
      </div>
    </div>
  )
}
