# Pawtrace 第一版 REST API 设计

> 文档状态：已确认  
> 版本：v0.2  
> 更新日期：2026-10-08  
> API 前缀：`/api/v1`  
> 前置文档：[MVP-PRD-v1.md](./MVP-PRD-v1.md)、[DATABASE-DESIGN-v1.md](./DATABASE-DESIGN-v1.md)

## 1. 设计原则

- 使用 REST 风格资源路径和 JSON 响应。
- 前台与管理后台认证体系分离。
- 后端查询阶段执行资源归属与可见性限制，不能依赖前端隐藏。
- 列表接口统一游标分页，避免页码在动态信息流中产生重复或遗漏。
- 写操作使用明确的校验错误和稳定错误码。
- 上传接口使用 `multipart/form-data`，业务接口只引用已上传的媒体 ID。
- API 不返回手机号、认证材料地址、私密病例等不属于当前调用者的数据。
- 第一版不采用 GraphQL、WebSocket 或实时聊天接口；通知实时推送使用单向 SSE。

## 2. 通用约定

### 2.1 请求头

```http
Accept: application/json
Content-Type: application/json
X-Request-Id: <optional-client-request-id>
X-CSRF-Token: <required-for-authenticated-write-actions>
Idempotency-Key: <required-for-selected-create-actions>
```

- 浏览器自动携带 HttpOnly Session Cookie，前端不保存或拼接认证 Token。
- `X-CSRF-Token` 用于已登录的新增、修改和删除操作；只读请求不需要。
- 媒体上传使用 `multipart/form-data`，不手动设置 JSON Content-Type。
- `X-Request-Id` 可由客户端提供；未提供时服务端生成。
- 发布内容、提交认证等可能被重复点击的接口支持 `Idempotency-Key`。

### 2.2 成功响应

单个资源：

```json
{
  "data": {
    "id": 123
  },
  "requestId": "req_01H..."
}
```

列表资源：

```json
{
  "data": [
    { "id": 123 },
    { "id": 122 }
  ],
  "page": {
    "nextCursor": "eyJpZCI6MTIyfQ",
    "hasMore": true
  },
  "requestId": "req_01H..."
}
```

删除或无响应体操作返回 `204 No Content`。

