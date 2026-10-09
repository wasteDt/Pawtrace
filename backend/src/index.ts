import 'dotenv/config'
import { createHash, randomBytes, randomInt, scryptSync, timingSafeEqual } from 'node:crypto'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import cors from 'cors'
import express, { type Request, type Response } from 'express'
import multer from 'multer'
import { AdminNotificationType, AdminStatus, ApplicationStatus, MediaKind, NotificationType, PetGender, PetSpecies, PetStatus, PrismaClient, ProfessionalStatus, ProfessionalType, UserStatus, VerificationPurpose } from '@prisma/client'

const app = express()
const prisma = new PrismaClient()
const port = Number(process.env.PORT ?? 3000)
const sessionCookie = 'pawtrace_session'
const adminSessionCookie = 'pawtrace_admin_session'
const authSecret = process.env.AUTH_SECRET ?? 'pawtrace-local-development-secret'
const sessionLifetimeMs = 30 * 24 * 60 * 60 * 1000
const secureCookie = process.env.COOKIE_SECURE === 'true'
const uploadDirectory = path.resolve(process.env.UPLOAD_DIR ?? './uploads')
mkdirSync(uploadDirectory, { recursive: true })
const notificationStreams = new Map<number, Set<Response>>()
const adminNotificationStreams = new Map<number, Set<Response>>()

function pushNotification(userId: number, notification: unknown) {
  for (const response of notificationStreams.get(userId) ?? []) response.write(`event: notification\ndata: ${JSON.stringify(notification)}\n\n`)
}

function pushAdminNotification(adminUserId: number, notification: unknown) {
  for (const response of adminNotificationStreams.get(adminUserId) ?? []) response.write(`event: notification\ndata: ${JSON.stringify(notification)}\n\n`)
}

const credentialUpload = multer({
  storage: multer.diskStorage({
    destination: uploadDirectory,
    filename: (_request, file, callback) => callback(null, `${Date.now()}-${randomBytes(12).toString('hex')}${path.extname(file.originalname).toLowerCase()}`),
  }),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: (_request, file, callback) => callback(null, ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(file.mimetype)),
})

app.disable('x-powered-by')
app.set('trust proxy', 1)
app.use(cors({ origin: process.env.APP_ORIGIN ?? true, credentials: true }))
app.use(express.json({ limit: '1mb' }))

const hash = (value: string) => createHash('sha256').update(`${authSecret}:${value}`).digest('hex')
const token = () => randomBytes(32).toString('base64url')

function cookies(request: Request) {
  return Object.fromEntries((request.headers.cookie ?? '').split(';').flatMap(item => {
    const separator = item.indexOf('=')
    return separator < 0 ? [] : [[decodeURIComponent(item.slice(0, separator).trim()), decodeURIComponent(item.slice(separator + 1).trim())]]
  }))
}

function setSessionCookie(response: Response, value: string, expires: Date) {
  response.cookie(sessionCookie, value, { httpOnly: true, secure: secureCookie, sameSite: 'lax', path: '/', expires })
}

function clearSessionCookie(response: Response) {
  response.clearCookie(sessionCookie, { httpOnly: true, secure: secureCookie, sameSite: 'lax', path: '/' })
}

function setAdminSessionCookie(response: Response, value: string, expires: Date) {
  response.cookie(adminSessionCookie, value, { httpOnly: true, secure: secureCookie, sameSite: 'lax', path: '/', expires })
}

function clearAdminSessionCookie(response: Response) {
  response.clearCookie(adminSessionCookie, { httpOnly: true, secure: secureCookie, sameSite: 'lax', path: '/' })
}

function sendError(response: Response, status: number, code: string, message: string, fields?: Record<string, string>) {
  return response.status(status).json({ error: { code, message, ...(fields ? { fields } : {}) } })
}

const clientIp = (request: Request) => request.ip?.slice(0, 64) ?? null
const validPhone = (value: unknown): value is string => typeof value === 'string' && /^1[3-9]\d{9}$/.test(value)

