import { XMLParser } from 'fast-xml-parser'

const PMC_EFETCH_URL = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi'

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  trimValues: true
})

function asArray(value) {
  if (!value) return []
  return Array.isArray(value) ? value : [value]
}

function normalizeWhitespace(value = '') {
  return String(value).replace(/\s+/g, ' ').trim()
}

function textFromNode(node) {
  if (node === null || node === undefined) return ''
  if (typeof node === 'string' || typeof node === 'number') return normalizeWhitespace(node)
  if (Array.isArray(node)) return normalizeWhitespace(node.map(textFromNode).filter(Boolean).join(' '))
  if (typeof node !== 'object') return ''

  return normalizeWhitespace(
    Object.entries(node)
      .filter(([key]) => !key.startsWith('@_'))
      .map(([, value]) => textFromNode(value))
      .filter(Boolean)
      .join(' ')
  )
}

function getArticle(parsed) {
  if (parsed.article) return parsed.article
  if (parsed['pmc-articleset']?.article) return asArray(parsed['pmc-articleset'].article)[0]
  return null
}

function classifySection(title = '') {
  const value = title.toLowerCase()
  if (/abstract|özet/.test(value)) return 'abstract'
  if (/introduction|background|giriş/.test(value)) return 'introduction'
  if (/method|materials|yöntem|metod/.test(value)) return 'methods'
  if (/result|bulgu|sonuçlar/.test(value)) return 'results'
  if (/discussion|tartışma/.test(value)) return 'discussion'
  if (/conclusion|sonuç/.test(value)) return 'conclusion'
  if (/limitation|kısıtlılık/.test(value)) return 'limitations'
  return 'other'
}

function collectSections(secNodes, sections = []) {
  for (const sec of asArray(secNodes)) {
    const sectionTitle = textFromNode(sec.title) || 'Untitled section'
    const content = textFromNode({ ...sec, sec: undefined, title: undefined })
    const section = classifySection(sectionTitle)

    if (content.length >= 80) {
      sections.push({ section, sectionTitle, content })
    }

    if (sec.sec) collectSections(sec.sec, sections)
  }
  return sections
}

export async function fetchPmcFullTextXml(pmcid) {
  const cleanId = String(pmcid || '').trim().replace(/^PMC/i, '')
  if (!cleanId) {
    const err = new Error('PMCID bulunamadı.')
    err.status = 422
    throw err
  }

  const url = new URL(PMC_EFETCH_URL)
  url.searchParams.set('db', 'pmc')
  url.searchParams.set('id', cleanId)
  url.searchParams.set('retmode', 'xml')

  const response = await fetch(url)
  if (!response.ok) {
    const err = new Error(`PMC XML alınamadı: ${response.status} ${response.statusText}`)
    err.status = 502
    throw err
  }

  const xml = await response.text()
  if (!/<article[\s>]/i.test(xml)) {
    const err = new Error('PMC yanıtında işlenebilir article XML bulunamadı.')
    err.status = 422
    throw err
  }

  return xml
}

export function extractSectionsFromPmcXml(xml) {
  const parsed = parser.parse(xml)
  const article = getArticle(parsed)
  if (!article) return []

  const sections = []
  const abstract = article.front?.['article-meta']?.abstract
  const abstractText = textFromNode(abstract)
  if (abstractText.length >= 80) {
    sections.push({
      section: 'abstract',
      sectionTitle: 'Abstract',
      content: abstractText
    })
  }

  collectSections(article.body?.sec, sections)

  const seen = new Set()
  return sections.filter(item => {
    const key = `${item.section}:${item.sectionTitle}:${item.content.slice(0, 160)}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export function chunkText(text, maxChars = 4200, overlapChars = 500) {
  const normalized = normalizeWhitespace(text)
  if (!normalized) return []
  if (normalized.length <= maxChars) return [normalized]

  const chunks = []
  let start = 0

  while (start < normalized.length) {
    let end = Math.min(start + maxChars, normalized.length)
    if (end < normalized.length) {
      const sentenceEnd = normalized.slice(start, end).search(/[.!?]\s+[A-ZÇĞİÖŞÜ0-9][^.!?]*$/)
      const lastStop = normalized.slice(start, end).lastIndexOf('. ')
      if (sentenceEnd > 0) end = start + sentenceEnd + 1
      else if (lastStop > maxChars * 0.55) end = start + lastStop + 1
    }

    const chunk = normalized.slice(start, end).trim()
    if (chunk) chunks.push(chunk)
    if (end >= normalized.length) break
    start = Math.max(0, end - overlapChars)
  }

  return chunks
}

export async function saveArticleChunks({ supabase, userId, article, sections }) {
  const rows = []

  for (const section of sections) {
    const chunks = chunkText(section.content)
    chunks.forEach((content, index) => {
      rows.push({
        user_id: userId,
        article_id: article.id,
        section: section.section,
        chunk_index: index,
        content,
        metadata: {
          source: 'pmc',
          pmcid: article.pmcid,
          section_title: section.sectionTitle
        }
      })
    })
  }

  if (!rows.length) {
    const err = new Error('PMC XML içinden anlamlı metin bölümü çıkarılamadı.')
    err.status = 422
    throw err
  }

  const { error } = await supabase
    .from('library_article_chunks')
    .upsert(rows, { onConflict: 'article_id,section,chunk_index' })

  if (error) throw error

  const fullText = sections.map(section => section.content).join('\n\n')
  const { error: updateError } = await supabase
    .from('library_articles')
    .update({
      full_text_status: 'open_access',
      context_status: 'full_text_ready',
      full_text: fullText
    })
    .eq('id', article.id)

  if (updateError) throw updateError

  return rows.length
}

export async function processPmcContext({ supabase, userId, article }) {
  try {
    const xml = await fetchPmcFullTextXml(article.pmcid)
    const sections = extractSectionsFromPmcXml(xml)
    const chunkCount = await saveArticleChunks({ supabase, userId, article, sections })
    return {
      success: true,
      articleId: article.id,
      source: 'pmc',
      chunkCount
    }
  } catch (err) {
    await supabase
      .from('library_articles')
      .update({ context_status: 'failed' })
      .eq('id', article.id)
      .catch(() => {})
    throw err
  }
}
