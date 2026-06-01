import { useState } from 'react'
import { academicSearchAPI } from '@/api'
import { PageHeader, AgentRunning, EmptyState, ResultCard } from '@/components/ui'
import { SaveBar, OutputSelector, SavedBadge } from '@/components/ui/SaveBar'
import { OUTPUT_TYPES } from '@/lib/outputs'
import toast from 'react-hot-toast'

const Q = { Q1:'bg-green-50 text-green-700', Q2:'bg-blue-50 text-blue-700', Q3:'bg-gray-100 text-gray-600', Q4:'bg-gray-100 text-gray-500' }
const EXAMPLES = ['DKA cerebral edema pediatric outcomes','mechanical ventilation weaning PICU','ARDS prone positioning children mortality','sepsis biomarkers pediatric']

export default function AcademicSearch() {
  const [query, setQuery]     = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult]   = useState(null)

  const handleSearch = async () => {
    if (!query.trim()) return
    setLoading(true); setResult(null)
    try {
      const data = await academicSearchAPI.search(query)
      setResult(data)
      if (!data.success) toast.error(data.message || 'Arama başarısız.')
    } catch (e) { toast.error('Agent hatası: ' + (e.message || '')) }
    finally { setLoading(false) }
  }

  const handleLoad = (savedResult, record) => { setResult(savedResult); setQuery(record?.query || '') }

  const analysis = result?.analysis || {}
  const papers   = analysis.papers || analysis.results || []
  const summary  = papers.length ? `${papers.length} makale — ${papers.filter(p=>p.quartile==='Q1').length} Q1` : ''

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <PageHeader icon="ti-search" title="Literatür Arama"
        subtitle="Consensus MCP ile 200M+ peer-reviewed makalede arama"
        actions={<SavedBadge type={OUTPUT_TYPES.LITERATURE} />} />

      <div className="card mb-4">
        <OutputSelector type={OUTPUT_TYPES.LITERATURE} label="Kayıtlı literatür yükle"
          placeholder="Önceki araştırmalardan seç..." onLoad={handleLoad} />
      </div>

      <div className="card mb-5">
        <label className="label">Araştırma sorusu</label>
        <div className="flex gap-2">
          <input className="input flex-1" value={query} onChange={e => setQuery(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleSearch() }}
            placeholder="örn: DKA cerebral edema pediatric outcomes" />
          <button className="btn-primary" onClick={handleSearch} disabled={loading || !query.trim()}>
            <i className="ti ti-search text-sm" />Ara
          </button>
        </div>
        <div className="flex flex-wrap gap-1.5 mt-3">
          <span className="text-xs text-gray-400">Örnek:</span>
          {EXAMPLES.map(ex => (
            <button key={ex} onClick={() => setQuery(ex)}
              className="text-xs px-2.5 py-1 bg-gray-100 text-gray-600 rounded-full hover:bg-brand-50 hover:text-brand-600 transition-colors">{ex}</button>
          ))}
        </div>
      </div>

      {loading && <AgentRunning message="Consensus MCP araştırıyor — meta-analizler, RCT'ler taranıyor..." />}

      {result?.success && (
        <div className="space-y-4">
          {analysis.summary && typeof analysis.summary === 'string' && (
            <ResultCard title="Agent Özeti">
              <p className="text-sm text-gray-700 leading-relaxed">{analysis.summary}</p>
            </ResultCard>
          )}

          {papers.length > 0 && (
            <ResultCard title={`Bulunan Makaleler (${papers.length})`}>
              <div className="space-y-3">
                {papers.map((p, i) => (
                  <div key={i} className="p-3.5 rounded-xl border border-gray-100 hover:border-brand-100 hover:bg-brand-50/20 transition-all">
                    <div className="flex items-start justify-between gap-3 mb-1.5">
                      <div className="text-sm font-medium text-gray-900 leading-snug">{p.title || `Makale ${i+1}`}</div>
                      <div className="flex gap-1.5 flex-shrink-0">
                        {p.quartile && <span className={`badge ${Q[p.quartile] || Q.Q4}`}>{p.quartile}</span>}
                        {p.studyType && <span className="badge bg-gray-100 text-gray-600">{p.studyType}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-400">
                      {p.journal && <span className="text-brand-600 font-medium">{p.journal}</span>}
                      {p.year && <span>{p.year}</span>}
                    </div>
                    {p.keyFindings && (
                      <div className="mt-2 p-2 bg-green-50 rounded-lg">
                        <span className="text-xs font-medium text-green-700">Temel Bulgu: </span>
                        <span className="text-xs text-green-700">{p.keyFindings}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <SaveBar type={OUTPUT_TYPES.LITERATURE}
                title={`Literatür: ${query?.slice(0, 40)}`}
                query={query} payload={{ query }} result={result} summary={summary} />
            </ResultCard>
          )}
        </div>
      )}

      {!result && !loading && (
        <EmptyState icon="ti-books" title="Literatür taramaya hazır"
          description="Klinik sorunuzu girin — agent kanıt hiyerarşisine göre sıralar." />
      )}
    </div>
  )
}