async function currentSession(request: Request) {
  const raw = cookies(request)[sessionCookie]
  if (!raw) return null
  return prisma.userSession.findFirst({
    where: { sessionTokenHash: hash(raw), revokedAt: null, expiresAt: { gt: new Date() } },
    include: { user: { include: { profile: true } } },
  })
}

async function currentAdminSession(request: Request) {
  const raw = cookies(request)[adminSessionCookie]
  if (!raw) return null
  return prisma.adminSession.findFirst({
    where: { sessionTokenHash: hash(raw), revokedAt: null, expiresAt: { gt: new Date() }, adminUser: { status: AdminStatus.ACTIVE } },
    include: { adminUser: true },
  })
}

type AdminSessionResult = NonNullable<Awaited<ReturnType<typeof currentAdminSession>>>

function adminCsrfValid(request: Request, session: AdminSessionResult) {
  return hash(request.get('x-csrf-token') ?? '') === session.csrfTokenHash
}

function passwordHash(password: string, salt = randomBytes(16).toString('hex')) {
  return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`
}

function passwordValid(password: string, stored: string) {
  const [salt, expectedHex] = stored.split(':')
  if (!salt || !expectedHex) return false
  const actual = scryptSync(password, salt, 64)
  const expected = Buffer.from(expectedHex, 'hex')
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

type SessionResult = NonNullable<Awaited<ReturnType<typeof currentSession>>>
function publicMe(user: SessionResult['user']) {
  return { id: user.id, status: user.status, profileCompleted: Boolean(user.profile?.profileCompletedAt), nickname: user.profile?.nickname ?? null, avatarUrl: user.profile?.avatarUrl ?? null }
}

function csrfValid(request: Request, session: SessionResult) {
  return hash(request.get('x-csrf-token') ?? '') === session.csrfTokenHash
}

async function requireUploadSession(request: Request, response: Response, next: () => void) {
  const session = await currentSession(request)
  if (!session) { sendError(response, 401, 'UNAUTHENTICATED', '请先登录'); return }
  if (!csrfValid(request, session)) { sendError(response, 403, 'CSRF_INVALID', '安全校验失败，请刷新页面后重试'); return }
  response.locals.session = session
  next()
}

function nullableText(value: unknown, max: number) {
  return typeof value === 'string' ? value.trim().slice(0, max) || null : null
}

function serializePet<T extends { weightKg: unknown }>(pet: T) {
  return { ...pet, weightKg: pet.weightKg == null ? null : Number(pet.weightKg) }
}

function petInput(body: unknown) {
  if (!body || typeof body !== 'object') return null
  const value = body as Record<string, unknown>
  const name = typeof value.name === 'string' ? value.name.trim() : ''
  const species = Object.values(PetSpecies).includes(value.species as PetSpecies) ? value.species as PetSpecies : null
  const gender = Object.values(PetGender).includes(value.gender as PetGender) ? value.gender as PetGender : null
  const weight = value.weightKg === '' || value.weightKg == null ? null : Number(value.weightKg)
  const birthDate = typeof value.birthDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.birthDate) ? new Date(`${value.birthDate}T00:00:00.000Z`) : null
  const ageText = nullableText(value.ageText, 30)
  if (!name || name.length > 50 || !species || !gender || (!birthDate && !ageText) || (weight !== null && (!Number.isFinite(weight) || weight <= 0 || weight > 9999))) return null
  const customSpecies = nullableText(value.customSpecies, 50)
  if (species === PetSpecies.OTHER && !customSpecies) return null
  return {
    name, species, gender, birthDate, ageText, customSpecies: species === PetSpecies.OTHER ? customSpecies : null,
    breed: nullableText(value.breed, 80), weightKg: weight, neutered: typeof value.neutered === 'boolean' ? value.neutered : null,
    allergies: nullableText(value.allergies, 5000), pastDiseases: nullableText(value.pastDiseases, 5000),
    vaccinationInfo: nullableText(value.vaccinationInfo, 5000), dewormingInfo: nullableText(value.dewormingInfo, 5000),
    note: nullableText(value.note, 1000), avatarUrl: nullableText(value.avatarUrl, 500),
  }
}

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

app.get('/api/v1/pets', async (request, response) => {
  const session = await currentSession(request)
  if (!session) return sendError(response, 401, 'UNAUTHENTICATED', '请先登录')
  const pets = await prisma.pet.findMany({ where: { ownerId: session.userId, deletedAt: null }, orderBy: { createdAt: 'desc' } })
  return response.json({ data: pets.map(serializePet) })
})

app.post('/api/v1/pets', async (request, response) => {
  const session = await currentSession(request)
  if (!session) return sendError(response, 401, 'UNAUTHENTICATED', '请先登录')
  if (!csrfValid(request, session)) return sendError(response, 403, 'CSRF_INVALID', '安全校验失败，请刷新页面后重试')
  const data = petInput(request.body)
  if (!data) return sendError(response, 400, 'VALIDATION_ERROR', '请检查宠物名称、种类、性别、年龄和体重')
  const pet = await prisma.pet.create({ data: { ...data, ownerId: session.userId } })
  return response.status(201).json({ data: serializePet(pet) })
})

app.get('/api/v1/pets/:petId', async (request, response) => {
  const session = await currentSession(request)
  if (!session) return sendError(response, 401, 'UNAUTHENTICATED', '请先登录')
  const petId = Number(request.params.petId)
  if (!Number.isInteger(petId)) return sendError(response, 404, 'RESOURCE_NOT_FOUND', '宠物不存在')
  const pet = await prisma.pet.findFirst({ where: { id: petId, ownerId: session.userId, deletedAt: null } })
  return pet ? response.json({ data: serializePet(pet) }) : sendError(response, 404, 'RESOURCE_NOT_FOUND', '宠物不存在')
})

app.patch('/api/v1/pets/:petId', async (request, response) => {
  const session = await currentSession(request)
  if (!session) return sendError(response, 401, 'UNAUTHENTICATED', '请先登录')
  if (!csrfValid(request, session)) return sendError(response, 403, 'CSRF_INVALID', '安全校验失败，请刷新页面后重试')
  const petId = Number(request.params.petId)
  const data = petInput(request.body)
  if (!Number.isInteger(petId) || !data) return sendError(response, 400, 'VALIDATION_ERROR', '宠物资料格式不正确')
  const exists = await prisma.pet.findFirst({ where: { id: petId, ownerId: session.userId, deletedAt: null } })
  if (!exists) return sendError(response, 404, 'RESOURCE_NOT_FOUND', '宠物不存在')
  const pet = await prisma.pet.update({ where: { id: petId }, data })
  return response.json({ data: serializePet(pet) })
})

app.delete('/api/v1/pets/:petId', async (request, response) => {
  const session = await currentSession(request)
  if (!session) return sendError(response, 401, 'UNAUTHENTICATED', '请先登录')
  if (!csrfValid(request, session)) return sendError(response, 403, 'CSRF_INVALID', '安全校验失败，请刷新页面后重试')
  const petId = Number(request.params.petId)
  const exists = Number.isInteger(petId) ? await prisma.pet.findFirst({ where: { id: petId, ownerId: session.userId, deletedAt: null } }) : null
  if (!exists) return sendError(response, 404, 'RESOURCE_NOT_FOUND', '宠物不存在')
  await prisma.pet.update({ where: { id: petId }, data: { status: PetStatus.INACTIVE, deletedAt: new Date() } })
  return response.status(204).send()
})

app.get('/api/v1/pets/:petId/histories', async (request, response) => {
  const session = await currentSession(request)
  if (!session) return sendError(response, 401, 'UNAUTHENTICATED', '请先登录')
  const petId = Number(request.params.petId)
  const pet = Number.isInteger(petId) ? await prisma.pet.findFirst({ where: { id: petId, ownerId: session.userId, deletedAt: null } }) : null
  if (!pet) return sendError(response, 404, 'RESOURCE_NOT_FOUND', '宠物不存在')
  const histories = await prisma.petMedicalHistory.findMany({ where: { petId, recordedByUserId: session.userId, deletedAt: null }, orderBy: [{ recordDate: 'desc' }, { id: 'desc' }] })
  return response.json({ data: histories })
})

app.post('/api/v1/pets/:petId/histories', async (request, response) => {
  const session = await currentSession(request)
  if (!session) return sendError(response, 401, 'UNAUTHENTICATED', '请先登录')
  if (!csrfValid(request, session)) return sendError(response, 403, 'CSRF_INVALID', '安全校验失败，请刷新页面后重试')
  const petId = Number(request.params.petId)
  const pet = Number.isInteger(petId) ? await prisma.pet.findFirst({ where: { id: petId, ownerId: session.userId, deletedAt: null } }) : null
  if (!pet) return sendError(response, 404, 'RESOURCE_NOT_FOUND', '宠物不存在')
  const recordDate = typeof request.body?.recordDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(request.body.recordDate) ? new Date(`${request.body.recordDate}T00:00:00.000Z`) : null
  const title = nullableText(request.body?.title, 150)
  const description = nullableText(request.body?.description, 10000)
  if (!recordDate || !title || !description) return sendError(response, 400, 'VALIDATION_ERROR', '记录日期、标题和情况描述为必填项')
  const history = await prisma.petMedicalHistory.create({ data: {
    petId, recordedByUserId: session.userId, recordDate, title, description,
    hospitalName: nullableText(request.body.hospitalName, 150), doctorName: nullableText(request.body.doctorName, 80),
    examinationResult: nullableText(request.body.examinationResult, 10000), treatment: nullableText(request.body.treatment, 10000), note: nullableText(request.body.note, 10000),
  } })
  return response.status(201).json({ data: history })
})

app.post('/api/v1/media/credentials', requireUploadSession, credentialUpload.single('file'), async (request, response) => {
  const session = response.locals.session as SessionResult
  if (!request.file) return sendError(response, 400, 'VALIDATION_ERROR', '请选择 JPG、PNG、WebP 或 PDF 证明材料')
  const media = await prisma.mediaAsset.create({ data: {
    uploaderId: session.userId,
    kind: request.file.mimetype === 'application/pdf' ? MediaKind.DOCUMENT : MediaKind.IMAGE,
    storageKey: request.file.filename,
    originalName: request.file.originalname.slice(0, 255),
    mimeType: request.file.mimetype,
    sizeBytes: request.file.size,
  } })
  return response.status(201).json({ data: { id: media.id, originalName: media.originalName, mimeType: media.mimeType, sizeBytes: Number(media.sizeBytes) } })
})

app.get('/api/v1/media/:mediaId/access', async (request, response) => {
  const session = await currentSession(request)
  if (!session) return sendError(response, 401, 'UNAUTHENTICATED', '请先登录')
  const mediaId = Number(request.params.mediaId)
  const media = Number.isInteger(mediaId) ? await prisma.mediaAsset.findFirst({ where: { id: mediaId, uploaderId: session.userId, deletedAt: null } }) : null
  if (!media) return sendError(response, 404, 'RESOURCE_NOT_FOUND', '文件不存在')
  response.type(media.mimeType)
  response.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(media.originalName)}`)
  return response.sendFile(path.join(uploadDirectory, media.storageKey))
})

