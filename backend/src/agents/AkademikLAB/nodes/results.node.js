import { HumanMessage, SystemMessage } from '@langchain/core/messages'
import { createModel } from '../../../services/openai.service.js'
import { AGENT_COUNCIL_MODEL, AGENT_STATUS } from '../agentCouncil.constants.js'
import { resultsSystemMessage } from '../prompts/results.prompt.js'
import { buildAgentContext } from '../projectContextBuilder.service.js'

export async function resultsNode(state) {
  const model = createModel({ model: AGENT_COUNCIL_MODEL, temperature: 0.1 })
  const context = state.projectPackage
    ? buildAgentContext('results', state.projectPackage, state.userSelections || {}, state.generatedSections || {})
    : state.context
  const response = await model.invoke([
    new SystemMessage(resultsSystemMessage),
    new HumanMessage(JSON.stringify({
      task: 'Results bölümünü yaz.',
      selections: state.userSelections,
      context,
      selectedResults: context?.selectedStatistics || state.selectedResults || []
    }))
  ])
  return {
    ...state,
    generatedSections: { ...state.generatedSections, results: response.content },
    agentStatuses: { ...state.agentStatuses, results: AGENT_STATUS.COMPLETED }
  }
}
