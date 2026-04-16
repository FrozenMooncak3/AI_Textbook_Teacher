---
date: 2026-04-07
topic: UX重设计Brainstorm交接文档
type: spec
status: resolved
keywords: [UX, brainstorm-chain, redesign, Amber-Companion]
---

# UX 重设计 — Brainstorm Chain

> 这个文件是多次 brainstorm 之间的交接文档。每次 session 开始时必须读取此文件。

---

## Chain 总览

| 次数 | 目标 | 产出 | 状态 |
|------|------|------|------|
| **第一次**（2026-04-07） | 行业调研 + 核心页面方向 | 本文件 + wireframe + journal | **已完成** |
| **第二次**（2026-04-08） | 补齐全部页面 + Stitch prompt + 第三次指引 | `stitch-prompts.md` + 更新本文件 | **已完成** |
| **第 2.5 次**（2026-04-08） | MCP 接入 + Stitch 生成全部页面 + 导出 + 审阅 | Stitch 截图/代码 + 完整审阅报告 | **已完成** |
| **第三次**（2026-04-08） | Scope 决策 + 后端代码分析 + Token 提取 | scope 结论 + `design-tokens.md` + 第四次指引 | **已完成** |
| **第四次**（2026-04-08） | 前端组件深度映射 → 最终 design spec → 实施计划 | `2026-04-08-ux-redesign-spec.md` + `2026-04-08-ux-redesign.md` | **已完成** |

---

## 第一次 Brainstorm 成果（2026-04-07）

### 行业调研结论

调研了 Coursera、Khan Academy、Duolingo、Quizlet、Notion、Anki 六个平台。

**5 条铁律**：
1. **进度不独立成页** — 没有主流平台把仪表盘做成需要跳转的页面。进度融入内容结构（颜色/图标/进度条）
2. **3-5 个子视图用顶部 Tab，不用侧栏** — 侧栏适合 app 全局导航，不适合书内视图切换
3. **客户端切换，拒绝整页 Loading** — Tab 切换是即时的，用 SPA 模式
4. **移动端用底部 Tab Bar**
5. **行动入口融入结构** — "今日待复习"、"可参加测试"直接标在模块卡片上

### 核心设计决策

#### 决策 1：书首页 = Action Hub

**什么**：用户点击一本书后的落地页。合并了原来独立的"模块地图"和"仪表盘"页面。

**布局**：
- Hero CTA 区域：当前学习进度环 + "继续学习 [模块名]" 大按钮 + 进度摘要
- 行动提醒卡片：待复习数量（可点击直接跳转复习）、错题数量（可点击跳转错题本）
- 模块状态网格：所有模块以卡片网格显示，颜色/样式区分状态（已完成/进行中/未开始），显示分数和进度
- 底部折叠区：最近考试成绩

**参考**：Option 2 (Action Hub) wireframe — `wireframe/0704-book-dashboard/index.html`

**用户反馈**："方向对但不够 fancy" → 视觉美化交给 Stitch

#### 决策 2：模块学习页 = Split Panel

**什么**：点击 Action Hub 中任意模块后进入的学习页面。

**布局**：
- 左侧栏（可折叠）：模块内的知识点(KP)列表，每个 KP 可点击跳转到对应的 QA 题目
- 右侧内容区：学习流程（指引 → 阅读 → QA → 笔记 → 测试）
- 左侧栏可以关掉，给内容区更多空间

**参考**：Option 5 (Split Panel) wireframe

#### 决策 3：砍掉 Learning Path

**原方案**：Action Hub → Learning Path（Duolingo 路径）→ Split Panel
**最终方案**：Action Hub → Split Panel（直接跳转）
**理由**：Action Hub 的模块网格已经显示全部模块状态，再加一页是重复信息 + 多一次点击。Khan Academy 同样做法。

#### 决策 4：侧栏导航简化

- 书内导航（模块地图/仪表盘）从侧栏**移除**
- 侧栏只保留 app 级导航：首页、上传、（未来：设置）
- 书内视图切换通过 Action Hub 的模块网格和行动卡片

### 用户流（最终版）

```
首页（书目列表）
    ↓ 点击一本书
Action Hub（Hero CTA + 行动提醒 + 模块网格）
    ↓ 点"继续学习"或点任意模块
Split Panel（左边 KP 目录可折叠/跳转，右边学习内容）
    ↓ 在 Split Panel 内完成 指引→阅读→QA→笔记→测试 全流程
```

### 用户报告的 Bug/UX 问题

