import { useEffect, useMemo, useState } from 'react'
import { academicLabAPI, projectAPI } from '@/api'
import { EmptyState, PageHeader, Spinner } from '@/components/ui'
import toast from 'react-hot-toast'

const AGENTS = [
  { id: 'introduction', icon: 'ti-file-text', name: 'Introduction', desc: 'Literatür bağlamıyla giriş bölümü' },
  { id: 'materialsMethods', icon: 'ti-clipboard-list', name: 'Materials & Methods', desc: 'Etik, tasarım ve seçilmiş analizler' },
  { id: 'results', icon: 'ti-chart-bar', name: 'Results', desc: 'Seçilmiş analiz sonuçlarının nesnel anlatımı' },
  { id: 'discussion', icon: 'ti-messages', name: 'Discussion', desc: 'Bulguların seçilmiş literatürle tartışılması' },
  { id: 'limitations', icon: 'ti-alert-circle', name: 'Limitations', desc: 'Dengeli sınırlılık analizi' },
  { id: 'conclusion', icon: 'ti-circle-check', name: 'Conclusion', desc: 'Kısa ve ölçülü sonuç bölümü' },
  { id: 'abstract', icon: 'ti-align-box-center-middle', name: 'Abstract', desc: 'Ana bölümlerden özet' },
  { id: 'references', icon: 'ti-list-numbers', name: 'References', desc: 'REF tokenlarını numaralı kaynakçaya dönüştürür' }
]

const EDITOR = { id: 'editor', icon: 'ti-sparkles', name: 'Editor Agent', desc: 'Tutarlılık, atıf ve akademik kalite denetimi' }

const STATUS_LABELS = {
  idle: 'Bekliyor',
  collecting_input: 'Bilgi toplanıyor',
  ready: 'Hazır',
  running: 'Yazıyor',
  completed: 'Tamamlandı',
  needs_review: 'İnceleme gerekli',
  approved: 'Onaylandı',
  error: 'Hata'
}

function statusLabel(status = 'idle') {
  return STATUS_LABELS[status] || status || STATUS_LABELS.idle
}

function statusClass(status = 'idle') {
  if (status === 'completed' || status === 'approved') return 'bg-green-50 text-green-700'
  if (status === 'running') return 'bg-amber-50 text-amber-700'
  if (status === 'needs_review') return 'bg-blue-50 text-blue-700'
  if (status === 'error') return 'bg-red-50 text-red-700'
  if (status === 'ready') return 'bg-brand-50 text-brand-600'
  return 'bg-gray-100 text-gray-500'
}

