import axios from 'axios'

const api = axios.create({ baseURL: '/api', timeout: 120000 })

function filenameFromDisposition(disposition, fallback) {
  const match = disposition?.match(/filename="?([^"]+)"?/i)
  return match?.[1] || fallback
}

async function downloadFile(path, params, fallbackFilename, successMessage) {
  const response = await api.get(path, {
    params,
    rawResponse: true,
    responseType: 'blob',
    transformResponse: [data => data]
  })
  const blob = response.data
  const filename = filenameFromDisposition(response.headers?.['content-disposition'], fallbackFilename)
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
  return { filename, message: successMessage }
}

api.interceptors.request.use(cfg => {
  const token = localStorage.getItem('pv_token')
  if (token) cfg.headers.Authorization = `Bearer ${token}`
  return cfg
})

api.interceptors.response.use(
  res => res.config.rawResponse ? res : res.data,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('pv_token')
      window.location.href = '/login'
    }
    return Promise.reject(err.response?.data || err)
  }
)

export const patientScanAPI   = { search: (message) => api.post('/academic/patient-scan', { message }) }
export const academicSearchAPI = { search: (query) => api.post('/academic/academic-search', { query }) }
export const libraryAPI = {
  createArticle: (body) => api.post('/library/articles', body),
  listArticles: (params = {}) => api.get('/library/articles', { params }),
  getArticle: (id) => api.get(`/library/articles/${id}`),
  deleteArticle: (id) => api.delete(`/library/articles/${id}`),
  processContext: (id) => api.post(`/library/articles/${id}/process-context`),
  uploadPdf: (id, formData) => api.post(`/library/articles/${id}/upload-pdf`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  uploadPdfArticle: (formData) => api.post('/library/articles/upload-pdf', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  extractPdfMetadata: (formData) => api.post('/library/articles/extract-pdf-metadata', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  downloadRis: (params = {}) => downloadFile('/library/export/ris', params, 'picuvision-library.ris', 'RIS dosyası indirildi.'),
  downloadBibtex: (params = {}) => downloadFile('/library/export/bibtex', params, 'picuvision-library.bib', 'BibTeX dosyası indirildi.'),
  addArticleToProject: (projectId, articleId, body = {}) => api.post(`/library/projects/${projectId}/articles/${articleId}`, body),
  removeArticleFromProject: (projectId, articleId) => api.delete(`/library/projects/${projectId}/articles/${articleId}`)
}
export const projectAPI = {
  listProjects: () => api.get('/projects'),
  createProject: (body) => api.post('/projects', body),
  getProject: (projectId) => api.get(`/projects/${projectId}`),
  updateProject: (projectId, body) => api.patch(`/projects/${projectId}`, body),
  deleteProject: (projectId) => api.delete(`/projects/${projectId}`),
  getContextPool: (projectId) => api.get(`/projects/${projectId}/context-pool`),
  listProjectArticles: (projectId) => api.get(`/projects/${projectId}/articles`),
  addArticleToProject: (projectId, articleId, body = {}) => api.post(`/projects/${projectId}/articles/${articleId}`, body),
  updateProjectArticle: (projectId, articleId, body = {}) => api.patch(`/projects/${projectId}/articles/${articleId}`, body),
  removeArticleFromProject: (projectId, articleId) => api.delete(`/projects/${projectId}/articles/${articleId}`),
  attachResearchOutput: (projectId, outputId) => api.post(`/projects/${projectId}/research-outputs/${outputId}`),
  detachResearchOutput: (projectId, outputId) => api.delete(`/projects/${projectId}/research-outputs/${outputId}`),
  attachTable: (projectId, tableId) => api.post(`/projects/${projectId}/tables/${tableId}`),
  detachTable: (projectId, tableId) => api.delete(`/projects/${projectId}/tables/${tableId}`),
  attachFigure: (projectId, figureId) => api.post(`/projects/${projectId}/figures/${figureId}`),
  detachFigure: (projectId, figureId) => api.delete(`/projects/${projectId}/figures/${figureId}`)
}
export const dataAPI = {
  createSchema: (studyDescription) => api.post('/academic/data', { mode: 'create', studyDescription }),
  validate:     (schema) => api.post('/academic/data', { mode: 'validate', schema }),
  prepare:      (schema) => api.post('/academic/data', { mode: 'prepare', schema }),
  parseExcel:   (filePath) => api.post('/academic/data', { mode: 'excel', filePath }),
  uploadFile:   (formData) => api.post('/academic/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } })
}
export const statisticsAPI = {
  recommend: (payload) => api.post('/academic/statistics', { mode: 'recommend', payload }),
  run:       (payload, approvedTests) => api.post('/academic/statistics', { mode: 'run', payload, approvedTests }),
  single:    ({ testName, columns, columnData }) => api.post('/academic/statistics', { mode: 'single', testName, columns, columnData })
}
export const figuresAPI  = { generate: (payload) => api.post('/academic/figures', payload) }
export const tablesAPI   = { generate: (payload) => api.post('/academic/tables', payload) }
export const writingAPI  = { generate: (body) => api.post('/academic/writing', body) }
export const academicLabAPI = {
  listProjects: () => api.get('/academic-lab/projects'),
  listProjectArticles: (projectId) => api.get(`/academic-lab/projects/${projectId}/articles`),
  listProjectStatistics: (projectId) => api.get(`/academic-lab/projects/${projectId}/statistics`),
  listProjectResults: (projectId) => api.get(`/academic-lab/projects/${projectId}/results`),
  getProjectSummary: (projectId) => api.get(`/academic-lab/projects/${projectId}/summary`),
  getContextPool: (projectId) => api.get(`/projects/${projectId}/context-pool`),
  createSession: (body = {}) => api.post('/academic-lab/council/session', body),
  listSessions: () => api.get('/academic-lab/council/sessions'),
  getSession: (sessionId) => api.get(`/academic-lab/council/session/${sessionId}`),
  sendMessage: (sessionId, body = {}) => api.post(`/academic-lab/council/session/${sessionId}/message`, body),
  startSession: (sessionId) => api.post(`/academic-lab/council/session/${sessionId}/start`),
  runAgent: (sessionId, body = {}) => api.post(`/academic-lab/council/session/${sessionId}/run-agent`, body),
  runFullManuscript: (sessionId, body = {}) => api.post(`/academic-lab/council/session/${sessionId}/run-full-manuscript`, body),
  editorReview: (sessionId) => api.post(`/academic-lab/council/session/${sessionId}/editor-review`),
  editorDecision: (sessionId, body = {}) => api.post(`/academic-lab/council/session/${sessionId}/editor-decision`, body),
  finalizeSession: (sessionId) => api.post(`/academic-lab/council/session/${sessionId}/finalize`),
  listSessionEvents: (sessionId) => api.get(`/academic-lab/council/session/${sessionId}/events`)
}
export const reviewerAPI = { analyze: (editorMail) => api.post('/academic/reviewer', { editorMail }) }

export default api
