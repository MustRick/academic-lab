import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import academicRoutes from './routes/academic.routes.js'
import authRoutes from './routes/auth.routes.js'

const app = express()
const port = process.env.PORT || 5001

app.use(cors())
app.use(express.json())

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'express-backend-verified', time: new Date().toISOString() })
})

app.use('/api/academic', academicRoutes)
app.use('/api/auth', authRoutes)

app.listen(port, () => {
  console.log(`Backend http://localhost:${port} adresinde calisiyor`)
})
