import { useState } from 'react'
import { figuresAPI } from '@/api'
import { useStatsStore } from '@/store'
import { PageHeader, AgentRunning, EmptyState, ResultCard } from '@/components/ui'
import { SaveBar, OutputSelector, SavedBadge } from '@/components/ui/SaveBar'
import { OUTPUT_TYPES } from '@/lib/outputs'
import toast from 'react-hot-toast'

export default function Figures() {
  const { results: statsResults } = useStatsStore()
  const [loading, setLoading] = useState(false)
  const [result, setResult]   = useState(null)
  const [plan, setPlan]       = useState(statsResults ? JSON.stringify(statsResults.results?.map(r => ({ test:r.testName, result:r.result })), null, 2) : '')

  const handleGenerate = async () => {
    if (!plan.trim()) return
    setLoading(true)
    try {
      const data = await figuresAPI.generate(plan)
      setResult(data); toast.success('Figürler oluşturuldu!')
    } catch (e) { toast.error('Figür hatası: '+(e.message||'')) }
    finally { setLoading(false) }
  }

  const summary = result?.success ? `${result.visuals?.length||0} figür, ${result.tables?.length||0} tablo` : null

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <PageHeader icon="ti-chart-dots" title="Figür Oluşturma" subtitle="Publication-ready figür ve tablo önerileri"
        actions={<SavedBadge type={OUTPUT_TYPES.FIGURES} />} />

      <div className="card mb-4">
        <OutputSelector type={OUTPUT_TYPES.FIGURES} label="Kayıtlı figür seti yükle"
          placeholder="Önceki figür setlerinden seç..." onLoad={(r) => setResult(r)} />
      </div>

      <div className="card mb-5">
        <label className="label">İstatistiksel plan / sonuçlar</label>
        <textarea className="textarea mb-3" rows={6} value={plan} onChange={e => setPlan(e.target.value)}
          placeholder="İstatistik ajanından gelen sonuçlar otomatik gelir..." />
        <button className="btn-primary" onClick={handleGenerate} disabled={loading || !plan.trim()}>
          <i className="ti ti-chart-dots text-sm" />{loading ? 'Oluşturuluyor...' : 'Figürleri Oluştur'}
        </button>
      </div>

      {loading && <AgentRunning message="Figür tipleri belirleniyor, legend'lar yazılıyor..." />}

      {result?.success && (
        <div className="space-y-4">
          {result.decision && <ResultCard title="Agent Kararı"><p className="text-sm text-gray-700 leading-relaxed">{result.decision}</p></ResultCard>}

          {result.visuals?.length > 0 && (
            <ResultCard title={`Önerilen Figürler (${result.visuals.length})`}>
              <div className="grid grid-cols-2 gap-3">
                {result.visuals.map((v,i) => (
                  <div key={i} className="p-4 border border-gray-100 rounded-xl">
                    <div className="flex items-center gap-2 mb-2">
                      <i className="ti ti-chart-bar text-brand-600" />
                      <span className="text-sm font-medium text-gray-800">{v.type||`Figür ${i+1}`}</span>
                    </div>
                    {v.title  && <div className="text-xs text-gray-600 mb-1"><b>Başlık:</b> {v.title}</div>}
                    {v.legend && <div className="text-xs text-gray-600"><b>Legend:</b> {v.legend}</div>}
                  </div>
                ))}
              </div>
            </ResultCard>
          )}

          {result.tables?.length > 0 && (
            <ResultCard title={`Tablolar (${result.tables.length})`}>
              {result.tables.map((t,i) => (
                <div key={i} className="mb-4">
                  <div className="text-xs font-medium text-gray-700 mb-2">{t.title||`Tablo ${i+1}`}</div>
                  {t.columns && t.rows && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs border-collapse">
                        <thead><tr className="bg-gray-50">{t.columns.map(c => <th key={c} className="text-left py-2 px-3 border border-gray-100 font-medium text-gray-600">{c}</th>)}</tr></thead>
                        <tbody>{t.rows.map((r,ri) => (
                          <tr key={ri} className="border-b border-gray-50">{t.columns.map(c => <td key={c} className="py-2 px-3 border border-gray-100 text-gray-700">{r[c]??'—'}</td>)}</tr>
                        ))}</tbody>
                      </table>
                    </div>
                  )}
                </div>
              ))}
            </ResultCard>
          )}

          <SaveBar type={OUTPUT_TYPES.FIGURES}
            title={`Figürler — ${new Date().toLocaleDateString('tr-TR')}`}
            payload={{ statisticalPlan: plan.slice(0,200) }} result={result} summary={summary} />
        </div>
      )}

      {!result && !loading && (
        <EmptyState icon="ti-chart-dots" title="Figür oluşturulmadı"
          description="İstatistik sonuçları otomatik aktarılır veya manuel plan girin." />
      )}
    </div>
  )
}
