import 'dotenv/config'
import { createHash, randomBytes, randomInt } from 'node:crypto'
import cors from 'cors'
import express, { type Request, type Response } from 'express'
import { PetGender, PetSpecies, PetStatus, PrismaClient, UserStatus, VerificationPurpose } from '@prisma/client'

const app = express()
const prisma = new PrismaClient()
const port = Number(process.env.PORT ?? 3000)
const sessionCookie = 'pawtrace_session'
const authSecret = process.env.AUTH_SECRET ?? 'pawtrace-local-development-secret'
const sessionLifetimeMs = 30 * 24 * 60 * 60 * 1000
const secureCookie = process.env.COOKIE_SECURE === 'true'

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

type SessionResult = NonNullable<Awaited<ReturnType<typeof currentSession>>>
function publicMe(user: SessionResult['user']) {
  return { id: user.id, status: user.status, profileCompleted: Boolean(user.profile?.profileCompletedAt), nickname: user.profile?.nickname ?? null, avatarUrl: user.profile?.avatarUrl ?? null }
}

function csrfValid(request: Request, session: SessionResult) {
  return hash(request.get('x-csrf-token') ?? '') === session.csrfTokenHash
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

app.use('/api', (_request, response) => sendError(response, 404, 'RESOURCE_NOT_FOUND', '接口不存在'))
app.use((cause: unknown, _request: Request, response: Response, _next: unknown) => {
  console.error('Unhandled request error', cause)
  if (!response.headersSent) sendError(response, 500, 'INTERNAL_ERROR', '服务暂时不可用，请稍后重试')
})

const server = app.listen(port, '0.0.0.0', () => console.log(`Pawtrace API listening on port ${port}`))
async function shutdown(signal: string) {
  console.log(`${signal} received, shutting down`)
  server.close(async () => { await prisma.$disconnect(); process.exit(0) })
}
process.on('SIGTERM', () => void shutdown('SIGTERM'))
process.on('SIGINT', () => void shutdown('SIGINT'))
