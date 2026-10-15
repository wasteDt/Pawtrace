# Pawtrace 设计令牌规范

> 文档状态：已确认  
> 版本：v0.1  
> 更新日期：2026-10-08  
> 对应实现：[frontend/src/styles/tokens.css](../frontend/src/styles/tokens.css)

## 1. 设计方向

Pawtrace 的视觉关键词是：专业、可信、清晰、克制、适度亲和。

- 医疗青绿作为主品牌色，传达健康、专业和稳定。
- 暖橙作为宠物亲和点缀，不承担大面积主操作和医疗状态表达。
- 中性色略带绿相，让页面比纯灰更温和，但保持医疗产品的严谨感。
- 状态色遵循通用语义，不用品牌色代替危险、警告或成功状态。
- 第一版仅定义亮色主题，暂不承诺暗色主题。

## 2. 令牌分层

令牌分为三层：

1. 原始令牌：固定色阶、尺寸和数值，如 `--color-primary-600`。
2. 语义令牌：表达用途，如 `--color-text-primary`、`--color-bg-surface`。
3. 组件令牌：组件内部组合语义令牌。第一版组件开发时按需补充，不直接复制原始色值。

业务代码应优先使用语义令牌。只有制作色板、图表或需要明确色阶时才直接使用原始令牌。

## 3. 品牌色

### 3.1 主色：Clinical Teal

| 令牌 | 色值 | 用途 |
| --- | --- | --- |
| `--color-primary-50` | `#E6F7F3` | 淡品牌背景 |
| `--color-primary-100` | `#CCEEE7` | 选中背景、浅边框 |
| `--color-primary-300` | `#69C5B7` | 图表或装饰 |
| `--color-primary-500` | `#168C7F` | 聚焦边框、辅助按钮 |
| `--color-primary-600` | `#0F766E` | 主按钮、品牌背景 |
| `--color-primary-700` | `#105E58` | 链接文字、主按钮悬停 |
| `--color-primary-800` | `#104B47` | 主按钮按下 |
| `--color-primary-950` | `#062624` | 深色品牌区域 |

主按钮默认使用 `primary-600` 配白字，悬停使用 `primary-700`，按下使用 `primary-800`。

### 3.2 点缀色：Warm Pet Accent

| 令牌 | 色值 | 用途 |
| --- | --- | --- |
| `--color-accent-50` | `#FFF4DF` | 宠物信息浅背景 |
| `--color-accent-200` | `#FFD17A` | 装饰、插画 |
| `--color-accent-400` | `#F59B24` | 小面积强调 |
| `--color-accent-500` | `#D97706` | 图标或标签，不配小号白字 |
| `--color-accent-700` | `#92400E` | 暖色背景上的强调文字 |

暖橙不用于错误提示、紧急医疗提示或主要提交按钮，避免语义混淆。

## 4. 中性色与页面层级

| 语义令牌 | 默认映射 | 用途 |
| --- | --- | --- |
| `--color-bg-canvas` | `neutral-50` | 页面底色 |
| `--color-bg-surface` | `white` | 卡片、弹窗、表单区域 |
| `--color-bg-subtle` | `neutral-100` | 次级区域、禁用底色 |
| `--color-text-primary` | `neutral-900` | 标题和正文主信息 |
| `--color-text-secondary` | `neutral-600` | 辅助说明 |
| `--color-text-tertiary` | `neutral-500` | 时间、统计和弱提示 |
| `--color-border-default` | `neutral-200` | 常规边框和分割线 |
| `--color-border-strong` | `neutral-300` | 输入框和强调分割线 |

页面以浅灰绿画布承载白色内容表面。卡片优先依靠边框区分，阴影只用于悬浮层或需要强调的容器。

## 5. 状态色

| 状态 | 背景 | 文字 | 典型用途 |
| --- | --- | --- | --- |
| 成功 | `--color-status-success-bg` | `--color-status-success-text` | 认证通过、保存成功、已解决 |
| 警告 | `--color-status-warning-bg` | `--color-status-warning-text` | 审核中、需要关注、非紧急提醒 |
| 危险 | `--color-status-danger-bg` | `--color-status-danger-text` | 紧急就医、删除、认证驳回 |
| 信息 | `--color-status-info-bg` | `--color-status-info-text` | 普通说明、流程提示 |