#### PDF 处理卡在 preparing 0/0
- 来源：`PdfViewer.tsx:125` 状态横幅 `PREPARING PDF (${ocrCurrent}/${ocrTotal})...`
- 原因：`ocr_current_page` 和 `ocr_total_pages` 都是 0，OCR 未启动或未回写进度
- 待确认：用户运行环境（Docker 三容器 vs 本地）

#### PDF 阅读器 UX 问题（5 项）
| 问题 | 代码位置 | 难度 | 方案 |
|------|----------|------|------|
| UI 太丑（默认主题） | `PdfViewer.tsx` 使用 `@react-pdf-viewer/default-layout` | 中 | CSS 主题覆盖或换 Stitch 风格 |
| 目录不能跳转 | bookmark plugin 可能未正确配置 | 低 | 检查 `defaultLayoutPlugin` 配置 |
| 组件英文 | react-pdf-viewer 默认英文 locale | 低 | 设置 `localization` 参数为中文 |
| 默认缩放 300% | 未设置 `defaultScale` | 低 | 设 `defaultScale={1.2}` 或 `SpecialZoomLevel.PageWidth` |
| 切页面不记住位置 | 无持久化逻辑 | 低 | localStorage 存/读 `currentPage`，用 `initialPage` 恢复 |

### Stitch 工具信息

- **是什么**：Google Labs 的 AI UI 设计工具（不是 Anthropic 的）
- **地址**：stitch.withgoogle.com，Google 账号登录，免费 350 次/月
- **输入**：自然语言描述 UI
- **输出**：React + Tailwind CSS、HTML/CSS、Figma、`design.md`
- **关键能力**：一次最多 5 个页面
- **转代码**：导出 design.md → 映射到 tailwind.config.js → Gemini 按参考实现
- **限制**：生成静态 UI，不含状态管理/API 集成/认证逻辑
- **Prompt 指南**：https://discuss.ai.google.dev/t/stitch-prompt-guide/83844（第二次 brainstorm 必须先读取此链接）

### Wireframe 文件

- 位置：`wireframe/0704-book-dashboard/index.html`
- 5 个选项：Safe Merge / Action Hub / Status Grid / Learning Path / Split Panel
- 用户选择：Action Hub + Split Panel 融合

---

## 第二次 Brainstorm 成果（2026-04-08）

### 深度调研

对 7 类页面做了行业调研（Coursera/Duolingo/Brilliant/Kindle/微信读书/作业帮/Anki/RemNote 等），提取了每类页面的行业共识、分歧点和最佳实践。

### 新增设计决策

| 决策 | 结论 | 理由 |
|------|------|------|
| 测试页跳题 | 允许跳题+返回+提交前检查页 | Coursera/Khan 共识，教材考试需要答题策略 |
| 测试中途退出 | 允许，弹警告，保存进度可恢复 | 用户要求 |
| 错题练习按钮 | MVP 标记到下次复习 | 简单方案，避免新建临时会话机制 |
| 复习显示轮次 | 显示（第几轮/间隔天数） | 帮用户理解间隔重复节奏 |
| 邀请码方式 | URL 参数（/register?code=XXX） | 行业最佳实践，比表单字段更干净 |
| 认证系统 | 做全：登录+注册+忘记密码+邮箱验证 | 用户要求 |
| Q&A 反馈模式 | 底部滑出面板（答案留着，反馈从底部滑上） | Duolingo/Brilliant/Khan 三家共识 |
| 首页单书 | 大号 hero 卡片而非孤零零的小网格 | Coursera 模式 |

### 产出文件

- Stitch prompts：`docs/superpowers/specs/stitch-prompts.md`（10 个页面 + 设计系统 + 使用说明）

---

## 第二次 Brainstorm 指令（已完成，以下保留原始指令供参考）

> 下一个 session 的 Claude 必须按以下步骤执行。

### 前置准备
1. 调用 session-init（读项目状态）
2. 读取本文件（`docs/superpowers/specs/2026-04-07-ux-redesign-chain.md`）获取第一次 brainstorm 全部成果
3. 读取 `docs/journal/2026-04-07-ux-redesign-brainstorm.md` 获取详细讨论记录
4. 读取 Stitch prompt guide：`https://discuss.ai.google.dev/t/stitch-prompt-guide/83844`

### 任务 A：补齐剩余页面方向

与用户讨论并确定以下页面的布局方向：

