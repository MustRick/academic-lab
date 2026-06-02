import { useEffect, useMemo, useState } from 'react'
import { libraryAPI, projectAPI } from '@/api'
import { PageHeader, EmptyState, AgentRunning, Modal, Spinner } from '@/components/ui'
import toast from 'react-hot-toast'

const FULL_TEXT_LABELS = {
  abstract_only: ['Tam metin: Abstract', 'bg-gray-100 text-gray-600'],
  open_access: ['Tam metin: PMC açık erişim', 'bg-green-50 text-green-700'],
  uploaded_pdf: ['Tam metin: Kullanıcı PDF’i', 'bg-blue-50 text-blue-700'],
  open_access_candidate: ['Tam metin: PMC adayı', 'bg-amber-50 text-amber-700']
}

const CONTEXT_LABELS = {
  pending: ['Context: Bekliyor', 'bg-gray-100 text-gray-600'],
  abstract_ready: ['Context: Abstract hazır', 'bg-blue-50 text-blue-700'],
  full_text_ready: ['Context: Tam metin hazır', 'bg-green-50 text-green-700'],
  failed: ['Context: Başarısız', 'bg-red-50 text-red-700']
}

function Badge({ value, fallback, labels }) {
  const [text, cls] = labels[value] || fallback
  return <span className={`badge ${cls}`}>{text}</span>
}

function authorsText(authors) {
  if (!Array.isArray(authors) || authors.length === 0) return ''
  return authors.slice(0, 4).join(', ') + (authors.length > 4 ? ' ...' : '')
}

function parseTags(value) {
  return value.split(',').map(tag => tag.trim()).filter(Boolean)
}

