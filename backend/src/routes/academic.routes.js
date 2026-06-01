import { Router } from 'express'
import * as academicController from '../controllers/academic.controller.js'

const router = Router()

router.post('/patient-scan',    academicController.patientScan)
router.post('/academic-search', academicController.academicSearch)
router.post('/data',            academicController.data)
router.post('/statistics',      academicController.statistics)
router.post('/figures',         academicController.figures)
router.post('/writing',         academicController.writing)
router.post('/reviewer',        academicController.reviewer)

export default router