| 页面 | 要讨论的问题 |
|------|-------------|
| **首页（书目列表）** | 卡片 vs 列表？显示哪些信息？空状态？ |
| **PDF 阅读器** | 在当前 react-pdf-viewer 基础上定制，还是换方案？工具栏要哪些按钮？ |
| **Q&A 答题** | 在 Split Panel 右侧展示？还是独立全屏？ |
| **测试页** | 同上 |
| **错题本** | 书级 vs 模块级？筛选维度？ |
| **复习页** | 和 Q&A 复用布局？还是独立设计？ |

可以用 `/wireframe` 生成 wireframe 辅助讨论。

### 任务 B：生成 Stitch Prompt

基于 Stitch prompt guide + 全部已定设计决策，为每个页面写一个 Stitch prompt：

要求：
- 每个 prompt 包含：页面用途、布局描述、交互说明、数据内容示例
- 保持风格一致性（在第一个页面 prompt 中定义设计系统，后续 prompt 引用）
- 用中文写功能描述，Stitch prompt 本身用英文（Stitch 对英文理解更好）
- 输出到 `docs/superpowers/specs/stitch-prompts.md`

### 任务 C：写第三次 Brainstorm 指令

更新本文件的"第三次 Brainstorm 指令"部分，包含：
- 用户需要带来什么（Stitch 生成的截图/代码/design.md）
- 如何从 Stitch 输出导出可用的设计 token
- 如何生成最终前端 spec
- 如何派发给 Gemini 实现

---

## 第 2.5 次 Brainstorm 成果（2026-04-08）

### Stitch 项目信息

- **Project ID**: `2533257689618969188`
- **Title**: "AI Textbook Design System"
- **Design System**: "Amber Companion" — 暖橙色调 + cream 背景
- **MCP 工具已验证可用**：create_project, generate_screen_from_text, edit_screens, get_screen, list_screens 等

### Screen 映射（共 11 个可见 screen）

| # | Stitch Screen ID | Stitch Title | 对应页面 | 本地截图 |
|---|-----------------|-------------|---------|---------|
| 0 | `7ac35f08b5fb46328167e07a6352c0cc` | Style Tile: Amber Companion | 设计系统 | page0.png |
| 1 | `7fae7a5cc8654e12a7e940df7da7618e` | Homepage - AI Textbook Teacher (Amber) | 首页/书目列表 | page1.png |
| 2 | `7729bc57492749bcade73c3ec72cee4c` | Macroeconomics Landing Page | Action Hub | page2.png |
| 3 | `8a1d7269c17541a7b1c3026ac7de723a` | Login Page | 登录 | page3.png |
| 4 | `bda9398cbbf94b76a7e122691a1ca954` | Registration Page | 注册 | page4.png |
| 5 | `30f21a98bf2b4927aba79f37ffc3cfb5` | Forgot Password States | 忘记密码（两状态） | page5.png |
| 6 | `669fdba6125d470dbe9dfd610e54f995` | Module Learning - Q&A Mode | Q&A Split Panel | page6.png |
| 7 | `45bba49b3aa041b999349c4cc39a5478` | Module Test - Exam Mode | 测试/考试 | page7.png |
| 8 | `49ecb732a11540c2b58688404ed3f7a1` | Mistake Notebook - Macroeconomics | 错题本 | page8.png |
| 9 | `cac16c9485894a92840582c147cff728` | Review Session - Start Screen | 复习启动屏 | page9.png |
| 10 | `9e1c5ee5bb4b4a09b80af610aba9fa3d` | Review Session - In-Session View | 复习答题中 | （无单独截图） |

### HTML 代码文件（已下载到本地）

所有 HTML 保存在 `wireframe/stitch/code/`：

| 文件 | 对应页面 | 大小 |
|------|---------|------|
| `style-tile.html` | 设计系统 | 19KB |
| `homepage.html` | 首页 | 14KB |
| `action-hub.html` | Action Hub | 17KB |
| `login.html` | 登录 | 8KB |
| `register.html` | 注册 | 10KB |
| `forgot-password.html` | 忘记密码 | 9KB |
| `qa-mode.html` | Q&A 学习页 | 15KB |
| `test-exam.html` | 测试页 | 13KB |
| `mistakes.html` | 错题本 | 18KB |
| `review-start.html` | 复习启动屏 | 15KB |
| `review-session.html` | 复习答题中 | 13KB |

### 设计系统 Token（从代码中提取）

