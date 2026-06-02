import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { EmptyState, Modal, PageHeader, Spinner } from '@/components/ui'
import { OUTPUT_TYPES, deleteOutput, listAllOutputs } from '@/lib/outputs'

const TYPE_LABELS = {
  [OUTPUT_TYPES.PATIENT_SCAN]: 'Hasta Tarama',
  [OUTPUT_TYPES.LITERATURE]: 'Literatür',
  [OUTPUT_TYPES.DATASET]: 'Dataset',
  [OUTPUT_TYPES.STATISTICS]: 'İstatistik',
  [OUTPUT_TYPES.FIGURES]: 'Figürler',
  [OUTPUT_TYPES.MANUSCRIPT]: 'Manuscript',
  [OUTPUT_TYPES.REVIEWER]: 'Reviewer',
}

const TYPE_COLORS = {
  [OUTPUT_TYPES.PATIENT_SCAN]: 'bg-brand-50 text-brand-600',
  [OUTPUT_TYPES.LITERATURE]: 'bg-blue-50 text-blue-700',
  [OUTPUT_TYPES.DATASET]: 'bg-green-50 text-green-700',
  [OUTPUT_TYPES.STATISTICS]: 'bg-purple-50 text-purple-700',
  [OUTPUT_TYPES.FIGURES]: 'bg-amber-50 text-amber-700',
  [OUTPUT_TYPES.MANUSCRIPT]: 'bg-pink-50 text-pink-700',
  [OUTPUT_TYPES.REVIEWER]: 'bg-teal-50 text-teal-700',
}

const typeOptions = Object.values(OUTPUT_TYPES)

function formatDate(value) {
  if (!value) return '—'
  return new Date(value).toLocaleString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function Records() {
  const [items, setItems] = useState([])
  const [type, setType] = useState('')
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)

  const counts = useMemo(() => {
    const next = Object.fromEntries(typeOptions.map(t => [t, 0]))
    for (const item of items) {
      if (next[item.type] !== undefined) next[item.type] += 1
    }
    return next
  }, [items])

  const filteredItems = useMemo(
    () => type ? items.filter(item => item.type === type) : items,
    [items, type]
  )

  const loadItems = async () => {
    setLoading(true)
    try {
      const data = await listAllOutputs()
      setItems(data)
    } catch (e) {
      toast.error('Kayıtlar yüklenemedi: ' + (e.message || ''))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadItems()
  }, [])

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteOutput(deleteTarget.id)
      toast.success(`"${deleteTarget.title}" silindi`)
      setDeleteTarget(null)
      await loadItems()
    } catch (e) {
      toast.error('Silme başarısız: ' + (e.message || ''))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <PageHeader
        icon="ti-folder"
        title="Kayıtlarım"
        subtitle="Kaydedilmiş tüm agent çıktıları"
        actions={
          <button className="btn-secondary text-xs" onClick={loadItems} disabled={loading}>
            <i className="ti ti-refresh text-sm" />Yenile
          </button>
        }
      />

      <div className="card mb-4">
        <div className="flex items-end gap-3">
          <div className="w-72 max-w-full">
            <label className="label">Çıktı tipi</label>
            <select className="input" value={type} onChange={e => setType(e.target.value)}>
              <option value="">Tüm kayıtlar</option>
              {typeOptions.map(option => (
                <option key={option} value={option}>
                  {TYPE_LABELS[option] || option} ({option})
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap gap-1.5 pb-1">
            {typeOptions.map(option => (
              <button key={option} onClick={() => setType(option)}
                className={`px-2.5 py-1 rounded-full text-xs transition-colors ${
                  type === option
                    ? TYPE_COLORS[option] || 'bg-gray-100 text-gray-600'
                    : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                }`}>
                {TYPE_LABELS[option] || option}
                {counts[option] ? <span className="ml-1 opacity-70">{counts[option]}</span> : null}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="card">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-gray-400 py-10 justify-center">
            <Spinner size="sm" />Kayıtlar yükleniyor...
          </div>
        ) : !filteredItems.length ? (
          <EmptyState
            icon="ti-inbox"
            title="Kayıt bulunamadı"
            description={type ? 'Bu çıktı tipi için kayıt yok.' : 'Henüz kaydedilmiş çıktı yok.'}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2.5 px-2 text-xs font-medium text-gray-400">Başlık</th>
                  <th className="text-left py-2.5 px-2 text-xs font-medium text-gray-400">Tip</th>
                  <th className="text-left py-2.5 px-2 text-xs font-medium text-gray-400">Sorgu / Özet</th>
                  <th className="text-left py-2.5 px-2 text-xs font-medium text-gray-400">Tarih</th>
                  <th className="w-12 py-2.5 px-2" />
                </tr>
              </thead>
              <tbody>
                {filteredItems.map(item => (
                  <tr key={item.id} className="border-b border-gray-50 hover:bg-gray-50/60">
                    <td className="py-3 px-2 align-top">
                      <div className="flex items-center gap-1.5">
                        {item.is_pinned && <i className="ti ti-pin text-amber-500 text-sm" />}
                        <span className="font-medium text-gray-800">{item.title}</span>
                      </div>
                      <div className="text-[11px] text-gray-400 mt-0.5">{item.id}</div>
                    </td>
                    <td className="py-3 px-2 align-top">
                      <span className={`badge ${TYPE_COLORS[item.type] || 'bg-gray-100 text-gray-600'}`}>
                        {TYPE_LABELS[item.type] || item.type}
                      </span>
                    </td>
                    <td className="py-3 px-2 align-top max-w-md">
                      {item.query && <div className="text-xs text-gray-700 line-clamp-1">{item.query}</div>}
                      {item.summary && <div className="text-xs text-gray-400 line-clamp-2 mt-0.5">{item.summary}</div>}
                      {!item.query && !item.summary && <span className="text-xs text-gray-300">—</span>}
                    </td>
                    <td className="py-3 px-2 align-top whitespace-nowrap text-xs text-gray-500">
                      {formatDate(item.created_at)}
                    </td>
                    <td className="py-2 px-2 align-top text-right">
                      <button onClick={() => setDeleteTarget(item)}
                        className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                        title="Sil">
                        <i className="ti ti-trash text-sm" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={!!deleteTarget} onClose={() => !deleting && setDeleteTarget(null)} title="Kaydı Sil">
        <p className="text-sm text-gray-600 mb-4">
          <span className="font-medium text-gray-900">"{deleteTarget?.title}"</span> kaydı kalıcı olarak silinecek.
          Bu işlem geri alınamaz.
        </p>
        <div className="flex justify-end gap-2">
          <button className="btn-secondary" onClick={() => setDeleteTarget(null)} disabled={deleting}>
            İptal
          </button>
          <button onClick={handleDelete} disabled={deleting}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50">
            {deleting
              ? <><div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Siliniyor...</>
              : <><i className="ti ti-trash text-sm" />Sil</>
            }
          </button>
        </div>
      </Modal>
    </div>
  )
}
