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
  return res.status(status).json({ success: false, message })
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