function AgentCard({ agent, status, active, editor, busy, canRun, selectionSummary, onClick, onRun }) {
  const completed = status === 'completed' || status === 'approved'
  return (
    <button
      onClick={onClick}
      className={`text-left card transition-all hover:border-brand-200 ${active ? 'border-brand-300 bg-brand-50/30' : ''} ${editor ? 'border-blue-200 shadow-[0_0_0_1px_rgba(59,130,246,0.12)]' : ''}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${editor ? 'bg-blue-50 text-blue-700' : 'bg-brand-50 text-brand-600'}`}>
            <i className={`ti ${agent.icon} text-lg`} />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-gray-900 truncate">{agent.name}</div>
            <div className="text-xs text-gray-500 mt-0.5">{agent.desc}</div>
          </div>
        </div>
        <span className={`badge ${statusClass(status)}`}>{statusLabel(status)}</span>
      </div>
      <div className="flex justify-end mt-3">
        <span className="text-xs text-gray-500 mr-auto">{selectionSummary}</span>
        <span
          onClick={(e) => { e.stopPropagation(); if (canRun) onRun() }}
          title={!canRun ? 'Önce manuscript için bir proje seçin.' : undefined}
          className={`btn-secondary text-xs ${!canRun ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {busy ? <Spinner size="sm" /> : <i className="ti ti-refresh text-sm" />}{completed ? 'Yeniden çalıştır' : 'Çalıştır'}
        </span>
      </div>
    </button>
  )
}

function selectedOptionText(item) {
  return item.title || item.summary || item.label || item.id
}

export default function Writing() {
  const [projects, setProjects] = useState([])
  const [articles, setArticles] = useState([])
  const [datasets, setDatasets] = useState([])
  const [statistics, setStatistics] = useState([])
  const [tables, setTables] = useState([])
  const [figures, setFigures] = useState([])
  const [projectSummary, setProjectSummary] = useState({ articles: 0, datasets: 0, analyses: 0, tables: 0, figures: 0 })
  const [sessions, setSessions] = useState([])
  const [events, setEvents] = useState([])
  const [session, setSession] = useState(null)
  const [activeAgent, setActiveAgent] = useState('introduction')
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [revisionText, setRevisionText] = useState('')
  const [form, setForm] = useState({
    projectId: '',
    wordTarget: 600,
    ethicsCommittee: '',
    ethicsDate: '',
    ethicsNumber: '',
    studyType: '',
    inclusionCriteria: '',
    exclusionCriteria: '',
    selectedResultIds: [],
    selectedDatasetIds: [],
    selectedTableIds: [],
    selectedFigureIds: [],
    selectedArticleIds: [],
    abstractType: 'structured',
    keywordCount: 5,
    theme: '',
    message: ''
  })

  const state = session?.state || {}
  const statuses = state.agentStatuses || {}
  const active = useMemo(() => [...AGENTS, EDITOR].find(agent => agent.id === activeAgent), [activeAgent])
  const finalVisible = state.finalManuscript && ['approved', 'finalized'].includes(session?.status)

  useEffect(() => {
    let cancelled = false

    async function loadInitialData() {
      try {
        const projectRes = await projectAPI.listProjects()
        if (!cancelled) setProjects(projectRes.data || [])
      } catch (e) {
        if (!cancelled) toast.error(e.message || 'Projeler yüklenemedi.')
      }

      try {
        const sessionRes = await academicLabAPI.listSessions()
        if (cancelled) return
        const loadedSessions = sessionRes.sessions || []
        setSessions(loadedSessions)
        const activeSession = loadedSessions.find(item => !['finalized', 'error'].includes(item.status)) || loadedSessions[0]
        if (activeSession) applySession(activeSession)
      } catch (e) {
        if (!cancelled) toast.error(e.message || 'Yazım oturumları yüklenemedi.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadInitialData()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!session?.id) return
    academicLabAPI.listSessionEvents(session.id)
      .then(res => setEvents(res.events || []))
      .catch(() => setEvents([]))
  }, [session?.id, session?.updatedAt])

  useEffect(() => {
    if (!form.projectId) {
      setArticles([])
      setDatasets([])
      setStatistics([])
      setTables([])
      setFigures([])
      setProjectSummary({ articles: 0, datasets: 0, analyses: 0, tables: 0, figures: 0 })
      return
    }
    academicLabAPI.getContextPool(form.projectId)
      .then((poolRes) => {
        const pool = poolRes.data || {}
        setArticles(pool.articles || [])
        setDatasets(pool.datasets || [])
        setStatistics(pool.statistics || [])
        setTables(pool.tables || [])
        setFigures(pool.figures || [])
        setProjectSummary({ analyses: pool.counts?.statistics || 0, ...(pool.counts || {}) })
        const metadata = pool.project?.metadata || {}
        setForm(prev => ({
          ...prev,
          ethicsCommittee: prev.ethicsCommittee || metadata.ethics_committee_name || '',
          ethicsDate: prev.ethicsDate || metadata.ethics_approval_date || '',
          ethicsNumber: prev.ethicsNumber || metadata.ethics_approval_number || '',
          studyType: prev.studyType || metadata.study_design || metadata.retrospective_or_prospective || '',
          inclusionCriteria: prev.inclusionCriteria || metadata.inclusion_criteria || '',
          exclusionCriteria: prev.exclusionCriteria || metadata.exclusion_criteria || ''
        }))
      })
      .catch(e => toast.error(e.message || 'Proje bağlamı yüklenemedi.'))
  }, [form.projectId])

  const applySession = (nextSession) => {
    setSession(nextSession)
    const nextState = nextSession?.state || {}
    setActiveAgent(nextState.activeAgent || nextSession?.activeAgent || 'introduction')
    setRevisionText(nextState.editorRevision || nextState.draftManuscript || '')
    setForm(prev => ({
      ...prev,
      projectId: nextState.projectId || nextSession?.projectId || prev.projectId,
      wordTarget: nextState.userSelections?.wordTarget || nextState.wordTarget || prev.wordTarget,
      selectedResultIds: nextState.userSelections?.selectedResultIds || prev.selectedResultIds,
      selectedDatasetIds: nextState.userSelections?.selectedDatasetIds || prev.selectedDatasetIds,
      selectedTableIds: nextState.userSelections?.selectedTableIds || prev.selectedTableIds,
      selectedFigureIds: nextState.userSelections?.selectedFigureIds || prev.selectedFigureIds,
      selectedArticleIds: nextState.userSelections?.selectedArticleIds || prev.selectedArticleIds,
      abstractType: nextState.userSelections?.abstractType || prev.abstractType,
      keywordCount: nextState.userSelections?.keywordCount || prev.keywordCount,
      theme: nextState.userSelections?.theme || prev.theme,
      studyType: nextState.userSelections?.studyType || nextState.studyType || prev.studyType,
      ethicsCommittee: nextState.ethicsApproval?.committeeName || prev.ethicsCommittee,
      ethicsDate: nextState.ethicsApproval?.decisionDate || prev.ethicsDate,
      ethicsNumber: nextState.ethicsApproval?.decisionNumber || prev.ethicsNumber,
      inclusionCriteria: nextState.inclusionCriteria || prev.inclusionCriteria,
      exclusionCriteria: nextState.exclusionCriteria || prev.exclusionCriteria
    }))
  }

  const refreshSession = async (sessionId = session?.id) => {
    if (!sessionId) return null
    const res = await academicLabAPI.getSession(sessionId)
    applySession(res.session)
    return res.session
  }

  const createNewSession = async () => {
    if (!form.projectId) {
      toast.error('Önce manuscript için bir proje seçin.')
      return
    }
    setBusy(true)
    try {
      const created = await academicLabAPI.createSession({ projectId: form.projectId, activeAgent })
      applySession(created.session)
      setSessions(prev => [created.session, ...prev])
      toast.success('Yeni yazım oturumu oluşturuldu.')
    } catch (e) {
      toast.error(e.message || 'Oturum oluşturulamadı.')
    } finally {
      setBusy(false)
    }
  }

  const ensureSession = async () => {
    if (!form.projectId) throw new Error('Önce manuscript için bir proje seçin.')
    if (session) return session
    const created = await academicLabAPI.createSession({ projectId: form.projectId, activeAgent })
    applySession(created.session)
    return created.session
  }

  const payload = (agentId = activeAgent) => ({
    agentId,
    projectId: form.projectId,
    userSelections: {
      wordTarget: Number(form.wordTarget) || null,
      selectedResultIds: form.selectedResultIds,
      selectedDatasetIds: form.selectedDatasetIds,
      selectedTableIds: form.selectedTableIds,
      selectedFigureIds: form.selectedFigureIds,
      selectedArticleIds: form.selectedArticleIds,
      abstractType: form.abstractType,
      keywordCount: Number(form.keywordCount) || 0,
      theme: form.theme,
      studyType: form.studyType
    },
    ethicsApproval: {
      committeeName: form.ethicsCommittee,
      decisionDate: form.ethicsDate,
      decisionNumber: form.ethicsNumber
    },
    studyType: form.studyType,
    inclusionCriteria: form.inclusionCriteria,
    exclusionCriteria: form.exclusionCriteria
  })

  const runAgent = async (agentId = activeAgent) => {
    if (!form.projectId) {
      toast.error('Önce manuscript için bir proje seçin.')
      return
    }
    setBusy(true)
    try {
      const current = await ensureSession()
      const res = agentId === 'editor'
        ? await academicLabAPI.editorReview(current.id)
        : await academicLabAPI.runAgent(current.id, payload(agentId))
      if (!res.success) {
        toast.error(res.message || 'Eksik bilgi var.')
      } else {
        applySession(res.session)
        toast.success(`${[...AGENTS, EDITOR].find(item => item.id === agentId)?.name || 'Ajan'} tamamlandı.`)
      }
    } catch (e) {
      toast.error(e.message || 'Ajan çalıştırılamadı.')
    } finally {
      setBusy(false)
    }
  }

  const runFull = async () => {
    if (!form.projectId) {
      toast.error('Önce manuscript için bir proje seçin.')
      return
    }
    setBusy(true)
    try {
      const current = await ensureSession()
      const res = await academicLabAPI.runFullManuscript(current.id, payload())
      applySession(res.session)
      toast.success(res.success ? 'Tam manuscript review için hazırlandı.' : 'Tam manuscript post-check uyarılarıyla tamamlandı.')
    } catch (e) {
      toast.error(e.message || 'Tam manuscript çalıştırılamadı.')
    } finally {
      setBusy(false)
    }
  }

  const sendMessage = async () => {
    if (!form.message.trim()) return
    const current = await ensureSession()
    const res = await academicLabAPI.sendMessage(current.id, { message: form.message })
    applySession(res.session)
    if (form.message.trim().toLowerCase() === 'start') await runAgent()
    update('message', '')
  }

  const submitEditorDecision = async (decision) => {
    if (!session?.id) return
    setBusy(true)
    try {
      const res = await academicLabAPI.editorDecision(session.id, { decision, revisionText })
      applySession(res.session)
      toast.success(decision === 'request_changes' ? 'Değişiklik isteği kaydedildi.' : 'Editor kararı kaydedildi.')
    } catch (e) {
      toast.error(e.message || 'Editor kararı kaydedilemedi.')
    } finally {
      setBusy(false)
    }
  }

  const finalize = async () => {
    if (!session?.id) return
    setBusy(true)
    try {
      const res = await academicLabAPI.finalizeSession(session.id)
      applySession(res.session)
      toast.success(res.success ? 'Manuscript finalize edildi.' : 'Finalize post-check tarafından engellendi.')
    } catch (e) {
      toast.error(e.message || 'Finalize edilemedi.')
    } finally {
      setBusy(false)
    }
  }

  const update = (key, value) => setForm(prev => ({ ...prev, [key]: value }))
  const toggle = (key, id) => setForm(prev => ({
    ...prev,
    [key]: prev[key].includes(id) ? prev[key].filter(item => item !== id) : [...prev[key], id]
  }))
  const activeProject = projects.find(project => project.id === form.projectId)

  if (loading) {
    return <div className="p-6 max-w-7xl mx-auto"><Spinner /> Yazım oturumları yükleniyor...</div>
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <PageHeader
        icon="ti-pencil"
        title="Manuscript Yazımı"
        subtitle="Çok ajanlı akademik yazım konseyi"
      />

      <div className="card mb-5">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <label className="text-sm font-semibold text-gray-800 whitespace-nowrap">Aktif proje:</label>
              <select
                className="input sm:min-w-[260px] sm:max-w-[360px]"
                value={form.projectId}
                onChange={e => update('projectId', e.target.value)}
              >
                <option value="">Proje seçin</option>
                {projects.map(project => <option key={project.id} value={project.id}>{project.title}</option>)}
              </select>
            </div>
            <div className="text-sm text-gray-500 mt-2">
              {activeProject ? (
                <>
                  Bu projeye bağlı {projectSummary.articles} makale · {projectSummary.datasets} veri seti · {projectSummary.analyses} analiz · {projectSummary.tables} tablo · {projectSummary.figures} figür
                </>
              ) : (
                'Yazım konseyini başlatmak için bir proje seçin.'
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="btn-secondary text-xs" onClick={createNewSession} disabled={busy || !form.projectId} title={!form.projectId ? 'Önce manuscript için bir proje seçin.' : undefined}>
              <i className="ti ti-plus text-sm" />Yeni session
            </button>
            <button className="btn-primary text-xs" onClick={runFull} disabled={busy || !form.projectId} title={!form.projectId ? 'Önce manuscript için bir proje seçin.' : undefined}>
              {busy && <Spinner size="sm" />}Tam manuscript çalıştır
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-5">
        <div>
          {sessions.length > 0 && (
            <div className="card mb-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="section-title">Aktif session</div>
                  <div className="text-xs text-gray-500 mt-1">{session?.id || 'Henüz seçili değil'}</div>
                </div>
                <select className="input max-w-sm" value={session?.id || ''} onChange={async e => refreshSession(e.target.value)}>
                  {sessions.map(item => (
                    <option key={item.id} value={item.id}>
                      {item.state?.projectMetadata?.title || item.projectId || 'Projesiz session'} · {item.status}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {AGENTS.map(agent => (
              <AgentCard
                key={agent.id}
                agent={agent}
                status={statuses[agent.id]}
                active={activeAgent === agent.id}
                busy={busy && activeAgent === agent.id}
                canRun={Boolean(form.projectId) && !busy}
                selectionSummary={agent.id === 'results' ? `${form.selectedResultIds.length} analiz` : agent.id === 'discussion' ? `${form.selectedArticleIds.length} makale` : ''}
                onClick={() => setActiveAgent(agent.id)}
                onRun={() => { setActiveAgent(agent.id); runAgent(agent.id) }}
              />
            ))}
          </div>
          <div className="max-w-xl mx-auto mt-4">
            <AgentCard
              agent={EDITOR}
              status={statuses.editor}
              active={activeAgent === 'editor'}
              editor
              busy={busy && activeAgent === 'editor'}
              canRun={Boolean(form.projectId) && !busy}
              selectionSummary=""
              onClick={() => setActiveAgent('editor')}
              onRun={() => { setActiveAgent('editor'); runAgent('editor') }}
            />
          </div>

          {finalVisible ? (
            <div className="card mt-5">
              <div className="flex items-center justify-between gap-2 mb-3">
                <div className="section-title">Final Manuscript</div>
                <button className="btn-primary text-xs" onClick={finalize} disabled={busy || session?.status === 'finalized'}>
                  {session?.status === 'finalized' ? 'Finalize edildi' : 'Finalize et'}
                </button>
              </div>
              <pre className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed font-sans">{state.finalManuscript}</pre>
            </div>
          ) : (
            <EmptyState icon="ti-users" title="Konsey hazır" description="Bir ajan seçin, gerekli bilgileri girin ve start komutuyla çalıştırın." />
          )}

          {events.length > 0 && (
            <div className="card mt-5">
              <div className="section-title mb-3">Session event log</div>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {events.map(event => (
                  <div key={event.id} className="text-xs text-gray-600 flex items-center justify-between gap-3 border-b border-gray-100 pb-2">
                    <span>{event.event_type}{event.agent_name ? ` · ${event.agent_name}` : ''}</span>
                    <span className="text-gray-400">{new Date(event.created_at).toLocaleString('tr-TR')}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <aside className="card h-fit sticky top-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-sm font-semibold text-gray-900">{active?.name}</div>
              <div className="text-xs text-gray-500">{active?.desc}</div>
            </div>
            <span className={`badge ${statusClass(statuses[activeAgent])}`}>{statusLabel(statuses[activeAgent])}</span>
          </div>

          <div className="space-y-3">
            {activeAgent === 'introduction' && (
              <>
                <div>
                  <label className="label">Hedef kelime sayısı</label>
                  <input className="input" type="number" value={form.wordTarget} onChange={e => update('wordTarget', e.target.value)} />
                </div>
                <textarea className="input min-h-[72px]" placeholder="Vurgulanacak tema" value={form.theme} onChange={e => update('theme', e.target.value)} />
              </>
            )}

            {activeAgent === 'materialsMethods' && (
              <>
                <input className="input" placeholder="Etik kurul adı" value={form.ethicsCommittee} onChange={e => update('ethicsCommittee', e.target.value)} />
                <input className="input" type="date" value={form.ethicsDate} onChange={e => update('ethicsDate', e.target.value)} />
                <input className="input" placeholder="Karar numarası" value={form.ethicsNumber} onChange={e => update('ethicsNumber', e.target.value)} />
                <input className="input" placeholder="Çalışma tipi" value={form.studyType} onChange={e => update('studyType', e.target.value)} />
                <textarea className="input min-h-[72px]" placeholder="Dahil edilme kriterleri" value={form.inclusionCriteria} onChange={e => update('inclusionCriteria', e.target.value)} />
                <textarea className="input min-h-[72px]" placeholder="Dışlanma kriterleri" value={form.exclusionCriteria} onChange={e => update('exclusionCriteria', e.target.value)} />
                <div>
                  <label className="label">Veri setleri</label>
                  {datasets.length === 0 ? (
                    <div className="text-xs text-amber-700 bg-amber-50 rounded-lg p-3">Bu projeye bağlı veri seti bulunamadı. Önce Veri Setleri bölümünde kayıt oluşturun veya mevcut sonucu projeye bağlayın.</div>
                  ) : (
                    <div className="max-h-32 overflow-y-auto space-y-1">
                      {datasets.map(item => (
                        <label key={item.id} className="flex items-center gap-2 text-xs text-gray-600">
                          <input type="checkbox" checked={form.selectedDatasetIds.includes(item.id)} onChange={() => toggle('selectedDatasetIds', item.id)} />
                          <span className="truncate">{selectedOptionText(item)}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}

            {(activeAgent === 'results' || activeAgent === 'materialsMethods') && (
              <div>
                <label className="label">Kayıtlı analizler</label>
                {statistics.length === 0 ? (
                  <div className="text-xs text-amber-700 bg-amber-50 rounded-lg p-3">
                    Bu projeye bağlı kayıtlı analiz sonucu bulunamadı. Önce İstatistik bölümünde analiz oluşturun veya mevcut sonucu projeye bağlayın.
                  </div>
                ) : (
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {statistics.map(item => (
                      <label key={item.id} className="flex items-center gap-2 text-xs text-gray-600">
                        <input type="checkbox" checked={form.selectedResultIds.includes(item.id)} onChange={() => toggle('selectedResultIds', item.id)} />
                        <span className="truncate">{selectedOptionText(item)}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeAgent === 'results' && (
              <>
                <div>
                  <label className="label">Tablolar</label>
                  {tables.length === 0 ? (
                    <div className="text-xs text-amber-700 bg-amber-50 rounded-lg p-3">
                      Bu projeye bağlı tablo bulunamadı. Önce Tablolar bölümünde bir tablo oluşturun veya mevcut tabloyu projeye bağlayın.
                    </div>
                  ) : (
                    <div className="max-h-32 overflow-y-auto space-y-1">
                      {tables.map(item => (
                        <label key={item.id} className="flex items-center gap-2 text-xs text-gray-600">
                          <input type="checkbox" checked={form.selectedTableIds.includes(item.id)} onChange={() => toggle('selectedTableIds', item.id)} />
                          <span className="truncate">{selectedOptionText(item)}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <label className="label">Figürler</label>
                  {figures.length === 0 ? (
                    <div className="text-xs text-amber-700 bg-amber-50 rounded-lg p-3">
                      Bu projeye bağlı figür bulunamadı. Önce Figürler bölümünde bir figür oluşturun veya mevcut figürü projeye bağlayın.
                    </div>
                  ) : (
                    <div className="max-h-32 overflow-y-auto space-y-1">
                      {figures.map(item => (
                        <label key={item.id} className="flex items-center gap-2 text-xs text-gray-600">
                          <input type="checkbox" checked={form.selectedFigureIds.includes(item.id)} onChange={() => toggle('selectedFigureIds', item.id)} />
                          <span className="truncate">{selectedOptionText(item)}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}

            {activeAgent === 'discussion' && (
              <>
                <textarea className="input min-h-[72px]" placeholder="Vurgulanacak tema" value={form.theme} onChange={e => update('theme', e.target.value)} />
                <div>
                  <label className="label">Literatür makaleleri</label>
                  <div className="max-h-44 overflow-y-auto space-y-1">
                    {articles.map(article => (
                      <label key={article.id} className="flex items-center gap-2 text-xs text-gray-600">
                        <input type="checkbox" checked={form.selectedArticleIds.includes(article.id)} onChange={() => toggle('selectedArticleIds', article.id)} />
                        <span className="truncate">{article.title}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </>
            )}

            {activeAgent === 'abstract' && (
              <>
                <select className="input" value={form.abstractType} onChange={e => update('abstractType', e.target.value)}>
                  <option value="structured">Yapılandırılmış abstract</option>
                  <option value="unstructured">Yapılandırılmamış abstract</option>
                </select>
                <input className="input" type="number" value={form.keywordCount} onChange={e => update('keywordCount', e.target.value)} />
              </>
            )}

            <div className="border-t border-gray-100 pt-3">
              <label className="label">Mesaj</label>
              <textarea className="input min-h-[84px]" value={form.message} onChange={e => update('message', e.target.value)} placeholder="start yazarak ajanı başlatabilirsiniz" />
              <div className="flex gap-2 mt-2">
                <button className="btn-secondary text-xs flex-1" onClick={sendMessage} disabled={busy}>Gönder</button>
                <button className="btn-primary text-xs flex-1" onClick={() => runAgent()} disabled={busy || !form.projectId} title={!form.projectId ? 'Önce manuscript için bir proje seçin.' : undefined}>
                  {busy && <Spinner size="sm" />}Start
                </button>
              </div>
            </div>

            {state.generatedSections?.[activeAgent] && (
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="text-xs font-medium text-gray-600 mb-2">Ajan çıktısı</div>
                <pre className="text-xs whitespace-pre-wrap text-gray-700 font-sans max-h-64 overflow-y-auto">{state.generatedSections[activeAgent]}</pre>
              </div>
            )}

            {activeAgent === 'editor' && (
              <div className="space-y-3">
                {state.editorReview || state.editorFeedback ? (
                  <div className="bg-blue-50 rounded-lg p-3 text-xs text-blue-800 whitespace-pre-wrap">{state.editorReview || state.editorFeedback}</div>
                ) : null}
                <textarea
                  className="input min-h-[120px]"
                  value={revisionText}
                  onChange={e => setRevisionText(e.target.value)}
                  placeholder="Editor revizyon metni"
                />
                <div className="grid grid-cols-1 gap-2">
                  <button className="btn-primary text-xs" onClick={() => submitEditorDecision('approve_revision')} disabled={busy || !revisionText.trim()}>
                    Revizyonu uygula
                  </button>
                  <button className="btn-secondary text-xs" onClick={() => submitEditorDecision('request_changes')} disabled={busy}>
                    Değişiklik iste
                  </button>
                  <button className="btn-secondary text-xs" onClick={() => submitEditorDecision('approve_without_revision')} disabled={busy}>
                    Olduğu gibi onayla
                  </button>
                </div>
              </div>
            )}

            {state.postCheck?.issues?.length > 0 && (
              <div className="bg-red-50 rounded-lg p-3">
                <div className="text-xs font-semibold text-red-800 mb-2">Post-check uyarıları</div>
                <ul className="space-y-1">
                  {state.postCheck.issues.map((item, idx) => (
                    <li key={`${item.code}-${idx}`} className="text-xs text-red-700">{item.code}: {item.message}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  )
}
