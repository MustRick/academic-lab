import { AGENT_STATUS } from '../agentCouncil.constants.js'
import { resolveReferences } from '../referenceResolver.service.js'

export async function referencesNode(state) {
  const resolved = resolveReferences({
    generatedSections: state.generatedSections,
    referenceRegistry: state.referenceRegistry
  })
  return {
    ...state,
    generatedSections: resolved.generatedSections,
    citationMap: resolved.citationMap,
    agentStatuses: { ...state.agentStatuses, references: AGENT_STATUS.COMPLETED }
  }
}
