import { getAccessToken } from '../services/library.service.js'
import * as projectService from '../services/project.service.js'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function token(req) {
  return getAccessToken(req)
}

function validateUuidParam(res, value, label) {
  if (UUID_RE.test(String(value || ''))) return true
  res.status(400).json({ success: false, message: `${label} geçerli bir UUID olmalıdır.` })
  return false
}

function sendError(res, err, label) {
  const status = err.status || (err.code === 'PGRST116' ? 404 : 500)
  const message =
    status === 500
      ? 'İşlem sırasında bir hata oluştu.'
      : err.message || 'İşlem tamamlanamadı.'

  console.error(`[project:${label}]`, err.message)
  const body = { success: false, code: err.code, message }
  if (process.env.NODE_ENV !== 'production' && err.details) body.details = err.details
  return res.status(status).json(body)
}

function normalizeBody(req) {
  const body = { ...(req.body || {}) }
  if (Object.prototype.hasOwnProperty.call(body, 'tags')) {
    body.tags = Array.isArray(body.tags) ? body.tags : []
  }
  return body
}

export const listProjects = async (req, res) => {
  try {
    const data = await projectService.listProjects({ token: token(req) })
    return res.json({ success: true, data })
  } catch (err) {
    return sendError(res, err, 'listProjects')
  }
}

export const createProject = async (req, res) => {
  try {
    if (process.env.DEBUG_PROJECTS === 'true') {
      console.log('[project:createProject:debug]', {
        userId: req.user?.id || null,
        userEmail: req.user?.email || null,
        bodyKeys: Object.keys(req.body || {}),
        body: req.body || {}
      })
    }
    const data = await projectService.createProject({
      token: token(req),
      userId: req.user.id,
      input: req.body || {}
    })
    return res.status(201).json({ success: true, data })
  } catch (err) {
    return sendError(res, err, 'createProject')
  }
}

export const getProject = async (req, res) => {
  try {
    if (!validateUuidParam(res, req.params.projectId, 'Proje ID')) return
    const data = await projectService.getProject({
      token: token(req),
      projectId: req.params.projectId
    })
    return res.json({ success: true, data })
  } catch (err) {
    return sendError(res, err, 'getProject')
  }
}

export const updateProject = async (req, res) => {
  try {
    if (!validateUuidParam(res, req.params.projectId, 'Proje ID')) return
    const data = await projectService.updateProject({
      token: token(req),
      projectId: req.params.projectId,
      input: req.body || {}
    })
    return res.json({ success: true, data })
  } catch (err) {
    return sendError(res, err, 'updateProject')
  }
}

export const deleteProject = async (req, res) => {
  try {
    if (!validateUuidParam(res, req.params.projectId, 'Proje ID')) return
    const data = await projectService.deleteProject({
      token: token(req),
      projectId: req.params.projectId
    })
    return res.json({ success: true, data })
  } catch (err) {
    return sendError(res, err, 'deleteProject')
  }
}

export const listProjectArticles = async (req, res) => {
  try {
    if (!validateUuidParam(res, req.params.projectId, 'Proje ID')) return
    const data = await projectService.listProjectArticles({
      token: token(req),
      projectId: req.params.projectId
    })
    return res.json({ success: true, data })
  } catch (err) {
    return sendError(res, err, 'listProjectArticles')
  }
}

export const addArticleToProject = async (req, res) => {
  try {
    if (!validateUuidParam(res, req.params.projectId, 'Proje ID')) return
    if (!validateUuidParam(res, req.params.articleId, 'Makale ID')) return
    const data = await projectService.addArticleToProject({
      token: token(req),
      projectId: req.params.projectId,
      articleId: req.params.articleId,
      input: normalizeBody(req)
    })
    return res.status(201).json({ success: true, data })
  } catch (err) {
    return sendError(res, err, 'addArticleToProject')
  }
}

export const removeArticleFromProject = async (req, res) => {
  try {
    if (!validateUuidParam(res, req.params.projectId, 'Proje ID')) return
    if (!validateUuidParam(res, req.params.articleId, 'Makale ID')) return
    const data = await projectService.removeArticleFromProject({
      token: token(req),
      projectId: req.params.projectId,
      articleId: req.params.articleId
    })
    return res.json({ success: true, data })
  } catch (err) {
    return sendError(res, err, 'removeArticleFromProject')
  }
}

export const updateProjectArticle = async (req, res) => {
  try {
    if (!validateUuidParam(res, req.params.projectId, 'Proje ID')) return
    if (!validateUuidParam(res, req.params.articleId, 'Makale ID')) return
    const data = await projectService.updateProjectArticle({
      token: token(req),
      projectId: req.params.projectId,
      articleId: req.params.articleId,
      input: normalizeBody(req)
    })
    return res.json({ success: true, data })
  } catch (err) {
    return sendError(res, err, 'updateProjectArticle')
  }
}

export const getContextPool = async (req, res) => {
  try {
    if (!validateUuidParam(res, req.params.projectId, 'Proje ID')) return
    const data = await projectService.getContextPool({
      token: token(req),
      projectId: req.params.projectId
    })
    return res.json({ success: true, data })
  } catch (err) {
    return sendError(res, err, 'getContextPool')
  }
}

function allowedTypesForKind(kind) {
  if (kind === 'tables') return ['tables']
  if (kind === 'figures') return ['figures']
  return ['patient_scan', 'literature', 'dataset', 'statistics', 'tables', 'figures', 'manuscript', 'reviewer']
}

async function attachOutput(req, res, kind = 'research_outputs') {
  if (!validateUuidParam(res, req.params.projectId, 'Proje ID')) return
  const outputId = req.params.outputId || req.params.tableId || req.params.figureId
  if (!validateUuidParam(res, outputId, 'Çıktı ID')) return
  const data = await projectService.attachResearchOutputToProject({
    token: token(req),
    projectId: req.params.projectId,
    outputId,
    allowedTypes: allowedTypesForKind(kind)
  })
  return res.status(201).json({ success: true, data })
}

async function detachOutput(req, res, kind = 'research_outputs') {
  if (!validateUuidParam(res, req.params.projectId, 'Proje ID')) return
  const outputId = req.params.outputId || req.params.tableId || req.params.figureId
  if (!validateUuidParam(res, outputId, 'Çıktı ID')) return
  const data = await projectService.detachResearchOutputFromProject({
    token: token(req),
    projectId: req.params.projectId,
    outputId,
    allowedTypes: allowedTypesForKind(kind)
  })
  return res.json({ success: true, data })
}

export const attachResearchOutput = async (req, res) => {
  try {
    return attachOutput(req, res, 'research_outputs')
  } catch (err) {
    return sendError(res, err, 'attachResearchOutput')
  }
}

export const detachResearchOutput = async (req, res) => {
  try {
    return detachOutput(req, res, 'research_outputs')
  } catch (err) {
    return sendError(res, err, 'detachResearchOutput')
  }
}

export const attachTable = async (req, res) => {
  try {
    return attachOutput(req, res, 'tables')
  } catch (err) {
    return sendError(res, err, 'attachTable')
  }
}

export const detachTable = async (req, res) => {
  try {
    return detachOutput(req, res, 'tables')
  } catch (err) {
    return sendError(res, err, 'detachTable')
  }
}

export const attachFigure = async (req, res) => {
  try {
    return attachOutput(req, res, 'figures')
  } catch (err) {
    return sendError(res, err, 'attachFigure')
  }
}

export const detachFigure = async (req, res) => {
  try {
    return detachOutput(req, res, 'figures')
  } catch (err) {
    return sendError(res, err, 'detachFigure')
  }
}