### 2.3 错误响应

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "提交内容有误",
    "fields": {
      "phoneNumber": "请输入合法的中国大陆手机号"
    }
  },
  "requestId": "req_01H..."
}
```

常用状态码：

| HTTP | 错误码示例 | 用途 |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | 参数格式或业务字段错误 |
| 401 | `UNAUTHENTICATED`、`TOKEN_EXPIRED` | 未登录或会话过期 |
| 403 | `FORBIDDEN`、`PROFESSIONAL_REQUIRED` | 身份或资源权限不足 |
| 404 | `RESOURCE_NOT_FOUND` | 不存在或调用者不可见 |
| 409 | `RESOURCE_CONFLICT`、`APPLICATION_PENDING` | 状态冲突或重复提交 |
| 413 | `FILE_TOO_LARGE` | 上传文件超限 |
| 415 | `UNSUPPORTED_MEDIA_TYPE` | 不支持的媒体类型 |
| 422 | `BUSINESS_RULE_VIOLATION` | 格式正确但违反业务规则 |
| 429 | `RATE_LIMITED` | 请求过于频繁 |
| 500 | `INTERNAL_ERROR` | 未预期服务端错误 |
| 503 | `SERVICE_UNAVAILABLE` | 数据库或依赖暂不可用 |

对无权访问的私密资源统一返回 404，避免泄露资源是否存在。

### 2.4 时间、ID 与空值

- 时间使用 ISO 8601 UTC，例如 `2026-10-08T08:30:00.000Z`。
- 数据库 `Int` ID 在 JSON 中返回 number。
- 未填写的可选值使用 `null`，不使用空字符串代替未知值。
- 列表返回空数组 `[]`，不返回 `null`。

### 2.5 分页、排序与过滤

通用参数：

| 参数 | 默认值 | 说明 |
| --- | --- | --- |
| `limit` | 20 | 范围 1–50 |
| `cursor` | 无 | 上一页返回的不透明游标 |
| `sort` | 资源默认 | 只允许接口声明的排序值 |

游标由服务端签名或编码，客户端不得解析或拼装。

### 2.6 字段选择与隐私

第一版不开放任意 `fields` 或 `include` 参数，防止客户端绕过 DTO 边界。每个端点返回固定用途的 DTO：

- `PublicUserSummary`：昵称、头像、公开认证标识。
- `CurrentUserProfile`：当前用户自己的完整非敏感资料。
- `ProfessionalPublicProfile`：展示名称、机构、擅长领域和认证类型。
- `PetPublicSummary`：问题公开展示所需宠物摘要。
- `PetPrivateDetail`：主人自己的完整宠物档案。

## 3. 认证与会话

### 3.1 会话方案

- 登录成功后，服务端创建不透明随机 Session Token。
- Session Token 写入 `HttpOnly; Secure; SameSite=Lax` Cookie，数据库只保存令牌哈希。
- 浏览器自动携带 Cookie，前端 JavaScript 不读取或保存登录凭证。
- 登录响应另行返回 CSRF Token，前端保存在内存中，并在已登录写操作中通过 `X-CSRF-Token` 发送。
- 页面刷新后通过 `GET /auth/session` 获取当前用户和新的 CSRF Token。
- 退出、账号禁用或身份安全变更时撤销服务端会话。
- 开发环境可关闭 Cookie 的 `Secure`，生产环境必须使用 HTTPS 并开启 `Secure`。

### 3.2 获取模拟验证码

`POST /auth/verification-codes`

无需登录。限流：同手机号 60 秒一次，同时按 IP 限流。

请求：

```json
{
  "countryCode": "+86",
  "phoneNumber": "13800138000",
  "purpose": "LOGIN"
}
```

演示环境响应：

```json
{
  "data": {
    "expiresInSeconds": 300,
    "retryAfterSeconds": 60,
    "demoCode": "123456"
  }
}
```

生产环境未来不得返回 `demoCode`。

### 3.3 手机号登录或注册

`POST /auth/login`

请求：

```json
{
  "countryCode": "+86",
  "phoneNumber": "13800138000",
  "code": "123456"
}
```

响应：

```json
{
  "data": {
    "csrfToken": "<csrf-token>",
    "sessionExpiresAt": "2026-11-07T08:30:00.000Z",
    "isNewUser": true,
    "profileCompleted": false,
    "user": {
      "id": 1,
      "nickname": null,
      "avatar": null,
      "professional": null
    }
  }
}
```

### 3.4 恢复会话与退出

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/auth/session` | 使用 Session Cookie 恢复当前用户并返回新的 CSRF Token |
| POST | `/auth/logout` | 撤销当前会话并清除 Cookie |
| POST | `/auth/logout-all` | 撤销当前用户所有会话 |

### 3.5 当前用户

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/me` | 当前用户资料、专业身份与未读通知数 |
| PATCH | `/me/profile` | 完善或编辑昵称、头像、简介、地区 |

`PATCH /me/profile` 请求示例：

```json
{
  "nickname": "豆豆家长",
  "avatarMediaId": 18,
  "bio": "两只猫的家长",
  "locationText": "上海"
}
```

## 4. 用户、主页与关注

### 4.1 公开用户资料

`GET /users/:userId`

返回公开资料、认证信息、关注数和粉丝数。禁止返回手机号、真实姓名、认证材料、宠物完整档案和私密内容。

### 4.2 用户公开内容

`GET /users/:userId/contents?type=COMMUNITY_POST&limit=20&cursor=...`

- 普通主页仅返回公开社区内容及该用户的公开医生回答摘要。
- 不返回个人提问、病例、宠物病史或学术讨论。

### 4.3 关注

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| PUT | `/users/:userId/follow` | 关注用户，幂等 |
| DELETE | `/users/:userId/follow` | 取消关注，幂等 |
| GET | `/me/following` | 我的关注列表 |
| GET | `/me/followers` | 我的粉丝列表 |

不能关注自己。目标用户被禁用或删除时返回 404。

## 5. 媒体上传与访问

### 5.1 上传媒体

`POST /media`

使用 `multipart/form-data`：

| 字段 | 说明 |
| --- | --- |
| `file` | 文件内容 |
| `kind` | `IMAGE`、`VIDEO`、`DOCUMENT` |
| `visibility` | `PUBLIC` 或 `PRIVATE` |
| `purpose` | `AVATAR`、`CONTENT`、`HISTORY`、`CASE`、`CREDENTIAL` |

规则：

- 图片单个不超过 10 MB。
- 视频单个不超过 100 MB 且不超过 3 分钟。
- 客户端声明的 MIME 只作提示，服务端重新检测。
- 认证材料、病史和病例媒体必须为 `PRIVATE`。
- 上传成功只代表文件可用，不代表已关联业务对象。

响应返回 `mediaId`、媒体元信息和调用者可用的短期预览地址。

### 5.2 媒体访问

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/media/:mediaId/access` | 校验业务权限后获取短期访问地址 |
| DELETE | `/media/:mediaId` | 删除尚未使用或由调用者拥有的媒体 |

