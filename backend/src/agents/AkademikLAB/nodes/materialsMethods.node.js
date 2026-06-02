import { HumanMessage, SystemMessage } from '@langchain/core/messages'
import { createModel } from '../../../services/openai.service.js'
import { AGENT_COUNCIL_MODEL, AGENT_STATUS } from '../agentCouncil.constants.js'
import { materialsMethodsSystemMessage } from '../prompts/materialsMethods.prompt.js'
import { buildAgentContext } from '../projectContextBuilder.service.js'

export async function materialsMethodsNode(state) {
  const model = createModel({ model: AGENT_COUNCIL_MODEL, temperature: 0.2 })
  const context = state.projectPackage
    ? buildAgentContext('materialsMethods', state.projectPackage, state.userSelections || {}, state.generatedSections || {})
    : state.context
  const metadataEthics = context?.ethics || {}
  const response = await model.invoke([
    new SystemMessage(materialsMethodsSystemMessage),
    new HumanMessage(JSON.stringify({
      task: 'Materials and Methods bölümünü yaz.',
      selections: state.userSelections,
      ethicsApproval: {
        ...metadataEthics,
        ...(state.ethicsApproval || {})
      },
      context,
      statistics: context?.selectedStatistics || []
    }))
  ])
  return {
    ...state,
    generatedSections: { ...state.generatedSections, materialsMethods: response.content },
    agentStatuses: { ...state.agentStatuses, materialsMethods: AGENT_STATUS.COMPLETED }
  }
}
