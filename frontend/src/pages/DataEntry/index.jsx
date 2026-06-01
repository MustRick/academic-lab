import { useState, useRef } from 'react'
import { dataAPI } from '@/api'
import { useDataStore } from '@/store'
import { PageHeader, AgentRunning, Modal } from '@/components/ui'
import { OutputSelector, SavedBadge } from '@/components/ui/SaveBar'
import { OUTPUT_TYPES, saveOutput, updateOutput, saveDatasetRows, loadDatasetRows } from '@/lib/outputs'
import toast from 'react-hot-toast'

const TYPE_COLORS  = { number:'bg-blue-50 text-blue-700', category:'bg-amber-50 text-amber-700', boolean:'bg-brand-50 text-brand-600', string:'bg-gray-100 text-gray-600' }
const TYPE_LABELS  = { number:'Sayısal', category:'Kategorik', boolean:'Binary', string:'Metin' }
const COL_COLORS   = ['#534AB7','#1D9E75','#378ADD','#BA7517','#D4537E','#639922','#D85A30','#185FA5','#9333ea','#0891b2']

export default function DataEntry() {
  const { schema, setSchema, updateCell, addRow, deleteRow, addColumn } = useDataStore()
  const [loading, setLoading]         = useState(false)
  const [loadingMsg, setLoadingMsg]   = useState('')
  const [activeTab, setActiveTab]     = useState('table')
  const [selectedCol, setSelectedCol] = useState(null)
  const [showAddVar, setShowAddVar]   = useState(false)
  const [showAI, setShowAI]           = useState(false)
  const [studyDesc, setStudyDesc]     = useState('')
  const [newVar, setNewVar]           = useState({ name: '', type: 'number' })
  const [savedId, setSavedId]         = useState(null)
  const fileRef = useRef()

  const handleAISchema = async () => {
    if (!studyDesc.trim()) return
    setLoading(true); setLoadingMsg('AI şema oluşturuyor...')
    try {
      const data = await dataAPI.createSchema(studyDesc)
      setSchema(data.schema); setShowAI(false)
      toast.success('Şema oluşturuldu!')
    } catch (e) { toast.error('Şema hatası: ' + (e.message || '')) }
    finally { setLoading(false) }
  }

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0]; if (!file) return
    setLoading(true); setLoadingMsg('Dosya okunuyor...')

    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const text = ev.target.result
        const lines = text.trim().split('\n').filter(l => l.trim())
        if (lines.length < 2) { toast.error('Dosya boş veya geçersiz.'); setLoading(false); return }

        const sep = lines[0].includes(';') ? ';' : ','
        const headers = lines[0].split(sep).map(h => h.replace(/"/g, '').trim())

        const rows = lines.slice(1).map(line => {
          const vals = line.split(sep).map(v => v.replace(/"/g, '').trim())
          return Object.fromEntries(headers.map((h, i) => [
            h.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_çğışöü]/g, '').slice(0, 40),
            vals[i] ?? null
          ]))
        })

        const detectedTypes = {}
        headers.forEach(h => {
          const key = h.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_çğışöü]/g, '').slice(0, 40)
          const vals = rows.map(r => r[key]).filter(v => v !== null && v !== '')
          const numCount = vals.filter(v => !isNaN(Number(v))).length
          const uniq = new Set(vals).size
          if (numCount / Math.max(vals.length, 1) > 0.8) detectedTypes[key] = 'number'
          else if (uniq <= 8 && vals.length > 3) detectedTypes[key] = 'category'
          else detectedTypes[key] = 'string'
        })

        const schema = {
          studyTitle: file.name.replace(/\.[^/.]+$/, ''),
          studyType: 'retrospektif',
          columns: headers.map(h => {
            const key = h.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_çğışöü]/g, '').slice(0, 40)
            return { key, label: h, type: detectedTypes[key] || 'string', required: false }
          }),
          rows,
          createdAt: new Date().toISOString(),
          mode: 'imported'
        }

        setSchema(schema)
        toast.success(`${rows.length} satır, ${headers.length} değişken yüklendi!`)
      } catch (err) {
        toast.error('Parse hatası: ' + (err.message || 'Dosya okunamadı'))
      } finally {
        setLoading(false)
        e.target.value = ''
      }
    }
    reader.onerror = () => { toast.error('Dosya okunamadı.'); setLoading(false) }
    reader.readAsText(file, 'UTF-8')
  }

  const handleSave = async () => {
    if (!schema) return
    setLoading(true); setLoadingMsg('Kaydediliyor...')
    try {
      const meta = { ...schema, rows: [] }
      let record
      if (savedId) {
        record = await updateOutput(savedId, { payload: meta, result: meta, summary: `${schema.rows.length} satır, ${schema.columns.length} değişken` })
      } else {
        record = await saveOutput({ type: OUTPUT_TYPES.DATASET, title: schema.studyTitle || 'Veri Seti', query: schema.studyTitle, payload: meta, result: meta, summary: `${schema.rows.length} satır, ${schema.columns.length} değişken` })
        setSavedId(record.id)
      }
      await saveDatasetRows(record.id, schema.rows)
      toast.success(`Kaydedildi (${schema.rows.length} satır)`)
    } catch (e) { toast.error('Kayıt hatası: ' + (e.message || '')) }
    finally { setLoading(false) }
  }

  const handleLoad = async (savedResult, record) => {
    setLoading(true); setLoadingMsg('Yükleniyor...')
    try {
      const rows = await loadDatasetRows(record.id)
      setSchema({ ...savedResult, rows }); setSavedId(record.id)
      toast.success(`"${record.title}" yüklendi (${rows.length} satır)`)
    } catch (e) { toast.error('Yükleme hatası: ' + (e.message || '')) }
    finally { setLoading(false) }
  }

  const handleExport = () => {
    if (!schema) return
    const csv = [schema.columns.map(c => c.label).join(','), ...schema.rows.map(r => schema.columns.map(c => `"${r[c.key] ?? ''}"`).join(','))].join('\n')
    const a = document.createElement('a'); a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv)
    a.download = `${schema.studyTitle || 'data'}.csv`; a.click()
    toast.success('CSV indirildi')
  }

  const handleAddVar = () => {
    if (!newVar.name.trim()) return
    const key = newVar.name.toLowerCase().replace(/\s+/g,'_').replace(/[^a-z0-9_]/g,'').slice(0,40)
    addColumn({ key, label: newVar.name, type: newVar.type, required: false })
    setNewVar({ name:'', type:'number' }); setShowAddVar(false)
    toast.success(`"${newVar.name}" eklendi`)
  }

  const colStats = () => {
    if (!schema || selectedCol === null) return null
    const col  = schema.columns[selectedCol]
    const vals = schema.rows.map(r => r[col.key]).filter(v => v !== null && v !== undefined && v !== '')
    if (col.type === 'number') {
      const nums = vals.map(Number).filter(v => !isNaN(v))
      if (!nums.length) return null
      const sorted = [...nums].sort((a,b) => a-b)
      const mean   = nums.reduce((a,b) => a+b, 0) / nums.length
      const sd     = Math.sqrt(nums.reduce((a,b) => a+(b-mean)**2, 0) / nums.length)
      const median = sorted.length%2===0 ? (sorted[sorted.length/2-1]+sorted[sorted.length/2])/2 : sorted[Math.floor(sorted.length/2)]
      return [['n',nums.length],['Ort.',mean.toFixed(2)],['Med.',median.toFixed(2)],['SS',sd.toFixed(2)],['Min',sorted[0]],['Max',sorted[sorted.length-1]]]
    }
    const counts = {}; vals.forEach(v => { counts[v] = (counts[v]||0)+1 })
    return Object.entries(counts).slice(0,6).map(([k,v]) => [k, v])
  }

  const missing = schema ? schema.rows.reduce((acc,r) => acc + schema.columns.filter(c => r[c.key]===null||r[c.key]===''||r[c.key]===undefined).length, 0) : 0

  return (
    <div className="p-6 h-screen flex flex-col">
      <div className="flex items-start justify-between mb-4">
        <PageHeader icon="ti-table" title="Veri Girişi"
          subtitle="Excel benzeri tablo — manuel giriş, CSV import veya AI şema"
          actions={<SavedBadge type={OUTPUT_TYPES.DATASET} />} />
        <div className="flex gap-2 mt-1">
          {schema && <>
            <button className="btn-secondary text-xs" onClick={handleExport}><i className="ti ti-download text-sm" />CSV</button>
            <button className="btn-primary text-xs" onClick={handleSave} disabled={loading}>
              <i className="ti ti-device-floppy text-sm" />{savedId ? 'Güncelle' : 'Kaydet'}
            </button>
          </>}
          <button className="btn-secondary text-xs" onClick={() => fileRef.current?.click()} disabled={loading}>
            <i className="ti ti-upload text-sm" />CSV/Excel Yükle
          </button>
          <button className="btn-primary text-xs" onClick={() => setShowAI(true)}>
            <i className="ti ti-sparkles text-sm" />AI Şema
          </button>
        </div>
      </div>

      <input type="file" ref={fileRef} className="hidden" accept=".csv,.xlsx,.xls" onChange={handleFileUpload} />
      {loading && <div className="mb-3"><AgentRunning message={loadingMsg} /></div>}

      {!schema && !loading && (
        <div className="flex-1 flex flex-col gap-4">
          <div className="card">
            <OutputSelector type={OUTPUT_TYPES.DATASET} label="Kayıtlı veri seti yükle"
              placeholder="Önceki veri setlerinden seç..." onLoad={handleLoad} />
          </div>
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-brand-50 flex items-center justify-center mx-auto mb-4">
                <i className="ti ti-table text-brand-600 text-2xl" />
              </div>
              <h3 className="text-base font-medium text-gray-800 mb-2">Veri girişine başla</h3>
              <p className="text-sm text-gray-400 mb-6 max-w-sm">AI ile şema oluşturun veya CSV/Excel import edin</p>
              <div className="flex gap-3 justify-center">
                <button className="btn-primary" onClick={() => setShowAI(true)}><i className="ti ti-sparkles" />AI ile Şema Oluştur</button>
                <button className="btn-secondary" onClick={() => fileRef.current?.click()}><i className="ti ti-upload" />CSV/Excel Yükle</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {schema && (
        <div className="flex flex-1 gap-4 min-h-0">
          {/* Left panel */}
          <div className="w-52 flex-shrink-0 flex flex-col bg-white border border-gray-100 rounded-xl overflow-hidden">
            <div className="px-3 py-2 border-b border-gray-100">
              <div className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">Değişkenler</div>
            </div>
            <div className="flex-1 overflow-y-auto py-1.5 px-1.5 space-y-0.5">
              {schema.columns.map((col, i) => (
                <div key={col.key} onClick={() => setSelectedCol(selectedCol===i ? null : i)}
                  className={`flex items-center gap-2 px-2 py-2 rounded-lg cursor-pointer text-xs transition-colors ${selectedCol===i ? 'bg-brand-50 text-brand-700' : 'text-gray-600 hover:bg-gray-50'}`}>
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: COL_COLORS[i%COL_COLORS.length] }} />
                  <span className="flex-1 truncate font-medium">{col.label}</span>
                  <span className={`badge text-[10px] px-1.5 py-0 ${TYPE_COLORS[col.type]}`}>{TYPE_LABELS[col.type]?.slice(0,3)}</span>
                </div>
              ))}
            </div>
            <div className="p-1.5 border-t border-gray-100">
              <button onClick={() => setShowAddVar(true)}
                className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg border border-dashed border-brand-200 text-xs text-brand-600 hover:bg-brand-50 transition-colors">
                <i className="ti ti-plus text-sm" />Değişken ekle
              </button>
            </div>
            {selectedCol !== null && colStats() && (
              <div className="border-t border-gray-100 p-3">
                <div className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-2">{schema.columns[selectedCol]?.label}</div>
                <div className="space-y-1">
                  {colStats().map(([l,v]) => (
                    <div key={l} className="flex justify-between text-xs">
                      <span className="text-gray-400">{l}</span>
                      <span className="font-medium text-gray-700">{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Table */}
          <div className="flex-1 flex flex-col bg-white border border-gray-100 rounded-xl overflow-hidden min-w-0">
            <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100">
              <div className="flex gap-1">
                {['table','stats'].map(t => (
                  <button key={t} onClick={() => setActiveTab(t)}
                    className={`px-3 py-1 rounded-md text-xs transition-colors ${activeTab===t ? 'bg-brand-50 text-brand-600 font-medium' : 'text-gray-500 hover:bg-gray-50'}`}>
                    {t === 'table' ? 'Tablo' : 'İstatistik'}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-3 text-xs text-gray-400">
                <span><b className="text-gray-700">{schema.rows.length}</b> satır</span>
                <span><b className="text-gray-700">{schema.columns.length}</b> değişken</span>
                {missing > 0 && <span className="text-amber-600"><b>{missing}</b> eksik</span>}
              </div>
            </div>

            {activeTab === 'table' && (
              <>
                <div className="flex-1 overflow-auto">
                  <table className="w-full border-collapse text-xs" style={{ tableLayout: 'fixed' }}>
                    <colgroup>
                      <col style={{ width: 44 }} />
                      {schema.columns.map(c => <col key={c.key} style={{ minWidth: 110 }} />)}
                    </colgroup>
                    <thead className="sticky top-0 z-10">
                      <tr>
                        <th className="bg-gray-50 border-b border-r border-gray-100 text-center text-[11px] text-gray-400 py-2">#</th>
                        {schema.columns.map((col, ci) => (
                          <th key={col.key} onClick={() => setSelectedCol(selectedCol===ci ? null : ci)}
                            className={`bg-gray-50 border-b border-r border-gray-100 text-left px-2 py-2 font-medium text-gray-600 cursor-pointer hover:bg-gray-100 ${selectedCol===ci ? 'bg-brand-50 text-brand-700' : ''}`}>
                            <div className="flex items-center gap-1.5">
                              <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: COL_COLORS[ci%COL_COLORS.length] }} />
                              <span className="truncate">{col.label}</span>
                              <span className={`ml-auto badge text-[9px] px-1 ${TYPE_COLORS[col.type]}`}>{TYPE_LABELS[col.type]?.slice(0,3)}</span>
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {schema.rows.map((row, ri) => (
                        <tr key={ri} className="group hover:bg-gray-50/50">
                          <td className="border-b border-r border-gray-100 text-center text-[11px] text-gray-400 bg-gray-50/50">
                            <div className="flex items-center justify-center gap-1">
                              <span>{ri+1}</span>
                              <button onClick={() => deleteRow(ri)} className="opacity-0 group-hover:opacity-100 transition-opacity text-red-400 hover:text-red-600">
                                <i className="ti ti-x text-[10px]" />
                              </button>
                            </div>
                          </td>
                          {schema.columns.map((col, ci) => (
                            <td key={col.key} className={`border-b border-r border-gray-100 p-0 ${selectedCol===ci ? 'bg-brand-50/20' : ''}`}>
                              <input className="cell-input" value={row[col.key] ?? ''}
                                onChange={e => updateCell(ri, col.key, e.target.value)} placeholder="—" />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <button onClick={addRow}
                  className="flex items-center justify-center gap-2 py-2.5 text-xs text-gray-400 hover:text-brand-600 hover:bg-gray-50 border-t border-gray-100 transition-colors">
                  <i className="ti ti-plus text-sm" />Satır ekle
                </button>
              </>
            )}

            {activeTab === 'stats' && (
              <div className="flex-1 overflow-y-auto p-4">
                <div className="grid grid-cols-3 gap-3">
                  {schema.columns.filter(c => c.type==='number').map((col, i) => {
                    const vals = schema.rows.map(r => r[col.key]).filter(v => v!==null&&v!==''&&!isNaN(Number(v))).map(Number)
                    if (!vals.length) return null
                    const sorted = [...vals].sort((a,b) => a-b)
                    const mean = vals.reduce((a,b) => a+b, 0) / vals.length
                    const sd   = Math.sqrt(vals.reduce((a,b) => a+(b-mean)**2, 0) / vals.length)
                    const median = sorted.length%2===0 ? (sorted[sorted.length/2-1]+sorted[sorted.length/2])/2 : sorted[Math.floor(sorted.length/2)]
                    return (
                      <div key={col.key} className="card">
                        <div className="flex items-center gap-2 mb-3">
                          <div className="w-2 h-2 rounded-full" style={{ background: COL_COLORS[i%COL_COLORS.length] }} />
                          <div className="text-xs font-medium text-gray-800 truncate">{col.label}</div>
                        </div>
                        {[['Ortalama',mean.toFixed(2)],['Std. Sapma',sd.toFixed(2)],['Medyan',median.toFixed(2)],['Min',sorted[0]],['Max',sorted[sorted.length-1]],['n',vals.length]].map(([l,v]) => (
                          <div key={l} className="flex justify-between py-1 border-b border-gray-50 text-xs last:border-0">
                            <span className="text-gray-400">{l}</span>
                            <span className="font-medium text-gray-700">{v}</span>
                          </div>
                        ))}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal: AI Schema */}
      <Modal open={showAI} onClose={() => setShowAI(false)} title="AI ile Şema Oluştur">
        <label className="label">Çalışma açıklaması</label>
        <textarea className="textarea mb-4" rows={4} value={studyDesc} onChange={e => setStudyDesc(e.target.value)}
          placeholder="örn: DKA tanısıyla PICU'ya yatan çocukların asidoz süresi ile nörolojik sonuçları..." />
        <div className="flex gap-2 justify-end">
          <button className="btn-secondary" onClick={() => setShowAI(false)}>İptal</button>
          <button className="btn-primary" onClick={handleAISchema} disabled={loading || !studyDesc.trim()}>
            <i className="ti ti-sparkles text-sm" />Oluştur
          </button>
        </div>
      </Modal>

      {/* Modal: Add Variable */}
      <Modal open={showAddVar} onClose={() => setShowAddVar(false)} title="Değişken Ekle">
        <label className="label">Değişken adı</label>
        <input className="input mb-3" value={newVar.name} onChange={e => setNewVar(n => ({...n, name: e.target.value}))} placeholder="örn. yaş, cinsiyet, pH..." />
        <label className="label">Veri tipi</label>
        <div className="grid grid-cols-4 gap-2 mb-4">
          {['number','category','boolean','string'].map(t => (
            <button key={t} onClick={() => setNewVar(n => ({...n, type: t}))}
              className={`py-2 rounded-lg border text-xs transition-colors ${newVar.type===t ? 'border-brand-600 bg-brand-50 text-brand-600 font-medium' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
              {TYPE_LABELS[t]}
            </button>
          ))}
        </div>
        <div className="flex gap-2 justify-end">
          <button className="btn-secondary" onClick={() => setShowAddVar(false)}>İptal</button>
          <button className="btn-primary" onClick={handleAddVar} disabled={!newVar.name.trim()}>Ekle</button>
        </div>
      </Modal>
    </div>
  )
}
