import axios from 'axios'

const api = axios.create({ baseURL: '/api', timeout: 120000 })

api.interceptors.request.use(cfg => {
  const token = localStorage.getItem('pv_token')
  if (token) cfg.headers.Authorization = `Bearer ${token}`
  return cfg
})

api.interceptors.response.use(
  res => res.data,
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
export const figuresAPI  = { generate: (statisticalPlan) => api.post('/academic/figures', { statisticalPlan }) }
export const writingAPI  = { generate: (body) => api.post('/academic/writing', body) }
export const reviewerAPI = { analyze: (editorMail) => api.post('/academic/reviewer', { editorMail }) }

export default api
