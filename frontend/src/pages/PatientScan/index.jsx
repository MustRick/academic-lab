import { useState } from 'react'
import { patientScanAPI } from '@/api'
import { PageHeader, AgentRunning, EmptyState, ResultCard, StatBox } from '@/components/ui'
import { SaveBar, OutputSelector, SavedBadge } from '@/components/ui/SaveBar'
import { OUTPUT_TYPES } from '@/lib/outputs'
import toast from 'react-hot-toast'

const EXAMPLES = ['DKA tanısı olan 1-5 yaş arası hastalar','mekanik ventilatörden başarısız ekstübasyon','sepsis + vazopresor tedavisi','ARDS + prone pozisyon']

export default function PatientScan() {
  const [query, setQuery]     = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult]   = useState(null)

  const handleSearch = async () => {
    if (!query.trim()) return
    setLoading(true); setResult(null)
    try {
      const data = await patientScanAPI.search(query)
      setResult(data)
      if (!data.success) toast.error(data.message || 'Tarama başarısız.')
    } catch (e) { toast.error('Bağlantı hatası: ' + (e.message || '')) }
    finally { setLoading(false) }
  }

  const handleLoad = (savedResult, record) => { setResult(savedResult); setQuery(record?.query || '') }

  const summary = result?.success
    ? `${result.hastaCount} hasta — Anahtar: ${result.keywords?.join(', ')}`
    : null

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <PageHeader icon="ti-user-search" title="Hasta Tarama"
        subtitle="Elasticsearch üzerinden klinik kriterlere göre kohort tara"
        actions={<SavedBadge type={OUTPUT_TYPES.PATIENT_SCAN} />} />

      <div className="card mb-4">
        <OutputSelector type={OUTPUT_TYPES.PATIENT_SCAN} label="Kayıtlı tarama yükle"
          placeholder="Önceki hasta taramalarından seç..." onLoad={handleLoad} />
      </div>

      <div className="card mb-5">
        <label className="label">Klinik arama kriteri</label>
        <div className="flex gap-2">
          <textarea className="textarea flex-1" rows={3} value={query} onChange={e => setQuery(e.target.value)}
            placeholder="örn: DKA tanısı ile yatırılan, asidoz süresi 6 saatten uzun olan hastalar"
            onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) handleSearch() }} />
          <button className="btn-primary self-end px-6" onClick={handleSearch} disabled={loading || !query.trim()}>
            <i className="ti ti-search text-sm" />Tara
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

      {loading && <AgentRunning message="Elasticsearch taranıyor, anahtar kelimeler çıkarılıyor..." />}

      {result?.success && (
        <div className="space-y-4">
          <div className="grid grid-cols-4 gap-3">
            <StatBox label="Bulunan Hasta"  value={result.hastaCount}              color="brand" />
            <StatBox label="Başvuru Sayısı" value={result.basvuruNumbers?.length || 0} color="green" />
            <StatBox label="Anahtar Kelime" value={result.keywords?.length || 0}   color="blue" />
            <StatBox label="Intent"         value={result.intent || '—'}           color="amber" />
          </div>

          {result.keywords?.length > 0 && (
            <ResultCard title="Anahtar Kelimeler">
              <div className="flex flex-wrap gap-2">
                {result.keywords.map(kw => (
                  <span key={kw} className="px-2.5 py-1 bg-brand-50 text-brand-700 rounded-full text-xs font-medium border border-brand-100">{kw}</span>
                ))}
              </div>
            </ResultCard>
          )}

          {result.basvuruNumbers?.length > 0 && (
            <ResultCard title={`Başvuru Numaraları (${result.basvuruNumbers.length})`}>
              <div className="grid grid-cols-6 gap-1.5 max-h-48 overflow-y-auto">
                {result.basvuruNumbers.map(no => (
                  <span key={no} className="text-xs font-mono bg-gray-50 border border-gray-100 rounded px-2 py-1 text-center text-gray-700">{no}</span>
                ))}
              </div>
              <SaveBar type={OUTPUT_TYPES.PATIENT_SCAN}
                title={`Hasta Tarama: ${query?.slice(0, 40)}`}
                query={query} payload={{ message: query }} result={result} summary={summary} />
            </ResultCard>
          )}
        </div>
      )}

      {!result && !loading && (
        <EmptyState icon="ti-user-search" title="Kohort tarama hazır"
          description="Klinik kriterleri doğal dilde yaz, agent anahtar kelime araması yapar." />
      )}
    </div>
  )
}
