import { app, prisma, sendError, currentSession, csrfValid, nullableText, serializePet, petInput, PetStatus } from '../context.js'

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

