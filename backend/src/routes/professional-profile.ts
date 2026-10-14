import { app, prisma, sendError, currentSession } from '../context.js'

app.get('/api/v1/me/professional-profile', async (request, response) => {
  const session = await currentSession(request)
  if (!session) return sendError(response, 401, 'UNAUTHENTICATED', '请先登录')
  const [profile, application] = await Promise.all([
    prisma.professionalProfile.findUnique({ where: { userId: session.userId } }),
    prisma.professionalApplication.findFirst({ where: { userId: session.userId }, orderBy: { createdAt: 'desc' }, include: { credentialMedia: { select: { id: true, originalName: true, mimeType: true } } } }),
  ])
  return response.json({ data: { profile, application } })
})

