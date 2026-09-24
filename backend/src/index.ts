import 'dotenv/config'
import cors from 'cors'
import express from 'express'
import { PrismaClient } from '@prisma/client'

const app = express()
const prisma = new PrismaClient()
const port = Number(process.env.PORT ?? 3000)

app.disable('x-powered-by')
app.use(cors())
app.use(express.json())

type PetInput = {
  name: string
  species: string
  breed: string
  gender: string
  age: number
  weight: number
  status: string
  note: string
}

function parsePetInput(body: unknown): { data?: PetInput; error?: string } {
  if (!body || typeof body !== 'object') return { error: '请求内容格式错误' }
  const input = body as Record<string, unknown>
  const text = (key: string) => typeof input[key] === 'string' ? input[key].trim() : ''
  const data = {
    name: text('name'),
    species: text('species'),
    breed: text('breed'),
    gender: text('gender'),
    age: Number(input.age),
    weight: Number(input.weight),
    status: text('status'),
    note: text('note'),
  }

  if (!data.name || !data.species || !data.breed || !data.gender || !data.status || !data.note) {
    return { error: '请填写所有宠物信息' }
  }
  if (!Number.isInteger(data.age) || data.age < 0 || data.age > 100) {
    return { error: '年龄必须是 0 到 100 之间的整数' }
  }
  if (!Number.isFinite(data.weight) || data.weight <= 0 || data.weight > 999) {
    return { error: '体重必须是 0 到 999 之间的数字' }
  }
  return { data }
}

function parseId(value: string): number | null {
  const id = Number(value)
  return Number.isInteger(id) && id > 0 ? id : null
}

function serializePet<T extends { weight: unknown }>(pet: T) {
  return { ...pet, weight: Number(pet.weight) }
}

app.get('/api/health', async (_request, response) => {
  try {
    await prisma.$queryRaw`SELECT 1`
    response.json({ status: 'ok', database: 'connected', timestamp: new Date().toISOString() })
  } catch (error) {
    console.error('Health check failed:', error)
    response.status(503).json({ status: 'error', database: 'disconnected', timestamp: new Date().toISOString() })
  }
})

app.get('/api/pets', async (_request, response) => {
  try {
    const pets = await prisma.pet.findMany({ orderBy: { id: 'asc' } })
    response.json(pets.map(serializePet))
  } catch (error) {
    console.error('Unable to load pets:', error)
    response.status(500).json({ message: '宠物数据读取失败' })
  }
})

app.post('/api/pets', async (request, response) => {
  const parsed = parsePetInput(request.body)
  if (!parsed.data) return response.status(400).json({ message: parsed.error })

  try {
    const pet = await prisma.pet.create({ data: parsed.data })
    return response.status(201).json(serializePet(pet))
  } catch (error) {
    console.error('Unable to create pet:', error)
    return response.status(500).json({ message: '宠物新增失败' })
  }
})

app.put('/api/pets/:id', async (request, response) => {
  const id = parseId(request.params.id)
  if (!id) return response.status(400).json({ message: '宠物 ID 格式错误' })
  const parsed = parsePetInput(request.body)
  if (!parsed.data) return response.status(400).json({ message: parsed.error })

  try {
    const exists = await prisma.pet.findUnique({ where: { id } })
    if (!exists) return response.status(404).json({ message: '宠物不存在' })
    const pet = await prisma.pet.update({ where: { id }, data: parsed.data })
    return response.json(serializePet(pet))
  } catch (error) {
    console.error('Unable to update pet:', error)
    return response.status(500).json({ message: '宠物编辑失败' })
  }
})

app.delete('/api/pets/:id', async (request, response) => {
  const id = parseId(request.params.id)
  if (!id) return response.status(400).json({ message: '宠物 ID 格式错误' })

  try {
    const result = await prisma.pet.deleteMany({ where: { id } })
    if (result.count === 0) return response.status(404).json({ message: '宠物不存在' })
    return response.status(204).send()
  } catch (error) {
    console.error('Unable to delete pet:', error)
    return response.status(500).json({ message: '宠物删除失败' })
  }
})

const server = app.listen(port, '0.0.0.0', () => {
  console.log(`Pawtrace API listening on port ${port}`)
})

async function shutdown(signal: string) {
  console.log(`${signal} received, shutting down`)
  server.close(async () => {
    await prisma.$disconnect()
    process.exit(0)
  })
}

process.on('SIGTERM', () => void shutdown('SIGTERM'))
process.on('SIGINT', () => void shutdown('SIGINT'))