app.get('/api/v1/me/professional-profile', async (request, response) => {
  const session = await currentSession(request)
  if (!session) return sendError(response, 401, 'UNAUTHENTICATED', '请先登录')
  const [profile, application] = await Promise.all([
    prisma.professionalProfile.findUnique({ where: { userId: session.userId } }),
    prisma.professionalApplication.findFirst({ where: { userId: session.userId }, orderBy: { createdAt: 'desc' }, include: { credentialMedia: { select: { id: true, originalName: true, mimeType: true } } } }),
  ])
  return response.json({ data: { profile, application } })
})

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

app.post('/api/v1/professional-applications', async (request, response) => {
  const session = await currentSession(request)
  if (!session) return sendError(response, 401, 'UNAUTHENTICATED', '请先登录')
  if (!csrfValid(request, session)) return sendError(response, 403, 'CSRF_INVALID', '安全校验失败，请刷新页面后重试')
  const pending = await prisma.professionalApplication.findFirst({ where: { userId: session.userId, status: ApplicationStatus.PENDING } })
  if (pending) return sendError(response, 409, 'APPLICATION_PENDING', '已有审核中的申请，请勿重复提交')
  const requestedType = Object.values(ProfessionalType).includes(request.body?.requestedType as ProfessionalType) ? request.body.requestedType as ProfessionalType : null
  const realName = nullableText(request.body?.realName, 80)
  const displayName = nullableText(request.body?.displayName, 80)
  const organization = nullableText(request.body?.organization, 150)
  const yearsOfPractice = Number(request.body?.yearsOfPractice)
  const specialties = Array.isArray(request.body?.specialties) ? request.body.specialties.filter((item: unknown) => typeof item === 'string' && item.trim()).map((item: string) => item.trim().slice(0, 40)).slice(0, 10) : []
  const credentialMediaId = Number(request.body?.credentialMediaId)
  if (!requestedType || !realName || !displayName || !organization || !Number.isInteger(yearsOfPractice) || yearsOfPractice < 0 || yearsOfPractice > 80 || specialties.length === 0 || !Number.isInteger(credentialMediaId)) return sendError(response, 400, 'VALIDATION_ERROR', '请完整填写认证资料、擅长领域和证明材料')
  const credential = await prisma.mediaAsset.findFirst({ where: { id: credentialMediaId, uploaderId: session.userId, deletedAt: null } })
  if (!credential) return sendError(response, 400, 'INVALID_CREDENTIAL_MEDIA', '证明材料不存在或不属于当前用户')
  const application = await prisma.professionalApplication.create({ data: {
    userId: session.userId, requestedType, realName, displayName, organization, yearsOfPractice, specialties,
    introduction: nullableText(request.body?.introduction, 1000), credentialMediaId,
  } })
  const admins = await prisma.adminUser.findMany({ where: { status: AdminStatus.ACTIVE }, select: { id: true } })
  const adminNotifications = await Promise.all(admins.map(admin => prisma.adminNotification.create({ data: { adminUserId: admin.id, type: AdminNotificationType.PROFESSIONAL_APPLICATION_SUBMITTED, title: '新的专业认证申请', content: `${displayName}提交了${requestedType === ProfessionalType.VETERINARIAN ? '宠物医生' : '医生助理'}认证申请，请及时审核。`, link: '/admin#applications' } })))
  adminNotifications.forEach(notification => pushAdminNotification(notification.adminUserId, notification))
  return response.status(201).json({ data: application })
})

