import { HumanMessage, SystemMessage } from '@langchain/core/messages'
import { createModel } from '../../../services/openai.service.js'
import { AGENT_COUNCIL_MODEL, AGENT_STATUS } from '../agentCouncil.constants.js'
import { editorSystemMessage } from '../prompts/editor.prompt.js'
import { buildAgentContext } from '../projectContextBuilder.service.js'

export async function editorNode(state) {
  const model = createModel({ model: AGENT_COUNCIL_MODEL, temperature: 0.1 })
  const context = state.projectPackage
    ? buildAgentContext('editor', state.projectPackage, state.userSelections || {}, state.generatedSections || {})
    : { generatedSections: state.generatedSections, citationRegistry: state.referenceRegistry, projectMetadata: state.projectMetadata }
  const response = await model.invoke([
    new SystemMessage(editorSystemMessage),
    new HumanMessage(JSON.stringify({ task: 'Editör kalite kontrol raporu üret.', context }))
  ])
  return {
    ...state,
    editorFeedback: response.content,
    agentStatuses: { ...state.agentStatuses, editor: AGENT_STATUS.NEEDS_REVIEW }
  }
}