公开媒体可以由 Nginx 或对象存储 CDN 提供；私密媒体必须经过权限校验。

## 6. 宠物档案

### 6.1 接口列表

| 方法 | 路径 | 权限 | 说明 |
| --- | --- | --- | --- |
| GET | `/pets` | 登录用户 | 我的宠物列表 |
| POST | `/pets` | 登录用户 | 新建宠物 |
| GET | `/pets/:petId` | 宠物主人 | 宠物完整资料 |
| PATCH | `/pets/:petId` | 宠物主人 | 编辑宠物 |
| DELETE | `/pets/:petId` | 宠物主人 | 停用/逻辑删除宠物 |

### 6.2 创建宠物

`POST /pets`

```json
{
  "name": "豆豆",
  "species": "CAT",
  "customSpecies": null,
  "breed": "英国短毛猫",
  "gender": "FEMALE",
  "birthDate": "2023-05-12",
  "ageText": null,
  "weightKg": 4.35,
  "neutered": true,
  "allergies": null,
  "pastDiseases": null,
  "vaccinationInfo": "年度疫苗已完成",
  "dewormingInfo": "2026-09-01",
  "note": null,
  "avatarMediaId": 21
}
```

`species = OTHER` 时必须填写 `customSpecies`。`birthDate` 和 `ageText` 至少填写一项。

## 7. 宠物病史

### 7.1 接口列表

| 方法 | 路径 | 权限 | 说明 |
| --- | --- | --- | --- |
| GET | `/pets/:petId/histories` | 宠物主人 | 病史时间线 |
| POST | `/pets/:petId/histories` | 宠物主人 | 新建病史 |
| GET | `/pet-histories/:historyId` | 宠物主人或被授权专业用户 | 病史详情 |
| PATCH | `/pet-histories/:historyId` | 宠物主人 | 编辑病史 |
| DELETE | `/pet-histories/:historyId` | 宠物主人 | 逻辑删除病史 |

“被授权专业用户”仅指该病史已附带到其有权查看的问题：

- 公开问题：认证宠物医生和认证医生助理。
- 个人提问：被指定的认证宠物医生。

### 7.2 创建病史

`POST /pets/:petId/histories`

```json
{
  "recordDate": "2026-09-20",
  "title": "皮肤瘙痒",
  "description": "持续抓挠耳后区域",
  "hospitalName": "示例宠物医院",
  "doctorName": "王医生",
  "examinationResult": "皮肤镜检查记录",
  "treatment": "遵医嘱用药",
  "note": null,
  "imageMediaIds": [31, 32],
  "videoMediaId": 33,
  "documentMediaId": null
}
```

## 8. 首页信息流与社区帖子

### 8.1 信息流

`GET /feed?tab=RECOMMENDED&limit=20&cursor=...`

`tab`：

- `RECOMMENDED`：近期内容结合互动数排序。
- `FOLLOWING`：关注用户的公开内容，按发布时间倒序。
- `PET_DAILY`：宠物日常。
- `PET_KNOWLEDGE`：养宠知识。

返回社区帖子卡片，不将学术讨论混入普通信息流。健康问答使用独立广场接口。

### 8.2 社区帖子接口

