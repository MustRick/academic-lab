import { useState } from 'react'
import { reviewerAPI } from '@/api'
import { PageHeader, AgentRunning, EmptyState, ResultCard } from '@/components/ui'
import { SaveBar, OutputSelector, SavedBadge } from '@/components/ui/SaveBar'
import { OUTPUT_TYPES } from '@/lib/outputs'
import toast from 'react-hot-toast'

export default function Reviewer() {
  const [loading, setLoading] = useState(false)
  const [result, setResult]   = useState(null)
  const [email, setEmail]     = useState('')

  const handleAnalyze = async () => {
    if (!email.trim()) return
    setLoading(true)
    try {
      const data = await reviewerAPI.analyze(email)
      setResult(data); toast.success('Reviewer yanıt stratejisi hazır!')
    } catch (e) { toast.error('Hata: '+(e.message||'')) }
    finally { setLoading(false) }
  }

  const analysis = result?.analysis || {}
  const summary  = analysis.todoList?.length ? `${analysis.todoList.length} madde — ${analysis.todoList.filter(i=>i.priority==='high').length} yüksek öncelik` : null

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <PageHeader icon="ti-message-check" title="Reviewer Yanıtı"
        subtitle="Editör mailini yapıştır — öncelikli todo listesi ve yanıt stratejisi"
        actions={<SavedBadge type={OUTPUT_TYPES.REVIEWER} />} />

      <div className="card mb-4">
        <OutputSelector type={OUTPUT_TYPES.REVIEWER} label="Kayıtlı reviewer yanıtı yükle"
          placeholder="Önceki reviewer yanıtları..." onLoad={(r) => setResult(r)} />
      </div>

      <div className="card mb-5">
        <label className="label">Editör veya reviewer mail içeriği</label>
        <textarea className="textarea mb-3" rows={7} value={email} onChange={e => setEmail(e.target.value)}
          placeholder="Editörden veya reviewerdan gelen maili yapıştırın..." />
        <button className="btn-primary" onClick={handleAnalyze} disabled={loading || !email.trim()}>
          <i className="ti ti-analyze text-sm" />{loading ? 'Analiz ediliyor...' : 'Analiz Et'}
        </button>
      </div>

      {loading && <AgentRunning message="Mail analiz ediliyor, revizyon noktaları önceliklendiriliyor..." />}

      {result?.success && (
        <div className="space-y-4">
          {analysis.todoList?.length > 0 && (
            <ResultCard title="Yapılacaklar Listesi">
              <div className="space-y-2">
                {analysis.todoList.map((item,i) => (
                  <div key={i} className="flex items-start gap-3 p-3 rounded-xl border border-gray-100">
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 text-xs font-bold ${item.priority==='high'?'bg-red-100 text-red-600':item.priority==='medium'?'bg-amber-100 text-amber-700':'bg-gray-100 text-gray-500'}`}>{i+1}</div>
                    <div className="flex-1">
                      <div className="text-sm font-medium text-gray-800">{item.task||item}</div>
                      {item.detail && <div className="text-xs text-gray-500 mt-0.5">{item.detail}</div>}
                    </div>
                    {item.priority && (
                      <span className={`badge flex-shrink-0 ${item.priority==='high'?'bg-red-50 text-red-600':item.priority==='medium'?'bg-amber-50 text-amber-700':'bg-gray-100 text-gray-500'}`}>{item.priority}</span>
                    )}
                  </div>
                ))}
              </div>
            </ResultCard>
          )}

          {analysis.response && (
            <ResultCard title="Önerilen Yanıt">
              <pre className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed font-sans">{analysis.response}</pre>
              <button className="btn-secondary text-xs mt-3" onClick={() => { navigator.clipboard.writeText(analysis.response); toast.success('Kopyalandı!') }}>
                <i className="ti ti-copy" />Kopyala
              </button>
            </ResultCard>
          )}

          <SaveBar type={OUTPUT_TYPES.REVIEWER}
            title={`Reviewer Yanıtı — ${new Date().toLocaleDateString('tr-TR')}`}
            payload={{ editorMail: email.slice(0,200) }} result={result} summary={summary} />
        </div>
      )}

      {!result && !loading && (
        <EmptyState icon="ti-message-check" title="Mail analizi bekleniyor"
          description="Editör veya hakem mailini yapıştırın." />
      )}
    </div>
  )
}
