import { scopedSupabase } from '../../services/library.service.js'

export const DEFAULT_EVIDENCE_SECTIONS = ['abstract', 'introduction', 'discussion', 'conclusion']

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
    url: article.url || null,
    publication_type: article.publication_type || null,
    metadata: article.metadata || {},
    context_status: article.context_status || null,
    full_text_status: article.full_text_status || null,
    chunks: article.chunks || []
  }
}

function compactOutput(row = {}) {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    query: row.query || null,
    summary: row.summary || null,
    payload: row.payload || {},
    result: row.result || {},
    tags: row.tags || [],
    created_at: row.created_at,
    updated_at: row.updated_at
  }
}

function sectionMatches(chunk, sections = []) {
  if (!sections.length) return true
  return sections.includes(String(chunk.section || '').toLowerCase())
}

async function getProject({ db, projectId }) {
  const { data, error } = await db
    .from('projects')
    .select('id,user_id,title,description,metadata,study_type,status,created_at,updated_at')
    .eq('id', projectId)
    .single()
  if (error) throw error
  return { ...data, metadata: data?.metadata || {} }
}

async function getArticles({ db, projectId }) {
  const { data, error } = await db
    .from('library_articles')
    .select(`
      id,
      title,
      authors,
      journal,
      publication_year,
      doi,
      pmid,
      pmcid,
      url,
      publication_type,
      metadata,
      context_status,
      full_text_status,
      project_articles!inner(project_id)
    `)
    .eq('project_articles.project_id', projectId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

async function getArticleChunks({ db, articleIds, sections = DEFAULT_EVIDENCE_SECTIONS }) {
  if (!articleIds.length) return []
  let query = db
    .from('library_article_chunks')
    .select('id,article_id,section,chunk_index,content,metadata')
    .in('article_id', articleIds)
    .neq('section', 'references')

  if (sections.length) query = query.in('section', sections)

  const { data, error } = await query
    .order('article_id')
    .order('section')
    .order('chunk_index')
  if (error) throw error
  return data || []
}

async function getOutputs({ db, projectId }) {
  const { data, error } = await db
    .from('research_outputs')
    .select('id,type,title,query,summary,payload,result,tags,created_at,updated_at')
    .eq('project_id', projectId)
    .in('type', ['dataset', 'statistics', 'tables', 'figures', 'manuscript'])
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data || []).map(compactOutput)
}

export async function buildProjectContextPackage({
  token,
  projectId,
  selectedArticleIds = [],
  chunkSections = DEFAULT_EVIDENCE_SECTIONS,
  manuscriptSections = {}
}) {
  if (!projectId) {
    const err = new Error('Çıktıyı kaydetmeden önce bir proje seçmelisiniz.')
    err.status = 400
    err.code = 'PROJECT_ID_REQUIRED'
    throw err
  }

  const db = scopedSupabase(token)
  const [project, articleRows, outputs] = await Promise.all([
    getProject({ db, projectId }),
    getArticles({ db, projectId }),
    getOutputs({ db, projectId })
  ])

  const allowedArticleIds = new Set(articleRows.map(article => article.id))
  const articleIds = selectedArticleIds.length
    ? selectedArticleIds.filter(id => allowedArticleIds.has(id))
    : articleRows.map(article => article.id)
  const chunks = await getArticleChunks({ db, articleIds, sections: chunkSections })
  const chunksByArticle = new Map()
  for (const chunk of chunks) {
    const list = chunksByArticle.get(chunk.article_id) || []
    list.push(chunk)
    chunksByArticle.set(chunk.article_id, list)
  }

  const articles = articleRows
    .filter(article => articleIds.includes(article.id))
    .map(article => compactArticle({ ...article, chunks: chunksByArticle.get(article.id) || [] }))

  return {
    project,
    articles,
    datasets: outputs.filter(item => item.type === 'dataset'),
    statistics: outputs.filter(item => item.type === 'statistics'),
    tables: outputs.filter(item => item.type === 'tables'),
    figures: outputs.filter(item => item.type === 'figures'),
    manuscriptSections
  }
}

function filterByIds(items = [], ids = []) {
  if (!ids.length) return []
  const selected = new Set(ids)
  return items.filter(item => selected.has(item.id))
}

function articleSubset(pkg, ids = [], sections = DEFAULT_EVIDENCE_SECTIONS) {
  const selected = ids.length ? new Set(ids) : null
  return (pkg.articles || [])
    .filter(article => !selected || selected.has(article.id))
    .map(article => ({
      ...article,
      chunks: (article.chunks || []).filter(chunk => sectionMatches(chunk, sections))
    }))
}

export function buildAgentContext(agentId, pkg = {}, selections = {}, generatedSections = {}) {
  const metadata = pkg.project?.metadata || {}
  const selectedStatistics = filterByIds(pkg.statistics, selections.selectedResultIds || selections.selectedStatisticIds || [])
  const selectedTables = filterByIds(pkg.tables, selections.selectedTableIds || [])
  const selectedFigures = filterByIds(pkg.figures, selections.selectedFigureIds || [])

  if (agentId === 'introduction') {
    return {
      project: pkg.project,
      projectMetadata: metadata,
      articles: articleSubset(pkg, selections.selectedArticleIds || [], DEFAULT_EVIDENCE_SECTIONS)
    }
  }

  if (agentId === 'materialsMethods') {
    return {
      project: pkg.project,
      projectMetadata: metadata,
      datasets: filterByIds(pkg.datasets, selections.selectedDatasetIds || []),
      selectedStatistics,
      ethics: {
        committeeName: metadata.ethics_committee_name,
        decisionDate: metadata.ethics_approval_date,
        decisionNumber: metadata.ethics_approval_number
      }
    }
  }

  if (agentId === 'results') {
    return { selectedStatistics, selectedTables, selectedFigures }
  }

  if (agentId === 'discussion') {
    return {
      resultsText: generatedSections.results || '',
      articles: articleSubset(pkg, selections.selectedArticleIds || [], ['abstract', 'introduction', 'discussion', 'conclusion'])
    }
  }

  if (agentId === 'limitations') {
    return {
      projectMetadata: metadata,
      datasets: pkg.datasets || [],
      methods: generatedSections.materialsMethods || '',
      results: generatedSections.results || ''
    }
  }

  if (agentId === 'conclusion') {
    return {
      results: generatedSections.results || '',
      discussion: generatedSections.discussion || '',
      limitations: generatedSections.limitations || ''
    }
  }

  if (agentId === 'abstract') {
    return {
      introduction: generatedSections.introduction || '',
      materialsMethods: generatedSections.materialsMethods || '',
      results: generatedSections.results || '',
      discussion: generatedSections.discussion || '',
      conclusion: generatedSections.conclusion || ''
    }
  }

  if (agentId === 'editor') {
    return {
      generatedSections,
      citationRegistry: pkg.articles || [],
      projectMetadata: metadata
    }
  }

  return pkg
}
