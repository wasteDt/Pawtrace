import { app, prisma, pushAdminNotification, sendError, currentSession, csrfValid, nullableText, AdminNotificationType, AdminStatus, ApplicationStatus, ProfessionalType } from '../context.js'

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

