import { HumanMessage, SystemMessage } from '@langchain/core/messages'
import { createModel } from '../../../services/openai.service.js'
import { AGENT_COUNCIL_MODEL, AGENT_STATUS } from '../agentCouncil.constants.js'
import { introductionSystemMessage } from '../prompts/introduction.prompt.js'
import { buildAgentContext } from '../projectContextBuilder.service.js'

export async function introductionNode(state) {
  const model = createModel({ model: AGENT_COUNCIL_MODEL, temperature: 0.2 })
  const context = state.projectPackage
    ? buildAgentContext('introduction', state.projectPackage, state.userSelections || {}, state.generatedSections || {})
    : state.context
  const response = await model.invoke([
    new SystemMessage(introductionSystemMessage),
    new HumanMessage(JSON.stringify({
      task: 'Introduction bölümünü yaz.',
      wordTarget: state.userSelections?.wordTarget || state.wordTarget,
      context
    }))
  ])
  return {
    ...state,
    generatedSections: { ...state.generatedSections, introduction: response.content },
    agentStatuses: { ...state.agentStatuses, introduction: AGENT_STATUS.COMPLETED }
  }
}
