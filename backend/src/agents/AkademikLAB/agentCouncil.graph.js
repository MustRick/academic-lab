import { Annotation, END, START, StateGraph } from '@langchain/langgraph'
import { buildAgentContext, buildProjectContextPackage } from './contextBuilder.service.js'
import { introductionNode } from './nodes/introduction.node.js'
import { materialsMethodsNode } from './nodes/materialsMethods.node.js'
import { resultsNode } from './nodes/results.node.js'
import { discussionNode } from './nodes/discussion.node.js'
import { limitationsNode } from './nodes/limitations.node.js'
import { conclusionNode } from './nodes/conclusion.node.js'
import { abstractNode } from './nodes/abstract.node.js'
import { referencesNode } from './nodes/references.node.js'
import { editorNode } from './nodes/editor.node.js'

const CouncilAnnotation = Annotation.Root({
  projectId: Annotation(),
  activeAgent: Annotation(),
  userCommand: Annotation(),
  userSelections: Annotation(),
  projectMetadata: Annotation(),
  selectedArticles: Annotation(),
  selectedStatistics: Annotation(),
  selectedResults: Annotation(),
  ethicsApproval: Annotation(),
  wordTarget: Annotation(),
  generatedSections: Annotation(),
  referenceRegistry: Annotation(),
  citationMap: Annotation(),
  editorFeedback: Annotation(),
  editorReview: Annotation(),
  editorDecision: Annotation(),
  editorRevision: Annotation(),
  draftManuscript: Annotation(),
  finalManuscript: Annotation(),
  finalizedAt: Annotation(),
  agentStatuses: Annotation(),
  messages: Annotation(),
  context: Annotation(),
  projectPackage: Annotation(),
  token: Annotation(),
  status: Annotation(),
  errors: Annotation()
})

export async function prepareContextNode(state) {
  const projectPackage = await buildProjectContextPackage({
    token: state.token,
    projectId: state.projectId,
    selectedArticleIds: state.userSelections?.selectedArticleIds || [],
    manuscriptSections: state.generatedSections || {}
  })
  const context = buildAgentContext(state.activeAgent || 'introduction', projectPackage, state.userSelections || {}, state.generatedSections || {})
  const selectedArticles = context.articles || projectPackage.articles || []
  const selectedStatistics = context.selectedStatistics || []

  return {
    ...state,
    projectPackage,
    context,
    projectMetadata: projectPackage.project,
    selectedArticles,
    selectedStatistics,
    referenceRegistry: selectedArticles.map(article => ({
      articleId: article.id,
      title: article.title,
      authors: article.authors,
      journal: article.journal,
      publicationYear: article.publication_year,
      doi: article.doi,
      pmid: article.pmid,
      pmcid: article.pmcid
    }))
  }
}

export function finalizeNode(state) {
  const sections = state.generatedSections || {}
  const draftManuscript = [
    sections.abstract && `Abstract\n${sections.abstract}`,
    sections.introduction && `Introduction\n${sections.introduction}`,
    sections.materialsMethods && `Materials and Methods\n${sections.materialsMethods}`,
    sections.results && `Results\n${sections.results}`,
    sections.discussion && `Discussion\n${sections.discussion}`,
    sections.limitations && `Limitations\n${sections.limitations}`,
    sections.conclusion && `Conclusion\n${sections.conclusion}`,
    sections.references && `References\n${sections.references}`
  ].filter(Boolean).join('\n\n')

  return { ...state, draftManuscript, status: 'ready_for_review' }
}

export function createAgentCouncilGraph() {
  return new StateGraph(CouncilAnnotation)
    .addNode('prepareContext', prepareContextNode)
    .addNode('introduction', introductionNode)
    .addNode('materialsMethods', materialsMethodsNode)
    .addNode('results', resultsNode)
    .addNode('discussion', discussionNode)
    .addNode('limitations', limitationsNode)
    .addNode('conclusion', conclusionNode)
    .addNode('abstract', abstractNode)
    .addNode('references', referencesNode)
    .addNode('editor', editorNode)
    .addNode('finalize', finalizeNode)
    .addEdge(START, 'prepareContext')
    .addEdge('prepareContext', 'introduction')
    .addEdge('introduction', 'materialsMethods')
    .addEdge('materialsMethods', 'results')
    .addEdge('results', 'discussion')
    .addEdge('discussion', 'limitations')
    .addEdge('limitations', 'conclusion')
    .addEdge('conclusion', 'abstract')
    .addEdge('abstract', 'references')
    .addEdge('references', 'editor')
    .addEdge('editor', 'finalize')
    .addEdge('finalize', END)
    .compile()
}
