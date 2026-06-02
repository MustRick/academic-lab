import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { academicSearchAPI, libraryAPI } from '@/api'
import { PageHeader, AgentRunning, EmptyState, ResultCard } from '@/components/ui'
import { SaveBar, OutputSelector, SavedBadge } from '@/components/ui/SaveBar'
import { OUTPUT_TYPES } from '@/lib/outputs'
import toast from 'react-hot-toast'

const EVIDENCE = {
  'meta-analysis': 'bg-green-50 text-green-700',
  rct: 'bg-blue-50 text-blue-700',
  cohort: 'bg-amber-50 text-amber-700',
  case: 'bg-gray-100 text-gray-600',
  other: 'bg-gray-100 text-gray-500',
}
const EXAMPLES = ['DKA cerebral edema pediatric outcomes','mechanical ventilation weaning PICU','ARDS prone positioning children mortality','sepsis biomarkers pediatric']

const getPaperKey = (paper, fallback = '') => (
  paper?.doi?.trim().toLowerCase() ||
  paper?.pmid?.trim() ||
  paper?.title?.trim().toLowerCase() ||
  fallback
)

export default function AcademicSearch() {
  const [query, setQuery]     = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult]   = useState(null)
  const [savedPaperKeys, setSavedPaperKeys] = useState(() => new Set())
  const [savingPaperKeys, setSavingPaperKeys] = useState(() => new Set())

  useEffect(() => {
    let active = true
    libraryAPI.listArticles()
      .then(response => {
        if (!active) return
        const keys = new Set((response.data || []).map(item => getPaperKey(item)).filter(Boolean))
        setSavedPaperKeys(keys)
      })
      .catch(() => {})
    return () => { active = false }
  }, [])

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

  const articlePayload = (paper) => ({
    title: paper.title || 'Başlık yok',
    authors: paper.authors || [],
    journal: paper.journal || null,
    publication_year: paper.year || null,
    doi: paper.doi || null,
    pmid: paper.pmid || null,
    pmcid: paper.pmcid || null,
    abstract: paper.abstract || null,
    url: paper.url || null,
    source: paper.source || null,
    publication_type: paper.evidenceLevel || null,
    metadata: {
      citation_count: paper.citationCount ?? null,
      semantic_scholar_id: paper.semanticScholarId || null,
      publication_types: paper.publicationTypes || []
    }
  })

  const handleAddToLibrary = async (paper, index) => {
    const key = getPaperKey(paper, `paper-${index}`)
    if (!key || savedPaperKeys.has(key)) return

    setSavingPaperKeys(prev => new Set(prev).add(key))
    try {
      await libraryAPI.createArticle(articlePayload(paper))
      setSavedPaperKeys(prev => new Set(prev).add(key))
      toast.success('Makale kütüphaneye eklendi.')
    } catch (e) {
      toast.error('Kütüphaneye eklenemedi: ' + (e.message || ''))
    } finally {
      setSavingPaperKeys(prev => {
        const next = new Set(prev)
        next.delete(key)
        return next
      })
    }
  }

  const papers = result?.papers || result?.analysis?.papers || result?.analysis?.results || []
  const summaryText =
    typeof result?.summary === 'string'
      ? result.summary
      : result?.summary?.conclusion || result?.analysis?.summary || ''
  const summary = papers.length
    ? `${papers.length} makale — ${result?.evidenceLevels?.counts?.['meta-analysis'] || 0} meta-analiz, ${result?.evidenceLevels?.counts?.rct || 0} RCT`
    : ''

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <PageHeader icon="ti-search" title="Literatür Arama"
        subtitle="PubMed ve Semantic Scholar ile ücretsiz literatür arama"
        actions={
          <>
            <Link to="/app/library" className="btn-secondary text-xs">
              <i className="ti ti-books text-sm" />Kütüphane
            </Link>
            <SavedBadge type={OUTPUT_TYPES.LITERATURE} />
          </>
        } />

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

      {loading && <AgentRunning message="PubMed ve Semantic Scholar taranıyor — meta-analizler, RCT'ler değerlendiriliyor..." />}

      {result?.success && (
        <div className="space-y-4">
          {summaryText && (
            <ResultCard title="Agent Özeti">
              <p className="text-sm text-gray-700 leading-relaxed">{summaryText}</p>
              {Array.isArray(result?.summary?.keyFindings) && result.summary.keyFindings.length > 0 && (
                <div className="mt-3 space-y-1.5">
                  {result.summary.keyFindings.map((item, i) => (
                    <div key={i} className="text-xs text-gray-600 flex gap-2">
                      <span className="text-brand-600 font-medium">{i + 1}.</span>
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              )}
            </ResultCard>
          )}

          {papers.length > 0 && (
            <ResultCard title={`Bulunan Makaleler (${papers.length})`}>
              <div className="space-y-3">
                {papers.map((p, i) => {
                  const addKey = getPaperKey(p, `paper-${i}`)
                  const isSaved = savedPaperKeys.has(addKey)
                  const isSaving = savingPaperKeys.has(addKey)
                  return (
                  <div key={i} className="p-3.5 rounded-xl border border-gray-100 hover:border-brand-100 hover:bg-brand-50/20 transition-all">
                    <div className="flex items-start justify-between gap-3 mb-1.5">
                      <div className="text-sm font-medium text-gray-900 leading-snug">{p.title || `Makale ${i+1}`}</div>
                      <div className="flex gap-1.5 flex-shrink-0">
                        {p.evidenceLevel && <span className={`badge ${EVIDENCE[p.evidenceLevel] || EVIDENCE.other}`}>{p.evidenceLabel || p.evidenceLevel}</span>}
                        {p.source && <span className="badge bg-gray-100 text-gray-600">{p.source}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-400">
                      {p.journal && <span className="text-brand-600 font-medium">{p.journal}</span>}
                      {p.year && <span>{p.year}</span>}
                      {p.citationCount !== null && p.citationCount !== undefined && <span>{p.citationCount} atıf</span>}
                    </div>
                    {p.abstract && (
                      <div className="mt-2 p-2 bg-gray-50 rounded-lg">
                        <span className="text-xs text-gray-600 line-clamp-3">{p.abstract}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 mt-2">
                      {p.url && (
                        <a href={p.url} target="_blank" rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-brand-600 hover:underline">
                          <i className="ti ti-external-link text-sm" />Makaleyi aç
                        </a>
                      )}
                      <button
                        onClick={() => handleAddToLibrary(p, i)}
                        disabled={isSaving || isSaved}
                        className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-50 border border-green-100 rounded-lg px-2 py-1 hover:bg-green-100 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {isSaving
                          ? <span className="w-3 h-3 border border-green-200 border-t-green-700 rounded-full animate-spin" />
                          : <i className={`ti ${isSaved ? 'ti-check' : 'ti-plus'} text-sm`} />
                        }
                        {isSaved ? 'Kütüphanede' : 'Kütüphaneye Ekle'}
                      </button>
                    </div>
                  </div>
                )})}
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
