import { HumanMessage, SystemMessage } from '@langchain/core/messages'
import { createModel } from '../../../services/openai.service.js'
import { AGENT_COUNCIL_MODEL, AGENT_STATUS } from '../agentCouncil.constants.js'
import { discussionSystemMessage } from '../prompts/discussion.prompt.js'
import { buildAgentContext } from '../projectContextBuilder.service.js'

export async function discussionNode(state) {
  const model = createModel({ model: AGENT_COUNCIL_MODEL, temperature: 0.2 })
  const context = state.projectPackage
    ? buildAgentContext('discussion', state.projectPackage, state.userSelections || {}, state.generatedSections || {})
    : state.context
  const response = await model.invoke([
    new SystemMessage(discussionSystemMessage),
    new HumanMessage(JSON.stringify({
      task: 'Discussion bölümünü yaz.',
      resultsText: state.generatedSections?.results,
      theme: state.userSelections?.theme,
      context
    }))
  ])
  return {
    ...state,
    generatedSections: { ...state.generatedSections, discussion: response.content },
    agentStatuses: { ...state.agentStatuses, discussion: AGENT_STATUS.COMPLETED }
  }
}
