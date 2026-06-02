import * as patientScanAgent from '../agents/patientScan.agent.js'
import * as academicSearchAgent from '../agents/academicSearch.agent.js'
import * as dataAgent from '../agents/data.agent.js'
import * as statisticsAgent from '../agents/statistics.agent.js'
import * as figureAgent from '../agents/figure.agent.js'
import * as tableAgent from '../agents/table.agent.js'
import * as writingAgent from '../agents/writing.agent.js'
import * as reviewerAgent from '../agents/reviewer.agent.js'

const handle = (agent, name) => async (req, res) => {
  try {
    res.json(await agent.run(req.body))
  } catch (err) {
    console.error(`[${name}] hata:`, err)
    res.status(500).json({ error: err.message })
  }
}

export const patientScan    = handle(patientScanAgent,    'patientScan')
export const academicSearch = handle(academicSearchAgent, 'academicSearch')
export const data           = handle(dataAgent,           'data')
export const statistics     = handle(statisticsAgent,     'statistics')
export const figures        = async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '')
    res.json(await figureAgent.run(req.body, { user: req.user, token }))
  } catch (err) {
    console.error('[figures] hata:', err)
    res.status(500).json({ error: err.message })
  }
}
export const tables         = async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '')
    res.json(await tableAgent.run(req.body, { user: req.user, token }))
  } catch (err) {
    console.error('[tables] hata:', err)
    res.status(500).json({ error: err.message })
  }
}
export const writing        = handle(writingAgent,        'writing')
export const reviewer       = handle(reviewerAgent,       'reviewer')