```javascript
// 颜色系统（Material 3 风格，暖橙色调）
colors: {
  primary: "#a74800",           // 深橙，主交互色
  "primary-container": "#ff7a23", // 亮橙，CTA 渐变
  "primary-fixed": "#ff7a23",
  "primary-fixed-dim": "#f06c0b",
  secondary: "#9b5100",
  "secondary-container": "#ffc69d",
  tertiary: "#845d00",          // 金色，复习/提醒
  "tertiary-container": "#febb28",
  error: "#be2d06",
  "error-container": "#f95630",
  surface: "#fffbff",           // 页面底色
  "surface-container": "#f8f4e2", // 卡片/面板底色
  "surface-container-low": "#fefae8", // 侧栏底色
  "surface-container-lowest": "#ffffff", // 白卡片
  "surface-container-high": "#f2eedb",
  "on-surface": "#39382d",      // 主文字
  "on-surface-variant": "#666558", // 次级文字
  outline: "#838174",
  "outline-variant": "#bcb9ab",
}

// 字体（用户确认使用 Stitch 的，不改回 Geist）
fontFamily: {
  headline: ["Plus Jakarta Sans"],  // 标题
  body: ["Be Vietnam Pro"],         // 正文
  label: ["Plus Jakarta Sans"],     // 标签
}

// 圆角
borderRadius: {
  DEFAULT: "1rem",   // 16px
  lg: "2rem",        // 32px
  xl: "3rem",        // 48px
  full: "9999px",
}

// 渐变
".amber-glow": "linear-gradient(135deg, #a74800 0%, #ff7a23 100%)"

// 图标
// Material Symbols Outlined（Google 图标库）
```

### 完整审阅报告

#### 全局问题（所有页面共性，spec 中必须解决）

| 问题 | 严重度 | 说明 | 解决方式 |
|------|--------|------|---------|
| **游戏化元素** | 高 | "Level 12 Researcher"、"+15 XP"、"Key Term Mastery"、"Upgrade to Pro" | Gemini 实现时删除 |
| **App 名字不统一** | 高 | 出现 "The Illuminated Companion"、"The Scholar"、"学伴 Companion"、"RK" logo | 统一为 **AI 教材精学老师** |
| **导航不统一** | 中 | 部分页面侧栏展开带文字，部分收缩为 icon-only | 统一展开 240px 带文字 |
| **MVP 外功能** | 中 | "Community"、"Flashcards"、"Resources"、"Companion Insight" | Gemini 实现时不做 |
| **邮箱验证页缺失** | 低 | Page 10 未生成 | 跳过，布局参考 forgot-password.html |

#### 逐页审阅

**Page 0 — Style Tile** ✅ OK
- 暖橙色调、cream 底色、Material 3 token 体系

**Page 1 — 首页** ⚠️ 需微调
- ✅ 侧栏展开、书卡片紧凑、渐变封面、进度条、badge、FAB
- ❌ 删 "The Scholar / Level 12 Researcher"、删 "Upgrade to Pro"
- ⚠️ 单书 hero 模式未展示（Gemini 需实现两种布局）

**Page 2 — Action Hub** ⚠️ 需微调
- ✅ Hero CTA + 进度环、Reviews Due / Mistakes 卡片、模块列表、面包屑
- ❌ 删右侧 "Companion Insight" 面板、删 "New Entry" / "View Syllabus"

**Page 3 — 登录** ⚠️ 小修
- ✅ 居中卡片、中文标签、忘记密码/注册链接
- ❌ 换 logo（"RK" → 产品 logo/图标）、删英文 copyright

**Page 4 — 注册** ⚠️ 小修
- ✅ 所有字段中文、邀请码 badge
- ❌ 换 logo

**Page 5 — 忘记密码** ⚠️ 小修
- ✅ 两个状态、中文文案、遮罩邮箱
- ❌ 顶部 "学伴 Companion" → "AI 教材精学老师"

**Page 6 — Q&A 学习页** ⚠️ 核心页面，需修复
- ✅ Split Panel 完美：左侧 KP 列表 + 右侧题目 + 底部 40% 反馈面板
- ✅ 分段进度条、面包屑、Short Answer badge
- ❌ 侧栏改为展开带文字（当前是 icon-only）
- ❌ 删 "+15 XP"、"Key Term Mastery"、"Community" 图标
- 代码结构：`h-screen overflow-hidden`，反馈面板 `absolute bottom-0 h-[40%]`

**Page 7 — 测试页** ⚠️ 需删 hint
- ✅ 全屏无侧栏、EXAM MODE badge、选择题卡片、数字导航器、Flag for Review
- ❌ **必须删底部 hint** — 违反产品不变量 #3

