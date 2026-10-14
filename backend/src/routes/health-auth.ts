import { randomInt } from 'node:crypto'
import { app, prisma, sessionLifetimeMs, hash, token, clientIp, validPhone, setSessionCookie, clearSessionCookie, sendError, currentSession, publicMe, UserStatus, VerificationPurpose } from '../context.js'

app.get('/api/health', async (_request, response) => {
  try {
    await prisma.$queryRaw`SELECT 1`
    response.json({ status: 'ok', database: 'connected', timestamp: new Date().toISOString() })
  } catch {
    response.status(503).json({ status: 'error', database: 'disconnected', timestamp: new Date().toISOString() })
  }
})

app.post('/api/v1/auth/verification-codes', async (request, response) => {
  const phoneNumber = request.body?.phoneNumber
  const countryCode = request.body?.countryCode === '+86' ? '+86' : null
  if (!countryCode || !validPhone(phoneNumber)) return sendError(response, 400, 'VALIDATION_ERROR', '手机号格式不正确', { phoneNumber: '请输入合法的中国大陆手机号' })

  const latest = await prisma.verificationCode.findFirst({ where: { phoneCountryCode: countryCode, phoneNumber, purpose: VerificationPurpose.LOGIN, consumedAt: null }, orderBy: { createdAt: 'desc' } })
  if (latest && Date.now() - latest.createdAt.getTime() < 60_000) {
    response.setHeader('Retry-After', '60')
    return sendError(response, 429, 'RATE_LIMITED', '请稍后再获取验证码')
  }

  const demoCode = String(randomInt(0, 1_000_000)).padStart(6, '0')
  await prisma.verificationCode.create({ data: { phoneCountryCode: countryCode, phoneNumber, purpose: VerificationPurpose.LOGIN, codeHash: hash(demoCode), expiresAt: new Date(Date.now() + 5 * 60_000), requestIp: clientIp(request) } })
  return response.status(201).json({ data: { expiresInSeconds: 300, retryAfterSeconds: 60, demoCode } })
})

app.post('/api/v1/auth/login', async (request, response) => {
  const { phoneNumber, code } = request.body ?? {}
  const countryCode = request.body?.countryCode === '+86' ? '+86' : null
  if (!countryCode || !validPhone(phoneNumber) || typeof code !== 'string' || !/^\d{6}$/.test(code)) return sendError(response, 400, 'VALIDATION_ERROR', '手机号或验证码格式不正确')

  const verification = await prisma.verificationCode.findFirst({ where: { phoneCountryCode: countryCode, phoneNumber, purpose: VerificationPurpose.LOGIN, consumedAt: null }, orderBy: { createdAt: 'desc' } })
  if (!verification || verification.expiresAt <= new Date() || verification.codeHash !== hash(code)) {
    if (verification) await prisma.verificationCode.update({ where: { id: verification.id }, data: { attemptCount: { increment: 1 } } })
    return sendError(response, 400, 'INVALID_VERIFICATION_CODE', '验证码错误或已过期')
  }
  if (verification.attemptCount >= 5) return sendError(response, 429, 'RATE_LIMITED', '验证码尝试次数过多，请重新获取')

  const rawSession = token()
  const csrfToken = token()
  const expiresAt = new Date(Date.now() + sessionLifetimeMs)
  const result = await prisma.$transaction(async tx => {
    await tx.verificationCode.update({ where: { id: verification.id }, data: { consumedAt: new Date() } })
    const existing = await tx.user.findUnique({ where: { phoneCountryCode_phoneNumber: { phoneCountryCode: countryCode, phoneNumber } } })
    const user = existing
      ? await tx.user.update({ where: { id: existing.id }, data: { lastLoginAt: new Date() }, include: { profile: true } })
      : await tx.user.create({ data: { phoneCountryCode: countryCode, phoneNumber, phoneVerifiedAt: new Date(), lastLoginAt: new Date(), profile: { create: {} } }, include: { profile: true } })
    if (user.status !== UserStatus.ACTIVE) throw new Error('ACCOUNT_DISABLED')
    await tx.userSession.create({ data: { userId: user.id, sessionTokenHash: hash(rawSession), csrfTokenHash: hash(csrfToken), userAgent: request.get('user-agent')?.slice(0, 500), ipAddress: clientIp(request), expiresAt } })
    return { user, isNewUser: !existing }
  }).catch(cause => cause instanceof Error && cause.message === 'ACCOUNT_DISABLED' ? null : Promise.reject(cause))

  if (!result) return sendError(response, 403, 'ACCOUNT_DISABLED', '账号已被禁用')
  setSessionCookie(response, rawSession, expiresAt)
  return response.json({ data: { csrfToken, sessionExpiresAt: expiresAt.toISOString(), isNewUser: result.isNewUser, user: publicMe(result.user) } })
})

app.get('/api/v1/auth/session', async (request, response) => {
  const session = await currentSession(request)
  if (!session || session.user.status !== UserStatus.ACTIVE) {
    clearSessionCookie(response)
    return sendError(response, 401, 'UNAUTHENTICATED', '登录状态已失效')
  }
  const csrfToken = token()
  await prisma.userSession.update({ where: { id: session.id }, data: { csrfTokenHash: hash(csrfToken) } })
  return response.json({ data: { csrfToken, sessionExpiresAt: session.expiresAt.toISOString(), user: publicMe(session.user) } })
})

app.post('/api/v1/auth/logout', async (request, response) => {
  const session = await currentSession(request)
  if (session) await prisma.userSession.update({ where: { id: session.id }, data: { revokedAt: new Date() } })
  clearSessionCookie(response)
  return response.status(204).send()
})

app.patch('/api/v1/me/profile', async (request, response) => {
  const session = await currentSession(request)
  if (!session) return sendError(response, 401, 'UNAUTHENTICATED', '请先登录')
  if (hash(request.get('x-csrf-token') ?? '') !== session.csrfTokenHash) return sendError(response, 403, 'CSRF_INVALID', '安全校验失败，请刷新页面后重试')
  const nickname = typeof request.body?.nickname === 'string' ? request.body.nickname.trim() : ''
  if (nickname.length < 2 || nickname.length > 50) return sendError(response, 400, 'VALIDATION_ERROR', '昵称长度应为 2 到 50 个字符', { nickname: '请输入 2 到 50 个字符' })
  const profile = await prisma.userProfile.update({ where: { userId: session.userId }, data: {
    nickname,
    bio: typeof request.body.bio === 'string' ? request.body.bio.trim().slice(0, 500) || null : undefined,
    locationText: typeof request.body.locationText === 'string' ? request.body.locationText.trim().slice(0, 100) || null : undefined,
    profileCompletedAt: session.user.profile?.profileCompletedAt ?? new Date(),
  } })
  return response.json({ data: { id: session.userId, nickname: profile.nickname, bio: profile.bio, locationText: profile.locationText, profileCompleted: true } })
})

