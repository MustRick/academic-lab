import { scopedSupabase } from '../../services/library.service.js'
import { createInitialAgentCouncilState } from './agentCouncil.state.js'
import { FULL_MANUSCRIPT_ORDER, AGENT_STATUS } from './agentCouncil.constants.js'
import { createAgentCouncilGraph, finalizeNode, prepareContextNode } from './agentCouncil.graph.js'
import { validateForAgent } from './agentCouncil.validators.js'
import { runPostChecks, validateNoNewReferencesFromEditor } from './manuscriptPostCheck.service.js'
import { introductionNode } from './nodes/introduction.node.js'
import { materialsMethodsNode } from './nodes/materialsMethods.node.js'
import { resultsNode } from './nodes/results.node.js'
import { discussionNode } from './nodes/discussion.node.js'
import { limitationsNode } from './nodes/limitations.node.js'
import { conclusionNode } from './nodes/conclusion.node.js'
import { abstractNode } from './nodes/abstract.node.js'
import { referencesNode } from './nodes/references.node.js'
import { editorNode } from './nodes/editor.node.js'

const nodeMap = {
  introduction: introductionNode,
  materialsMethods: materialsMethodsNode,
  results: resultsNode,
  discussion: discussionNode,
  limitations: limitationsNode,
  conclusion: conclusionNode,
  abstract: abstractNode,
  references: referencesNode,
  editor: editorNode
}

function assembleManuscript(sections = {}) {
  return [
    sections.abstract && `Abstract\n${sections.abstract}`,
    sections.introduction && `Introduction\n${sections.introduction}`,
    sections.materialsMethods && `Materials and Methods\n${sections.materialsMethods}`,
    sections.results && `Results\n${sections.results}`,
    sections.discussion && `Discussion\n${sections.discussion}`,
    sections.limitations && `Limitations\n${sections.limitations}`,
    sections.conclusion && `Conclusion\n${sections.conclusion}`,
    sections.references && `References\n${sections.references}`
  ].filter(Boolean).join('\n\n')
}

function sanitizeState(state = {}) {
  const { token: _token, ...safe } = state
  return safe
}

function publicSession(row) {
  return {
    id: row.id,
    userId: row.user_id,
    projectId: row.project_id,
    activeAgent: row.active_agent,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    state: row.state || {}
  }
}

async function loadSessionRow(db, sessionId, userId) {
  const { data, error } = await db
    .from('academic_writing_sessions')
    .select('*')
    .eq('id', sessionId)
    .eq('user_id', userId)
    .single()

  if (error || !data) {
    const err = new Error('Oturum bulunamadı.')
    err.status = 404
    throw err
  }
  return data
}

export async function appendSessionEvent({ token, userId, sessionId, agentName = null, eventType, payload = {} }) {
  const db = scopedSupabase(token)
  const compactPayload = {
    ...payload,
    state: undefined,
    fullText: undefined,
    token: undefined
  }
  const { error } = await db.from('academic_writing_session_events').insert({
    session_id: sessionId,
    user_id: userId,
    agent_name: agentName,
    event_type: eventType,
    payload: compactPayload
  })
  if (error) throw error
}

export async function createSession({ userId, token, input = {} }) {
  const db = scopedSupabase(token)
  const state = sanitizeState(createInitialAgentCouncilState({ ...input, status: 'collecting_input' }))
  const { data, error } = await db
    .from('academic_writing_sessions')
    .insert({
      user_id: userId,
      project_id: input.projectId || null,
      active_agent: input.activeAgent || null,
      status: 'collecting_input',
      state
    })
    .select('*')
    .single()

  if (error) throw error
  await appendSessionEvent({ token, userId, sessionId: data.id, eventType: 'session_created', payload: { projectId: input.projectId || null } })
  return publicSession(data)
}

export async function getSessionById({ sessionId, userId, token }) {
  const db = scopedSupabase(token)
  return publicSession(await loadSessionRow(db, sessionId, userId))
}

export async function listUserSessions({ userId, token }) {
  const db = scopedSupabase(token)
  const { data, error } = await db
    .from('academic_writing_sessions')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })

  if (error) throw error
  return (data || []).map(publicSession)
}

