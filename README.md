# Pawtrace

宠物健康管理与兽医病例交流平台。本仓库提供可在本机模拟生产环境的基础设施。

## 技术栈

- React + TypeScript + Vite
- Node.js + Express + TypeScript
- Prisma + MySQL 8.4
- Nginx + Docker Compose

## 一键启动

```powershell
Copy-Item .env.example .env
docker compose up -d --build
docker compose ps
```

访问 <http://localhost:8081>。页面显示“服务正常 · 数据库已连接”即表示完整链路可用。

- 查看日志：`docker compose logs -f`
- 停止并保留数据库：`docker compose down`
- 停止并清空数据库：`docker compose down -v`

## 开发模式

用 `docker compose up -d mysql` 启动数据库。在 `backend/.env` 中配置：

```env
DATABASE_URL=mysql://pawtrace:pawtrace_local_password@localhost:3306/pawtrace
PORT=3000
```

然后分别在 `backend` 和 `frontend` 目录运行 `pnpm install` 与 `pnpm dev`。
开发页面位于 <http://localhost:5173>。
