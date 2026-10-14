import path from 'node:path'
import { app, prisma, uploadDirectory, credentialUpload, sendError, currentSession, requireUploadSession, type SessionResult, MediaKind } from '../context.js'

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

