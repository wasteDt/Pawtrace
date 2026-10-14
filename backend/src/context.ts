import 'dotenv/config'
import { createHash, randomBytes, randomInt, scryptSync, timingSafeEqual } from 'node:crypto'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import cors from 'cors'
import express, { type Request, type Response } from 'express'
import multer from 'multer'
import { AdminNotificationType, AdminStatus, ApplicationStatus, MediaKind, NotificationType, PetGender, PetSpecies, PetStatus, PrismaClient, ProfessionalStatus, ProfessionalType, UserStatus, VerificationPurpose } from '@prisma/client'

export const app = express()
export const prisma = new PrismaClient()
export const port = Number(process.env.PORT ?? 3000)
export const sessionCookie = 'pawtrace_session'
export const adminSessionCookie = 'pawtrace_admin_session'
export const authSecret = process.env.AUTH_SECRET ?? 'pawtrace-local-development-secret'
export const sessionLifetimeMs = 30 * 24 * 60 * 60 * 1000
export const secureCookie = process.env.COOKIE_SECURE === 'true'
export const uploadDirectory = path.resolve(process.env.UPLOAD_DIR ?? './uploads')
mkdirSync(uploadDirectory, { recursive: true })
export const notificationStreams = new Map<number, Set<Response>>()
export const adminNotificationStreams = new Map<number, Set<Response>>()

export function pushNotification(userId: number, notification: unknown) {
  for (const response of notificationStreams.get(userId) ?? []) response.write(`event: notification\ndata: ${JSON.stringify(notification)}\n\n`)
}

export function pushAdminNotification(adminUserId: number, notification: unknown) {
  for (const response of adminNotificationStreams.get(adminUserId) ?? []) response.write(`event: notification\ndata: ${JSON.stringify(notification)}\n\n`)
}

export const credentialUpload = multer({
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

export const hash = (value: string) => createHash('sha256').update(`${authSecret}:${value}`).digest('hex')
export const token = () => randomBytes(32).toString('base64url')

export function cookies(request: Request) {
  return Object.fromEntries((request.headers.cookie ?? '').split(';').flatMap(item => {
    const separator = item.indexOf('=')
    return separator < 0 ? [] : [[decodeURIComponent(item.slice(0, separator).trim()), decodeURIComponent(item.slice(separator + 1).trim())]]
  }))
}

export function setSessionCookie(response: Response, value: string, expires: Date) {
  response.cookie(sessionCookie, value, { httpOnly: true, secure: secureCookie, sameSite: 'lax', path: '/', expires })
}

export function clearSessionCookie(response: Response) {
  response.clearCookie(sessionCookie, { httpOnly: true, secure: secureCookie, sameSite: 'lax', path: '/' })
}

export function setAdminSessionCookie(response: Response, value: string, expires: Date) {
  response.cookie(adminSessionCookie, value, { httpOnly: true, secure: secureCookie, sameSite: 'lax', path: '/', expires })
}

export function clearAdminSessionCookie(response: Response) {
  response.clearCookie(adminSessionCookie, { httpOnly: true, secure: secureCookie, sameSite: 'lax', path: '/' })
}

export function sendError(response: Response, status: number, code: string, message: string, fields?: Record<string, string>) {
  return response.status(status).json({ error: { code, message, ...(fields ? { fields } : {}) } })
}

export const clientIp = (request: Request) => request.ip?.slice(0, 64) ?? null
export const validPhone = (value: unknown): value is string => typeof value === 'string' && /^1[3-9]\d{9}$/.test(value)

export async function currentSession(request: Request) {
  const raw = cookies(request)[sessionCookie]
  if (!raw) return null
  return prisma.userSession.findFirst({
    where: { sessionTokenHash: hash(raw), revokedAt: null, expiresAt: { gt: new Date() } },
    include: { user: { include: { profile: true } } },
  })
}

export async function currentAdminSession(request: Request) {
  const raw = cookies(request)[adminSessionCookie]
  if (!raw) return null
  return prisma.adminSession.findFirst({
    where: { sessionTokenHash: hash(raw), revokedAt: null, expiresAt: { gt: new Date() }, adminUser: { status: AdminStatus.ACTIVE } },
    include: { adminUser: true },
  })
}

export type AdminSessionResult = NonNullable<Awaited<ReturnType<typeof currentAdminSession>>>

export function adminCsrfValid(request: Request, session: AdminSessionResult) {
  return hash(request.get('x-csrf-token') ?? '') === session.csrfTokenHash
}

export function passwordHash(password: string, salt = randomBytes(16).toString('hex')) {
  return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`
}

export function passwordValid(password: string, stored: string) {
  const [salt, expectedHex] = stored.split(':')
  if (!salt || !expectedHex) return false
  const actual = scryptSync(password, salt, 64)
  const expected = Buffer.from(expectedHex, 'hex')
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

export type SessionResult = NonNullable<Awaited<ReturnType<typeof currentSession>>>
export function publicMe(user: SessionResult['user']) {
  return { id: user.id, status: user.status, profileCompleted: Boolean(user.profile?.profileCompletedAt), nickname: user.profile?.nickname ?? null, avatarUrl: user.profile?.avatarUrl ?? null }
}

export function csrfValid(request: Request, session: SessionResult) {
  return hash(request.get('x-csrf-token') ?? '') === session.csrfTokenHash
}

export async function requireUploadSession(request: Request, response: Response, next: () => void) {
  const session = await currentSession(request)
  if (!session) { sendError(response, 401, 'UNAUTHENTICATED', '请先登录'); return }
  if (!csrfValid(request, session)) { sendError(response, 403, 'CSRF_INVALID', '安全校验失败，请刷新页面后重试'); return }
  response.locals.session = session
  next()
}

export function nullableText(value: unknown, max: number) {
  return typeof value === 'string' ? value.trim().slice(0, max) || null : null
}

export function serializePet<T extends { weightKg: unknown }>(pet: T) {
  return { ...pet, weightKg: pet.weightKg == null ? null : Number(pet.weightKg) }
}

export function petInput(body: unknown) {
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


export { AdminNotificationType, AdminStatus, ApplicationStatus, MediaKind, NotificationType, PetGender, PetSpecies, PetStatus, ProfessionalStatus, ProfessionalType, UserStatus, VerificationPurpose } from '@prisma/client'
