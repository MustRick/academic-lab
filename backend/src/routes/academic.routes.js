import { Router } from 'express'
import * as academicController from '../controllers/academic.controller.js'
import { requireAuth } from '../middlewares/auth.middleware.js'

const router = Router()

router.post('/patient-scan',    academicController.patientScan)
router.post('/academic-search', academicController.academicSearch)
router.post('/data',            academicController.data)
router.post('/statistics',      academicController.statistics)
router.post('/figures',         requireAuth, academicController.figures)
router.post('/tables',          requireAuth, academicController.tables)
router.post('/writing',         academicController.writing)
router.post('/reviewer',        academicController.reviewer)

export default router