**Page 8 — 错题本** ⚠️ 需清理
- ✅ 筛选栏、Toggle unresolved、展开卡片（答案对比 + AI 诊断）
- ❌ 删 "The Illuminated Companion" 导航、删 "+ Add Mistake"

**Page 9 — 复习启动屏** ⚠️ 需清理
- ✅ KP mastery 列表、briefing 卡片、轮次/间隔信息、Mastery Distribution
- ❌ 删 "Flashcards" / "Resources" 导航

**Page 10 — 复习答题中** ⚠️ 同 Q&A 问题
- 与 page6 共用 Split Panel 布局，需同样修复侧栏和游戏化

### 用户决策（2026-04-08 确认）

1. **整体方向**：认可暖橙色调 + 全部页面布局，但所有问题必须解决
2. **字体**：使用 Stitch 的 Plus Jakarta Sans + Be Vietnam Pro，不改回 Geist
3. **邮箱验证页**：跳过，布局代码保存在 `wireframe/stitch/code/forgot-password.html` 供未来参考

### 第三次 Brainstorm 进度

- ✅ 任务 A（审阅 Stitch 输出）— 已完成，见上方审阅报告
- 🔄 任务 B/C/D（提取 token → 写 spec → 出计划）— brainstorm 已启动
- ⚠️ **未回答的 scope 问题**：这次重设计的后端变更边界

**Scope 问题详情**：

| 设计元素 | 需要的后端工作 | 复杂度 |
|----------|---------------|--------|
| 测试页跳题 + Flag | 保存标记状态、允许非顺序答题 | 中 |
| 复习启动屏 briefing | 新 API 聚合复习元数据 | 低 |
| 忘记密码流程 | 发邮件 + reset token + 新 API | 高 |
| Action Hub 合并 | 合并 module-map + dashboard 数据 | 低 |

**Claude 推荐**：视觉重设计 + 低复杂度后端调整优先，忘记密码和测试跳题后做。

---

## 第 2.5 次 Brainstorm 指令（Stitch MCP 生成全部页面）——已完成

> 由第二次 brainstorm 填写（2026-04-08）。
> 本次任务：用 Stitch MCP 工具直接生成所有页面，不再让用户手动复制粘贴。

### 前置准备

1. 读取本文件（chain 全文）— 特别注意"第二次 Brainstorm 成果"和"关键经验"部分
2. 读取 `docs/superpowers/specs/stitch-prompts.md`（全部 10 个页面的 prompt）
3. 验证 Stitch MCP 是否可用（`.mcp.json` 已配置好，重启后应自动加载）
4. 用 ToolSearch 搜索 stitch 相关工具，了解可用的 MCP 操作（创建 project、生成页面、导出代码等）

### 关键经验（从第二次 brainstorm 手动操作中总结）

**必须遵守：**

1. **不要过度约束 Stitch** — 用户发现 Stitch 自由发挥（page0）比按详细 prompt 生成（page1）效果更好。给组件和内容，让 Stitch 自己发挥设计感。
2. **所有 prompt 必须以这段开头**（这是生成 page0 好效果的原始风格描述）：
   ```
   An educational web app with a warm, friendly color palette. Primary color: warm orange (#f97316). Page background: soft warm cream (#fffbeb). Cards: white with rounded-3xl corners and subtle warm shadows. Use colorful filled icons instead of outlined ones. Status colors should be softer/pastel versions. The overall feel should be inviting and approachable, like a friendly learning companion — think Duolingo's warmth but more mature.
   ```
3. **侧栏要展开带文字**，不要 collapsed icon-only（page0 的展开侧栏比 page1 的收缩侧栏好看很多）
4. **书卡片不要太大** — page1 的封面图太高，占了 70% 视口。卡片应该紧凑。
5. **不要加游戏化元素** — Stitch 会自己加 "Daily Goal"、"Streak" 之类的东西，需要明确排除。
6. **页面高度 = 一个浏览器窗口**，不要生成需要大量滚动的超长页面。

### 当前 Stitch 状态

用户已经在 Stitch 网页上手动生成了：
- **Batch 1 project**：page0（设计系统 style tile）+ page1（首页/Homepage）— 截图在 `wireframe/stitch/page0.png` 和 `wireframe/stitch/page1.png`
- page0 效果好（用户说"挺完美"），page1 有问题（书太大、侧栏收缩了、多了游戏化元素）

**以下页面还没生成，需要用 MCP 完成：**