| 方法 | 路径 | 权限 | 说明 |
| --- | --- | --- | --- |
| POST | `/posts` | 登录用户 | 新建草稿或发布 |
| GET | `/posts/:postId` | 公开 | 帖子详情 |
| PATCH | `/posts/:postId` | 作者 | 编辑帖子 |
| DELETE | `/posts/:postId` | 作者 | 逻辑删除帖子 |
| POST | `/posts/:postId/publish` | 作者 | 发布草稿 |

创建请求：

```json
{
  "postType": "PET_DAILY",
  "title": null,
  "body": "豆豆今天第一次主动喝水。",
  "petId": 8,
  "tagIds": [2, 5],
  "imageMediaIds": [41, 42],
  "videoMediaId": 43,
  "saveAsDraft": false
}
```

图片和视频字段分区传递，同一帖子允许最多 9 张图片和 1 个视频。

### 8.3 点赞、收藏和评论

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| PUT | `/contents/:contentId/like` | 点赞，幂等 |
| DELETE | `/contents/:contentId/like` | 取消点赞，幂等 |
| PUT | `/contents/:contentId/favorite` | 收藏，幂等 |
| DELETE | `/contents/:contentId/favorite` | 取消收藏，幂等 |
| GET | `/contents/:contentId/comments` | 评论列表 |
| POST | `/contents/:contentId/comments` | 发布评论或回复 |
| DELETE | `/comments/:commentId` | 作者删除评论 |

健康问题不使用普通评论接口，统一使用问答回复接口。

## 9. 健康问答

### 9.1 公开问题广场

`GET /questions?mode=PUBLIC_FORUM&status=WAITING&species=CAT&categoryId=3&limit=20&cursor=...`

- 游客可访问。
- 返回宠物公开摘要，不返回完整档案和附带病史。
- 普通用户查看详情时也不返回附带病史。

### 9.2 我的问题与医生待办

| 方法 | 路径 | 权限 | 说明 |
| --- | --- | --- | --- |
| GET | `/me/questions` | 登录用户 | 我发布的公开和个人问题 |
| GET | `/professional/questions/open` | 认证宠物医生 | 公开待回答问题 |
| GET | `/professional/questions/direct` | 认证宠物医生 | 指定给我的个人提问 |
| GET | `/professional/questions/answered` | 认证宠物医生 | 我的回答记录 |

医生助理没有回答权限，但可以从公开问题详情读取主人主动附带的病史。

### 9.3 创建问题

`POST /questions`

请求：

```json
{
  "mode": "PUBLIC_FORUM",
  "assignedDoctorUserId": null,
  "petId": 8,
  "categoryId": 3,
  "title": "猫咪连续两天食欲下降",
  "body": "平时食量正常，这两天只吃少量湿粮。",
  "symptomDuration": "2天",
  "mentalState": "比平时安静",
  "dietAndWater": "饮水基本正常",
  "excretion": "排便减少",
  "measuresTaken": "暂未用药",
  "historyIds": [15],
  "imageMediaIds": [51],
  "videoMediaId": 52
}
```

校验：

- `DIRECT_DOCTOR` 必须传 `assignedDoctorUserId`，目标必须是已认证宠物医生。
- `PUBLIC_FORUM` 的 `assignedDoctorUserId` 必须为空。
- 宠物和病史必须属于当前用户，病史必须属于所选宠物。
- 命中紧急词时接口仍可创建，但响应增加 `emergencyWarning`，前端必须醒目展示。

### 9.4 问题详情

`GET /questions/:questionId`

按身份返回不同字段：

- 普通浏览者：公开问题、宠物摘要、公开医生回答。
- 问题作者：额外返回本人附带的病史和管理操作。
- 认证专业用户：公开问题额外返回附带病史；医生助理不返回回答操作权限。
- 个人提问：仅作者和指定医生可访问。

响应中使用 `permissions` 明确当前调用者能力：

```json
{
  "permissions": {
    "canViewSharedHistories": true,
    "canAnswer": false,
    "canFollowUp": false,
    "canResolve": false,
    "canClose": false
  }
}
```

### 9.5 回答、追问与状态

