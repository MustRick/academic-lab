import { HumanMessage, SystemMessage } from '@langchain/core/messages'
import { createModel } from '../../../services/openai.service.js'
import { AGENT_COUNCIL_MODEL, AGENT_STATUS } from '../agentCouncil.constants.js'
import { abstractSystemMessage } from '../prompts/abstract.prompt.js'
import { buildAgentContext } from '../projectContextBuilder.service.js'

export async function abstractNode(state) {
  const model = createModel({ model: AGENT_COUNCIL_MODEL, temperature: 0.2 })
  const context = state.projectPackage
    ? buildAgentContext('abstract', state.projectPackage, state.userSelections || {}, state.generatedSections || {})
    : state.generatedSections
  const response = await model.invoke([
    new SystemMessage(abstractSystemMessage),
    new HumanMessage(JSON.stringify({
      task: 'Abstract yaz.',
      abstractType: state.userSelections?.abstractType,
      wordTarget: state.userSelections?.wordTarget,
      keywordCount: state.userSelections?.keywordCount,
      generatedSections: context
    }))
  ])
  return {
    ...state,
    generatedSections: { ...state.generatedSections, abstract: response.content },
    agentStatuses: { ...state.agentStatuses, abstract: AGENT_STATUS.COMPLETED }
  }
}
