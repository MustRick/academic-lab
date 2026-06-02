import { scopedSupabase } from '../../services/library.service.js'
import { EVIDENCE_SECTIONS } from './agentCouncil.constants.js'
import { buildAgentContext, buildProjectContextPackage } from './projectContextBuilder.service.js'

function compactArticle(article = {}) {
  return {
    id: article.id,
    title: article.title,
    authors: article.authors || [],
    journal: article.journal || null,
    publication_year: article.publication_year || null,
    doi: article.doi || null,
    pmid: article.pmid || null,
    pmcid: article.pmcid || null,
    context_status: article.context_status || null,
    full_text_status: article.full_text_status || null
  }
}

export async function listAcademicLabProjects({ token }) {
  const db = scopedSupabase(token)
  const { data, error } = await db
    .from('projects')
    .select('id,title,description,metadata,created_at,updated_at')
    .order('created_at', { ascending: false })

  if (error) throw error
  return data || []
}

export async function getProjectMetadata({ token, projectId }) {
  const db = scopedSupabase(token)
  const { data, error } = await db
    .from('projects')
    .select('id,title,description,metadata,created_at,updated_at')
    .eq('id', projectId)
    .single()

  if (error) throw error
  return data
}

export async function listProjectArticles({ token, projectId }) {
  const db = scopedSupabase(token)
  const { data, error } = await db
    .from('library_articles')
    .select('id,title,authors,journal,publication_year,doi,pmid,pmcid,url,publication_type,context_status,full_text_status,project_articles!inner(project_id)')
    .eq('project_articles.project_id', projectId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data || []).map(compactArticle)
}

export async function listProjectStatistics({ token, projectId }) {
  const db = scopedSupabase(token)
  let query = db
    .from('research_outputs')
    .select('id,title,query,summary,result,payload,created_at,updated_at')
    .eq('type', 'statistics')

  if (projectId) query = query.eq('project_id', projectId)

  const { data, error } = await query.order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function listProjectDatasets({ token, projectId }) {
  const db = scopedSupabase(token)
  const { data, error } = await db
    .from('research_outputs')
    .select('id,title,query,summary,result,payload,created_at,updated_at')
    .eq('type', 'dataset')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function listProjectTables({ token, projectId }) {
  const db = scopedSupabase(token)
  const { data, error } = await db
    .from('research_outputs')
    .select('id,title,query,summary,result,payload,created_at,updated_at')
    .eq('type', 'tables')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function listProjectFigures({ token, projectId }) {
  const db = scopedSupabase(token)
  const { data, error } = await db
    .from('research_outputs')
    .select('id,title,query,summary,result,payload,created_at,updated_at')
    .eq('type', 'figures')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function listProjectResults({ token, projectId }) {
  return listProjectStatistics({ token, projectId })
}

export async function getProjectWritingSummary({ token, projectId }) {
  const db = scopedSupabase(token)
  const [articlesResult, outputsResult] = await Promise.all([
    db
      .from('project_articles')
      .select('id', { count: 'exact', head: true })
      .eq('project_id', projectId),
    db
      .from('research_outputs')
      .select('type')
      .eq('project_id', projectId)
      .in('type', ['dataset', 'statistics', 'tables', 'figures'])
  ])

  if (articlesResult.error) throw articlesResult.error
  if (outputsResult.error) throw outputsResult.error

  const counts = {
    articles: articlesResult.count || 0,
    datasets: 0,
    analyses: 0,
    statistics: 0,
    tables: 0,
    figures: 0
  }

  for (const item of outputsResult.data || []) {
    if (item.type === 'dataset') counts.datasets += 1
    if (item.type === 'statistics') {
      counts.analyses += 1
      counts.statistics += 1
    }
    if (item.type === 'tables') counts.tables += 1
    if (item.type === 'figures') counts.figures += 1
  }

  return counts
}

export async function getArticleChunks({ token, articleIds = [], preferredSections = EVIDENCE_SECTIONS }) {
  if (!articleIds.length) return []
  const db = scopedSupabase(token)
  const { data, error } = await db
    .from('library_article_chunks')
    .select('id,article_id,section,chunk_index,content,metadata')
    .in('article_id', articleIds)
    .neq('section', 'references')
    .in('section', preferredSections)
    .order('article_id')
    .order('section')
    .order('chunk_index')

  if (error) throw error
  return data || []
}

export async function buildContext({ token, projectId, selectedArticleIds = [], selectedResultIds = [] }) {
  const projectPackage = await buildProjectContextPackage({
    token,
    projectId,
    selectedArticleIds,
    manuscriptSections: {}
  })
  const context = buildAgentContext('introduction', projectPackage, { selectedArticleIds, selectedResultIds }, {})
  const selectedStatistics = selectedResultIds.length
    ? projectPackage.statistics.filter(item => selectedResultIds.includes(item.id))
    : []

  return {
    projectPackage,
    projectMetadata: projectPackage.project,
    selectedArticles: context.articles,
    articleChunks: context.articles.flatMap(article => article.chunks || []),
    selectedStatistics
  }
}

export { buildAgentContext, buildProjectContextPackage }
