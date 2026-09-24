import { useEffect, useState } from 'react'

type Health = {
  status: 'ok' | 'error'
  database: 'connected' | 'disconnected'
  timestamp: string
}

export default function App() {
  const [health, setHealth] = useState<Health | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/health')
      .then(async response => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        return response.json() as Promise<Health>
      })
      .then(setHealth)
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : '未知错误'))
  }, [])

  return (
    <main className="page">
      <section className="card">
        <p className="eyebrow">PAWTRACE</p>
        <h1>宠物健康，清晰可追踪</h1>
        <p className="intro">React、Node.js 与 MySQL 的本地部署链路已经建立。</p>
        <div className={`status ${health?.status === 'ok' ? 'success' : error ? 'error' : ''}`}>
          <span className="dot" />
          {health ? `服务正常 · 数据库${health.database === 'connected' ? '已连接' : '未连接'}`
            : error ? `连接失败：${error}` : '正在检查服务状态…'}
        </div>
      </section>
    </main>
  )
}