app.post('/api/v1/professional-applications/:applicationId/cancel', async (request, response) => {
  const session = await currentSession(request)
  if (!session) return sendError(response, 401, 'UNAUTHENTICATED', '请先登录')
  if (!csrfValid(request, session)) return sendError(response, 403, 'CSRF_INVALID', '安全校验失败，请刷新页面后重试')
  const applicationId = Number(request.params.applicationId)
  const application = Number.isInteger(applicationId) ? await prisma.professionalApplication.findFirst({ where: { id: applicationId, userId: session.userId, status: ApplicationStatus.PENDING } }) : null
  if (!application) return sendError(response, 404, 'RESOURCE_NOT_FOUND', '待审核申请不存在')
  await prisma.professionalApplication.update({ where: { id: application.id }, data: { status: ApplicationStatus.CANCELLED } })
  return response.status(204).send()
})

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

const applicationInclude = {
  user: { select: { id: true, phoneNumber: true, profile: { select: { nickname: true } } } },
  credentialMedia: { select: { id: true, originalName: true, mimeType: true, sizeBytes: true } },
  reviewedBy: { select: { displayName: true } },
} as const

function serializeApplication<T extends { credentialMedia: { sizeBytes: bigint } }>(application: T) {
  return { ...application, credentialMedia: { ...application.credentialMedia, sizeBytes: Number(application.credentialMedia.sizeBytes) } }
}