状态表达必须同时包含文字或图标，不能只通过颜色表达。

健康问题状态建议：

- 待回答：警告色。
- 已回答：信息色。
- 已解决：成功色。
- 已关闭：中性色。
- 紧急就医提示：危险色。

## 6. 字体

字体栈：

```css
Inter, "PingFang SC", "Microsoft YaHei", "Noto Sans CJK SC", system-ui, sans-serif
```

- 中文依赖系统字体，第一版不额外下载 Web 中文字体，减少首屏体积。
- 数字和英文优先使用 Inter；系统未安装时自动回退。
- 正文默认 `16px / 1.6`，医疗说明不低于 `14px`。
- 正文常规字重为 400，标签和按钮使用 500 或 600，避免大量粗体。

### 字体角色

| 角色 | 字号/行高 | 字重 | 用途 |
| --- | --- | --- | --- |
| Display | `48–60px / 1.2` | 700 | 营销页主标题，产品内少用 |
| H1 | `36px / 1.2` | 700 | 桌面页面标题 |
| H2 | `30px / 1.3` | 700 | 大区块标题 |
| H3 | `24px / 1.3` | 600 | 卡片组或详情区标题 |
| H4 | `20px / 1.3` | 600 | 卡片标题 |
| Body L | `18px / 1.6` | 400 | 重要正文、病例阅读 |
| Body M | `16px / 1.6` | 400 | 默认正文和表单输入 |
| Body S | `14px / 1.6` | 400 | 辅助信息 |
| Caption | `12px / 1.6` | 500 | 时间、统计、徽章 |

移动端 H1 建议降为 30px，H2 降为 24px。

## 7. 间距

采用 4px 基础网格：

| 令牌 | 值 | 常见用途 |
| --- | --- | --- |
| `--space-1` | 4px | 图标内部微间距 |
| `--space-2` | 8px | 紧密元素、徽章 |
| `--space-3` | 12px | 标签与输入框内部间距 |
| `--space-4` | 16px | 默认组件间距 |
| `--space-6` | 24px | 卡片内边距、小区块间距 |
| `--space-8` | 32px | 大区块间距 |
| `--space-12` | 48px | 页面模块间距 |
| `--space-16` | 64px | 桌面页头与大区块 |

组件内部不创建随意的 13px、17px 等间距；确有视觉需求时先判断是否应补充令牌。

## 8. 圆角

| 令牌 | 值 | 用途 |
| --- | --- | --- |
| `--radius-xs` | 4px | 小标签、进度条 |
| `--radius-sm` | 8px | 小按钮、提示块 |
| `--radius-md` | 12px | 输入框、常规按钮、卡片 |
| `--radius-lg` | 16px | 大卡片、抽屉 |
| `--radius-xl` | 24px | 模态框、重要展示卡片 |
| `--radius-full` | 9999px | 头像、胶囊标签 |

专业医疗页面优先使用 `md` 和 `lg`，避免所有容器都使用过大的圆角。

## 9. 阴影与边框

- 默认卡片：`1px solid var(--color-border-default)` + `--shadow-xs`。
- 悬停卡片：边框保持，最多提升至 `--shadow-sm`。
- 下拉菜单：`--shadow-md`。
- 抽屉和弹窗：`--shadow-overlay`。
- 输入框聚焦：品牌边框 + `--shadow-focus`。
- 普通页面容器不使用 `--shadow-lg` 或更重阴影。

## 10. 控件尺寸

| 令牌 | 值 | 用途 |
| --- | --- | --- |
| `--control-height-sm` | 32px | 桌面紧凑筛选、标签按钮 |
| `--control-height-md` | 40px | 默认输入框和按钮 |
| `--control-height-lg` | 48px | 登录、发布等主要表单 |
| `--touch-target-min` | 44px | 移动端最小触控区域 |

- 输入框和按钮正文不得小于 14px。
- 同一操作组内控件高度一致。
- 图标按钮的可点击区域不得小于 40px，移动端不得小于 44px。

## 11. 布局令牌

