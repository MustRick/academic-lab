import { useState, useEffect } from 'react'
import { saveOutput, listOutputs, getOutput, deleteOutput, togglePin } from '@/lib/outputs'
import { Modal } from '@/components/ui'
import toast from 'react-hot-toast'

export function SaveBar({ type, title: defaultTitle, query, payload, result, summary, disabled, onSaved }) {
  const [saving, setSaving] = useState(false)
  const [saved, setSaved]   = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [customTitle, setCustomTitle] = useState('')

  useEffect(() => { setSaved(false) }, [result])

  const handleSave = async () => {
    const title = customTitle.trim() || defaultTitle || query?.slice(0, 60) || 'Kayıt'
    setSaving(true)
    try {
      const record = await saveOutput({ type, title, query, payload, result, summary })
      setSaved(true)
      setShowModal(false)
      toast.success(`"${title}" kaydedildi`)
      onSaved?.(record)
    } catch (e) {
      toast.error('Kayıt hatası: ' + (e.message || ''))
    } finally { setSaving(false) }
  }

  if (disabled) return null

  return (
    <>
      <div className="flex items-center gap-2 mt-4 pt-4 border-t border-gray-100">
        {saved ? (
          <div className="flex items-center gap-2 text-green-600 text-sm">
            <i className="ti ti-circle-check" /><span>Kaydedildi</span>
          </div>
        ) : (
          <button onClick={() => setShowModal(true)} disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-800 transition-colors disabled:opacity-50">
            {saving
              ? <><div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Kaydediliyor...</>
              : <><i className="ti ti-device-floppy text-sm" />Bu sonucu kaydet</>
            }
          </button>
        )}
        <span className="text-xs text-gray-400">Kaydedilen sonuçlar diğer agent'larda kullanılabilir</span>
      </div>

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Sonucu Kaydet">
        <label className="label">Kayıt başlığı</label>
        <input className="input mb-1" value={customTitle} onChange={e => setCustomTitle(e.target.value)}
          placeholder={defaultTitle || query?.slice(0, 60) || 'Başlık girin...'}
          autoFocus onKeyDown={e => { if (e.key === 'Enter') handleSave() }} />
        <p className="text-xs text-gray-400 mb-4">Boş bırakırsanız otomatik oluşturulur</p>
        {summary && (
          <div className="bg-gray-50 rounded-lg p-3 mb-4">
            <div className="text-xs text-gray-400 mb-1">Özet</div>
            <div className="text-xs text-gray-700 line-clamp-3">{summary}</div>
          </div>
        )}
        <div className="flex gap-2 justify-end">
          <button className="btn-secondary" onClick={() => setShowModal(false)}>İptal</button>
          <button className="btn-primary" onClick={handleSave} disabled={saving}>
            <i className="ti ti-device-floppy text-sm" />{saving ? 'Kaydediliyor...' : 'Kaydet'}
          </button>
        </div>
      </Modal>
    </>
  )
}

export function OutputSelector({ type, label, placeholder, onLoad }) {
  const [items, setItems]       = useState([])
  const [selected, setSelected] = useState('')
  const [loading, setLoading]   = useState(false)
  const [fetching, setFetching] = useState(false)

  useEffect(() => {
    setFetching(true)
    listOutputs(type).then(setItems).catch(() => {}).finally(() => setFetching(false))
  }, [type])

  const handleLoad = async () => {
    if (!selected) return
    setLoading(true)
    try {
      const record = await getOutput(selected)
      onLoad?.(record.result, record)
      toast.success(`"${record.title}" yüklendi`)
    } catch (e) { toast.error('Yükleme hatası: ' + (e.message || '')) }
    finally { setLoading(false) }
  }

  const handleDelete = async () => {
    if (!selected) return
    try {
      await deleteOutput(selected)
      setItems(prev => prev.filter(i => i.id !== selected))
      setSelected('')
      toast.success('Silindi')
    } catch { toast.error('Silme hatası') }
  }

  if (fetching) return (
    <div className="flex items-center gap-2 text-xs text-gray-400 py-2">
      <div className="w-3 h-3 border border-gray-300 border-t-brand-400 rounded-full animate-spin" />
      Kayıtlı sonuçlar yükleniyor...
    </div>
  )

  if (!items.length) return (
    <div className="text-xs text-gray-400 py-2 flex items-center gap-1.5">
      <i className="ti ti-inbox text-sm" />Henüz kaydedilmiş sonuç yok
    </div>
  )

  return (
    <div className="flex items-end gap-2">
      <div className="flex-1">
        {label && <div className="label">{label}</div>}
        <select className="input" value={selected} onChange={e => setSelected(e.target.value)}>
          <option value="">{placeholder || 'Kayıtlı sonuç seç...'}</option>
          {items.map(item => (
            <option key={item.id} value={item.id}>
              {item.is_pinned ? '📌 ' : ''}{item.title}
              {item.query ? ` — ${item.query.slice(0, 35)}` : ''}
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
      {selected && (
        <button onClick={handleDelete}
          className="flex items-center gap-1 px-2 py-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg text-sm transition-colors">
          <i className="ti ti-trash text-sm" />
        </button>
      )}
    </div>
  )
}

export function SavedBadge({ type }) {
  const [count, setCount] = useState(null)
  useEffect(() => { listOutputs(type, { limit: 100 }).then(i => setCount(i.length)).catch(() => {}) }, [type])
  if (!count) return null
  return (
    <span className="inline-flex items-center gap-1 text-xs bg-green-50 text-green-700 border border-green-200 rounded-full px-2 py-0.5">
      <i className="ti ti-device-floppy text-[11px]" />{count} kayıt
    </span>
  )
}
