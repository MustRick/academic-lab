import { AGENT_STATUS } from './agentCouncil.constants.js'

export const initialGeneratedSections = {
  introduction: '',
  materialsMethods: '',
  results: '',
  discussion: '',
  limitations: '',
  conclusion: '',
  abstract: '',
  references: ''
}

export const initialAgentStatuses = {
  introduction: AGENT_STATUS.IDLE,
  materialsMethods: AGENT_STATUS.IDLE,
  results: AGENT_STATUS.IDLE,
  discussion: AGENT_STATUS.IDLE,
  limitations: AGENT_STATUS.IDLE,
  conclusion: AGENT_STATUS.IDLE,
  abstract: AGENT_STATUS.IDLE,
  references: AGENT_STATUS.IDLE,
  editor: AGENT_STATUS.IDLE
}

export function createInitialAgentCouncilState(input = {}) {
  return {
    projectId: input.projectId || null,
    activeAgent: input.activeAgent || null,
    userCommand: input.userCommand || '',
    userSelections: input.userSelections || {},
    projectMetadata: input.projectMetadata || null,
    selectedArticles: input.selectedArticles || [],
    selectedStatistics: input.selectedStatistics || [],
    selectedResults: input.selectedResults || [],
    ethicsApproval: input.ethicsApproval || null,
    wordTarget: input.wordTarget || null,
    generatedSections: { ...initialGeneratedSections, ...(input.generatedSections || {}) },
    referenceRegistry: input.referenceRegistry || [],
    citationMap: input.citationMap || {},
    editorFeedback: input.editorFeedback || '',
    finalManuscript: input.finalManuscript || '',
    agentStatuses: { ...initialAgentStatuses, ...(input.agentStatuses || {}) },
    messages: input.messages || [],
    context: input.context || {},
    status: input.status || 'idle',
    errors: input.errors || []
  }
}

export const initialAgentCouncilState = createInitialAgentCouncilState()
