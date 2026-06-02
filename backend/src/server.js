import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import academicRoutes from './routes/academic.routes.js'
import authRoutes from './routes/auth.routes.js'
import libraryRoutes from './routes/library.routes.js'
import projectRoutes from './routes/project.routes.js'

const app = express()
const port = process.env.PORT || 5001

app.use(cors())
app.use(express.json())

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'express-backend-verified', time: new Date().toISOString() })
})

app.use('/api/academic', academicRoutes)
app.use('/api/auth', authRoutes)
app.use('/api/library', libraryRoutes)
app.use('/api', projectRoutes)

const server = app.listen(port, () => {
  console.log(`Backend http://localhost:${port} adresinde calisiyor`)
})
server.timeout = 120000