| 页面 | 对应 stitch-prompts.md 中的 | 备注 |
|------|---------------------------|------|
| 首页（重做） | Page 1 | page1 需要修：书卡片缩小、侧栏展开、去掉游戏化 |
| Action Hub | Page 2 | 书落地页 |
| 登录 | Page 3 | 无侧栏，居中卡片 |
| 注册 | Page 4 | 同上 + 邀请码徽章 |
| 忘记密码 | Page 5 | 两个状态并排 |
| Q&A 学习页 | Page 6 | Split Panel，含底部反馈面板 |
| 测试页 | Page 7 | 全屏考试模式，无侧栏 |
| 错题本 | Page 8 | 卡片列表 + 筛选栏 + 展开 |
| 复习启动屏 | Page 9 | 两个状态：启动屏 + 答题中 |
| 邮箱验证 | Page 10 | 居中卡片，确认状态 |

### 任务 A：验证 MCP 并探索工具

1. 用 ToolSearch 搜索所有 stitch MCP 工具
2. 了解工具能力：创建 project、添加页面、修改页面、导出代码、导出截图
3. 如果 MCP 不可用，告诉用户需要检查 `.mcp.json` 配置或 API key

### 任务 B：用 MCP 生成全部页面

分两个 Stitch project（每个最多 5 页）：

**Project 1**（入口页面）：
1. 首页（修正版：书卡片缩小、侧栏展开、无游戏化）
2. Action Hub
3. 登录
4. 注册
5. 忘记密码

**Project 2**（学习流程页面）：
6. Q&A 学习页（Split Panel + 反馈面板）
7. 测试页（全屏考试模式）
8. 错题本
9. 复习启动屏 + 答题状态
10. 邮箱验证

每个页面生成后：
- 截图保存到 `wireframe/stitch/` 目录
- 让用户过目确认（给用户看截图，问"这个 OK 吗"）
- 不满意的用 follow-up prompt 微调（每次只改 1-2 处）

### 任务 C：导出 Stitch 产出

全部页面确认后：
1. 导出每个 project 的 React + Tailwind 代码
2. 导出 design.md（如果 MCP 支持）
3. 将代码保存到 `wireframe/stitch/code/` 目录
4. 将 design.md 保存到 `wireframe/stitch/design.md`

### 任务 D：流入第三次 Brainstorm

所有页面生成完毕后，**直接进入第三次 brainstorm 的任务**（不需要新开 session）：
- 审阅全部输出
- 提取设计 token
- 写最终前端 spec
- 出实现计划

详见下方"第三次 Brainstorm 指令"。

---

## 第三次 Brainstorm 成果（2026-04-08）

### 方法论

用两路并行审阅：
1. **Stitch MCP 直连**：拉取 project 的全部 11 个 screen，查看截图和 HTML 代码
2. **Explore Agent**：独立审阅全部 HTML 文件 + 全部后端 API 源码，分析后端变更边界

然后手动读了 5 个关键后端文件交叉验证：`test/generate`、`test/submit`、`review/generate`、`dashboard`、`module-map`。

### Scope 决策（用户已确认 ✅）

#### 本次 UX 里程碑纳入

| 项目 | 后端变更 | 前端变更 | 说明 |
|------|---------|---------|------|
| **全部 11 页视觉重设计** | 零 | 高 | 应用 Amber Companion 设计系统 |
| **Action Hub 合并** | 零 | 高 | dashboard API 已返回所有需要的数据 |
| **测试跳题/Flag/导航** | 零 | 高 | test/submit 已是批量提交，跳题纯前端 |
| **复习 briefing 屏** | 低（1 GET 端点） | 中 | 新增 `GET /review/[scheduleId]/briefing` |
| **Q&A KP 进度** | 低（1 聚合查询） | 低 | 可选增强 |

#### 延后到独立里程碑

| 项目 | 原因 |
|------|------|
| **忘记密码** | 需邮件基础设施（Resend/SendGrid）— 这是一个**难以反悔**的选型决策，需要产品负责人参与 |

### 关键发现

#### 测试跳题：后端零改动

- `test/generate`（`src/app/api/modules/[moduleId]/test/generate/route.ts`）一次返回全部题目
- `test/submit`（`src/app/api/modules/[moduleId]/test/submit/route.ts` 第 66 行）接收 `{ paper_id, answers: [{question_id, user_answer}] }` — **已是批量提交**
- 现有 "cached paper" 机制：未提交的 paper 再次调 generate 时直接返回已有题目
- Flag 状态用 React state 或 localStorage 即可，无需持久化
- 答题进度用 localStorage 保存（刷新不丢），最终一次性 submit

