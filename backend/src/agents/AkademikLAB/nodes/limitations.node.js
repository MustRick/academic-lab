import { HumanMessage, SystemMessage } from '@langchain/core/messages'
import { createModel } from '../../../services/openai.service.js'
import { AGENT_COUNCIL_MODEL, AGENT_STATUS } from '../agentCouncil.constants.js'
import { limitationsSystemMessage } from '../prompts/limitations.prompt.js'
import { buildAgentContext } from '../projectContextBuilder.service.js'

export async function limitationsNode(state) {
  const model = createModel({ model: AGENT_COUNCIL_MODEL, temperature: 0.2 })
  const context = state.projectPackage
    ? buildAgentContext('limitations', state.projectPackage, state.userSelections || {}, state.generatedSections || {})
    : state.context
  const response = await model.invoke([
    new SystemMessage(limitationsSystemMessage),
    new HumanMessage(JSON.stringify({ task: 'Limitations bölümünü yaz.', selections: state.userSelections, context }))
  ])
  return {
    ...state,
    generatedSections: { ...state.generatedSections, limitations: response.content },
    agentStatuses: { ...state.agentStatuses, limitations: AGENT_STATUS.COMPLETED }
  }
}
