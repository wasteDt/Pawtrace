import { app, prisma, sessionLifetimeMs, hash, token, clientIp, setAdminSessionCookie, clearAdminSessionCookie, sendError, currentAdminSession, passwordHash, passwordValid, nullableText, AdminStatus } from '../context.js'

app.post('/api/v1/admin/auth/login', async (request, response) => {
  const username = nullableText(request.body?.username, 100)
  const password = typeof request.body?.password === 'string' ? request.body.password : ''
  const admin = username ? await prisma.adminUser.findUnique({ where: { username } }) : null
  if (!admin || admin.status !== AdminStatus.ACTIVE || !passwordValid(password, admin.passwordHash)) return sendError(response, 401, 'INVALID_CREDENTIALS', '管理员账号或密码错误')
  const rawSession = token()
  const rawCsrf = token()
  const expiresAt = new Date(Date.now() + sessionLifetimeMs)
  await prisma.$transaction([
    prisma.adminSession.create({ data: { adminUserId: admin.id, sessionTokenHash: hash(rawSession), csrfTokenHash: hash(rawCsrf), expiresAt, ipAddress: clientIp(request), userAgent: request.get('user-agent')?.slice(0, 500) ?? null } }),
    prisma.adminUser.update({ where: { id: admin.id }, data: { lastLoginAt: new Date() } }),
  ])
  setAdminSessionCookie(response, rawSession, expiresAt)
  return response.json({ data: { csrfToken: rawCsrf, admin: { id: admin.id, username: admin.username, displayName: admin.displayName } } })
})

app.get('/api/v1/admin/auth/session', async (request, response) => {
  const session = await currentAdminSession(request)
  if (!session) return sendError(response, 401, 'UNAUTHENTICATED', '请先登录管理端')
  const rawCsrf = token()
  await prisma.adminSession.update({ where: { id: session.id }, data: { csrfTokenHash: hash(rawCsrf) } })
  return response.json({ data: { csrfToken: rawCsrf, admin: { id: session.adminUser.id, username: session.adminUser.username, displayName: session.adminUser.displayName } } })
})

app.post('/api/v1/admin/auth/logout', async (request, response) => {
  const session = await currentAdminSession(request)
  if (session) await prisma.adminSession.update({ where: { id: session.id }, data: { revokedAt: new Date() } })
  clearAdminSessionCookie(response)
  return response.status(204).send()
})

