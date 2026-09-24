import 'dotenv/config'
import cors from 'cors'
import express from 'express'
import { PrismaClient } from '@prisma/client'

const app = express()
const prisma = new PrismaClient()
const port = Number(process.env.PORT ?? 3000)

app.disable('x-powered-by')
app.use(cors())
app.use(express.json())

app.get('/api/health', async (_request, response) => {
  try {
    await prisma.$queryRaw`SELECT 1`
    response.json({ status: 'ok', database: 'connected', timestamp: new Date().toISOString() })
  } catch (error) {
    console.error('Health check failed:', error)
    response.status(503).json({ status: 'error', database: 'disconnected', timestamp: new Date().toISOString() })
  }
})

const server = app.listen(port, '0.0.0.0', () => {
  console.log(`Pawtrace API listening on port ${port}`)
})

async function shutdown(signal: string) {
  console.log(`${signal} received, shutting down`)
  server.close(async () => {
    await prisma.$disconnect()
    process.exit(0)
  })
}

process.on('SIGTERM', () => void shutdown('SIGTERM'))
process.on('SIGINT', () => void shutdown('SIGINT'))