export async function updateSessionState({ token, userId, sessionId, statePatch = {}, status = null, activeAgent = null, eventType = 'input_updated', eventPayload = {} }) {
  const db = scopedSupabase(token)
  const row = await loadSessionRow(db, sessionId, userId)
  const nextState = sanitizeState({ ...(row.state || {}), ...statePatch })

  const { data, error } = await db
    .from('academic_writing_sessions')
    .update({
      state: nextState,
      status: status || row.status,
      active_agent: activeAgent ?? row.active_agent,
      project_id: nextState.projectId || row.project_id
    })
    .eq('id', sessionId)
    .eq('user_id', userId)
    .select('*')
    .single()

  if (error) throw error
  await appendSessionEvent({ token, userId, sessionId, agentName: activeAgent, eventType, payload: eventPayload })
  return publicSession(data)
}

async function runtimeState({ token, row }) {
  return { ...(row.state || {}), token }
}

export async function resumeSession(args) {
  return getSessionById(args)
}

export async function appendMessage({ sessionId, userId, token, message }) {
  const row = await loadSessionRow(scopedSupabase(token), sessionId, userId)
  const messages = [...(row.state?.messages || []), { role: 'user', content: message, createdAt: new Date().toISOString() }]
  return updateSessionState({
    token,
    userId,
    sessionId,
    statePatch: { messages, userCommand: message },
    eventType: 'input_updated',
    eventPayload: { messageLength: String(message || '').length }
  })
}

export async function runAgent({ sessionId, userId, token, agentId, input = {} }) {
  const db = scopedSupabase(token)
  const row = await loadSessionRow(db, sessionId, userId)
  const baseState = await runtimeState({ token, row })
  const nextState = {
    ...baseState,
    ...input,
    activeAgent: agentId,
    userSelections: { ...(baseState.userSelections || {}), ...(input.userSelections || input) },
    projectId: input.projectId || baseState.projectId || row.project_id
  }

  const validation = validateForAgent(agentId, {
    ...nextState.userSelections,
    projectId: nextState.projectId,
    ethicsApproval: nextState.ethicsApproval,
    studyType: nextState.studyType || nextState.userSelections?.studyType,
    generatedSections: nextState.generatedSections,
    resultsText: nextState.generatedSections?.results
  })
  if (!validation.success) return { success: false, ...validation, session: publicSession(row) }

  const node = nodeMap[agentId]
  if (!node) {
    const err = new Error('Bilinmeyen ajan.')
    err.status = 400
    throw err
  }

  await appendSessionEvent({ token, userId, sessionId, agentName: agentId, eventType: 'agent_started', payload: { agentId } })
  let prepared = nextState
  if (agentId !== 'abstract' && agentId !== 'references' && agentId !== 'editor') prepared = await prepareContextNode(nextState)
  prepared.agentStatuses = { ...prepared.agentStatuses, [agentId]: AGENT_STATUS.RUNNING }

  try {
    const resultState = await node(prepared)
    const checks = runPostChecks(resultState)
    const status = checks.success ? 'collecting_input' : 'ready_for_review'
    const session = await updateSessionState({
      token,
      userId,
      sessionId,
      statePatch: { ...resultState, postCheck: checks },
      status,
      activeAgent: agentId,
      eventType: checks.success ? 'agent_completed' : 'agent_completed',
      eventPayload: { agentId, issueCount: checks.issues.length }
    })
    return { success: true, session }
  } catch (err) {
    await updateSessionState({
      token,
      userId,
      sessionId,
      statePatch: { errors: [...(nextState.errors || []), { agentId, message: err.message }] },
      status: 'error',
      activeAgent: agentId,
      eventType: 'agent_failed',
      eventPayload: { agentId, message: err.message }
    })
    throw err
  }
}

export async function runFullManuscript({ sessionId, userId, token, input = {} }) {
  const row = await loadSessionRow(scopedSupabase(token), sessionId, userId)
  const graph = createAgentCouncilGraph()
  const state = { ...(await runtimeState({ token, row })), ...input, projectId: input.projectId || row.project_id }
  const resultState = await graph.invoke(state)
  const checks = runPostChecks(resultState)
  const session = await updateSessionState({
    token,
    userId,
    sessionId,
    statePatch: { ...resultState, postCheck: checks },
    status: checks.success ? 'ready_for_review' : 'error',
    activeAgent: 'editor',
    eventType: 'agent_completed',
    eventPayload: { mode: 'full_manuscript', order: FULL_MANUSCRIPT_ORDER, issueCount: checks.issues.length }
  })
  return { success: checks.success, session, order: FULL_MANUSCRIPT_ORDER, postCheck: checks }
}

