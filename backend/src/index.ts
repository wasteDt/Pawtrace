import 'dotenv/config'
import type { Request, Response } from 'express'
import multer from 'multer'
import { app, prisma, port, sendError, passwordHash } from './context.js'
import './routes/health-auth.js'
import './routes/pets.js'
import './routes/media.js'
import './routes/professional-profile.js'
import './routes/user-notifications.js'
import './routes/professional-applications.js'
import './routes/admin-auth.js'
import './routes/admin-notifications.js'
import './routes/admin-professionals.js'
import './routes/social-chat.js'

app.use('/api', (_request, response) => sendError(response, 404, 'RESOURCE_NOT_FOUND', '接口不存在'))
app.use((cause: unknown, _request: Request, response: Response, _next: unknown) => {
  if (cause instanceof multer.MulterError) {
    if (cause.code === 'LIMIT_FILE_SIZE') { sendError(response, 413, 'FILE_TOO_LARGE', '证明材料不能超过 10 MB'); return }
    sendError(response, 400, 'UPLOAD_ERROR', '证明材料上传失败'); return
  }
  console.error('Unhandled request error', cause)
  if (!response.headersSent) sendError(response, 500, 'INTERNAL_ERROR', '服务暂时不可用，请稍后重试')
})

async function ensureAdminUser() {
  const username = process.env.ADMIN_USERNAME ?? 'admin'
  const password = process.env.ADMIN_PASSWORD ?? 'pawtrace_admin_demo'
  const existing = await prisma.adminUser.findUnique({ where: { username } })
  if (!existing) await prisma.adminUser.create({ data: { username, passwordHash: passwordHash(password), displayName: 'Pawtrace 管理员' } })
}

await ensureAdminUser()
const server = app.listen(port, '0.0.0.0', () => console.log(`Pawtrace API listening on port ${port}`))
async function shutdown(signal: string) {
  console.log(`${signal} received, shutting down`)
  server.close(async () => { await prisma.$disconnect(); process.exit(0) })
}
process.on('SIGTERM', () => void shutdown('SIGTERM'))
process.on('SIGINT', () => void shutdown('SIGINT'))
