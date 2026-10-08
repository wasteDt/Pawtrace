# Pawtrace

面向宠物主人、宠物医生和医生助理的宠物健康与专业交流平台。

## 技术栈

- React 19 + TypeScript + Vite
- Node.js + Express + TypeScript
- Prisma + MySQL 8.4
- Nginx + Docker Compose

## 当前进度

- 手机号模拟验证码登录
- HttpOnly Cookie 服务端 Session
- CSRF 写操作保护
- 首次登录资料完善
- 用户、宠物和宠物病史基础数据模型
- 新版登录页、资料完善页和产品首页骨架

完整需求和设计位于 [`docs`](./docs) 目录。

## 本地启动

```powershell
Copy-Item .env.example .env
docker compose up -d --build
docker compose ps
```

访问 <http://localhost:8081>。第一版短信为模拟实现，验证码会直接显示在登录页面。

## 旧演示数据库

2026-10-08 前的 CRUD 演示模型已作废。若本机曾启动旧版本，需要删除旧 Docker 数据卷后再启动新基线：

```powershell
docker compose down -v
docker compose up -d --build
```

`down -v` 会永久删除该 Compose 项目的本地 MySQL 数据，只应在确认不需要旧演示数据时执行。

## 开发模式

先运行 `docker compose up -d mysql`。在 `backend/.env` 配置：

```env
DATABASE_URL=mysql://pawtrace:pawtrace_local_password@localhost:3306/pawtrace
PORT=3000
AUTH_SECRET=replace_with_a_long_random_local_secret
APP_ORIGIN=http://localhost:5173
COOKIE_SECURE=false
```

然后分别在 `backend` 和 `frontend` 目录运行 `pnpm install` 与 `pnpm dev`。

## 验证

```powershell
cd backend
pnpm prisma:generate
pnpm typecheck
pnpm build

cd ../frontend
pnpm build
```
