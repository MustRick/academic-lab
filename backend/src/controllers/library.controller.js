import * as libraryService from '../services/library.service.js'
import { processPmcContext } from '../services/pmcContext.service.js'
import {
  createArticleFromPdf,
  extractPdfMetadata,
  uploadAndExtractPdfContext
} from '../services/pdfContext.service.js'
import * as exportService from '../services/export.service.js'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function token(req) {
  return libraryService.getAccessToken(req)
}

function isUuid(value) {
  return UUID_RE.test(String(value || ''))
}

function sendError(res, err, label) {
  const status = err.status || (err.code === 'PGRST116' ? 404 : 500)
  const message =
    status === 500
      ? 'İşlem sırasında bir hata oluştu.'
      : err.message || 'İşlem tamamlanamadı.'

  console.error(`[library:${label}]`, err.message)
  return res.status(status).json({ success: false, message })
}

function validateUuidParam(res, value, label) {
  if (isUuid(value)) return true
  res.status(400).json({ success: false, message: `${label} geçerli bir UUID olmalıdır.` })
  return false
}

export const createArticle = async (req, res) => {
  try {
    if (!String(req.body?.title || '').trim()) {
      return res.status(400).json({ success: false, message: 'Başlık boş olamaz.' })
    }

    const data = await libraryService.saveLibraryArticle(
      {
        ...req.body,
        authors: Array.isArray(req.body?.authors) ? req.body.authors : []
      },
      token(req)
    )

    return res.status(201).json({ success: true, data })
  } catch (err) {
    return sendError(res, err, 'createArticle')
  }
}

export const listArticles = async (req, res) => {
  try {
    const data = await libraryService.listLibraryArticles(req.query, token(req))
    return res.json({ success: true, data })
  } catch (err) {
    return sendError(res, err, 'listArticles')
  }
}

export const getArticle = async (req, res) => {
  try {
    if (!validateUuidParam(res, req.params.id, 'Makale ID')) return
    const data = await libraryService.getLibraryArticle(req.params.id, token(req))
    return res.json({ success: true, data })
  } catch (err) {
    return sendError(res, err, 'getArticle')
  }
}

export const deleteArticle = async (req, res) => {
  try {
    if (!validateUuidParam(res, req.params.id, 'Makale ID')) return
    const data = await libraryService.deleteLibraryArticle(req.params.id, token(req))
    return res.json({ success: true, data })
  } catch (err) {
    return sendError(res, err, 'deleteArticle')
  }
}

export const processContext = async (req, res) => {
  try {
    if (!validateUuidParam(res, req.params.id, 'Makale ID')) return

    const db = libraryService.scopedSupabase(token(req))
    const article = await libraryService.getLibraryArticle(req.params.id, token(req))

    if (!article?.pmcid) {
      return res.status(422).json({
        success: false,
        message: 'Bu makale için PMCID bulunamadı. Abstract context kullanılabilir veya kullanıcı PDF yükleyebilir.'
      })
    }

    const data = await processPmcContext({
      supabase: db,
      userId: req.user.id,
      article
    })

    return res.json({ success: true, data })
  } catch (err) {
    return sendError(res, err, 'processContext')
  }
}

export const uploadPdf = async (req, res) => {
  try {
    if (!validateUuidParam(res, req.params.id, 'Makale ID')) return

    const db = libraryService.scopedSupabase(token(req))
    const article = await libraryService.getLibraryArticle(req.params.id, token(req))

    const data = await uploadAndExtractPdfContext({
      supabase: db,
      userId: req.user.id,
      article,
      file: req.file
    })

    return res.json({ success: true, data })
  } catch (err) {
    return sendError(res, err, 'uploadPdf')
  }
}

export const uploadPdfArticle = async (req, res) => {
  try {
    const db = libraryService.scopedSupabase(token(req))
    const data = await createArticleFromPdf({
      supabase: db,
      userId: req.user.id,
      token: token(req),
      file: req.file,
      metadata: req.body || {}
    })

    return res.status(201).json({ success: true, data })
  } catch (err) {
    return sendError(res, err, 'uploadPdfArticle')
  }
}

export const extractPdfArticleMetadata = async (req, res) => {
  try {
    const metadata = await extractPdfMetadata(req.file)
    return res.json({ success: true, metadata })
  } catch (err) {
    return sendError(res, err, 'extractPdfArticleMetadata')
  }
}

export const exportRis = async (req, res) => {
  try {
    if (req.query.project_id && !isUuid(req.query.project_id)) {
      return res.status(400).json({ success: false, message: 'Proje ID geçerli bir UUID olmalıdır.' })
    }

    const articles = await exportService.listArticlesForExport({
      token: token(req),
      projectId: req.query.project_id || null
    })
    const content = exportService.generateRis(articles)

    res.setHeader('Content-Type', 'application/x-research-info-systems; charset=utf-8')
    res.setHeader('Content-Disposition', 'attachment; filename="picuvision-library.ris"')
    return res.send(content)
  } catch (err) {
    return sendError(res, err, 'exportRis')
  }
}

export const exportBibtex = async (req, res) => {
  try {
    if (req.query.project_id && !isUuid(req.query.project_id)) {
      return res.status(400).json({ success: false, message: 'Proje ID geçerli bir UUID olmalıdır.' })
    }

    const articles = await exportService.listArticlesForExport({
      token: token(req),
      projectId: req.query.project_id || null
    })
    const content = exportService.generateBibtex(articles)

    res.setHeader('Content-Type', 'application/x-bibtex; charset=utf-8')
    res.setHeader('Content-Disposition', 'attachment; filename="picuvision-library.bib"')
    return res.send(content)
  } catch (err) {
    return sendError(res, err, 'exportBibtex')
  }
}

export const addArticleToProject = async (req, res) => {
  try {
    if (!validateUuidParam(res, req.params.projectId, 'Proje ID')) return
    if (!validateUuidParam(res, req.params.articleId, 'Makale ID')) return

    const data = await libraryService.addArticleToProject(
      req.params.projectId,
      req.params.articleId,
      req.body || {},
      token(req)
    )

    return res.status(201).json({ success: true, data })
  } catch (err) {
    return sendError(res, err, 'addArticleToProject')
  }
}

export const removeArticleFromProject = async (req, res) => {
  try {
    if (!validateUuidParam(res, req.params.projectId, 'Proje ID')) return
    if (!validateUuidParam(res, req.params.articleId, 'Makale ID')) return

    const data = await libraryService.removeArticleFromProject(
      req.params.projectId,
      req.params.articleId,
      token(req)
    )

    return res.json({ success: true, data })
  } catch (err) {
    return sendError(res, err, 'removeArticleFromProject')
  }
}
