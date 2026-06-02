import { Router } from 'express'
import * as academicLabController from '../controllers/academicLab.controller.js'
import { requireAuth } from '../middlewares/auth.middleware.js'

const router = Router()

router.use(requireAuth)

router.get('/projects', academicLabController.projects)
router.get('/projects/:projectId/articles', academicLabController.projectArticles)
router.get('/projects/:projectId/statistics', academicLabController.projectStatistics)
router.get('/projects/:projectId/results', academicLabController.projectResults)
router.get('/projects/:projectId/summary', academicLabController.projectSummary)
router.post('/council/session', academicLabController.createCouncilSession)
router.get('/council/sessions', academicLabController.listCouncilSessions)
router.get('/council/session/:sessionId', academicLabController.getCouncilSession)
router.post('/council/session/:sessionId/message', academicLabController.councilMessage)
router.post('/council/session/:sessionId/start', academicLabController.councilStart)
router.post('/council/session/:sessionId/run-agent', academicLabController.runCouncilAgent)
router.post('/council/session/:sessionId/run-full-manuscript', academicLabController.runCouncilFullManuscript)
router.post('/council/session/:sessionId/editor-review', academicLabController.councilEditorReview)
router.post('/council/session/:sessionId/editor-decision', academicLabController.councilEditorDecision)
router.post('/council/session/:sessionId/finalize', academicLabController.councilFinalize)
router.get('/council/session/:sessionId/events', academicLabController.councilEvents)

export default router