| 方法 | 路径 | 权限 | 说明 |
| --- | --- | --- | --- |
| POST | `/questions/:questionId/replies` | 作者或有权回答的医生 | 回答或追问 |
| PATCH | `/question-replies/:replyId` | 作者 | 编辑短时间内尚无后续回复的内容 |
| DELETE | `/question-replies/:replyId` | 作者 | 逻辑删除 |
| PUT | `/questions/:questionId/helpful-reply` | 问题作者 | 标记有帮助回答 |
| DELETE | `/questions/:questionId/helpful-reply` | 问题作者 | 取消标记 |
| POST | `/questions/:questionId/resolve` | 问题作者 | 标记已解决 |
| POST | `/questions/:questionId/close` | 问题作者或指定医生 | 关闭问题 |

创建回复请求：

```json
{
  "parentReplyId": null,
  "body": "建议尽快进行线下检查，并记录饮水和排尿情况。",
  "imageMediaIds": []
}
```

回复角色由服务端根据调用者和上下文生成，客户端不能提交 `DOCTOR_ANSWER` 等角色值。

## 10. 专业身份认证

### 10.1 公共专业人员目录

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/professionals?type=VETERINARIAN&specialty=...` | 已认证专业人员列表 |
| GET | `/professionals/:userId` | 专业公开主页 |

指定医生提问的选择器只查询 `type=VETERINARIAN`。

### 10.2 我的专业身份

| 方法 | 路径 | 权限 | 说明 |
| --- | --- | --- | --- |
| GET | `/me/professional-profile` | 登录用户 | 当前身份和最近申请状态 |
| POST | `/professional-applications` | 登录用户 | 提交认证或升级申请 |
| GET | `/professional-applications/:applicationId` | 申请人 | 查看申请详情 |
| PATCH | `/professional-applications/:applicationId` | 被驳回的申请人 | 修改并重新提交 |
| POST | `/professional-applications/:applicationId/cancel` | 申请人 | 撤销待审核申请 |

提交请求：

```json
{
  "requestedType": "VETERINARIAN",
  "realName": "王某某",
  "displayName": "王医生",
  "organization": "示例宠物医院",
  "yearsOfPractice": 6,
  "specialties": ["猫科", "内科"],
  "introduction": "专注伴侣动物内科。",
  "credentialMediaId": 61
}
```

## 11. 专业病例库

所有接口仅认证宠物医生和认证医生助理可用，并始终限制为本人病例。

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/medical-cases` | 我的病例列表，支持状态与关键词筛选 |
| POST | `/medical-cases` | 新建病例 |
| GET | `/medical-cases/:caseId` | 病例详情 |
| PATCH | `/medical-cases/:caseId` | 编辑病例 |
| DELETE | `/medical-cases/:caseId` | 逻辑删除病例 |
| POST | `/medical-cases/:caseId/publish-preview` | 生成匿名化讨论预览数据 |

创建请求按数据库设计中的病例分组传递，并使用独立 `imageMediaIds`、`videoMediaId` 和 `documentMediaIds` 字段。

`publish-preview` 只生成预览，不直接发布，也不修改原病例。

## 12. 学术论坛

所有接口均需认证宠物医生或认证医生助理。无权限访问统一返回 `PROFESSIONAL_REQUIRED`，列表和详情均不泄露摘要。

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/academic-topics` | 讨论列表 |
| POST | `/academic-topics` | 发布讨论 |
| GET | `/academic-topics/:topicId` | 讨论详情 |
| PATCH | `/academic-topics/:topicId` | 作者编辑讨论 |
| DELETE | `/academic-topics/:topicId` | 作者逻辑删除讨论 |
| GET | `/academic-topics/:topicId/comments` | 专业评论列表 |
| POST | `/academic-topics/:topicId/comments` | 发表评论或回复 |

从病例发布请求：

```json
{
  "topicType": "CASE_DISCUSSION",
  "sourceCaseId": 72,
  "title": "一例猫慢性食欲下降的鉴别思路",
  "body": "已匿名化的讨论正文",
  "tagIds": [11, 18],
  "imageMediaIds": [71],
  "videoMediaId": null,
  "anonymizationConfirmed": true
}
```

服务端验证 `sourceCaseId` 属于当前用户，但只保存来源关系，不直接公开原病例字段。

## 13. 搜索与分类

### 13.1 搜索

`GET /search?q=关键词&scope=COMMUNITY&limit=20&cursor=...`

`scope`：

- `COMMUNITY`：公开社区帖子。
- `QUESTIONS`：公开健康问题。
- `ACADEMIC`：学术讨论，仅认证专业用户。

第一版不提供跨全部类型混合搜索；前端通过页签切换 scope。

### 13.2 分类与标签

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/categories?scope=QUESTION` | 获取启用分类 |
| GET | `/tags?scope=COMMUNITY&q=...` | 获取或搜索启用标签 |

