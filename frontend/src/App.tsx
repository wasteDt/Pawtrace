import { FormEvent, useEffect, useState } from 'react'

type Pet = {
  id: number
  name: string
  species: string
  breed: string
  gender: string
  age: number
  weight: number
  status: string
  note: string
}

type PetDraft = Omit<Pet, 'id'>

const emptyPet: PetDraft = {
  name: '', species: '狗狗', breed: '', gender: '公',
  age: 1, weight: 1, status: '健康', note: '',
}

const petEmoji: Record<string, string> = { 狗狗: '🐕', 猫咪: '🐈', 兔子: '🐇' }

export default function App() {
  const [pets, setPets] = useState<Pet[]>([])
  const [draft, setDraft] = useState<PetDraft>(emptyPet)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function loadPets() {
    setError('')
    const response = await fetch('/api/pets')
    if (!response.ok) throw new Error('宠物数据读取失败')
    setPets(await response.json() as Pet[])
  }

  useEffect(() => {
    loadPets().catch(reason => setError(reason instanceof Error ? reason.message : '未知错误'))
      .finally(() => setLoading(false))
  }, [])

  function openCreate() {
    setDraft(emptyPet)
    setEditingId(null)
    setError('')
    setFormOpen(true)
  }

  function openEdit(pet: Pet) {
    const { id, ...values } = pet
    setDraft(values)
    setEditingId(id)
    setError('')
    setFormOpen(true)
  }

  function updateField<K extends keyof PetDraft>(key: K, value: PetDraft[K]) {
    setDraft(current => ({ ...current, [key]: value }))
  }

  async function submitPet(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      const response = await fetch(editingId ? `/api/pets/${editingId}` : '/api/pets', {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      })
      const result = await response.json() as Pet | { message?: string }
      if (!response.ok) throw new Error('message' in result ? result.message : '保存失败')
      await loadPets()
      setFormOpen(false)
      setMessage(editingId ? '宠物资料已更新' : '宠物已新增')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  async function removePet(pet: Pet) {
    if (!window.confirm(`确定删除“${pet.name}”吗？此操作会直接删除数据库记录。`)) return
    setError('')
    try {
      const response = await fetch(`/api/pets/${pet.id}`, { method: 'DELETE' })
      if (!response.ok) {
        const result = await response.json() as { message?: string }
        throw new Error(result.message ?? '删除失败')
      }
      setPets(current => current.filter(item => item.id !== pet.id))
      setMessage(`已删除宠物“${pet.name}”`)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '删除失败')
    }
  }

  return (
    <main className="page">
      <header className="hero">
        <div>
          <p className="eyebrow">PAWTRACE · MYSQL CRUD DEMO</p>
          <h1>我的宠物档案</h1>
          <p className="intro">页面上的新增、编辑和删除都会直接同步到 MySQL。</p>
        </div>
        <div className="hero-actions">
          <div className="summary"><strong>{pets.length}</strong><span>只宠物</span></div>
          <button className="primary" onClick={openCreate}>＋ 新增宠物</button>
        </div>
      </header>

      {message && <div className="notice success-notice">{message}<button onClick={() => setMessage('')}>×</button></div>}
      {error && <div className="notice error-notice">{error}<button onClick={() => setError('')}>×</button></div>}
      {loading && <p className="message">正在读取宠物数据…</p>}

      <section className="pet-grid" aria-label="宠物列表">
        {pets.map((pet, index) => (
          <article className="pet-card" key={pet.id}>
            <div className="card-top">
              <div className={`pet-avatar avatar-${index % 4}`}>{petEmoji[pet.species] ?? '🐾'}</div>
              <div className="card-actions">
                <button className="icon-button" onClick={() => openEdit(pet)}>编辑</button>
                <button className="icon-button danger" onClick={() => void removePet(pet)}>删除</button>
              </div>
            </div>
            <div className="pet-heading">
              <div><p className="species">{pet.species} · {pet.breed}</p><h2>{pet.name}</h2></div>
              <span className={`badge ${pet.status === '健康' ? 'healthy' : pet.status === '需复诊' ? 'review' : 'watch'}`}>{pet.status}</span>
            </div>
            <dl className="facts">
              <div><dt>性别</dt><dd>{pet.gender}</dd></div>
              <div><dt>年龄</dt><dd>{pet.age} 岁</dd></div>
              <div><dt>体重</dt><dd>{pet.weight} kg</dd></div>
            </dl>
            <p className="note">{pet.note}</p>
          </article>
        ))}
      </section>

      {formOpen && (
        <div className="modal-backdrop" onMouseDown={event => event.target === event.currentTarget && setFormOpen(false)}>
          <section className="modal" role="dialog" aria-modal="true" aria-labelledby="form-title">
            <div className="modal-head">
              <div><p className="eyebrow">PET PROFILE</p><h3 id="form-title">{editingId ? '编辑宠物' : '新增宠物'}</h3></div>
              <button className="close-button" onClick={() => setFormOpen(false)} aria-label="关闭">×</button>
            </div>
            <form onSubmit={event => void submitPet(event)}>
              <div className="form-grid">
                <label>昵称<input required maxLength={50} value={draft.name} onChange={e => updateField('name', e.target.value)} /></label>
                <label>种类<select value={draft.species} onChange={e => updateField('species', e.target.value)}><option>狗狗</option><option>猫咪</option><option>兔子</option><option>其他</option></select></label>
                <label>品种<input required maxLength={80} value={draft.breed} onChange={e => updateField('breed', e.target.value)} /></label>
                <label>性别<select value={draft.gender} onChange={e => updateField('gender', e.target.value)}><option>公</option><option>母</option><option>未知</option></select></label>
                <label>年龄（岁）<input required type="number" min="0" max="100" step="1" value={draft.age} onChange={e => updateField('age', Number(e.target.value))} /></label>
                <label>体重（kg）<input required type="number" min="0.01" max="999" step="0.01" value={draft.weight} onChange={e => updateField('weight', Number(e.target.value))} /></label>
                <label>健康状态<select value={draft.status} onChange={e => updateField('status', e.target.value)}><option>健康</option><option>观察中</option><option>需复诊</option></select></label>
                <label className="full">备注<textarea required maxLength={255} rows={3} value={draft.note} onChange={e => updateField('note', e.target.value)} /></label>
              </div>
              <div className="form-actions">
                <button type="button" className="secondary" onClick={() => setFormOpen(false)}>取消</button>
                <button type="submit" className="primary" disabled={saving}>{saving ? '保存中…' : '保存到数据库'}</button>
              </div>
            </form>
          </section>
        </div>
      )}
    </main>
  )
}