export async function editorReview({ sessionId, userId, token }) {
  const result = await runAgent({ sessionId, userId, token, agentId: 'editor', input: {} })
  if (result.success) {
    await updateSessionState({
      token,
      userId,
      sessionId,
      statePatch: { editorReview: result.session.state?.editorFeedback || '' },
      status: 'ready_for_review',
      activeAgent: 'editor',
      eventType: 'editor_review_created',
      eventPayload: {}
    })
    return getSessionById({ sessionId, userId, token }).then(session => ({ success: true, session }))
  }
  return result
}

export async function editorDecision({ sessionId, userId, token, decision, revisionText = '' }) {
  if (!['approve_revision', 'request_changes', 'approve_without_revision'].includes(decision)) {
    const err = new Error('Geçersiz editor kararı.')
    err.status = 400
    throw err
  }
  const row = await loadSessionRow(scopedSupabase(token), sessionId, userId)
  const state = row.state || {}
  const generatedText = state.draftManuscript || assembleManuscript(state.generatedSections || {})
  const issues = decision === 'approve_revision'
    ? validateNoNewReferencesFromEditor(state, revisionText)
    : []

  if (issues.length) {
    const session = await updateSessionState({
      token,
      userId,
      sessionId,
      statePatch: { editorDecision: decision, editorRevision: revisionText, editorRevisionIssues: issues },
      status: 'ready_for_review',
      activeAgent: 'editor',
      eventType: 'editor_revision_rejected',
      eventPayload: { issueCount: issues.length, codes: issues.map(item => item.code) }
    })
    return { success: false, message: 'Editor revizyonu referans bütünlüğünü bozuyor.', session, issues }
  }

  const finalManuscript = decision === 'approve_revision'
    ? revisionText
    : decision === 'approve_without_revision'
      ? generatedText
      : ''
  const status = decision === 'request_changes' ? 'changes_requested' : 'approved'
  const eventType = decision === 'request_changes' ? 'editor_revision_rejected' : 'editor_revision_approved'

  const session = await updateSessionState({
    token,
    userId,
    sessionId,
    statePatch: {
      editorDecision: decision,
      editorRevision: revisionText,
      finalManuscript,
      finalizedAt: null
    },
    status,
    activeAgent: 'editor',
    eventType,
    eventPayload: { decision }
  })
  return { success: true, session }
}

export async function finalizeSession({ sessionId, userId, token }) {
  const row = await loadSessionRow(scopedSupabase(token), sessionId, userId)
  const state = row.state || {}
  if (!state.finalManuscript) {
    const err = new Error('Final manuscript için önce editor onayı gerekir.')
    err.status = 400
    throw err
  }
  if (state.editorDecision === 'request_changes') {
    const err = new Error('Değişiklik istenen oturum finalize edilemez.')
    err.status = 400
    throw err
  }

  const checks = runPostChecks(state, { finalize: true })
  if (!checks.success) {
    const session = await updateSessionState({
      token,
      userId,
      sessionId,
      statePatch: { postCheck: checks },
      status: 'ready_for_review',
      eventType: 'manuscript_finalized',
      eventPayload: { blocked: true, issueCount: checks.issues.length }
    })
    return { success: false, message: 'Post-check hataları nedeniyle finalize engellendi.', session, postCheck: checks }
  }

  const finalized = await updateSessionState({
    token,
    userId,
    sessionId,
    statePatch: { finalizedAt: new Date().toISOString(), postCheck: checks },
    status: 'finalized',
    eventType: 'manuscript_finalized',
    eventPayload: { issueCount: checks.issues.length }
  })
  return { success: true, session: finalized, postCheck: checks }
}

export async function listSessionEvents({ sessionId, userId, token }) {
  const db = scopedSupabase(token)
  await loadSessionRow(db, sessionId, userId)
  const { data, error } = await db
    .from('academic_writing_session_events')
    .select('*')
    .eq('session_id', sessionId)
    .eq('user_id', userId)
    .order('created_at', { ascending: true })

  if (error) throw error
  return data || []
}

export function getSession(args) {
  return getSessionById(args)
}

export function getPublicSession(args) {
  return getSessionById(args)
}

export async function startSession({ sessionId, userId, token }) {
  return updateSessionState({ token, userId, sessionId, status: 'collecting_input', eventType: 'input_updated', eventPayload: { action: 'start' } })
}

export async function runAgentCouncil(args) {
  return runFullManuscript(args)
}