分类和标签的维护接口放在管理后台。

## 14. 通知

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/notifications` | 通知列表，支持未读过滤 |
| GET | `/notifications/unread-count` | 未读数量 |
| GET | `/notifications/stream` | 建立 SSE 实时通知流 |
| PUT | `/notifications/:notificationId/read` | 标记单条已读，幂等 |
| PUT | `/notifications/read-all` | 全部已读，幂等 |

通知响应只返回摘要和受控跳转目标，不携带认证材料、病例正文或完整病史。

### 14.1 SSE 实时推送

`GET /notifications/stream`

- 使用 `Content-Type: text/event-stream`。
- 浏览器 `EventSource` 自动携带同域 Session Cookie，因此不需要在 URL 中传 Token。
- 连接建立后立即发送 `connected` 事件和当前未读数。
- 有新通知时发送通知摘要；完整列表仍以通知 REST 接口和数据库记录为准。
- 服务端每 20～30 秒发送一次 heartbeat，避免代理关闭空闲连接。
- 浏览器断线后自动重连；重连成功后客户端再次请求未读数和最近通知，避免丢失事件。
- 用户退出、会话失效或账号被禁用时关闭连接。

事件示例：

```text
event: notification.created
id: 9821
data: {"notificationId":9821,"type":"QUESTION_ANSWERED","title":"你的问题收到医生回答","createdAt":"2026-10-08T08:30:00.000Z"}
```

第一版部署为单个后端实例时使用进程内事件分发。未来扩展为多个后端实例时，需要使用 Redis Pub/Sub 等跨实例消息通道；数据库中的 `notifications` 表始终是可靠记录来源。

Nginx 对该路径需要关闭响应缓冲和缓存，并延长读取超时：

```nginx
location /api/v1/notifications/stream {
    proxy_pass http://backend;
    proxy_http_version 1.1;
    proxy_buffering off;
    proxy_cache off;
    proxy_read_timeout 1h;
}
```

## 15. 举报

`POST /reports`

```json
{
  "targetType": "CONTENT",
  "targetId": 123,
  "reason": "MISLEADING_MEDICAL_INFORMATION",
  "description": "补充说明"
}
```

同一用户短时间内对同一对象重复举报返回 409。用户可通过 `GET /me/reports` 查看自己的举报及处理结果。

## 16. 管理后台 API

后台前缀：`/api/v1/admin`。使用独立的管理员 HttpOnly Session Cookie，不接受前台用户 Session。

### 16.1 后台认证

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | `/admin/auth/login` | 用户名密码登录 |
| GET | `/admin/auth/session` | 恢复后台会话并返回 CSRF Token |
| POST | `/admin/auth/logout` | 退出后台 |
| GET | `/admin/me` | 当前管理员 |

### 16.2 专业认证审核

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/admin/professional-applications` | 申请列表与筛选 |
| GET | `/admin/professional-applications/:id` | 申请详情和私密材料访问 |
| POST | `/admin/professional-applications/:id/approve` | 审核通过 |
| POST | `/admin/professional-applications/:id/reject` | 驳回并填写原因 |
| POST | `/admin/professionals/:userId/revoke` | 撤销专业身份 |

审核通过、驳回和撤销必须传 `reviewNote` 或 `reason`，并自动写审计日志。

### 16.3 内容与举报

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/admin/contents` | 内容列表，按类型/状态筛选 |
| POST | `/admin/contents/:contentId/hide` | 下架内容 |
| POST | `/admin/contents/:contentId/restore` | 恢复内容 |
| GET | `/admin/reports` | 举报列表 |
| GET | `/admin/reports/:reportId` | 举报详情 |
| POST | `/admin/reports/:reportId/resolve` | 处理举报 |
| POST | `/admin/reports/:reportId/reject` | 驳回举报 |

管理后台默认不能查看私密病例正文或无举报关联的个人提问。

### 16.4 用户、分类与标签

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/admin/users` | 用户列表和筛选 |
| GET | `/admin/users/:userId` | 用户管理摘要，不含私密病例 |
| POST | `/admin/users/:userId/disable` | 禁用用户 |
| POST | `/admin/users/:userId/restore` | 恢复用户 |
| POST/PATCH | `/admin/categories` | 创建或编辑分类 |
| POST/PATCH | `/admin/tags` | 创建或编辑标签 |
| GET | `/admin/audit-logs` | 管理操作记录 |

