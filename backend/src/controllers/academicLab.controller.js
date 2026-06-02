import { getAccessToken } from '../services/library.service.js'
import {
  getProjectWritingSummary,
  listAcademicLabProjects,
  listProjectArticles,
  listProjectResults,
  listProjectStatistics
} from '../agents/AkademikLAB/contextBuilder.service.js'
import {
  appendMessage,
  createSession,
  editorDecision,
  editorReview,
  finalizeSession,
  getPublicSession,
  listSessionEvents,
  listUserSessions,
  runAgent,
  runFullManuscript,
  startSession
} from '../agents/AkademikLAB/agentCouncil.service.js'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function token(req) {
  return getAccessToken(req)
}

function sendError(res, err, label) {
  const status = err.status || 500
  const message = status === 500 ? 'İşlem sırasında bir hata oluştu.' : err.message
  console.error(`[academic-lab:${label}]`, err.message)
  return res.status(status).json({ success: false, code: err.code, message })
}

function validateUuid(res, value, label) {
  if (UUID_RE.test(String(value || ''))) return true
  res.status(400).json({ success: false, message: `${label} geçerli bir UUID olmalıdır.` })
  return false
}

export const projects = async (req, res) => {
  try {
    const data = await listAcademicLabProjects({ token: token(req) })
    res.json({ success: true, data })
  } catch (err) {
    sendError(res, err, 'projects')
  }
}

export const projectArticles = async (req, res) => {
  try {
    if (!validateUuid(res, req.params.projectId, 'Proje ID')) return
    const data = await listProjectArticles({ token: token(req), projectId: req.params.projectId })
    res.json({ success: true, data })
  } catch (err) {
    sendError(res, err, 'projectArticles')
  }
}

export const projectStatistics = async (req, res) => {
  try {
    if (!validateUuid(res, req.params.projectId, 'Proje ID')) return
    const data = await listProjectStatistics({ token: token(req), projectId: req.params.projectId })
    res.json({ success: true, data })
  } catch (err) {
    sendError(res, err, 'projectStatistics')
  }
}

export const projectResults = async (req, res) => {
  try {
    if (!validateUuid(res, req.params.projectId, 'Proje ID')) return
    const data = await listProjectResults({ token: token(req), projectId: req.params.projectId })
    res.json({ success: true, data })
  } catch (err) {
    sendError(res, err, 'projectResults')
  }
}

export const projectSummary = async (req, res) => {
  try {
    if (!validateUuid(res, req.params.projectId, 'Proje ID')) return
    const data = await getProjectWritingSummary({ token: token(req), projectId: req.params.projectId })
    res.json({ success: true, data })
  } catch (err) {
    sendError(res, err, 'projectSummary')
  }
}

export const createCouncilSession = async (req, res) => {
  try {
    const session = await createSession({ userId: req.user.id, token: token(req), input: req.body || {} })
    res.status(201).json({ success: true, session })
  } catch (err) {
    sendError(res, err, 'createCouncilSession')
  }
}

export const listCouncilSessions = async (req, res) => {
  try {
    const sessions = await listUserSessions({ userId: req.user.id, token: token(req) })
    res.json({ success: true, sessions })
  } catch (err) {
    sendError(res, err, 'listCouncilSessions')
  }
}

export const getCouncilSession = async (req, res) => {
  try {
    if (!validateUuid(res, req.params.sessionId, 'Session ID')) return
    const session = await getPublicSession({ sessionId: req.params.sessionId, userId: req.user.id, token: token(req) })
    res.json({ success: true, session })
  } catch (err) {
    sendError(res, err, 'getCouncilSession')
  }
}

export const councilMessage = async (req, res) => {
  try {
    if (!validateUuid(res, req.params.sessionId, 'Session ID')) return
    const session = await appendMessage({ sessionId: req.params.sessionId, userId: req.user.id, token: token(req), message: req.body?.message || '' })
    res.json({ success: true, session })
  } catch (err) {
    sendError(res, err, 'councilMessage')
  }
}

export const councilStart = async (req, res) => {
  try {
    if (!validateUuid(res, req.params.sessionId, 'Session ID')) return
    const session = await startSession({ sessionId: req.params.sessionId, userId: req.user.id, token: token(req) })
    res.json({ success: true, session })
  } catch (err) {
    sendError(res, err, 'councilStart')
  }
}

export const runCouncilAgent = async (req, res) => {
  try {
    if (!validateUuid(res, req.params.sessionId, 'Session ID')) return
    const result = await runAgent({
      sessionId: req.params.sessionId,
      userId: req.user.id,
      token: token(req),
      agentId: req.body?.agentId,
      input: req.body || {}
    })
    res.status(result.success ? 200 : 400).json(result)
  } catch (err) {
    sendError(res, err, 'runCouncilAgent')
  }
}

export const runCouncilFullManuscript = async (req, res) => {
  try {
    if (!validateUuid(res, req.params.sessionId, 'Session ID')) return
    const result = await runFullManuscript({ sessionId: req.params.sessionId, userId: req.user.id, token: token(req), input: req.body || {} })
    res.json(result)
  } catch (err) {
    sendError(res, err, 'runCouncilFullManuscript')
  }
}

export const councilEditorReview = async (req, res) => {
  try {
    if (!validateUuid(res, req.params.sessionId, 'Session ID')) return
    const result = await editorReview({ sessionId: req.params.sessionId, userId: req.user.id, token: token(req) })
    res.json(result)
  } catch (err) {
    sendError(res, err, 'councilEditorReview')
  }
}

export const councilEditorDecision = async (req, res) => {
  try {
    if (!validateUuid(res, req.params.sessionId, 'Session ID')) return
    const result = await editorDecision({
      sessionId: req.params.sessionId,
      userId: req.user.id,
      token: token(req),
      decision: req.body?.decision,
      revisionText: req.body?.revisionText || ''
    })
    res.status(result.success ? 200 : 400).json(result)
  } catch (err) {
    sendError(res, err, 'councilEditorDecision')
  }
}

export const councilFinalize = async (req, res) => {
  try {
    if (!validateUuid(res, req.params.sessionId, 'Session ID')) return
    const result = await finalizeSession({ sessionId: req.params.sessionId, userId: req.user.id, token: token(req) })
    res.status(result.success ? 200 : 400).json(result)
  } catch (err) {
    sendError(res, err, 'councilFinalize')
  }
}

export const councilEvents = async (req, res) => {
  try {
    if (!validateUuid(res, req.params.sessionId, 'Session ID')) return
    const events = await listSessionEvents({ sessionId: req.params.sessionId, userId: req.user.id, token: token(req) })
    res.json({ success: true, events })
  } catch (err) {
    sendError(res, err, 'councilEvents')
  }
}
