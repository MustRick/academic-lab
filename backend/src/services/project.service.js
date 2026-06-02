import { scopedSupabase } from './library.service.js'

function blankToNull(value) {
  if (value === undefined || value === null) return null
  if (typeof value === 'string' && value.trim() === '') return null
  return typeof value === 'string' ? value.trim() : value
}

function normalizeTags(tags) {
  if (!Array.isArray(tags)) return []
  return tags.map(tag => String(tag).trim()).filter(Boolean)
}

function normalizeProject(row, countMap = new Map()) {
  return {
    ...row,
    article_count: countMap.get(row.id) || 0
  }
}

async function countProjectArticles(db, projectIds = []) {
  if (!projectIds.length) return new Map()

  const { data, error } = await db
    .from('project_articles')
    .select('project_id')
    .in('project_id', projectIds)

  if (error) throw error

  const countMap = new Map()
  for (const row of data || []) {
    countMap.set(row.project_id, (countMap.get(row.project_id) || 0) + 1)
  }
  return countMap
}

async function findProjectByTitle(db, title) {
  const { data, error } = await db
    .from('projects')
    .select('id,title')
    .eq('title', title)
    .maybeSingle()

  if (error) throw error
  return data
}

export async function listProjects({ token }) {
  const db = scopedSupabase(token)
  const { data, error } = await db
    .from('projects')
    .select('id,user_id,title,description,created_at,updated_at')
    .order('created_at', { ascending: false })

  if (error) throw error

  const countMap = await countProjectArticles(db, (data || []).map(project => project.id))
  return (data || []).map(project => normalizeProject(project, countMap))
}

export async function createProject({ token, userId, input = {} }) {
  const db = scopedSupabase(token)
  const title = blankToNull(input.title)
  const description = blankToNull(input.description)

  if (!title) {
    const err = new Error('Proje adı boş olamaz.')
    err.status = 400
    throw err
  }

  const existing = await findProjectByTitle(db, title)
  if (existing) {
    const err = new Error('Bu proje adı zaten kullanılıyor.')
    err.status = 409
    throw err
  }

  const { data, error } = await db
    .from('projects')
    .insert({ user_id: userId, title, description })
    .select('id,user_id,title,description,created_at,updated_at')
    .single()

  if (error) throw error
  return normalizeProject(data)
}

export async function getProject({ token, projectId }) {
  const db = scopedSupabase(token)
  const { data, error } = await db
    .from('projects')
    .select('id,user_id,title,description,created_at,updated_at')
    .eq('id', projectId)
    .single()

  if (error) throw error

  const countMap = await countProjectArticles(db, [projectId])
  return normalizeProject(data, countMap)
}

export async function updateProject({ token, projectId, input = {} }) {
  const db = scopedSupabase(token)
  const patch = {}

  if (input.title !== undefined) {
    const title = blankToNull(input.title)
    if (!title) {
      const err = new Error('Proje adı boş olamaz.')
      err.status = 400
      throw err
    }

    const existing = await findProjectByTitle(db, title)
    if (existing && existing.id !== projectId) {
      const err = new Error('Bu proje adı zaten kullanılıyor.')
      err.status = 409
      throw err
    }

    patch.title = title
  }

  if (input.description !== undefined) patch.description = blankToNull(input.description)

  if (Object.keys(patch).length === 0) {
    return getProject({ token, projectId })
  }

  const { data, error } = await db
    .from('projects')
    .update(patch)
    .eq('id', projectId)
    .select('id,user_id,title,description,created_at,updated_at')
    .single()

  if (error) throw error
  return getProject({ token, projectId: data.id })
}

export async function deleteProject({ token, projectId }) {
  const db = scopedSupabase(token)
  const { error } = await db.from('projects').delete().eq('id', projectId)
  if (error) throw error
  return { success: true, projectId }
}

export async function addArticleToProject({ token, projectId, articleId, input = {} }) {
  const db = scopedSupabase(token)
  const notes = blankToNull(input.notes)
  const tags = normalizeTags(input.tags)

  const { data: existing, error: existingError } = await db
    .from('project_articles')
    .select('id')
    .eq('project_id', projectId)
    .eq('article_id', articleId)
    .maybeSingle()

  if (existingError) throw existingError

  if (existing) {
    return updateProjectArticle({
      token,
      projectId,
      articleId,
      input: { notes, tags }
    })
  }

  const { data, error } = await db.rpc('add_article_to_project', {
    p_project_id: projectId,
    p_article_id: articleId,
    p_notes: notes,
    p_tags: tags
  })

  if (error) throw error
  return { success: true, data }
}

export async function removeArticleFromProject({ token, projectId, articleId }) {
  const db = scopedSupabase(token)
  const { error } = await db
    .from('project_articles')
    .delete()
    .eq('project_id', projectId)
    .eq('article_id', articleId)

  if (error) throw error
  return { success: true, projectId, articleId }
}

export async function updateProjectArticle({ token, projectId, articleId, input = {} }) {
  const db = scopedSupabase(token)
  const patch = {}

  if (input.notes !== undefined) patch.notes = blankToNull(input.notes)
  if (input.tags !== undefined) patch.tags = normalizeTags(input.tags)
  if (input.is_favorite !== undefined) patch.is_favorite = Boolean(input.is_favorite)

  const { data, error } = await db
    .from('project_articles')
    .update(patch)
    .eq('project_id', projectId)
    .eq('article_id', articleId)
    .select('id,project_id,article_id,notes,tags,is_favorite,created_at,updated_at')
    .single()

  if (error) throw error
  return data
}

export async function listProjectArticles({ token, projectId }) {
  const db = scopedSupabase(token)
  const { data, error } = await db
    .from('project_articles')
    .select(`
      id,
      article_id,
      notes,
      tags,
      is_favorite,
      created_at,
      updated_at,
      library_articles!inner(
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
        full_text_status,
        context_status
      )
    `)
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })

  if (error) throw error

  return (data || []).map(row => ({
    project_article_id: row.id,
    article_id: row.article_id,
    title: row.library_articles?.title || '',
    authors: row.library_articles?.authors || [],
    journal: row.library_articles?.journal || null,
    publication_year: row.library_articles?.publication_year || null,
    doi: row.library_articles?.doi || null,
    pmid: row.library_articles?.pmid || null,
    pmcid: row.library_articles?.pmcid || null,
    url: row.library_articles?.url || null,
    publication_type: row.library_articles?.publication_type || null,
    full_text_status: row.library_articles?.full_text_status || null,
    context_status: row.library_articles?.context_status || null,
    notes: row.notes || '',
    tags: row.tags || [],
    is_favorite: Boolean(row.is_favorite),
    created_at: row.created_at,
    updated_at: row.updated_at
  }))
}
