import type { Response } from 'express'
import { app, prisma, adminNotificationStreams, sendError, currentAdminSession, adminCsrfValid, AdminNotificationType } from '../context.js'

app.get('/api/v1/admin/notifications', async (request, response) => {
  const session = await currentAdminSession(request)
  if (!session) return sendError(response, 401, 'UNAUTHENTICATED', '请先登录管理端')
  const filter = typeof request.query.filter === 'string' ? request.query.filter : 'all'
  const where = { adminUserId: session.adminUserId, deletedAt: null, ...(filter === 'unread' ? { readAt: null } : {}), ...(filter === 'work' ? { type: { in: [AdminNotificationType.PROFESSIONAL_APPLICATION_SUBMITTED, AdminNotificationType.PROFESSIONAL_APPLICATION_CANCELLED] } } : {}), ...(filter === 'system' ? { type: AdminNotificationType.SYSTEM } : {}) }
  const [notifications, unreadCount] = await Promise.all([
    prisma.adminNotification.findMany({ where, orderBy: { createdAt: 'desc' }, take: 100 }),
    prisma.adminNotification.count({ where: { adminUserId: session.adminUserId, readAt: null, deletedAt: null } }),
  ])
  return response.json({ data: { notifications, unreadCount } })
})

app.get('/api/v1/admin/notifications/stream', async (request, response) => {
  const session = await currentAdminSession(request)
  if (!session) return sendError(response, 401, 'UNAUTHENTICATED', '请先登录管理端')
  response.setHeader('Content-Type', 'text/event-stream'); response.setHeader('Cache-Control', 'no-cache, no-transform'); response.setHeader('Connection', 'keep-alive'); response.setHeader('X-Accel-Buffering', 'no'); response.flushHeaders(); response.write('event: connected\ndata: {}\n\n')
  const streams = adminNotificationStreams.get(session.adminUserId) ?? new Set<Response>(); streams.add(response); adminNotificationStreams.set(session.adminUserId, streams)
  const heartbeat = setInterval(() => response.write(': heartbeat\n\n'), 25000)
  request.on('close', () => { clearInterval(heartbeat); streams.delete(response); if (streams.size === 0) adminNotificationStreams.delete(session.adminUserId) })
})

app.post('/api/v1/admin/notifications/:notificationId/read', async (request, response) => {
  const session = await currentAdminSession(request)
  if (!session) return sendError(response, 401, 'UNAUTHENTICATED', '请先登录管理端')
  if (!adminCsrfValid(request, session)) return sendError(response, 403, 'CSRF_INVALID', '安全校验失败，请刷新页面后重试')
  const notificationId = Number(request.params.notificationId)
  const result = Number.isInteger(notificationId) ? await prisma.adminNotification.updateMany({ where: { id: notificationId, adminUserId: session.adminUserId, readAt: null }, data: { readAt: new Date() } }) : { count: 0 }
  if (result.count === 0) return sendError(response, 404, 'RESOURCE_NOT_FOUND', '未读消息不存在')
  return response.status(204).send()
})

app.post('/api/v1/admin/notifications/read-all', async (request, response) => {
  const session = await currentAdminSession(request)
  if (!session) return sendError(response, 401, 'UNAUTHENTICATED', '请先登录管理端')
  if (!adminCsrfValid(request, session)) return sendError(response, 403, 'CSRF_INVALID', '安全校验失败，请刷新页面后重试')
  await prisma.adminNotification.updateMany({ where: { adminUserId: session.adminUserId, readAt: null, deletedAt: null }, data: { readAt: new Date() } })
  return response.status(204).send()
})

app.delete('/api/v1/admin/notifications/item/:notificationId', async (request, response) => {
  const session = await currentAdminSession(request)
  if (!session) return sendError(response, 401, 'UNAUTHENTICATED', '请先登录管理端')
  if (!adminCsrfValid(request, session)) return sendError(response, 403, 'CSRF_INVALID', '安全校验失败，请刷新页面后重试')
  const notificationId = Number(request.params.notificationId)
  const result = Number.isInteger(notificationId) ? await prisma.adminNotification.updateMany({ where: { id: notificationId, adminUserId: session.adminUserId, deletedAt: null }, data: { deletedAt: new Date() } }) : { count: 0 }
  if (result.count === 0) return sendError(response, 404, 'RESOURCE_NOT_FOUND', '消息不存在')
  return response.status(204).send()
})

app.delete('/api/v1/admin/notifications/read', async (request, response) => {
  const session = await currentAdminSession(request)
  if (!session) return sendError(response, 401, 'UNAUTHENTICATED', '请先登录管理端')
  if (!adminCsrfValid(request, session)) return sendError(response, 403, 'CSRF_INVALID', '安全校验失败，请刷新页面后重试')
  await prisma.adminNotification.updateMany({ where: { adminUserId: session.adminUserId, readAt: { not: null }, deletedAt: null }, data: { deletedAt: new Date() } })
  return response.status(204).send()
})

