import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { libraryAPI, projectAPI } from '@/api'
import { EmptyState, Modal, PageHeader, Spinner } from '@/components/ui'
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

function Badge({ value, labels, fallback }) {
  const [text, cls] = labels[value] || fallback
  return <span className={`badge ${cls}`}>{text}</span>
}

function parseTags(value) {
  return value.split(',').map(tag => tag.trim()).filter(Boolean)
}

function tagText(tags) {
  return Array.isArray(tags) ? tags.join(', ') : ''
}

function ProjectModal({ open, title, initial, saving, onClose, onSave }) {
  const [form, setForm] = useState({ title: '', description: '' })

  useEffect(() => {
    setForm({
      title: initial?.title || '',
      description: initial?.description || ''
    })
  }, [initial, open])

  return (
    <Modal open={open} onClose={onClose} title={title}>
      <div className="space-y-3">
        <div>
          <label className="label">Proje adı</label>
          <input
            className="input"
            value={form.title}
            onChange={e => setForm(prev => ({ ...prev, title: e.target.value }))}
            placeholder="Pediatrik ARDS prone positioning"
          />
        </div>
        <div>
          <label className="label">Açıklama</label>
          <textarea
            className="input min-h-[96px]"
            value={form.description}
            onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
            placeholder="Projenin kapsamı ve notları"
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button className="btn-secondary" onClick={onClose} disabled={saving}>Vazgeç</button>
          <button className="btn-primary" onClick={() => onSave(form)} disabled={saving || !form.title.trim()}>
            {saving && <Spinner size="sm" />}Kaydet
          </button>
        </div>
      </div>
    </Modal>
  )
}

const DETAIL_TABS = [
  ['sources', 'Kaynaklar'],
  ['datasets', 'Veri Setleri'],
  ['statistics', 'İstatistikler'],
  ['tables', 'Tablolar'],
  ['figures', 'Figürler'],
  ['metadata', 'Proje Bilgileri']
]

const METADATA_FIELDS = [
  ['study_title', 'Çalışma başlığı', 'input'],
  ['research_question', 'Araştırma sorusu', 'textarea'],
  ['study_design', 'Çalışma tasarımı', 'input'],
  ['center_type', 'Merkez tipi', 'input'],
  ['retrospective_or_prospective', 'Retrospektif / prospektif', 'input'],
  ['start_date', 'Başlangıç tarihi', 'date'],
  ['end_date', 'Bitiş tarihi', 'date'],
  ['ethics_committee_name', 'Etik kurul adı', 'input'],
  ['ethics_approval_date', 'Etik kurul karar tarihi', 'date'],
  ['ethics_approval_number', 'Etik kurul karar numarası', 'input'],
  ['inclusion_criteria', 'Dahil edilme kriterleri', 'textarea'],
  ['exclusion_criteria', 'Dışlanma kriterleri', 'textarea'],
  ['primary_outcome', 'Birincil sonlanım', 'textarea'],
  ['secondary_outcomes', 'İkincil sonlanımlar', 'textarea'],
  ['notes', 'Notlar', 'textarea']
]

