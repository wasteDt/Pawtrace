import path from 'node:path'
import { app, prisma, uploadDirectory, pushNotification, sendError, currentAdminSession, adminCsrfValid, nullableText, ApplicationStatus, NotificationType, ProfessionalStatus, ProfessionalType } from '../context.js'

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

