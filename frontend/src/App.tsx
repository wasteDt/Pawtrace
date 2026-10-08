import { type FormEvent, useEffect, useState } from 'react'

type User = { id: number; nickname: string | null; avatarUrl: string | null; profileCompleted: boolean }
type SessionData = { csrfToken: string; user: User }
type ApiError = { error?: { message?: string } }
type Pet = { id: number; name: string; species: 'CAT' | 'DOG' | 'OTHER'; customSpecies: string | null; breed: string | null; gender: 'MALE' | 'FEMALE' | 'UNKNOWN'; birthDate: string | null; ageText: string | null; weightKg: number | null; neutered: boolean | null; allergies: string | null; pastDiseases: string | null; vaccinationInfo: string | null; dewormingInfo: string | null; note: string | null }
type History = { id: number; recordDate: string; title: string; description: string; hospitalName: string | null; doctorName: string | null; treatment: string | null }
type PetDraft = Omit<Pet, 'id'>
const emptyPet: PetDraft = { name: '', species: 'CAT', customSpecies: null, breed: null, gender: 'UNKNOWN', birthDate: null, ageText: '', weightKg: null, neutered: null, allergies: null, pastDiseases: null, vaccinationInfo: null, dewormingInfo: null, note: null }

async function json<T>(response: Response): Promise<T> {
  const body = await response.json() as T & ApiError
  if (!response.ok) throw new Error(body.error?.message ?? '请求失败，请稍后重试')
  return body
}