| 令牌 | 值 | 用途 |
| --- | --- | --- |
| `--header-height-desktop` | 64px | 桌面顶栏 |
| `--bottom-nav-height-mobile` | 64px | 移动底栏，不含安全区 |
| `--content-width-reading` | 760px | 问答、病例、帖子正文 |
| `--content-width-page` | 1200px | 桌面页面最大宽度 |
| `--sidebar-width` | 280px | 桌面辅助侧栏 |

响应式断点作为 CSS 媒体查询常量记录，不声明为 CSS 自定义属性：

- Mobile：`< 768px`
- Tablet：`768px–1199px`
- Desktop：`≥ 1200px`

## 12. 动效

- 即时反馈：80ms。
- 按钮、标签和颜色过渡：150ms。
- 抽屉、弹窗和折叠区域：240ms。
- 大面积页面过渡上限：360ms。
- 默认缓动：`--ease-standard`。
- 尊重 `prefers-reduced-motion`，开启减少动态效果时将令牌持续时间归零。
- 医疗提醒、错误信息和验证码不使用持续晃动或闪烁动画。

## 13. 层级

| 令牌 | 值 | 用途 |
| --- | --- | --- |
| `--z-sticky` | 100 | 固定导航、吸顶操作栏 |
| `--z-dropdown` | 300 | 下拉菜单、日期选择器 |
| `--z-overlay` | 500 | 遮罩 |
| `--z-modal` | 600 | 弹窗、抽屉 |
| `--z-toast` | 800 | 全局消息 |
| `--z-tooltip` | 900 | 工具提示 |

业务组件禁止使用任意极大值，例如 `99999`。

## 14. 组件令牌映射

### 14.1 主按钮

```css
background: var(--color-bg-brand);
color: var(--color-text-inverse);
height: var(--control-height-md);
border-radius: var(--radius-md);
font-weight: var(--font-weight-semibold);
```

### 14.2 输入框

```css
background: var(--color-bg-surface);
color: var(--color-text-primary);
border: 1px solid var(--color-border-strong);
height: var(--control-height-md);
border-radius: var(--radius-md);
```

### 14.3 内容卡片

```css
background: var(--color-bg-surface);
border: 1px solid var(--color-border-default);
border-radius: var(--radius-lg);
box-shadow: var(--shadow-xs);
padding: var(--space-6);
```

### 14.4 专业身份徽章

- 宠物医生：主色浅背景 + `--color-text-brand`，配医疗十字或认证图标。
- 医生助理：信息色浅背景 + `--color-status-info-text`，明确显示“医生助理”。
- 身份不能只靠颜色区分，必须显示完整文字。

## 15. 无障碍要求

- 普通文字与背景对比度目标不低于 4.5:1。
- 大号文字与背景对比度目标不低于 3:1。
- 表单焦点必须清晰可见，不移除焦点样式。
- 暖橙 `accent-500` 不用于白底小号正文，也不作为白字按钮背景。
- 所有状态均配文字或图标。
- 医疗危险提示使用危险色，但正文仍保持足够对比度。

## 16. 工程使用规则

```css
/* 推荐 */
.card {
  color: var(--color-text-primary);
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border-default);
}

/* 不推荐 */
.card {
  color: #17231f;
  background: #fff;
  border: 1px solid #dce4e1;
}
```

- 新页面禁止直接添加与令牌重复的十六进制色值。
- 语义变化时修改令牌映射，不在各页面批量替换色值。
- 组件出现稳定且重复的视觉模式后，再补充 `--button-*`、`--input-*` 等组件级令牌。
- CSS 中先加载 `tokens.css`，再加载全局样式和组件样式。

## 17. 已确认的视觉决策

1. 主品牌色采用医疗青绿 `#0F766E`，暖橙仅作为宠物亲和点缀。
2. 第一版只提供亮色主题，不做暗色主题。
3. 默认卡片以边框为主、轻阴影为辅，避免过度悬浮的视觉效果。
4. 中文使用系统字体，不额外加载体积较大的中文 Web 字体。
5. 宠物医生和医生助理使用不同颜色与文字徽章，但不通过颜色单独表达身份。