app.get('/api/v1/admin/professional-applications', async (request, response) => {
  const session = await currentAdminSession(request)
  if (!session) return sendError(response, 401, 'UNAUTHENTICATED', '请先登录管理端')
  const requestedStatus = typeof request.query.status === 'string' ? request.query.status : ApplicationStatus.PENDING
  const status = Object.values(ApplicationStatus).includes(requestedStatus as ApplicationStatus) ? requestedStatus as ApplicationStatus : ApplicationStatus.PENDING
  const applications = await prisma.professionalApplication.findMany({ where: { status }, include: applicationInclude, orderBy: { submittedAt: 'asc' }, take: 100 })
  return response.json({ data: applications.map(serializeApplication) })
})

app.get('/api/v1/admin/professional-applications/:applicationId', async (request, response) => {
  const session = await currentAdminSession(request)
  if (!session) return sendError(response, 401, 'UNAUTHENTICATED', '请先登录管理端')
  const applicationId = Number(request.params.applicationId)
  const application = Number.isInteger(applicationId) ? await prisma.professionalApplication.findUnique({ where: { id: applicationId }, include: applicationInclude }) : null
  if (!application) return sendError(response, 404, 'RESOURCE_NOT_FOUND', '认证申请不存在')
  return response.json({ data: serializeApplication(application) })
})

