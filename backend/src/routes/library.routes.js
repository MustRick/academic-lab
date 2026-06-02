import { Router } from 'express'
import multer from 'multer'
import * as libraryController from '../controllers/library.controller.js'
import { requireAuth } from '../middlewares/auth.middleware.js'

const router = Router()
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype !== 'application/pdf') {
      const err = new Error('Yalnızca PDF dosyası yüklenebilir.')
      err.status = 415
      cb(err)
      return
    }
    cb(null, true)
  }
})

function handlePdfUpload(req, res, next) {
  upload.fields([{ name: 'pdf', maxCount: 1 }, { name: 'file', maxCount: 1 }])(req, res, err => {
    if (!err) return next()

    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({
        success: false,
        message: 'PDF dosyası 15 MB sınırını aşamaz.'
      })
    }

    return res.status(err.status || 400).json({
      success: false,
      message: err.message || 'PDF yükleme başarısız.'
    })
  })
}

function normalizePdfFile(req, _res, next) {
  req.file = req.files?.pdf?.[0] || req.files?.file?.[0] || null
  next()
}

router.use(requireAuth)

router.get('/export/ris', libraryController.exportRis)
router.get('/export/bibtex', libraryController.exportBibtex)

router.post('/articles', libraryController.createArticle)
router.get('/articles', libraryController.listArticles)
router.post('/articles/upload-pdf', handlePdfUpload, normalizePdfFile, libraryController.uploadPdfArticle)
router.post('/articles/extract-pdf-metadata', handlePdfUpload, normalizePdfFile, libraryController.extractPdfArticleMetadata)
router.get('/articles/:id', libraryController.getArticle)
router.delete('/articles/:id', libraryController.deleteArticle)

router.post('/articles/:id/process-context', libraryController.processContext)
router.post('/articles/:id/upload-pdf', handlePdfUpload, normalizePdfFile, libraryController.uploadPdf)

router.post('/projects/:projectId/articles/:articleId', libraryController.addArticleToProject)
router.delete('/projects/:projectId/articles/:articleId', libraryController.removeArticleFromProject)

export default router
