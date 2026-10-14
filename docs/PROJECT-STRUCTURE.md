# 代码结构

## 前端

| 目录 | 职责 |
| --- | --- |
| `frontend/src/App.tsx` | 根据路径装配用户端或管理端入口 |
| `frontend/src/pages/` | 页面状态、接口调用与页面组合 |
| `frontend/src/components/auth/` | 用户及管理员登录、资料完善视图 |
| `frontend/src/components/public/` | 首页、宠物、专业认证和通知界面 |
| `frontend/src/components/admin/` | 工作台、审核、认证人员、通知与审计界面 |
| `frontend/src/hooks/` | 用户与管理员通知的状态、实时连接及操作 |
| `frontend/src/shared.ts` | 当前阶段共用的类型、表单初值与响应解析 |

页面组件处理流程和状态，视图组件通过属性接收数据与回调。新增功能优先放入对应领域目录，再由页面组合；不要继续向 `App.tsx` 添加业务代码。

## 后端

| 目录 | 职责 |
| --- | --- |
| `backend/src/index.ts` | 注册路由、统一错误处理、启动与关闭服务 |
| `backend/src/context.ts` | Express、Prisma、会话校验及共用工具 |
| `backend/src/routes/` | 按认证、宠物、媒体、专业身份和通知拆分的接口 |

路由文件只注册所属领域的接口。新增接口先确定业务领域，再放入对应路由文件；跨领域共用能力放在独立模块中。
