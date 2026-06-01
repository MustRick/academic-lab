import { useState } from 'react'
import { writingAPI } from '@/api'
import { useStatsStore } from '@/store'
import { PageHeader, AgentRunning, EmptyState } from '@/components/ui'
import { SaveBar, OutputSelector, SavedBadge } from '@/components/ui/SaveBar'
import { OUTPUT_TYPES, gatherWritingContext } from '@/lib/outputs'
import toast from 'react-hot-toast'

export default function Writing() {
  const { results: statsResults } = useStatsStore()
  const [loading, setLoading]     = useState(false)
  const [gathering, setGathering] = useState(false)
  const [manuscript, setManuscript] = useState('')
  const [contextNote, setContextNote] = useState('')
  const [form, setForm] = useState({
    topic: '',
    statisticalPlan: statsResults ? JSON.stringify(statsResults, null, 2) : '',
    literatureSummary: ''
  })

  const F = k => e => setForm(f => ({ ...f, [k]: e.target.value }))

  const handleGather = async () => {
    setGathering(true)
    try {
      const ctx = await gatherWritingContext()
      const parts = []
      if (ctx.literature?.result) {
        const papers = ctx.literature.result?.analysis?.papers || []
        if (papers.length) parts.push(`## Literatür (${papers.length} makale)\n` + papers.slice(0,5).map(p => `- ${p.title} (${p.journal}, ${p.year})`).join('\n'))
      }
      if (ctx.statistics?.result) {
        const tests = ctx.statistics.result?.results || []
        if (tests.length) parts.push(`## İstatistik Sonuçları\n` + tests.map(t => `- ${t.testName}: ${t.interpretation?.conclusion||''}`).join('\n'))
      }
      if (parts.length) {
        setForm(f => ({ ...f, literatureSummary: parts.join('\n\n') }))
        setContextNote(`${Object.keys(ctx).filter(k=>ctx[k]).length} kayıtlı çıktı yüklendi`)
        toast.success('Kayıtlı çıktılar yüklendi!')
      } else {
        toast('Yüklenecek kayıtlı içerik bulunamadı', { icon: 'ℹ️' })
      }
    } catch (e) { toast.error('Bağlam yükleme hatası: '+(e.message||'')) }
    finally { setGathering(false) }
  }

  const handleGenerate = async () => {
    if (!form.topic.trim()) { toast.error('Konu zorunlu'); return }
    setLoading(true)
    try {
      const data = await writingAPI.generate(form)
      setManuscript(data.manuscript || '')
      toast.success('Manuscript taslağı hazır!')
    } catch (e) { toast.error('Yazım hatası: '+(e.message||'')) }
    finally { setLoading(false) }
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <PageHeader icon="ti-pencil" title="Manuscript Yazımı" subtitle="IMRaD formatında Giriş ve Yöntemler taslağı"
        actions={<SavedBadge type={OUTPUT_TYPES.MANUSCRIPT} />} />

      <div className="grid grid-cols-5 gap-5">
        <div className="col-span-2 space-y-3">
          <div className="card">
            <div className="mb-4">
              <OutputSelector type={OUTPUT_TYPES.MANUSCRIPT} label="Kayıtlı manuscript yükle"
                placeholder="Önceki taslaklar..." onLoad={(r) => setManuscript(r?.manuscript||'')} />
            </div>

            <button onClick={handleGather} disabled={gathering}
              className="w-full flex items-center justify-center gap-2 py-2 mb-3 bg-green-50 text-green-700 border border-green-200 rounded-lg text-sm font-medium hover:bg-green-100 transition-colors">
              {gathering ? <><div className="w-3.5 h-3.5 border-2 border-green-300 border-t-green-600 rounded-full animate-spin" />Toplanıyor...</> : <><i className="ti ti-database-import text-sm" />Kayıtlı çıktıları otomatik yükle</>}
            </button>
            {contextNote && (
              <div className="mb-3 text-xs text-green-700 bg-green-50 rounded-lg px-3 py-2 flex items-center gap-2">
                <i className="ti ti-circle-check" />{contextNote}
              </div>
            )}

            <label className="label">Çalışma konusu *</label>
            <input className="input mb-3" value={form.topic} onChange={F('topic')} placeholder="örn: DKA asidoz süresi ve nörolojik sonuçlar" />

            <label className="label">Literatür özeti / bağlam</label>
            <textarea className="textarea mb-3" rows={5} value={form.literatureSummary} onChange={F('literatureSummary')} placeholder="Akademik arama sonuçları..." />

            <label className="label">İstatistiksel plan</label>
            <textarea className="textarea mb-4" rows={4} value={form.statisticalPlan} onChange={F('statisticalPlan')} placeholder="Analiz sonuçları..." />

            <button className="btn-primary w-full" onClick={handleGenerate} disabled={loading || !form.topic.trim()}>
              <i className="ti ti-pencil text-sm" />{loading ? 'Yazılıyor...' : 'Taslak Oluştur'}
            </button>
          </div>
        </div>

        <div className="col-span-3">
          {loading && <AgentRunning message="GPT-4o IMRaD formatında yazıyor..." />}
          {manuscript ? (
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <div className="section-title">Manuscript Taslağı</div>
                <button className="btn-ghost text-xs" onClick={() => { navigator.clipboard.writeText(manuscript); toast.success('Kopyalandı!') }}>
                  <i className="ti ti-copy" />Kopyala
                </button>
              </div>
              <pre className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed font-sans">{manuscript}</pre>
              <SaveBar type={OUTPUT_TYPES.MANUSCRIPT}
                title={`Manuscript: ${form.topic?.slice(0,40)}`}
                query={form.topic} payload={{ topic:form.topic }}
                result={{ manuscript, topic:form.topic }}
                summary={`IMRaD taslağı — ${form.topic}`} />
            </div>
          ) : (
            <EmptyState icon="ti-pencil" title="Taslak bekleniyor"
              description="Sol panelde konuyu doldurun. 'Kayıtlı çıktıları otomatik yükle' ile literatür ve istatistik bağlamı gelir." />
          )}
        </div>
      </div>
    </div>
  )
}