## 17. 速率限制

建议第一版限制：

| 接口 | 建议限制 |
| --- | --- |
| 获取验证码 | 每手机号 1 次/60 秒、10 次/天；每 IP 30 次/小时 |
| 校验验证码 | 单验证码最多失败 5 次 |
| 登录 | 每 IP 30 次/15 分钟 |
| 发布问题/帖子 | 每用户 20 次/小时 |
| 评论/回复 | 每用户 60 次/小时 |
| 关注/点赞/收藏 | 每用户 120 次/分钟 |
| 上传媒体 | 每用户 30 次/小时，另限制总字节数 |
| 搜索 | 每用户或 IP 60 次/分钟 |

超过限制返回 429，并设置 `Retry-After`。

## 18. 幂等与并发

- 登录验证码一经消费不可再次使用。
- `PUT` 点赞、收藏、关注和已读操作天然幂等。
- 发布帖子、问题、病例、学术讨论和提交认证支持 `Idempotency-Key`，相同用户和 key 在 24 小时内返回首次结果。
- 编辑资源使用 `updatedAt` 或版本号进行乐观并发检查；冲突返回 409。
- 标记有帮助、解决问题和审核认证在事务中校验当前状态。
- 媒体关联后，后台任务清理超过 24 小时未关联的临时媒体。

## 19. 审计与日志

- 每个响应返回 `requestId`。
- 日志记录方法、路由模板、状态码、耗时和调用者 ID。
- 不记录验证码、Session Token、CSRF Token、完整手机号、认证材料地址、病例正文和病史正文。
- 管理员审核、身份撤销、内容上下架、用户禁用和举报处理写 `admin_audit_logs`。
- 线上 500 错误对用户返回通用信息，详细堆栈只进入受限服务端日志。

## 20. OpenAPI 与实现约定

- 实现阶段以 OpenAPI 3.1 文件作为可执行接口契约。
- 路由层负责解析请求和返回响应，不直接写 Prisma 查询。
- 服务层负责权限、事务和业务状态流转。
- 数据访问层集中管理 Prisma 查询和默认 `deletedAt = null` 条件。
- 请求校验统一使用一个 Schema 校验库，具体依赖在实现阶段确定。
- API DTO 与 Prisma 模型分离，禁止直接返回 Prisma 对象。

## 21. 建议开发顺序

1. 通用响应、错误、请求 ID、认证中间件和校验基础设施。
2. 模拟验证码、登录、刷新、退出和当前用户。
3. 媒体上传、宠物档案与宠物病史。
4. 专业认证和后台审核。
5. 社区帖子、信息流、互动和关注。
6. 公开问题、个人提问、医生回答与病史授权。
7. 专业病例库与学术论坛。
8. 通知、搜索、举报和管理后台治理。
9. 生成 OpenAPI 文档并完成端到端权限测试。

## 22. 已确认的 API 决策

1. 前台采用 HttpOnly Cookie + 服务端 Session；前端不保存登录凭证，写操作使用独立 CSRF Token。
2. 列表统一使用游标分页，管理后台表格可在前端转换为“上一页/下一页”体验。
3. 图片、视频和文件先上传获得媒体 ID，再由业务提交接口关联，避免大型文件进入 JSON 请求。
4. 健康问题详情根据调用者身份裁剪病史和操作权限，并返回 `permissions` 对象供页面渲染。
5. 创建内容类接口支持 `Idempotency-Key`，避免网络重试产生重复内容。
6. API DTO 不直接暴露 Prisma 数据模型，也不允许客户端自由指定关联展开。
7. 第一版提供实时通知推送，采用 SSE；数据库通知记录是可靠来源，断线重连后通过 REST 接口补齐状态。