#### Action Hub：后端零改动

dashboard API（`src/app/api/books/[bookId]/dashboard/route.ts`）已返回：
- `book.completedModules / book.totalModules` → 进度环百分比
- `modules[].learningStatus` → 模块状态 badge
- `reviewsDue.length` → "X Reviews Due" 行动卡片
- `mistakesSummary.total` → "X Mistakes" 行动卡片
- "Continue Learning" 目标 = 第一个非 completed 模块（前端 derive）

#### 复习 briefing：1 个新端点

`GET /api/review/[scheduleId]/briefing` 需聚合：
- `review_schedule.review_round` → Round N
- JOIN `modules` → 模块名
- `buildAllocations()` 逻辑（已存在于 review/generate）→ 预估题数
- `clusters.current_p_value` → Mastery Distribution (P=1 mastered, P=2 improving, P=3-4 weak)
- 查上一轮 completed schedule → Last Review 天数
- 硬编码间隔 [3,7,15,30,60] + round → "Day X of 3/7/15/30/60"
- **无 schema 变更**

### Token 提取

已输出到 `docs/superpowers/specs/design-tokens.md`，内容：
- 完整 Material 3 颜色系统（30+ token，值从 11 个 HTML 交叉验证）
- 字体：Plus Jakarta Sans (headline/label) + Be Vietnam Pro (body)
- 圆角：1rem / 2rem / 3rem / 9999px
- 渐变：`.amber-glow` = `linear-gradient(135deg, #a74800, #ff7a23)`
- 阴影系统（5 级）
- 图标：Material Symbols Outlined + 常用图标映射表
- 语义状态色：emerald (mastered) / blue (improving) / orange (weak/in-progress)
- **现成的 `tailwind.config.js` 模板**

### 第三次 Brainstorm 未完成的工作

这次 session 的 context 用在了后端分析和 Stitch MCP 审阅上，**未读任何前端组件代码**。以下是写最终 spec 的前置条件，需要在第四次 brainstorm 中完成：

| 需要读的文件 | 为什么 |
|-------------|--------|
| `src/app/page.tsx` | 首页当前实现 → 映射到新 Homepage |
| `src/app/books/[bookId]/page.tsx` | 书详情页 → 映射到 Action Hub |
| `src/app/books/[bookId]/module-map/page.tsx` | 模块地图 → 合并进 Action Hub |
| `src/app/books/[bookId]/dashboard/page.tsx` | 仪表盘 → 合并进 Action Hub |
| `src/app/books/[bookId]/modules/[moduleId]/page.tsx` | 模块学习页 → 映射到 Split Panel |
| `src/app/books/[bookId]/modules/[moduleId]/qa/page.tsx` | QA 页 → 映射到 Q&A Mode |
| `src/app/books/[bookId]/modules/[moduleId]/test/page.tsx` | 测试页 → 映射到 Exam Mode |
| `src/app/books/[bookId]/modules/[moduleId]/review/page.tsx` | 复习页 → 映射到 Review Session |
| `src/app/books/[bookId]/modules/[moduleId]/mistakes/page.tsx` | 错题页 → 映射到 Mistake Notebook |
| `src/app/books/[bookId]/mistakes/page.tsx` | 书级错题 → 同上 |
| `src/components/sidebar/Sidebar.tsx` | 侧栏导航 → 简化 |
| `src/components/sidebar/SidebarLayout.tsx` | 布局容器 |
| `src/app/(auth)/login/page.tsx` | 登录页 → 映射到新 Login |
| `src/app/(auth)/register/page.tsx` | 注册页 → 映射到新 Register |
| `tailwind.config.ts` | 当前主题配置 → 替换为 Amber Companion tokens |

---

## 第三次 Brainstorm 指令（已完成）

> 原始指令保留供参考。实际执行了 A + B，C/D 推迟到第四次。

- ✅ 任务 A：Scope 决策 — 4 个后端变更问题全部回答，用户确认
- ✅ 任务 B：Token 提取 — `design-tokens.md` 已写入
- ⏭️ 任务 C：最终 Spec — 推迟（需要前端组件深度分析）
- ⏭️ 任务 D：实施计划 — 推迟（依赖 Spec）

---

## 第四次 Brainstorm 指令

> 这是最终 brainstorm。产出最终 design spec + 实施计划。

### 前置条件