function OutputList({ items, empty, onDetach }) {
  if (!items.length) {
    return <EmptyState icon="ti-database" title="Kayıt yok" description={empty} />
  }
  return (
    <div className="space-y-3">
      {items.map(item => (
        <div key={item.id} className="card">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-gray-900 leading-snug">{item.title}</h2>
              {item.summary && <p className="text-sm text-gray-600 mt-1">{item.summary}</p>}
              <p className="text-xs text-gray-400 mt-1">{new Date(item.created_at).toLocaleString('tr-TR')}</p>
            </div>
            <button className="btn-secondary text-xs text-red-600 hover:text-red-700" onClick={() => onDetach(item)}>
              <i className="ti ti-unlink text-sm" />Projeden çıkar
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

function ArticleEditModal({ open, article, saving, onClose, onSave }) {
  const [form, setForm] = useState({ notes: '', tags: '' })

  useEffect(() => {
    setForm({
      notes: article?.notes || '',
      tags: tagText(article?.tags)
    })
  }, [article, open])

  return (
    <Modal open={open} onClose={onClose} title="Proje makalesini düzenle">
      <div className="space-y-3">
        <div>
          <label className="label">Not</label>
          <textarea
            className="input min-h-[100px]"
            value={form.notes}
            onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))}
            placeholder="Bu makale proje için neden önemli?"
          />
        </div>
        <div>
          <label className="label">Etiketler</label>
          <input
            className="input"
            value={form.tags}
            onChange={e => setForm(prev => ({ ...prev, tags: e.target.value }))}
            placeholder="ARDS, prone, pediatric"
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button className="btn-secondary" onClick={onClose} disabled={saving}>Vazgeç</button>
          <button
            className="btn-primary"
            onClick={() => onSave({ notes: form.notes, tags: parseTags(form.tags) })}
            disabled={saving}
          >
            {saving && <Spinner size="sm" />}Kaydet
          </button>
        </div>
      </div>
    </Modal>
  )
}

export default function Projects() {
  const { projectId } = useParams()
  const navigate = useNavigate()
  const [projects, setProjects] = useState([])
  const [project, setProject] = useState(null)
  const [articles, setArticles] = useState([])
  const [contextPool, setContextPool] = useState(null)
  const [activeTab, setActiveTab] = useState('sources')
  const [metadataForm, setMetadataForm] = useState({})
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [projectModal, setProjectModal] = useState({ open: false, project: null })
  const [articleModal, setArticleModal] = useState({ open: false, article: null })

  const loadProjects = async () => {
    setLoading(true)
    try {
      const response = await projectAPI.listProjects()
      setProjects(response.data || [])
    } catch (e) {
      toast.error(e.message || 'Projeler yüklenemedi.')
    } finally {
      setLoading(false)
    }
  }

  const loadProjectDetail = async () => {
    setLoading(true)
    try {
      const [projectResponse, articleResponse] = await Promise.all([
        projectAPI.getProject(projectId),
        projectAPI.listProjectArticles(projectId)
      ])
      setProject(projectResponse.data)
      setArticles(articleResponse.data || [])
      setMetadataForm(projectResponse.data?.metadata || {})
      const poolResponse = await projectAPI.getContextPool(projectId)
      setContextPool(poolResponse.data)
    } catch (e) {
      toast.error(e.message || 'Proje yüklenemedi.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (projectId) loadProjectDetail()
    else loadProjects()
  }, [projectId])

  const saveProject = async (form) => {
    setSaving(true)
    try {
      if (projectModal.project) {
        await projectAPI.updateProject(projectModal.project.id, form)
        toast.success('Proje güncellendi.')
      } else {
        await projectAPI.createProject(form)
        toast.success('Proje oluşturuldu.')
      }
      setProjectModal({ open: false, project: null })
      if (projectId) await loadProjectDetail()
      else await loadProjects()
    } catch (e) {
      toast.error(e.message || 'Proje kaydedilemedi.')
    } finally {
      setSaving(false)
    }
  }

  const deleteProject = async (item) => {
    if (!window.confirm('Bu projeyi silmek istiyor musunuz?')) return
    try {
      await projectAPI.deleteProject(item.id)
      toast.success('Proje silindi.')
      if (projectId) navigate('/app/projects')
      else setProjects(prev => prev.filter(project => project.id !== item.id))
    } catch (e) {
      toast.error(e.message || 'Proje silinemedi.')
    }
  }

  const updateArticle = async (article, body) => {
    setSaving(true)
    try {
      await projectAPI.updateProjectArticle(projectId, article.article_id, body)
      toast.success('Makale bilgileri güncellendi.')
      setArticleModal({ open: false, article: null })
      await loadProjectDetail()
    } catch (e) {
      toast.error(e.message || 'Makale güncellenemedi.')
    } finally {
      setSaving(false)
    }
  }

  const toggleFavorite = async (article) => {
    await updateArticle(article, { is_favorite: !article.is_favorite })
  }

  const removeArticle = async (article) => {
    if (!window.confirm('Bu makaleyi projeden çıkarmak istiyor musunuz?')) return
    try {
      await projectAPI.removeArticleFromProject(projectId, article.article_id)
      setArticles(prev => prev.filter(item => item.article_id !== article.article_id))
      toast.success('Makale projeden çıkarıldı.')
    } catch (e) {
      toast.error(e.message || 'Makale projeden çıkarılamadı.')
    }
  }

  const detachOutput = async (item, kind = 'research') => {
    if (!window.confirm('Bu kaydı projeden çıkarmak istiyor musunuz?')) return
    try {
      if (kind === 'tables') await projectAPI.detachTable(projectId, item.id)
      else if (kind === 'figures') await projectAPI.detachFigure(projectId, item.id)
      else await projectAPI.detachResearchOutput(projectId, item.id)
      toast.success('Kayıt projeden çıkarıldı.')
      await loadProjectDetail()
    } catch (e) {
      toast.error(e.message || 'Kayıt projeden çıkarılamadı.')
    }
  }

  const saveMetadata = async () => {
    setSaving(true)
    try {
      await projectAPI.updateProject(projectId, { metadata: metadataForm })
      toast.success('Proje bilgileri güncellendi.')
      await loadProjectDetail()
    } catch (e) {
      toast.error(e.message || 'Proje bilgileri kaydedilemedi.')
    } finally {
      setSaving(false)
    }
  }

  const handleDownloadRis = async () => {
    try {
      const result = await libraryAPI.downloadRis({ project_id: projectId })
      toast.success(result.message)
    } catch (e) {
      toast.error(e.message || 'RIS dosyası indirilemedi.')
    }
  }

  const handleDownloadBibtex = async () => {
    try {
      const result = await libraryAPI.downloadBibtex({ project_id: projectId })
      toast.success(result.message)
    } catch (e) {
      toast.error(e.message || 'BibTeX dosyası indirilemedi.')
    }
  }

  if (projectId) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <PageHeader
          icon="ti-folder"
          title={project?.title || 'Proje'}
          subtitle={project?.description || 'Projeye eklenmiş makaleler'}
          actions={
            <>
              <button className="btn-secondary text-xs" onClick={handleDownloadRis}>
                <i className="ti ti-file-export text-sm" />RIS dışa aktar
              </button>
              <button className="btn-secondary text-xs" onClick={handleDownloadBibtex}>
                <i className="ti ti-file-export text-sm" />BibTeX dışa aktar
              </button>
              <Link to="/app/projects" className="btn-secondary text-xs">
                <i className="ti ti-arrow-left text-sm" />Projeler
              </Link>
            </>
          }
        />

        {loading && <div className="flex items-center gap-2 text-sm text-gray-500"><Spinner size="sm" />Proje yükleniyor...</div>}

        {!loading && contextPool && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-4">
            <div className="card py-3"><div className="text-xs text-gray-500">Makale</div><div className="text-xl font-semibold">{contextPool.counts?.articles || 0}</div></div>
            <div className="card py-3"><div className="text-xs text-gray-500">Veri seti</div><div className="text-xl font-semibold">{contextPool.counts?.datasets || 0}</div></div>
            <div className="card py-3"><div className="text-xs text-gray-500">Analiz</div><div className="text-xl font-semibold">{contextPool.counts?.statistics || 0}</div></div>
            <div className="card py-3"><div className="text-xs text-gray-500">Tablo</div><div className="text-xl font-semibold">{contextPool.counts?.tables || 0}</div></div>
            <div className="card py-3"><div className="text-xs text-gray-500">Figür</div><div className="text-xl font-semibold">{contextPool.counts?.figures || 0}</div></div>
          </div>
        )}

        {!loading && (
          <div className="flex flex-wrap gap-2 mb-4">
            {DETAIL_TABS.map(([id, label]) => (
              <button key={id} className={activeTab === id ? 'btn-primary text-xs' : 'btn-secondary text-xs'} onClick={() => setActiveTab(id)}>
                {label}
              </button>
            ))}
          </div>
        )}

        {!loading && activeTab === 'sources' && articles.length === 0 && (
          <EmptyState
            icon="ti-folder"
            title="Bu projede makale yok"
            description="Bu projeye bağlı kaynak bulunamadı. Önce Kütüphane bölümünden projeye makale ekleyin."
          />
        )}

        {!loading && activeTab === 'sources' && articles.length > 0 && (
          <div className="space-y-3">
            {articles.map(article => (
              <div key={article.article_id} className="card">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="text-base font-semibold text-gray-900 leading-snug">{article.title}</h2>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-500 mt-1">
                      {article.journal && <span className="text-brand-600 font-medium">{article.journal}</span>}
                      {article.publication_year && <span>{article.publication_year}</span>}
                      {article.doi && <span>DOI: {article.doi}</span>}
                      {article.pmid && <span>PMID: {article.pmid}</span>}
                    </div>
                  </div>
                  <button className="btn-ghost p-1" onClick={() => toggleFavorite(article)} title="Favori">
                    <i className={`ti ${article.is_favorite ? 'ti-star-filled text-amber-500' : 'ti-star text-gray-400'} text-lg`} />
                  </button>
                </div>

                <div className="flex flex-wrap gap-1.5 mt-3">
                  <Badge
                    value={article.full_text_status || 'abstract_only'}
                    labels={FULL_TEXT_LABELS}
                    fallback={['Tam metin: Abstract', 'bg-gray-100 text-gray-600']}
                  />
                  <Badge
                    value={article.context_status || 'pending'}
                    labels={CONTEXT_LABELS}
                    fallback={['Context: Bekliyor', 'bg-gray-100 text-gray-600']}
                  />
                </div>

                {article.notes && <p className="text-xs text-gray-600 bg-gray-50 rounded-lg p-2 mt-3">{article.notes}</p>}
                {article.tags?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {article.tags.map(tag => <span key={tag} className="badge bg-brand-50 text-brand-600">{tag}</span>)}
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-2 mt-4">
                  <button className="btn-secondary text-xs" onClick={() => setArticleModal({ open: true, article })}>
                    <i className="ti ti-note text-sm" />Not düzenle
                  </button>
                  <button className="btn-secondary text-xs" onClick={() => setArticleModal({ open: true, article })}>
                    <i className="ti ti-tags text-sm" />Etiket düzenle
                  </button>
                  <button className="btn-secondary text-xs" onClick={() => toggleFavorite(article)}>
                    <i className="ti ti-star text-sm" />Favori
                  </button>
                  <button className="btn-secondary text-xs text-red-600 hover:text-red-700" onClick={() => removeArticle(article)}>
                    <i className="ti ti-unlink text-sm" />Projeden çıkar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && activeTab === 'datasets' && (
          <OutputList
            items={contextPool?.datasets || []}
            empty="Bu projeye bağlı veri seti bulunamadı. Önce Veri Setleri bölümünde kayıt oluşturun veya mevcut sonucu projeye bağlayın."
            onDetach={item => detachOutput(item)}
          />
        )}

        {!loading && activeTab === 'statistics' && (
          <OutputList
            items={contextPool?.statistics || []}
            empty="Bu projeye bağlı kayıtlı analiz sonucu bulunamadı. Önce İstatistik bölümünde analiz oluşturun veya mevcut sonucu projeye bağlayın."
            onDetach={item => detachOutput(item)}
          />
        )}

        {!loading && activeTab === 'tables' && (
          <OutputList
            items={contextPool?.tables || []}
            empty="Bu projeye bağlı tablo bulunamadı. Önce Tablolar bölümünde bir tablo oluşturun veya mevcut tabloyu projeye bağlayın."
            onDetach={item => detachOutput(item, 'tables')}
          />
        )}

        {!loading && activeTab === 'figures' && (
          <OutputList
            items={contextPool?.figures || []}
            empty="Bu projeye bağlı figür bulunamadı. Önce Figürler bölümünde bir figür oluşturun veya mevcut figürü projeye bağlayın."
            onDetach={item => detachOutput(item, 'figures')}
          />
        )}

        {!loading && activeTab === 'metadata' && (
          <div className="card">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {METADATA_FIELDS.map(([key, label, kind]) => (
                <div key={key} className={kind === 'textarea' ? 'md:col-span-2' : ''}>
                  <label className="label">{label}</label>
                  {kind === 'textarea' ? (
                    <textarea className="input min-h-[84px]" value={metadataForm[key] || ''} onChange={e => setMetadataForm(prev => ({ ...prev, [key]: e.target.value }))} />
                  ) : (
                    <input className="input" type={kind === 'date' ? 'date' : 'text'} value={metadataForm[key] || ''} onChange={e => setMetadataForm(prev => ({ ...prev, [key]: e.target.value }))} />
                  )}
                </div>
              ))}
            </div>
            <div className="flex justify-end mt-4">
              <button className="btn-primary text-xs" onClick={saveMetadata} disabled={saving}>
                {saving && <Spinner size="sm" />}Kaydet
              </button>
            </div>
          </div>
        )}

        <ArticleEditModal
          open={articleModal.open}
          article={articleModal.article}
          saving={saving}
          onClose={() => setArticleModal({ open: false, article: null })}
          onSave={(body) => updateArticle(articleModal.article, body)}
        />
      </div>
    )
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <PageHeader
        icon="ti-folder"
        title="Projeler"
        subtitle="Araştırma projelerinizi yönetin ve makalelerinizi organize edin."
        actions={
          <button className="btn-primary text-xs" onClick={() => setProjectModal({ open: true, project: null })}>
            <i className="ti ti-plus text-sm" />Yeni proje oluştur
          </button>
        }
      />

      {loading && <div className="flex items-center gap-2 text-sm text-gray-500"><Spinner size="sm" />Projeler yükleniyor...</div>}

      {!loading && projects.length === 0 && (
        <EmptyState
          icon="ti-folder"
          title="Henüz proje yok"
          description="Araştırma makalelerinizi organize etmek için yeni proje oluşturun."
          action={
            <button className="btn-primary text-xs" onClick={() => setProjectModal({ open: true, project: null })}>
              <i className="ti ti-plus text-sm" />Yeni proje oluştur
            </button>
          }
        />
      )}

      {!loading && projects.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {projects.map(item => (
            <div key={item.id} className="card">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-base font-semibold text-gray-900 leading-snug">{item.title}</h2>
                  <p className="text-xs text-gray-400 mt-1">{item.article_count || 0} makale</p>
                </div>
              </div>
              {item.description && <p className="text-sm text-gray-600 mt-3 line-clamp-3">{item.description}</p>}
              <div className="flex flex-wrap gap-2 mt-4">
                <Link to={`/app/projects/${item.id}`} className="btn-secondary text-xs">
                  <i className="ti ti-folder-open text-sm" />Projeyi aç
                </Link>
                <button className="btn-secondary text-xs" onClick={() => setProjectModal({ open: true, project: item })}>
                  <i className="ti ti-edit text-sm" />Düzenle
                </button>
                <button className="btn-secondary text-xs text-red-600 hover:text-red-700" onClick={() => deleteProject(item)}>
                  <i className="ti ti-trash text-sm" />Sil
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <ProjectModal
        open={projectModal.open}
        title={projectModal.project ? 'Projeyi düzenle' : 'Yeni proje oluştur'}
        initial={projectModal.project}
        saving={saving}
        onClose={() => setProjectModal({ open: false, project: null })}
        onSave={saveProject}
      />
    </div>
  )
}
