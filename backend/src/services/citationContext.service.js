export async function getProjectReadyContext({ supabase, projectId }) {
  if (!supabase || !projectId) return []

  const { data, error } = await supabase
    .from('library_article_chunks')
    .select(`
      id,
      article_id,
      section,
      chunk_index,
      content,
      library_articles!inner(
        id,
        title,
        doi,
        pmid,
        url,
        context_status,
        metadata_verified,
        project_articles!inner(project_id)
      )
    `)
    .in('library_articles.context_status', ['abstract_ready', 'full_text_ready'])
    .eq('library_articles.project_articles.project_id', projectId)
    .order('chunk_index', { ascending: true })

  if (error) {
    if (String(error.message || '').includes('metadata_verified')) {
      return getProjectReadyContextWithoutMetadataVerified({ supabase, projectId })
    }
    throw error
  }

  return (data || [])
    .filter(row => row.library_articles?.metadata_verified !== false)
    .map(row => ({
      articleId: row.article_id,
      chunkId: row.id,
      title: row.library_articles?.title || '',
      doi: row.library_articles?.doi || null,
      pmid: row.library_articles?.pmid || null,
      url: row.library_articles?.url || null,
      section: row.section,
      chunkIndex: row.chunk_index,
      content: row.content
    }))
}

async function getProjectReadyContextWithoutMetadataVerified({ supabase, projectId }) {
  const { data, error } = await supabase
    .from('library_article_chunks')
    .select(`
      id,
      article_id,
      section,
      chunk_index,
      content,
      library_articles!inner(
        id,
        title,
        doi,
        pmid,
        url,
        context_status,
        project_articles!inner(project_id)
      )
    `)
    .in('library_articles.context_status', ['abstract_ready', 'full_text_ready'])
    .eq('library_articles.project_articles.project_id', projectId)
    .order('chunk_index', { ascending: true })

  if (error) throw error

  return (data || []).map(row => ({
    articleId: row.article_id,
    chunkId: row.id,
    title: row.library_articles?.title || '',
    doi: row.library_articles?.doi || null,
    pmid: row.library_articles?.pmid || null,
    url: row.library_articles?.url || null,
    section: row.section,
    chunkIndex: row.chunk_index,
    content: row.content
  }))
}

export async function getCitationContext(_input = {}) {
  return {
    source: 'citation',
    items: [],
    status: 'not_implemented'
  }
}