app.get('/api/v1/admin/media/:mediaId/access', async (request, response) => {
  const session = await currentAdminSession(request)
  if (!session) return sendError(response, 401, 'UNAUTHENTICATED', '请先登录管理端')
  const mediaId = Number(request.params.mediaId)
  const media = Number.isInteger(mediaId) ? await prisma.mediaAsset.findFirst({ where: { id: mediaId, deletedAt: null, applications: { some: {} } } }) : null
  if (!media) return sendError(response, 404, 'RESOURCE_NOT_FOUND', '证明材料不存在')
  response.type(media.mimeType)
  response.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(media.originalName)}`)
  return response.sendFile(path.join(uploadDirectory, media.storageKey))
})

app.post('/api/v1/admin/professional-applications/:applicationId/review', async (request, response) => {
  const session = await currentAdminSession(request)
  if (!session) return sendError(response, 401, 'UNAUTHENTICATED', '请先登录管理端')
  if (!adminCsrfValid(request, session)) return sendError(response, 403, 'CSRF_INVALID', '安全校验失败，请刷新页面后重试')
  const applicationId = Number(request.params.applicationId)
  const decision = request.body?.decision === 'APPROVE' || request.body?.decision === 'REJECT' ? request.body.decision as 'APPROVE' | 'REJECT' : null
  const reviewNote = nullableText(request.body?.reviewNote, 500)
  if (!Number.isInteger(applicationId) || !decision || (decision === 'REJECT' && !reviewNote)) return sendError(response, 400, 'VALIDATION_ERROR', '请选择审核结果；驳回时必须填写原因')
  const application = await prisma.professionalApplication.findUnique({ where: { id: applicationId } })
  if (!application) return sendError(response, 404, 'RESOURCE_NOT_FOUND', '认证申请不存在')
  if (application.status !== ApplicationStatus.PENDING) return sendError(response, 409, 'APPLICATION_REVIEWED', '该申请已经处理，不能重复审核')
  const reviewedAt = new Date()
  const specialties = Array.isArray(application.specialties) ? application.specialties.filter((item): item is string => typeof item === 'string') : []
  const notification = await prisma.$transaction(async transaction => {
    await transaction.professionalApplication.update({ where: { id: application.id }, data: { status: decision === 'APPROVE' ? ApplicationStatus.APPROVED : ApplicationStatus.REJECTED, reviewNote, reviewedAt, reviewedByAdminId: session.adminUserId } })
    if (decision === 'APPROVE') {
      await transaction.professionalProfile.upsert({
        where: { userId: application.userId },
        create: { userId: application.userId, type: application.requestedType, status: ProfessionalStatus.APPROVED, realName: application.realName, displayName: application.displayName, organization: application.organization, yearsOfPractice: application.yearsOfPractice, specialties, introduction: application.introduction, approvedAt: reviewedAt },
        update: { type: application.requestedType, status: ProfessionalStatus.APPROVED, realName: application.realName, displayName: application.displayName, organization: application.organization, yearsOfPractice: application.yearsOfPractice, specialties, introduction: application.introduction, approvedAt: reviewedAt, revokedAt: null },
      })
    }
    await transaction.adminAuditLog.create({ data: { adminUserId: session.adminUserId, action: decision === 'APPROVE' ? 'PROFESSIONAL_APPLICATION_APPROVED' : 'PROFESSIONAL_APPLICATION_REJECTED', targetType: 'ProfessionalApplication', targetId: application.id, reason: reviewNote, metadata: { requestedType: application.requestedType, userId: application.userId } } })
    const identityName = application.requestedType === ProfessionalType.VETERINARIAN ? '宠物医生' : '医生助理'
    return transaction.userNotification.create({ data: {
      userId: application.userId,
      type: decision === 'APPROVE' ? NotificationType.PROFESSIONAL_APPLICATION_APPROVED : NotificationType.PROFESSIONAL_APPLICATION_REJECTED,
      title: decision === 'APPROVE' ? `${identityName}认证已通过` : `${identityName}认证未通过`,
      content: decision === 'APPROVE' ? `你的${identityName}身份已经生效，可以使用对应的专业功能。` : `审核意见：${reviewNote}`,
      link: '/?view=professional',
    } })
  })
  pushNotification(application.userId, notification)
  return response.json({ data: { id: application.id, status: decision === 'APPROVE' ? ApplicationStatus.APPROVED : ApplicationStatus.REJECTED } })
})

app.get('/api/v1/admin/dashboard', async (request, response) => {
  const session = await currentAdminSession(request)
  if (!session) return sendError(response, 401, 'UNAUTHENTICATED', '请先登录管理端')
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const [pendingApplications, approvedProfessionals, revokedProfessionals, todayActions] = await Promise.all([
    prisma.professionalApplication.count({ where: { status: ApplicationStatus.PENDING } }),
    prisma.professionalProfile.count({ where: { status: ProfessionalStatus.APPROVED } }),
    prisma.professionalProfile.count({ where: { status: ProfessionalStatus.REVOKED } }),
    prisma.adminAuditLog.count({ where: { createdAt: { gte: today } } }),
  ])
  return response.json({ data: { pendingApplications, approvedProfessionals, revokedProfessionals, todayActions } })
})

app.get('/api/v1/admin/professionals', async (request, response) => {
  const session = await currentAdminSession(request)
  if (!session) return sendError(response, 401, 'UNAUTHENTICATED', '请先登录管理端')
  const requestedStatus = typeof request.query.status === 'string' ? request.query.status : ProfessionalStatus.APPROVED
  const status = requestedStatus === ProfessionalStatus.REVOKED ? ProfessionalStatus.REVOKED : ProfessionalStatus.APPROVED
  const professionals = await prisma.professionalProfile.findMany({
    where: { status }, orderBy: { updatedAt: 'desc' }, take: 100,
    include: { user: { select: { id: true, phoneNumber: true, profile: { select: { nickname: true } }, applications: { select: { id: true, requestedType: true, status: true, submittedAt: true, reviewedAt: true, reviewNote: true }, orderBy: { createdAt: 'desc' } } } } },
  })
  return response.json({ data: professionals.map(item => ({ ...item, user: { ...item.user, phoneNumber: item.user.phoneNumber.replace(/^(\d{3})\d{4}(\d{4})$/, '$1****$2') } })) })
})

app.post('/api/v1/admin/professionals/:userId/status', async (request, response) => {
  const session = await currentAdminSession(request)
  if (!session) return sendError(response, 401, 'UNAUTHENTICATED', '请先登录管理端')
  if (!adminCsrfValid(request, session)) return sendError(response, 403, 'CSRF_INVALID', '安全校验失败，请刷新页面后重试')
  const userId = Number(request.params.userId)
  const action = request.body?.action === 'REVOKE' || request.body?.action === 'RESTORE' ? request.body.action as 'REVOKE' | 'RESTORE' : null
  const reason = nullableText(request.body?.reason, 1000)
  if (!Number.isInteger(userId) || !action || !reason) return sendError(response, 400, 'VALIDATION_ERROR', '请选择操作并填写原因')
  const profile = await prisma.professionalProfile.findUnique({ where: { userId } })
  if (!profile) return sendError(response, 404, 'RESOURCE_NOT_FOUND', '专业身份不存在')
  const expected = action === 'REVOKE' ? ProfessionalStatus.APPROVED : ProfessionalStatus.REVOKED
  if (profile.status !== expected) return sendError(response, 409, 'STATUS_CONFLICT', '当前身份状态不允许执行该操作')
  const identityName = profile.type === ProfessionalType.VETERINARIAN ? '宠物医生' : '医生助理'
  const notification = await prisma.$transaction(async transaction => {
    await transaction.professionalProfile.update({ where: { userId }, data: action === 'REVOKE' ? { status: ProfessionalStatus.REVOKED, revokedAt: new Date() } : { status: ProfessionalStatus.APPROVED, revokedAt: null } })
    if (action === 'REVOKE') await transaction.professionalApplication.updateMany({ where: { userId, status: ApplicationStatus.PENDING }, data: { status: ApplicationStatus.CANCELLED, reviewedAt: new Date(), reviewNote: '当前专业身份已被管理员撤销，待审核申请同步取消', reviewedByAdminId: session.adminUserId } })
    await transaction.adminAuditLog.create({ data: { adminUserId: session.adminUserId, action: action === 'REVOKE' ? 'PROFESSIONAL_IDENTITY_REVOKED' : 'PROFESSIONAL_IDENTITY_RESTORED', targetType: 'ProfessionalProfile', targetId: profile.id, reason, metadata: { userId, professionalType: profile.type } } })
    return transaction.userNotification.create({ data: { userId, type: action === 'REVOKE' ? NotificationType.PROFESSIONAL_IDENTITY_REVOKED : NotificationType.PROFESSIONAL_IDENTITY_RESTORED, title: action === 'REVOKE' ? `${identityName}身份已撤销` : `${identityName}身份已恢复`, content: action === 'REVOKE' ? `你的专业身份已被撤销。原因：${reason}` : `你的专业身份已恢复。说明：${reason}`, link: '/?view=professional' } })
  })
  pushNotification(userId, notification)
  return response.json({ data: { userId, status: action === 'REVOKE' ? ProfessionalStatus.REVOKED : ProfessionalStatus.APPROVED } })
})

app.get('/api/v1/admin/audit-logs', async (request, response) => {
  const session = await currentAdminSession(request)
  if (!session) return sendError(response, 401, 'UNAUTHENTICATED', '请先登录管理端')
  const logs = await prisma.adminAuditLog.findMany({ include: { adminUser: { select: { displayName: true } } }, orderBy: { createdAt: 'desc' }, take: 100 })
  return response.json({ data: logs })
})

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