export default function App() {
  const [session, setSession] = useState<SessionData | null>(null)
  const [checking, setChecking] = useState(true)
  const [phoneNumber, setPhoneNumber] = useState('')
  const [code, setCode] = useState('')
  const [demoCode, setDemoCode] = useState('')
  const [nickname, setNickname] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [accountMenuOpen, setAccountMenuOpen] = useState(false)
  const [view, setView] = useState<'home' | 'pets'>('home')
  const [pets, setPets] = useState<Pet[]>([])
  const [petsLoading, setPetsLoading] = useState(false)
  const [petFormOpen, setPetFormOpen] = useState(false)
  const [petDraft, setPetDraft] = useState<PetDraft>(emptyPet)
  const [editingPetId, setEditingPetId] = useState<number | null>(null)
  const [selectedPet, setSelectedPet] = useState<Pet | null>(null)
  const [histories, setHistories] = useState<History[]>([])
  const [historyFormOpen, setHistoryFormOpen] = useState(false)
  const [historyDraft, setHistoryDraft] = useState({ recordDate: new Date().toISOString().slice(0, 10), title: '', description: '', hospitalName: '', doctorName: '', treatment: '' })

  useEffect(() => {
    fetch('/api/v1/auth/session', { credentials: 'include' })
      .then(response => response.ok ? response.json() : null)
      .then(result => result && setSession(result.data as SessionData))
      .finally(() => setChecking(false))
  }, [])

  useEffect(() => {
    if (!message) return
    const timer = window.setTimeout(() => setMessage(''), 3200)
    return () => window.clearTimeout(timer)
  }, [message])

  useEffect(() => {
    if (session?.user.profileCompleted && view === 'pets') void loadPets()
  }, [session?.user.profileCompleted, view])

  async function loadPets() {
    setPetsLoading(true)
    try {
      const result = await json<{ data: Pet[] }>(await fetch('/api/v1/pets', { credentials: 'include' }))
      setPets(result.data)
    } catch (reason) { setMessage(reason instanceof Error ? reason.message : '宠物档案加载失败') }
    finally { setPetsLoading(false) }
  }

  async function openPetDetail(pet: Pet) {
    setSelectedPet(pet); setHistories([])
    try {
      const result = await json<{ data: History[] }>(await fetch(`/api/v1/pets/${pet.id}/histories`, { credentials: 'include' }))
      setHistories(result.data)
    } catch (reason) { setMessage(reason instanceof Error ? reason.message : '病史加载失败') }
  }

  function openCreatePet() { setPetDraft(emptyPet); setEditingPetId(null); setPetFormOpen(true) }
  function openEditPet(pet: Pet) { const { id, ...draft } = pet; setPetDraft({ ...draft, birthDate: draft.birthDate?.slice(0, 10) ?? null }); setEditingPetId(id); setPetFormOpen(true) }

  async function savePet(event: FormEvent) {
    event.preventDefault(); if (!session) return
    setBusy(true)
    try {
      await json(await fetch(editingPetId ? `/api/v1/pets/${editingPetId}` : '/api/v1/pets', { method: editingPetId ? 'PATCH' : 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': session.csrfToken }, body: JSON.stringify(petDraft) }))
      setPetFormOpen(false); setMessage(editingPetId ? '宠物档案已更新' : '宠物档案已创建'); await loadPets()
    } catch (reason) { setMessage(reason instanceof Error ? reason.message : '宠物档案保存失败') }
    finally { setBusy(false) }
  }

  async function removePet(pet: Pet) {
    if (!session || !window.confirm(`确定停用“${pet.name}”的档案吗？历史数据将被保留。`)) return
    try {
      const response = await fetch(`/api/v1/pets/${pet.id}`, { method: 'DELETE', credentials: 'include', headers: { 'X-CSRF-Token': session.csrfToken } })
      if (!response.ok) await json(response)
      setSelectedPet(null); setMessage('宠物档案已停用'); await loadPets()
    } catch (reason) { setMessage(reason instanceof Error ? reason.message : '操作失败') }
  }

  async function saveHistory(event: FormEvent) {
    event.preventDefault(); if (!session || !selectedPet) return
    setBusy(true)
    try {
      await json(await fetch(`/api/v1/pets/${selectedPet.id}/histories`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': session.csrfToken }, body: JSON.stringify(historyDraft) }))
      setHistoryFormOpen(false); setHistoryDraft({ recordDate: new Date().toISOString().slice(0, 10), title: '', description: '', hospitalName: '', doctorName: '', treatment: '' }); setMessage('宠物病史已记录'); await openPetDetail(selectedPet)
    } catch (reason) { setMessage(reason instanceof Error ? reason.message : '病史保存失败') }
    finally { setBusy(false) }
  }

  async function requestCode() {
    if (!/^1[3-9]\d{9}$/.test(phoneNumber)) {
      setMessage('请输入正确的 11 位中国大陆手机号')
      return
    }
    setBusy(true); setMessage('')
    try {
      const result = await json<{ data: { demoCode: string } }>(await fetch('/api/v1/auth/verification-codes', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ countryCode: '+86', phoneNumber, purpose: 'LOGIN' }),
      }))
      setDemoCode(result.data.demoCode)
      setMessage('模拟验证码已生成，有效期 5 分钟。')
    } catch (reason) { setMessage(reason instanceof Error ? reason.message : '验证码获取失败') }
    finally { setBusy(false) }
  }

  async function login(event: FormEvent) {
    event.preventDefault()
    if (!/^1[3-9]\d{9}$/.test(phoneNumber)) {
      setMessage('请输入正确的 11 位中国大陆手机号')
      return
    }
    if (!/^\d{6}$/.test(code)) {
      setMessage('请输入 6 位短信验证码')
      return
    }
    setBusy(true); setMessage('')
    try {
      const result = await json<{ data: SessionData }>(await fetch('/api/v1/auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ countryCode: '+86', phoneNumber, code }),
      }))
      setSession(result.data); setNickname(result.data.user.nickname ?? '')
    } catch (reason) { setMessage(reason instanceof Error ? reason.message : '登录失败') }
    finally { setBusy(false) }
  }

  async function saveProfile(event: FormEvent) {
    event.preventDefault()
    if (!session) return
    setBusy(true); setMessage('')
    try {
      await json(await fetch('/api/v1/me/profile', {
        method: 'PATCH', credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': session.csrfToken },
        body: JSON.stringify({ nickname }),
      }))
      setSession({ ...session, user: { ...session.user, nickname, profileCompleted: true } })
    } catch (reason) { setMessage(reason instanceof Error ? reason.message : '资料保存失败') }
    finally { setBusy(false) }
  }

  async function logout() {
    await fetch('/api/v1/auth/logout', { method: 'POST', credentials: 'include' })
    setSession(null); setCode(''); setDemoCode(''); setMessage('')
  }

  if (checking) return <main className="loading-page"><span className="loading-dot" />正在恢复登录状态</main>

  if (!session) return (
    <main className="auth-page">
      {message && <div className="toast" role="alert">{message}</div>}
      <section className="brand-panel">
        <a className="brand" href="#top"><span className="brand-mark">P</span>Pawtrace</a>
        <div className="brand-copy">
          <p className="eyebrow">PET HEALTH COMMUNITY</p>
          <h1>让每一次关心，<br />都有专业回应。</h1>
          <p>连接宠物主人与专业兽医，记录健康轨迹，沉淀可信的医学交流。</p>
        </div>
        <div className="trust-row"><span>宠物健康档案</span><span>认证专业身份</span><span>隐私问答</span></div>
      </section>
      <section className="auth-panel">
        <form className="auth-card" onSubmit={login}>
          <div><p className="eyebrow">WELCOME</p><h2>手机号登录</h2><p className="muted">未注册的手机号将自动创建账户</p></div>
          <label>手机号<div className="phone-field"><span>+86</span><input autoComplete="tel" inputMode="numeric" maxLength={11} placeholder="请输入手机号" value={phoneNumber} onChange={event => setPhoneNumber(event.target.value.replace(/\D/g, ''))} /></div></label>
          <label>验证码<div className="code-field"><input autoComplete="one-time-code" inputMode="numeric" maxLength={6} placeholder="6 位验证码" value={code} onChange={event => setCode(event.target.value.replace(/\D/g, ''))} /><button type="button" className="text-button" disabled={busy} onClick={() => void requestCode()}>获取验证码</button></div></label>
          {demoCode && <div className="demo-code"><span>模拟短信验证码</span><strong>{demoCode}</strong></div>}
          <button className="primary-button" disabled={busy}>{busy ? '请稍候…' : '登录 / 自动注册'}</button>
          <p className="agreement">登录即表示你同意服务条款与隐私政策。本项目当前使用模拟短信。</p>
        </form>
      </section>
    </main>
  )

  if (!session.user.profileCompleted) return (
    <main className="onboarding-page">
      <form className="profile-card" onSubmit={saveProfile}>
        <span className="step">1 / 1</span><p className="eyebrow">CREATE PROFILE</p><h1>先认识一下你</h1>
        <p className="muted">所有用户默认拥有宠物主人身份，之后可以申请医生或医生助理认证。</p>
        <label>你的昵称<input autoFocus maxLength={50} placeholder="例如：豆豆家长" value={nickname} onChange={event => setNickname(event.target.value)} /></label>
        {message && <p className="form-message">{message}</p>}
        <button className="primary-button" disabled={busy || nickname.trim().length < 2}>{busy ? '保存中…' : '进入 Pawtrace'}</button>
      </form>
    </main>
  )

  return (
    <main className="app-shell">
      {message && <div className="toast" role="alert">{message}</div>}
      <header className="topbar"><button className="brand brand-button" onClick={() => setView('home')}><span className="brand-mark">P</span>Pawtrace</button><nav><button className={view === 'home' ? 'active' : ''} onClick={() => setView('home')}>首页</button><button>健康问答</button><button>发现</button></nav><div className="top-actions"><button className="publish-button">＋ 发布</button><div className="account-menu"><button className="avatar-button" aria-label="打开个人菜单" aria-expanded={accountMenuOpen} onClick={() => setAccountMenuOpen(open => !open)}>{session.user.nickname?.slice(0, 1)}</button>{accountMenuOpen && <div className="account-popover"><div className="account-summary"><strong>{session.user.nickname}</strong><span>宠物主人</span></div><button>个人主页</button><button onClick={() => { setView('pets'); setAccountMenuOpen(false) }}>我的宠物</button><button>专业身份认证</button><div className="menu-divider" /><button className="logout-button" onClick={() => void logout()}>退出登录</button></div>}</div></div></header>

      {view === 'home' ? <>
        <section className="welcome-section"><div><p className="eyebrow">GOOD TO SEE YOU</p><h1>你好，{session.user.nickname}</h1><p>从宠物健康档案开始，建立属于你和它的长期健康轨迹。</p></div><button className="primary-button compact" onClick={() => { setView('pets'); openCreatePet() }}>＋ 添加宠物</button></section>
        <section className="dashboard-grid">
          <article className="dashboard-card featured"><span className="card-icon">⌁</span><div><p className="eyebrow">HEALTH PROFILE</p><h2>管理宠物健康档案</h2><p>记录基础信息、疫苗、驱虫和每一次健康变化。</p></div><button className="link-button" onClick={() => setView('pets')}>查看我的宠物 →</button></article>
          <article className="dashboard-card"><span className="card-icon cool">?</span><div><h3>健康问答</h3><p>向认证宠物医生提出健康问题。</p></div><button className="link-button">查看问答 →</button></article>
          <article className="dashboard-card"><span className="card-icon warm">♢</span><div><h3>专业身份认证</h3><p>医生与医生助理可申请专业认证。</p></div><button className="link-button">了解认证 →</button></article>
        </section>
      </> : <section className="pets-page">
        <div className="page-heading"><div><button className="back-button" onClick={() => { setView('home'); setSelectedPet(null) }}>← 返回首页</button><p className="eyebrow">PET PROFILES</p><h1>我的宠物</h1><p>管理宠物资料，并按时间记录健康变化。</p></div><button className="primary-button compact" onClick={openCreatePet}>＋ 新增宠物</button></div>
        {petsLoading ? <div className="empty-card">正在加载宠物档案…</div> : pets.length === 0 ? <div className="empty-card"><span>⌁</span><h2>还没有宠物档案</h2><p>创建第一份档案，开始记录它的健康轨迹。</p><button className="primary-button compact" onClick={openCreatePet}>创建宠物档案</button></div> : <div className="pet-layout"><div className="pet-list">{pets.map(pet => <article key={pet.id} className={`pet-list-card ${selectedPet?.id === pet.id ? 'selected' : ''}`} onClick={() => void openPetDetail(pet)}><div className="pet-symbol">{pet.species === 'CAT' ? '猫' : pet.species === 'DOG' ? '犬' : '宠'}</div><div><h3>{pet.name}</h3><p>{pet.breed || pet.customSpecies || '品种未填写'} · {pet.ageText || (pet.birthDate ? `${pet.birthDate.slice(0, 4)} 年出生` : '年龄未知')}</p></div><span>›</span></article>)}</div>{selectedPet ? <article className="pet-detail"><div className="detail-head"><div><p className="eyebrow">PET DETAIL</p><h2>{selectedPet.name}</h2><p>{selectedPet.species === 'CAT' ? '猫' : selectedPet.species === 'DOG' ? '狗' : selectedPet.customSpecies} · {selectedPet.breed || '未填写品种'}</p></div><div className="detail-actions"><button onClick={() => openEditPet(selectedPet)}>编辑</button><button className="danger-text" onClick={() => void removePet(selectedPet)}>停用</button></div></div><dl className="pet-facts"><div><dt>性别</dt><dd>{selectedPet.gender === 'MALE' ? '公' : selectedPet.gender === 'FEMALE' ? '母' : '未知'}</dd></div><div><dt>体重</dt><dd>{selectedPet.weightKg ? `${selectedPet.weightKg} kg` : '未记录'}</dd></div><div><dt>绝育</dt><dd>{selectedPet.neutered == null ? '未知' : selectedPet.neutered ? '是' : '否'}</dd></div></dl><div className="history-head"><div><h3>病史时间线</h3><p>仅你本人可见，分享时需主动选择。</p></div><button className="secondary-button" onClick={() => setHistoryFormOpen(true)}>＋ 记录病史</button></div>{histories.length === 0 ? <div className="mini-empty">暂无病史记录</div> : <div className="timeline">{histories.map(item => <div className="timeline-item" key={item.id}><time>{item.recordDate.slice(0, 10)}</time><div><h4>{item.title}</h4><p>{item.description}</p>{(item.hospitalName || item.doctorName) && <small>{[item.hospitalName, item.doctorName].filter(Boolean).join(' · ')}</small>}{item.treatment && <small>治疗：{item.treatment}</small>}</div></div>)}</div>}</article> : <div className="pet-detail placeholder-detail">选择一只宠物查看完整档案和病史</div>}</div>}
      </section>}

      {petFormOpen && <div className="modal-backdrop" onMouseDown={event => event.target === event.currentTarget && setPetFormOpen(false)}><form className="modal-card" onSubmit={savePet}><div className="modal-head"><div><p className="eyebrow">PET PROFILE</p><h2>{editingPetId ? '编辑宠物档案' : '新增宠物档案'}</h2></div><button type="button" onClick={() => setPetFormOpen(false)}>×</button></div><div className="form-grid"><label>宠物昵称<input required maxLength={50} value={petDraft.name} onChange={event => setPetDraft({ ...petDraft, name: event.target.value })} /></label><label>宠物类型<select value={petDraft.species} onChange={event => setPetDraft({ ...petDraft, species: event.target.value as Pet['species'] })}><option value="CAT">猫</option><option value="DOG">狗</option><option value="OTHER">其他</option></select></label>{petDraft.species === 'OTHER' && <label>具体类型<input required value={petDraft.customSpecies ?? ''} onChange={event => setPetDraft({ ...petDraft, customSpecies: event.target.value })} /></label>}<label>品种<input value={petDraft.breed ?? ''} onChange={event => setPetDraft({ ...petDraft, breed: event.target.value })} /></label><label>性别<select value={petDraft.gender} onChange={event => setPetDraft({ ...petDraft, gender: event.target.value as Pet['gender'] })}><option value="UNKNOWN">未知</option><option value="MALE">公</option><option value="FEMALE">母</option></select></label><label>出生日期<input type="date" value={petDraft.birthDate ?? ''} onChange={event => setPetDraft({ ...petDraft, birthDate: event.target.value || null })} /></label><label>年龄描述<input placeholder="日期不确定时填写，如约3岁" value={petDraft.ageText ?? ''} onChange={event => setPetDraft({ ...petDraft, ageText: event.target.value })} /></label><label>体重（kg）<input type="number" min="0.01" max="9999" step="0.01" value={petDraft.weightKg ?? ''} onChange={event => setPetDraft({ ...petDraft, weightKg: event.target.value ? Number(event.target.value) : null })} /></label><label>是否绝育<select value={petDraft.neutered == null ? '' : String(petDraft.neutered)} onChange={event => setPetDraft({ ...petDraft, neutered: event.target.value === '' ? null : event.target.value === 'true' })}><option value="">未知</option><option value="true">是</option><option value="false">否</option></select></label><label className="full">过敏史<textarea value={petDraft.allergies ?? ''} onChange={event => setPetDraft({ ...petDraft, allergies: event.target.value })} /></label><label className="full">既往疾病<textarea value={petDraft.pastDiseases ?? ''} onChange={event => setPetDraft({ ...petDraft, pastDiseases: event.target.value })} /></label></div><div className="form-actions"><button type="button" className="secondary-button" onClick={() => setPetFormOpen(false)}>取消</button><button className="primary-button compact" disabled={busy}>{busy ? '保存中…' : '保存档案'}</button></div></form></div>}
      {historyFormOpen && selectedPet && <div className="modal-backdrop" onMouseDown={event => event.target === event.currentTarget && setHistoryFormOpen(false)}><form className="modal-card small" onSubmit={saveHistory}><div className="modal-head"><div><p className="eyebrow">MEDICAL HISTORY</p><h2>记录 {selectedPet.name} 的病史</h2></div><button type="button" onClick={() => setHistoryFormOpen(false)}>×</button></div><div className="form-grid"><label>记录日期<input required type="date" value={historyDraft.recordDate} onChange={event => setHistoryDraft({ ...historyDraft, recordDate: event.target.value })} /></label><label>疾病或症状名称<input required value={historyDraft.title} onChange={event => setHistoryDraft({ ...historyDraft, title: event.target.value })} /></label><label className="full">情况描述<textarea required rows={4} value={historyDraft.description} onChange={event => setHistoryDraft({ ...historyDraft, description: event.target.value })} /></label><label>就诊医院<input value={historyDraft.hospitalName} onChange={event => setHistoryDraft({ ...historyDraft, hospitalName: event.target.value })} /></label><label>接诊医生<input value={historyDraft.doctorName} onChange={event => setHistoryDraft({ ...historyDraft, doctorName: event.target.value })} /></label><label className="full">用药或治疗<textarea value={historyDraft.treatment} onChange={event => setHistoryDraft({ ...historyDraft, treatment: event.target.value })} /></label></div><div className="form-actions"><button type="button" className="secondary-button" onClick={() => setHistoryFormOpen(false)}>取消</button><button className="primary-button compact" disabled={busy}>{busy ? '保存中…' : '保存病史'}</button></div></form></div>}
    </main>
  )
}