export default function Library() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [processingIds, setProcessingIds] = useState(() => new Set())
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false)
  const [selectedPdfFile, setSelectedPdfFile] = useState(null)
  const [isUploadingPdf, setIsUploadingPdf] = useState(false)
  const [isExtractingPdfMetadata, setIsExtractingPdfMetadata] = useState(false)
  const [pdfForm, setPdfForm] = useState({
    title: '',
    authors: '',
    journal: '',
    publication_year: '',
    doi: '',
    pmid: '',
    pmcid: ''
  })
  const [projects, setProjects] = useState([])
  const [projectModal, setProjectModal] = useState({ open: false, article: null })
  const [projectForm, setProjectForm] = useState({ projectId: '', notes: '', tags: '' })
  const [projectSaving, setProjectSaving] = useState(false)
  const [projectsLoading, setProjectsLoading] = useState(false)
  const [filters, setFilters] = useState({
    q: '',
    year: '',
    publication_type: ''
  })

  const params = useMemo(() => Object.fromEntries(
    Object.entries(filters).filter(([, value]) => String(value || '').trim())
  ), [filters])

  const loadArticles = async () => {
    setLoading(true)
    try {
      const response = await libraryAPI.listArticles(params)
      setItems(response.data || [])
    } catch (e) {
      toast.error('Kütüphane yüklenemedi: ' + (e.message || ''))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadArticles()
  }, [params.q, params.year, params.publication_type])

  const updateFilter = (key, value) => setFilters(prev => ({ ...prev, [key]: value }))

  const handleDelete = async (article) => {
    if (!window.confirm('Bu makaleyi kütüphaneden kaldırmak istiyor musunuz?')) return
    try {
      await libraryAPI.deleteArticle(article.id)
      setItems(prev => prev.filter(item => item.id !== article.id))
      toast.success('Makale kütüphaneden kaldırıldı.')
    } catch (e) {
      toast.error('Makale kaldırılamadı: ' + (e.message || ''))
    }
  }

  const handleProcessContext = async (article) => {
    setProcessingIds(prev => new Set(prev).add(article.id))
    try {
      const response = await libraryAPI.processContext(article.id)
      const chunkCount = response.data?.chunkCount || 0
      toast.success(`PMC context işlendi. ${chunkCount} chunk oluşturuldu.`)
      await loadArticles()
    } catch (e) {
      toast.error(e.message || 'PMC context işlenemedi.')
    } finally {
      setProcessingIds(prev => {
        const next = new Set(prev)
        next.delete(article.id)
        return next
      })
    }
  }

  const closePdfModal = (force = false) => {
    if (isUploadingPdf && !force) return
    setIsPdfModalOpen(false)
    setSelectedPdfFile(null)
    setIsExtractingPdfMetadata(false)
    setPdfForm({
      title: '',
      authors: '',
      journal: '',
      publication_year: '',
      doi: '',
      pmid: '',
      pmcid: ''
    })
  }

  const updatePdfForm = (key, value) => {
    setPdfForm(prev => ({ ...prev, [key]: value }))
  }

  const handlePdfFileChange = async (event) => {
    const file = event.target.files?.[0] || null
    if (!file) {
      setSelectedPdfFile(null)
      return
    }
    if (file.type !== 'application/pdf') {
      toast.error('Yalnızca PDF dosyası yüklenebilir.')
      event.target.value = ''
      setSelectedPdfFile(null)
      return
    }
    setSelectedPdfFile(file)

    const formData = new FormData()
    formData.append('file', file)
    setIsExtractingPdfMetadata(true)
    try {
      const response = await libraryAPI.extractPdfMetadata(formData)
      const metadata = response.metadata || {}
      setPdfForm(prev => ({
        title: prev.title || metadata.title || '',
        authors: prev.authors || (Array.isArray(metadata.authors) ? metadata.authors.join(', ') : ''),
        journal: prev.journal || metadata.journal || '',
        publication_year: prev.publication_year || metadata.publication_year || '',
        doi: prev.doi || metadata.doi || '',
        pmid: prev.pmid || metadata.pmid || '',
        pmcid: prev.pmcid || metadata.pmcid || ''
      }))
    } catch (_) {
      toast.error('PDF metadata otomatik çıkarılamadı. Alanları manuel doldurabilirsiniz.')
    } finally {
      setIsExtractingPdfMetadata(false)
    }
  }

  const handlePdfUpload = async () => {
    if (!selectedPdfFile || !pdfForm.title.trim()) return

    const formData = new FormData()
    formData.append('file', selectedPdfFile)
    formData.append('title', pdfForm.title.trim())
    formData.append('authors', pdfForm.authors)
    formData.append('journal', pdfForm.journal)
    formData.append('publication_year', pdfForm.publication_year)
    formData.append('doi', pdfForm.doi)
    formData.append('pmid', pdfForm.pmid)
    formData.append('pmcid', pdfForm.pmcid)

    setIsUploadingPdf(true)
    try {
      await libraryAPI.uploadPdfArticle(formData)
      toast.success('PDF yüklendi ve context hazırlandı.')
      closePdfModal(true)
      await loadArticles()
    } catch (e) {
      const message =
        e?.response?.data?.message ||
        e?.message ||
        'PDF yüklenemedi.'
      toast.error(message)
    } finally {
      setIsUploadingPdf(false)
    }
  }

  const openProjectModal = async (article) => {
    setProjectModal({ open: true, article })
    setProjectForm({ projectId: '', notes: '', tags: '' })
    setProjectsLoading(true)
    try {
      const response = await projectAPI.listProjects()
      const data = response.data || []
      setProjects(data)
      setProjectForm(prev => ({ ...prev, projectId: data[0]?.id || '' }))
    } catch (e) {
      toast.error(e.message || 'Projeler yüklenemedi.')
    } finally {
      setProjectsLoading(false)
    }
  }

  const closeProjectModal = () => {
    setProjectModal({ open: false, article: null })
    setProjectForm({ projectId: '', notes: '', tags: '' })
  }

  const handleAddToProject = async () => {
    const article = projectModal.article
    if (!article || !projectForm.projectId) return

    setProjectSaving(true)
    try {
      await projectAPI.addArticleToProject(projectForm.projectId, article.id, {
        notes: projectForm.notes,
        tags: parseTags(projectForm.tags)
      })
      toast.success('Makale projeye eklendi.')
      closeProjectModal()
    } catch (e) {
      toast.error(e.message || 'Makale projeye eklenemedi.')
    } finally {
      setProjectSaving(false)
    }
  }

  const handleDownloadRis = async () => {
    try {
      const result = await libraryAPI.downloadRis()
      toast.success(result.message)
    } catch (e) {
      toast.error(e.message || 'RIS dosyası indirilemedi.')
    }
  }

  const handleDownloadBibtex = async () => {
    try {
      const result = await libraryAPI.downloadBibtex()
      toast.success(result.message)
    } catch (e) {
      toast.error(e.message || 'BibTeX dosyası indirilemedi.')
    }
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <PageHeader
        icon="ti-books"
        title="Kütüphane"
        subtitle="Kaydettiğiniz makaleleri yönetin ve projelerinize bağlayın."
        actions={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button className="btn-secondary text-xs" onClick={() => setIsPdfModalOpen(true)}>
              <i className="ti ti-upload text-sm" />PDF Yükle
            </button>
            <button className="btn-secondary text-xs" onClick={handleDownloadRis}>
              <i className="ti ti-file-export text-sm" />RIS dışa aktar
            </button>
            <button className="btn-secondary text-xs" onClick={handleDownloadBibtex}>
              <i className="ti ti-file-export text-sm" />BibTeX dışa aktar
            </button>
          </div>
        }
      />

      <div className="card mb-5">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_140px_180px] gap-3">
          <div>
            <label className="label">Arama</label>
            <input
              className="input"
              value={filters.q}
              onChange={e => updateFilter('q', e.target.value)}
              placeholder="Başlık, DOI, PMID veya dergi"
            />
          </div>
          <div>
            <label className="label">Yıl</label>
            <input
              className="input"
              value={filters.year}
              onChange={e => updateFilter('year', e.target.value)}
              placeholder="2024"
              inputMode="numeric"
            />
          </div>
          <div>
            <label className="label">Çalışma tipi</label>
            <select
              className="input"
              value={filters.publication_type}
              onChange={e => updateFilter('publication_type', e.target.value)}
            >
              <option value="">Tümü</option>
              <option value="meta-analysis">Meta-analiz</option>
              <option value="rct">RCT</option>
              <option value="cohort">Kohort</option>
              <option value="case">Olgu</option>
              <option value="other">Diğer</option>
            </select>
          </div>
        </div>
      </div>

      {loading && <AgentRunning message="Kütüphane kayıtları yükleniyor..." />}

      {!loading && items.length === 0 && (
        <EmptyState
          icon="ti-books"
          title="Kütüphane henüz boş"
          description="Literatür Arama ekranından makaleleri kütüphaneye ekleyebilirsiniz."
        />
      )}

      {!loading && items.length > 0 && (
        <div className="space-y-3">
          {items.map(article => {
            const processing = processingIds.has(article.id)
            const fullTextStatus = article.full_text_status || (article.pmcid ? 'open_access_candidate' : 'abstract_only')
            const contextStatus = article.context_status || 'pending'

            return (
              <div key={article.id} className="card">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="text-base font-semibold text-gray-900 leading-snug">{article.title}</h2>
                    {authorsText(article.authors) && (
                      <p className="text-xs text-gray-500 mt-1">{authorsText(article.authors)}</p>
                    )}
                  </div>
                  <div className="flex flex-wrap justify-end gap-1.5 flex-shrink-0">
                    <Badge
                      value={fullTextStatus}
                      fallback={['Tam metin: Abstract', 'bg-gray-100 text-gray-600']}
                      labels={FULL_TEXT_LABELS}
                    />
                    <Badge
                      value={contextStatus}
                      fallback={['Context: Bekliyor', 'bg-gray-100 text-gray-600']}
                      labels={CONTEXT_LABELS}
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500 mt-3">
                  {article.journal && <span className="text-brand-600 font-medium">{article.journal}</span>}
                  {article.publication_year && <span>{article.publication_year}</span>}
                  {article.doi && <span>DOI: {article.doi}</span>}
                  {article.pmid && <span>PMID: {article.pmid}</span>}
                  {article.pmcid && <span>PMCID: {article.pmcid}</span>}
                  {article.publication_type && <span>{article.publication_type}</span>}
                </div>

                <div className="flex flex-wrap items-center gap-2 mt-4">
                  {article.url && (
                    <a href={article.url} target="_blank" rel="noreferrer" className="btn-secondary text-xs">
                      <i className="ti ti-external-link text-sm" />Makaleyi aç
                    </a>
                  )}
                  <button
                    className="btn-secondary text-xs"
                    disabled={!article.pmcid || processing}
                    onClick={() => handleProcessContext(article)}
                    title={!article.pmcid ? 'PMCID bulunmuyor' : 'PMC XML üzerinden context işle'}
                  >
                    {processing
                      ? <span className="w-3 h-3 border border-gray-200 border-t-brand-600 rounded-full animate-spin" />
                      : <i className="ti ti-file-text text-sm" />
                    }
                    PMC Context İşle
                  </button>
                  <button className="btn-secondary text-xs" onClick={() => openProjectModal(article)}>
                    <i className="ti ti-folder-plus text-sm" />Projeye ekle
                  </button>
                  <button className="btn-secondary text-xs text-red-600 hover:text-red-700" onClick={() => handleDelete(article)}>
                    <i className="ti ti-trash text-sm" />Kaldır
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Modal open={isPdfModalOpen} onClose={closePdfModal} title="PDF'den Makale Ekle" maxWidth="max-w-lg">
        <div className="space-y-4">
          <p className="text-xs text-gray-500">PDF dosyanızı yükleyin. Makale bilgilerini kontrol ederek kütüphaneye ekleyin.</p>
          <div>
            <label className="label">PDF dosyası</label>
            <input
              className="input"
              type="file"
              accept=".pdf,application/pdf"
              onChange={handlePdfFileChange}
              disabled={isUploadingPdf}
            />
            {isExtractingPdfMetadata && (
              <div className="flex items-center gap-2 text-xs text-gray-500 mt-2">
                <Spinner size="sm" />PDF bilgileri okunuyor...
              </div>
            )}
          </div>
          <div>
            <label className="label">Makale başlığı</label>
            <input className="input" value={pdfForm.title} onChange={e => updatePdfForm('title', e.target.value)} disabled={isUploadingPdf} />
          </div>
          <div>
            <label className="label">Yazarlar</label>
            <textarea
              className="input min-h-[72px]"
              value={pdfForm.authors}
              onChange={e => updatePdfForm('authors', e.target.value)}
              placeholder="Curley, Martha, Hibberd, Patricia"
              disabled={isUploadingPdf}
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="label">Dergi</label>
              <input className="input" value={pdfForm.journal} onChange={e => updatePdfForm('journal', e.target.value)} disabled={isUploadingPdf} />
            </div>
            <div>
              <label className="label">Yıl</label>
              <input className="input" value={pdfForm.publication_year} onChange={e => updatePdfForm('publication_year', e.target.value)} inputMode="numeric" disabled={isUploadingPdf} />
            </div>
            <div>
              <label className="label">DOI</label>
              <input className="input" value={pdfForm.doi} onChange={e => updatePdfForm('doi', e.target.value)} disabled={isUploadingPdf} />
            </div>
            <div>
              <label className="label">PMID</label>
              <input className="input" value={pdfForm.pmid} onChange={e => updatePdfForm('pmid', e.target.value)} disabled={isUploadingPdf} />
            </div>
            <div>
              <label className="label">PMCID</label>
              <input className="input" value={pdfForm.pmcid} onChange={e => updatePdfForm('pmcid', e.target.value)} disabled={isUploadingPdf} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button className="btn-secondary" onClick={closePdfModal} disabled={isUploadingPdf}>İptal</button>
            <button
              className="btn-primary"
              onClick={handlePdfUpload}
              disabled={isUploadingPdf || !selectedPdfFile || !pdfForm.title.trim()}
            >
              {isUploadingPdf && <Spinner size="sm" />}
              {isUploadingPdf ? 'PDF İşleniyor...' : "PDF'yi İşle ve Kütüphaneye Ekle"}
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={projectModal.open} onClose={closeProjectModal} title="Projeye ekle">
        <div className="space-y-3">
          <div>
            <label className="label">Proje seç</label>
            {projectsLoading ? (
              <div className="flex items-center gap-2 text-sm text-gray-500 py-2"><Spinner size="sm" />Projeler yükleniyor...</div>
            ) : (
              <select
                className="input"
                value={projectForm.projectId}
                onChange={e => setProjectForm(prev => ({ ...prev, projectId: e.target.value }))}
              >
                {projects.length === 0 && <option value="">Önce proje oluşturun</option>}
                {projects.map(project => <option key={project.id} value={project.id}>{project.title}</option>)}
              </select>
            )}
          </div>
          <div>
            <label className="label">Not</label>
            <textarea
              className="input min-h-[96px]"
              value={projectForm.notes}
              onChange={e => setProjectForm(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="Bu makale proje için neden önemli?"
            />
          </div>
          <div>
            <label className="label">Etiketler</label>
            <input
              className="input"
              value={projectForm.tags}
              onChange={e => setProjectForm(prev => ({ ...prev, tags: e.target.value }))}
              placeholder="ARDS, prone, pediatric"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button className="btn-secondary" onClick={closeProjectModal} disabled={projectSaving}>Vazgeç</button>
            <button className="btn-primary" onClick={handleAddToProject} disabled={projectSaving || !projectForm.projectId}>
              {projectSaving && <Spinner size="sm" />}Kaydet
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
