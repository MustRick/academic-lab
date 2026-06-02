import { PDFParse } from 'pdf-parse'
import { saveLibraryArticle, getLibraryArticle } from './library.service.js'

const BUCKET = 'library-pdfs'

function normalizeWhitespace(value = '') {
  return String(value).replace(/\s+/g, ' ').trim()
}

function makeError(message, status = 400) {
  const err = new Error(message)
  err.status = status
  return err
}

export function getPdfStoragePath(userId, articleId) {
  return `${userId}/${articleId}/article.pdf`
}

export function validatePdfFile(file) {
  if (!file) throw makeError('PDF dosyası bulunamadı.', 400)
  if (file.mimetype !== 'application/pdf') {
    throw makeError('Yalnızca PDF dosyası yüklenebilir.', 415)
  }
}

export async function extractPdfText(buffer, { normalize = true } = {}) {
  const parser = new PDFParse({ data: buffer })

  try {
    const parsed = await parser.getText()
    const text = normalize ? normalizeWhitespace(parsed.text || '') : String(parsed.text || '').trim()

    if (!text) {
      throw makeError('PDF metni çıkarılamadı. Dosya taranmış olabilir.', 422)
    }

    return text
  } finally {
    await parser.destroy()
  }
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
      const slice = normalized.slice(start, end)
      const lastSentence = Math.max(
        slice.lastIndexOf('. '),
        slice.lastIndexOf('? '),
        slice.lastIndexOf('! ')
      )
      if (lastSentence > maxChars * 0.55) end = start + lastSentence + 1
    }

    const chunk = normalized.slice(start, end).trim()
    if (chunk) chunks.push(chunk)
    if (end >= normalized.length) break
    start = Math.max(0, end - overlapChars)
  }

  return chunks
}

function parseAuthors(value) {
  if (Array.isArray(value)) return value.map(item => String(item).trim()).filter(Boolean)
  return String(value || '').split(',').map(item => item.trim()).filter(Boolean)
}

function normalizeYear(value) {
  const year = Number(value)
  return Number.isInteger(year) && year > 0 ? year : null
}

function extractDoi(text) {
  return text.match(/10\.\d{4,9}\/[-._;()/:A-Z0-9]+/i)?.[0]?.replace(/[.,;)]$/, '') || null
}

function extractPmid(text) {
  return text.match(/\bPMID[:\s]+(\d{5,12})\b/i)?.[1] || null
}

function extractYear(text) {
  const year = text.match(/\b(19|20)\d{2}\b/)?.[0]
  return year ? Number(year) : null
}

function extractTitle(text) {
  const lines = String(text || '')
    .split(/\n|\r/)
    .map(line => normalizeWhitespace(line))
    .filter(line => line.length >= 12 && line.length <= 180)

  return lines[0] || ''
}

async function setArticleFailed(supabase, articleId) {
  await supabase
    .from('library_articles')
    .update({ context_status: 'failed' })
    .eq('id', articleId)
    .catch(() => {})
}

export async function uploadAndExtractPdfContext({ supabase, userId, article, file }) {
  validatePdfFile(file)

  const storagePath = getPdfStoragePath(userId, article.id)

  try {
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, file.buffer, {
        contentType: 'application/pdf',
        upsert: true
      })

    if (uploadError) throw uploadError

    const fullText = await extractPdfText(file.buffer)
    const chunks = chunkText(fullText)

    if (!chunks.length) {
      throw makeError('PDF metni çıkarılamadı. Dosya taranmış olabilir.', 422)
    }

    const rows = chunks.map((content, index) => ({
      user_id: userId,
      article_id: article.id,
      section: 'uploaded_pdf',
      chunk_index: index,
      content,
      metadata: {
        source: 'uploaded_pdf',
        storage_path: storagePath,
        extraction_method: 'pdf_text',
        auto_created: false
      }
    }))

    const { error: chunkError } = await supabase
      .from('library_article_chunks')
      .upsert(rows, { onConflict: 'article_id,section,chunk_index' })

    if (chunkError) throw chunkError

    const { error: updateError } = await supabase
      .from('library_articles')
      .update({
        pdf_storage_path: storagePath,
        full_text_status: 'uploaded_pdf',
        context_status: 'full_text_ready',
        full_text: fullText,
        source: 'uploaded_pdf'
      })
      .eq('id', article.id)

    if (updateError) throw updateError

    return {
      success: true,
      articleId: article.id,
      storagePath,
      chunkCount: rows.length
    }
  } catch (err) {
    await setArticleFailed(supabase, article.id)
    throw err
  }
}

export async function createArticleFromPdf({ supabase, userId, token, file, metadata = {} }) {
  validatePdfFile(file)

  const title = String(metadata.title || '').trim()
  if (!title) {
    const err = makeError('Başlık boş olamaz.', 400)
    throw err
  }

  const saved = await saveLibraryArticle({
    title,
    abstract: null,
    authors: parseAuthors(metadata.authors),
    journal: metadata.journal || null,
    publication_year: normalizeYear(metadata.publication_year),
    doi: metadata.doi || null,
    pmid: metadata.pmid || null,
    pmcid: metadata.pmcid || null,
    url: null,
    source: 'uploaded_pdf',
    publication_type: null,
    metadata: {
      upload_source: 'library_pdf_modal'
    }
  }, token)

  const articleId = saved.articleId
  if (!articleId) {
    throw makeError('PDF makalesi oluşturulamadı.', 500)
  }

  const article = await getLibraryArticle(articleId, token)
  return uploadAndExtractPdfContext({ supabase, userId, article, file })
}

export async function extractPdfMetadata(file) {
  validatePdfFile(file)

  const text = await extractPdfText(file.buffer, { normalize: false })
  return {
    title: extractTitle(text),
    authors: [],
    journal: '',
    publication_year: extractYear(text),
    doi: extractDoi(text),
    pmid: extractPmid(text),
    pmcid: ''
  }
}

export async function getPdfContext(_input = {}) {
  return {
    source: 'pdf',
    items: [],
    status: 'not_implemented'
  }
}
