import { createClient } from '@supabase/supabase-js'

export function getAccessToken(req) {
  return req.headers.authorization?.replace('Bearer ', '') || null
}

export function scopedSupabase(token) {
  if (!token) throw new Error('Kimlik doğrulama gerekli.')

  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } }
  })
}

function blankToNull(value) {
  if (value === undefined || value === null) return null
  if (typeof value === 'string' && value.trim() === '') return null
  return typeof value === 'string' ? value.trim() : value
}

function normalizeYear(value) {
  const year = Number(value)
  return Number.isInteger(year) && year > 0 ? year : null
}

function normalizeArticle(input = {}) {
  const metadata = input.metadata && typeof input.metadata === 'object' && !Array.isArray(input.metadata)
    ? input.metadata
    : {}

  return {
    title: blankToNull(input.title),
    abstract: blankToNull(input.abstract),
    authors: Array.isArray(input.authors) ? input.authors.filter(Boolean) : [],
    journal: blankToNull(input.journal),
    publication_year: normalizeYear(input.publication_year ?? input.year),
    doi: blankToNull(input.doi),
    pmid: blankToNull(input.pmid),
    pmcid: blankToNull(input.pmcid),
    url: blankToNull(input.url),
    source: blankToNull(input.source),
    publication_type: blankToNull(
      input.publication_type || input.evidenceLevel || input.publicationType
    ),
    metadata: {
      ...metadata,
      citation_count: metadata.citation_count ?? input.citationCount ?? null,
      semantic_scholar_id: metadata.semantic_scholar_id ?? input.semanticScholarId ?? null,
      publication_types: metadata.publication_types ?? input.publicationTypes ?? []
    }
  }
}

function normalizeRpcArticleId(data) {
  if (!data) return null
  if (typeof data === 'string') return data
  if (Array.isArray(data)) return normalizeRpcArticleId(data[0])
  return data.article_id || data.articleId || data.id || null
}

export async function saveLibraryArticle(input = {}, token = null) {
  const db = scopedSupabase(token)
  const article = normalizeArticle(input)

  if (!article.title) {
    const err = new Error('Başlık boş olamaz.')
    err.status = 400
    throw err
  }

  const { data, error } = await db.rpc('save_library_article', {
    p_title: article.title,
    p_abstract: article.abstract,
    p_authors: article.authors,
    p_journal: article.journal,
    p_publication_year: article.publication_year,
    p_doi: article.doi,
    p_pmid: article.pmid,
    p_pmcid: article.pmcid,
    p_url: article.url,
    p_source: article.source,
    p_publication_type: article.publication_type,
    p_metadata: article.metadata
  })

  if (error) throw error

  const articleId = normalizeRpcArticleId(data)
  return {
    success: true,
    articleId,
    message: 'Makale kütüphaneye kaydedildi.'
  }
}

export async function listLibraryArticles(filters = {}, token = null) {
  const db = scopedSupabase(token)
  let query = db.from('library_articles').select('*')

  if (filters.q) {
    const value = String(filters.q).replace(/[%(),]/g, ' ').trim()
    if (value) {
      query = query.or(
        `title.ilike.%${value}%,doi.ilike.%${value}%,pmid.ilike.%${value}%,journal.ilike.%${value}%`
      )
    }
  }

  if (filters.year) query = query.eq('publication_year', Number(filters.year))
  if (filters.publication_type) query = query.eq('publication_type', filters.publication_type)
  if (filters.context_status) query = query.eq('context_status', filters.context_status)
  if (filters.full_text_status) query = query.eq('full_text_status', filters.full_text_status)

  if (filters.project_id) {
    query = query
      .select('*, project_articles!inner(project_id)')
      .eq('project_articles.project_id', filters.project_id)
  }

  const { data, error } = await query.order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function getLibraryArticle(articleId, token = null) {
  const db = scopedSupabase(token)

  const { data: article, error } = await db
    .from('library_articles')
    .select('*')
    .eq('id', articleId)
    .single()

  if (error) throw error

  const { count, error: countError } = await db
    .from('library_article_chunks')
    .select('id', { count: 'exact', head: true })
    .eq('article_id', articleId)

  if (countError) throw countError

  return { ...article, chunk_count: count || 0 }
}

export async function deleteLibraryArticle(articleId, token = null) {
  const db = scopedSupabase(token)

  const { error } = await db
    .from('library_articles')
    .delete()
    .eq('id', articleId)

  if (error) throw error
  return { success: true, articleId }
}

export async function addArticleToProject(projectId, articleId, input = {}, token = null) {
  const db = scopedSupabase(token)

  const { data, error } = await db.rpc('add_article_to_project', {
    p_project_id: projectId,
    p_article_id: articleId,
    p_notes: input.notes || null,
    p_tags: Array.isArray(input.tags) ? input.tags : []
  })

  if (error) throw error
  return { success: true, data }
}

export async function removeArticleFromProject(projectId, articleId, token = null) {
  const db = scopedSupabase(token)

  const { error } = await db
    .from('project_articles')
    .delete()
    .eq('project_id', projectId)
    .eq('article_id', articleId)

  if (error) throw error
  return { success: true, projectId, articleId }
}

export async function getLibraryContext(input = {}) {
  return {
    status: 'not_implemented',
    context: input
  }
}
