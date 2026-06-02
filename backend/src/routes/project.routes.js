import { Router } from 'express'
import * as projectController from '../controllers/project.controller.js'
import { requireAuth } from '../middlewares/auth.middleware.js'

const router = Router()

router.use(requireAuth)

router.get('/projects', projectController.listProjects)
router.post('/projects', projectController.createProject)
router.get('/projects/:projectId', projectController.getProject)
router.patch('/projects/:projectId', projectController.updateProject)
router.delete('/projects/:projectId', projectController.deleteProject)

router.get('/projects/:projectId/articles', projectController.listProjectArticles)
router.post('/projects/:projectId/articles/:articleId', projectController.addArticleToProject)
router.patch('/projects/:projectId/articles/:articleId', projectController.updateProjectArticle)
router.delete('/projects/:projectId/articles/:articleId', projectController.removeArticleFromProject)

export default router
