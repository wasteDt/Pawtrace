import type { Response } from 'express'
import { app, prisma, notificationStreams, sendError, currentSession, csrfValid, NotificationType } from '../context.js'

app.get('/api/v1/me/notifications', async (request, response) => {
  const session = await currentSession(request)
  if (!session) return sendError(response, 401, 'UNAUTHENTICATED', '请先登录')
  const filter = typeof request.query.filter === 'string' ? request.query.filter : 'all'
  const typeFilter = filter === 'professional' ? { in: [NotificationType.PROFESSIONAL_APPLICATION_APPROVED, NotificationType.PROFESSIONAL_APPLICATION_REJECTED, NotificationType.PROFESSIONAL_IDENTITY_REVOKED, NotificationType.PROFESSIONAL_IDENTITY_RESTORED] } : filter === 'system' ? NotificationType.SYSTEM : undefined
  const where = { userId: session.userId, deletedAt: null, ...(filter === 'unread' ? { readAt: null } : {}), ...(typeFilter ? { type: typeFilter } : {}) }
  const [notifications, unreadCount] = await Promise.all([
    prisma.userNotification.findMany({ where, orderBy: { createdAt: 'desc' }, take: 100 }),
    prisma.userNotification.count({ where: { userId: session.userId, readAt: null, deletedAt: null } }),
  ])
  return response.json({ data: { notifications, unreadCount } })
})

app.get('/api/v1/me/notifications/stream', async (request, response) => {
  const session = await currentSession(request)
  if (!session) return sendError(response, 401, 'UNAUTHENTICATED', '请先登录')
  response.setHeader('Content-Type', 'text/event-stream')
  response.setHeader('Cache-Control', 'no-cache, no-transform')
  response.setHeader('Connection', 'keep-alive')
  response.setHeader('X-Accel-Buffering', 'no')
  response.flushHeaders()
  response.write('event: connected\ndata: {}\n\n')
  const streams = notificationStreams.get(session.userId) ?? new Set<Response>()
  streams.add(response)
  notificationStreams.set(session.userId, streams)
  const heartbeat = setInterval(() => response.write(': heartbeat\n\n'), 25000)
  request.on('close', () => {
    clearInterval(heartbeat)
    streams.delete(response)
    if (streams.size === 0) notificationStreams.delete(session.userId)
  })
})

app.post('/api/v1/me/notifications/:notificationId/read', async (request, response) => {
  const session = await currentSession(request)
  if (!session) return sendError(response, 401, 'UNAUTHENTICATED', '请先登录')
  if (!csrfValid(request, session)) return sendError(response, 403, 'CSRF_INVALID', '安全校验失败，请刷新页面后重试')
  const notificationId = Number(request.params.notificationId)
  const result = Number.isInteger(notificationId) ? await prisma.userNotification.updateMany({ where: { id: notificationId, userId: session.userId, readAt: null }, data: { readAt: new Date() } }) : { count: 0 }
  if (result.count === 0) return sendError(response, 404, 'RESOURCE_NOT_FOUND', '未读消息不存在')
  return response.status(204).send()
})

app.post('/api/v1/me/notifications/read-all', async (request, response) => {
  const session = await currentSession(request)
  if (!session) return sendError(response, 401, 'UNAUTHENTICATED', '请先登录')
  if (!csrfValid(request, session)) return sendError(response, 403, 'CSRF_INVALID', '安全校验失败，请刷新页面后重试')
  await prisma.userNotification.updateMany({ where: { userId: session.userId, readAt: null, deletedAt: null }, data: { readAt: new Date() } })
  return response.status(204).send()
})

app.delete('/api/v1/me/notifications/item/:notificationId', async (request, response) => {
  const session = await currentSession(request)
  if (!session) return sendError(response, 401, 'UNAUTHENTICATED', '请先登录')
  if (!csrfValid(request, session)) return sendError(response, 403, 'CSRF_INVALID', '安全校验失败，请刷新页面后重试')
  const notificationId = Number(request.params.notificationId)
  const result = Number.isInteger(notificationId) ? await prisma.userNotification.updateMany({ where: { id: notificationId, userId: session.userId, deletedAt: null }, data: { deletedAt: new Date() } }) : { count: 0 }
  if (result.count === 0) return sendError(response, 404, 'RESOURCE_NOT_FOUND', '消息不存在')
  return response.status(204).send()
})

app.delete('/api/v1/me/notifications/read', async (request, response) => {
  const session = await currentSession(request)
  if (!session) return sendError(response, 401, 'UNAUTHENTICATED', '请先登录')
  if (!csrfValid(request, session)) return sendError(response, 403, 'CSRF_INVALID', '安全校验失败，请刷新页面后重试')
  await prisma.userNotification.updateMany({ where: { userId: session.userId, readAt: { not: null }, deletedAt: null }, data: { deletedAt: new Date() } })
  return response.status(204).send()
})

