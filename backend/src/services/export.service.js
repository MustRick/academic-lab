import { scopedSupabase } from './library.service.js'

function clean(value) {
  if (value === undefined || value === null) return ''
  return String(value).replace(/\s+/g, ' ').trim()
}

function asAuthors(authors) {
  return Array.isArray(authors) ? authors.map(clean).filter(Boolean) : []
}

function normalizeKeyPart(value) {
  return clean(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ı/g, 'i')
    .replace(/İ/g, 'i')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toLowerCase()
}

function firstAuthorKey(authors) {
  const first = asAuthors(authors)[0] || 'article'
  return normalizeKeyPart(first.split(/[,\s]+/).filter(Boolean)[0] || 'article') || 'article'
}

function firstTitleWord(title) {
  return normalizeKeyPart(clean(title).split(/\s+/).filter(Boolean)[0] || 'article') || 'article'
}

function escapeBibtex(value) {
  return clean(value)
    .replace(/\\/g, '\\textbackslash{}')
    .replace(/\{/g, '\\{')
    .replace(/\}/g, '\\}')
    .replace(/"/g, '\\"')
}

function citationKey(article, usedKeys) {
  const base = `${firstAuthorKey(article.authors)}${article.publication_year || 'nd'}${firstTitleWord(article.title)}`
  let key = base
  let index = 2
  while (usedKeys.has(key)) {
    key = `${base}${index}`
    index += 1
  }
  usedKeys.add(key)
  return key
}

export async function listArticlesForExport({ token, projectId = null }) {
  const db = scopedSupabase(token)
  let query = db
    .from('library_articles')
    .select('id,title,authors,journal,publication_year,doi,pmid,url,publication_type,created_at')

  if (projectId) {
    query = db
      .from('library_articles')
      .select('id,title,authors,journal,publication_year,doi,pmid,url,publication_type,created_at,project_articles!inner(project_id)')
      .eq('project_articles.project_id', projectId)
  }

  const { data, error } = await query.order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

export function generateRis(articles = []) {
  return articles.map(article => {
    const lines = ['TY  - JOUR']
    if (clean(article.title)) lines.push(`TI  - ${clean(article.title)}`)
    for (const author of asAuthors(article.authors)) lines.push(`AU  - ${author}`)
    if (clean(article.journal)) lines.push(`JO  - ${clean(article.journal)}`)
    if (article.publication_year) lines.push(`PY  - ${article.publication_year}`)
    if (clean(article.doi)) lines.push(`DO  - ${clean(article.doi)}`)
    if (clean(article.pmid)) lines.push(`PM  - ${clean(article.pmid)}`)
    if (clean(article.url)) lines.push(`UR  - ${clean(article.url)}`)
    lines.push('ER  -')
    return lines.join('\n')
  }).join('\n\n')
}

export function generateBibtex(articles = []) {
  const usedKeys = new Set()

  return articles.map(article => {
    const fields = []
    if (clean(article.title)) fields.push(['title', article.title])
    const authors = asAuthors(article.authors)
    if (authors.length) fields.push(['author', authors.join(' and ')])
    if (clean(article.journal)) fields.push(['journal', article.journal])
    if (article.publication_year) fields.push(['year', article.publication_year])
    if (clean(article.doi)) fields.push(['doi', article.doi])
    if (clean(article.pmid)) fields.push(['pmid', article.pmid])
    if (clean(article.url)) fields.push(['url', article.url])

    const key = citationKey(article, usedKeys)
    const body = fields
      .map(([name, value], index) => {
        const suffix = index === fields.length - 1 ? '' : ','
        return `  ${name.padEnd(7)} = {${escapeBibtex(value)}}${suffix}`
      })
      .join('\n')

    return `@article{${key},\n${body}\n}`
  }).join('\n\n')
}