- ✅ Scope 已确认（见第三次成果）
- ✅ Design tokens 已提取（`docs/superpowers/specs/design-tokens.md`）
- ✅ 后端代码已分析，后端变更边界已明确
- ✅ Stitch HTML 代码在 `wireframe/stitch/code/`（11 个文件）
- ✅ 审阅报告在本文件"第 2.5 次 Brainstorm 成果"部分

### 任务 A：前端组件深度映射

**必须先读全部现有前端组件**（见上方"未完成的工作"文件列表），然后逐页做映射：

对每个页面，输出一个表格：

| 列 | 内容 |
|----|------|
| 新页面 | Stitch 设计名（如 "Action Hub"） |
| 当前路由 | 现有 Next.js 路由 |
| 新路由 | 重设计后的路由（如果改了的话） |
| 当前组件 | 涉及的现有 React 组件文件 |
| 操作 | 修改 / 新建 / 删除 / 不变 |
| Stitch 参考 | 对应的 `wireframe/stitch/code/*.html` |
| 数据来源 | 调用哪个 API 端点 |
| 审阅问题 | 第 2.5 次审阅中标记的需修复项 |

特别关注：
- **路由合并**：module-map + dashboard → Action Hub，旧路由怎么处理（重定向 or 删除）
- **组件复用**：哪些现有组件可以改造，哪些必须新建
- **侧栏简化**：从三层导航简化为 app 级导航，Sidebar.tsx 改动范围
- **布局变更**：SidebarLayout 是否需要改？测试页全屏无侧栏怎么处理？

### 任务 B：写最终 Design Spec

基于任务 A 的映射结果，写一份完整的 `docs/superpowers/specs/2026-MM-DD-ux-redesign-spec.md`：

| Spec 章节 | 内容 |
|-----------|------|
| **概览** | 范围（11 页视觉重设计 + 测试跳题 + Action Hub 合并 + 复习 briefing）、目标、非目标（忘记密码延后） |
| **逐页设计** | 每页：路由、布局结构、组件树、数据需求、交互说明、Stitch 参考文件 |
| **组件变更清单** | 修改的组件 / 新建的组件 / 删除的组件，每个标注文件路径和变更内容 |
| **路由变更** | 新增/合并/删除的路由，重定向策略 |
| **API 变更** | `GET /review/[scheduleId]/briefing` 的完整契约（请求/响应/数据来源） |
| **设计 Token** | 引用 `design-tokens.md`，说明 tailwind.config.ts 的具体改法 |
| **审阅清理项** | 从 2.5 次审阅报告中提取的全部修复项（游戏化删除、名字统一、导航统一等） |
| **产品不变量检查** | 逐条确认 5 个不变量在新设计中如何保证 |

### 任务 C：Spec 审查

用 spec-document-reviewer agent 审查 spec 文件（brainstorming skill 标准流程）。

### 任务 D：规划实施方案

invoke writing-plans skill：
- 拆分任务（按页面分组）
- Codex：`review/briefing` 端点 + 可选的 KP 进度聚合
- Gemini：全部前端页面实现
- 标注依赖关系
- 第一批：tailwind.config + 设计系统基础（所有页面依赖）
- 第二批：核心页面（Action Hub、Split Panel/QA、Test）
- 第三批：辅助页面（错题本、复习、认证页面视觉更新）

### 下一个 Session 的启动指令

> 对新 session 说这句话即可：

**"继续 UX chain 第四次 brainstorm（最终）。读 `docs/superpowers/specs/2026-04-07-ux-redesign-chain.md` 的'第三次成果'和'第四次指令'部分。这次的目标是读全部前端组件 → 逐页映射 → 写最终 spec → 出计划。"**

---

## 当前技术栈参考

- Framework: Next.js 15 (App Router) + React + Tailwind CSS
- Font: **Plus Jakarta Sans** (headline/label) + **Be Vietnam Pro** (body) ← Stitch 输出，用户确认
- Primary color: **#a74800** (deep orange) ← 从 blue-600 改为暖橙
- CTA gradient: `linear-gradient(135deg, #a74800 0%, #ff7a23 100%)` (.amber-glow)
- Background: #fffbff (surface), #fefae8 (sidebar), #ffffff (cards)
- Cards: rounded-2xl (1rem default), shadow-sm, no border (tonal stacking)
- Sidebar: 240px expanded with text, left-fixed
- Status colors: emerald (completed), blue (reading/in-progress), indigo (qa), amber (testing), slate (unstarted)
- Icons: Material Symbols Outlined (Google)
- Responsive: mobile-first, lg: breakpoint for sidebar
