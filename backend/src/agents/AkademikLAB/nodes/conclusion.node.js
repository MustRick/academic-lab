import { HumanMessage, SystemMessage } from '@langchain/core/messages'
import { createModel } from '../../../services/openai.service.js'
import { AGENT_COUNCIL_MODEL, AGENT_STATUS } from '../agentCouncil.constants.js'
import { conclusionSystemMessage } from '../prompts/conclusion.prompt.js'
import { buildAgentContext } from '../projectContextBuilder.service.js'

export async function conclusionNode(state) {
  const model = createModel({ model: AGENT_COUNCIL_MODEL, temperature: 0.2 })
  const context = state.projectPackage
    ? buildAgentContext('conclusion', state.projectPackage, state.userSelections || {}, state.generatedSections || {})
    : { generatedSections: state.generatedSections }
  const response = await model.invoke([
    new SystemMessage(conclusionSystemMessage),
    new HumanMessage(JSON.stringify({ task: 'Conclusion bölümünü yaz.', context }))
  ])
  return {
    ...state,
    generatedSections: { ...state.generatedSections, conclusion: response.content },
    agentStatuses: { ...state.agentStatuses, conclusion: AGENT_STATUS.COMPLETED }
  }
}
