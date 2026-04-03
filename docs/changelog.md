# 变更日志（Changelog）

> 记录每次完成的功能和修改，包含日期、内容、涉及文件。
> 目的：Context 压缩后，新对话的 Claude 读这个文件可以知道"代码里现在有什么"。
> 规则：每完成一个功能或修改，必须在这里追加一条记录。

## 2026-04-03 | M5：AI 生成内容 Markdown 渲染全覆盖 (Rollout)

- **全量迁移至 AIResponse**: 对全站 AI 生成内容进行了审计，确保所有动态生成的文本均使用 `<AIResponse>` 组件进行 Markdown 渲染。
- **覆盖位置**:
  - **读前指引**: 模块学习页面的目标、核心重点、易错点。
  - **学习笔记**: Q&A 后生成的模块总结笔记。
  - **错题诊断**: 模块级与书籍级错题本中的题目文本、正确答案、KP 描述及补救建议。
  - **模块地图**: 首页及书籍详情页中的模块摘要。
- **样式统一**: 移除所有残留的原始文本渲染（`<p>`、`<div>` 等直接包裹变量），统一采用 Tailwind Typography 规范。
- **清理**: 确认项目中已无 `MarkdownRenderer` 组件的引用。

修改文件：
- `src/app/books/[bookId]/modules/[moduleId]/ModuleLearning.tsx`
- `src/app/books/[bookId]/modules/[moduleId]/NotesDisplay.tsx`
- `src/app/books/[bookId]/modules/[moduleId]/mistakes/page.tsx`
- `src/app/books/[bookId]/mistakes/page.tsx`
- `src/app/books/[bookId]/ModuleMap.tsx`

---

## 2026-04-03 | M5：学习仪表盘与错题诊断中心

- **学习仪表盘 (Dashboard)**: 新增 `src/app/books/[bookId]/dashboard/page.tsx`。
  - **总览进度**: 展示教材完成百分比进度条。
  - **学习路径**: 模块列表及其当前学习状态（图标化展示）。
  - **复习计划**: 按日期排列的复习日程，过期任务红色高亮。
  - **测试记录**: 展示最近 10 次测试成绩及是否通过。
  - **错题概览**: 统计总错题数及各类错误分布，一键跳转错题本。
- **错题诊断中心 (Mistakes Center)**: 新增 `src/app/books/[bookId]/mistakes/page.tsx`。
  - **多维筛选**: 支持按模块、错误类型（知识盲点、程序失误等）、来源（测试、Q&A、复习）进行组合筛选。
  - **对比展示**: 清晰对比"你的回答"与"正确答案"，针对性纠错。
  - **AI 诊断**: 使用 `<AIResponse>` 组件渲染 AI 提供的深度诊断与补救建议。
- **入口集成**: 
  - 首页书架卡片新增"学习仪表盘"入口。
  - 教材详情页顶部新增"仪表盘"快捷链接。

修改文件：
- `src/app/books/[bookId]/dashboard/page.tsx` — 新建
- `src/app/books/[bookId]/mistakes/page.tsx` — 新建
- `src/app/page.tsx` — 首页入口集成
- `src/app/books/[bookId]/page.tsx` — 详情页入口集成

---

## 2026-04-03 | M5：复习与测试结果展示优化

- **复习结果增强**: 在 `ReviewSession.tsx` 中新增"正确答案"与"解析"区块，在 AI 评价后展示，帮助用户快速纠错。
- **测试结果增强**: 在 `TestSession.tsx` 的逐题反馈中，为所有题目（无论对错）增加"正确答案"与"解析"展示。
- **UI 组件统一**: 全面移除 `MarkdownRenderer`，改用基于 Tailwind Typography 的 `AIResponse` 组件渲染题目、评价与解析，确保视觉风格一致。
- **视觉风格**: 正确答案采用绿色（green-50）背景，解析采用蓝色（blue-50）背景，层次分明。

修改文件：
- `src/app/books/[bookId]/modules/[moduleId]/review/ReviewSession.tsx`
- `src/app/books/[bookId]/modules/[moduleId]/test/TestSession.tsx`

---

## 2026-04-03 | M5：截图问 AI 流程重构

- **重写 AiChatDialog**: 将截图问 AI 流程从"挂载即自动解释"改为两步走：OCR 识别 → 用户提问 → AI 回答。
- **状态机管理**: 引入 `ocr_processing | text_ready | asking | answered` 状态机，优化交互体验。
- **OCR 优先**: 挂载后首先调用 `/api/books/{bookId}/screenshot-ocr` 进行文字识别并展示。
- **Markdown 渲染**: 接入 `<AIResponse>` 组件，使 AI 的回答支持 Markdown 格式（标题、列表、表格等）。
- **API 适配**: 适配后端 `handleRoute` 包装后的 `{ success, data }` 响应格式，移除已废弃的 `extractedText` 字段处理。
- **持续对话**: 修复并保留了基于 `conversationId` 的追问功能。

修改文件：
- `src/app/books/[bookId]/reader/AiChatDialog.tsx` — 核心逻辑重写

---

## 2026-04-03 | M5：AIResponse 组件与 Markdown 渲染统一化

- **新增 AIResponse 组件**: 创建 `src/components/AIResponse.tsx`，集成 `react-markdown` 和 `remark-gfm`，使用 `@tailwindcss/typography` 的 `prose` 类实现标准化的 AI 内容渲染。
- **集成 Typography 插件**: 在 `src/app/globals.css` 中引入 `@plugin "@tailwindcss/typography"`，适配 Tailwind v4 架构。
- **依赖更新**: 安装 `remark-gfm` 和 `@tailwindcss/typography` 依赖。
- **验证与清理**: 在 `src/app/page.tsx` 中进行了组件渲染验证，确认支持标题、表格、加粗、代码块和列表，验证通过后已清理测试代码。

修改文件：
- `src/components/AIResponse.tsx` — 新增组件
- `src/app/globals.css` — 引入 typography 插件 (Tailwind v4)
- `package.json` — 新增依赖
- `docs/changelog.md` — 本条记录

---

## 2026-04-03 | M5：Dashboard Aggregate API + Book Mistakes API

- **Dashboard 聚合接口**: 新增 `GET /api/books/[bookId]/dashboard`，汇总学习进度、待复习、最近测试及错题分布。
- **书级错题接口**: 新增 `GET /api/books/[bookId]/mistakes`，支持按模块、错因、来源过滤全书错题。
- **契约同步**: 更新 `.agents/API_CONTRACT.md`，同步新增接口并修正 `review respond` 字段描述。

修改文件：
- `src/app/api/books/[bookId]/dashboard/route.ts`
- `src/app/api/books/[bookId]/mistakes/route.ts`
- `.agents/API_CONTRACT.md`

---

## 2026-04-03 | M5：Review/Test Mistake Payload Completion

- **接口补全**: 为 `POST /api/review/[scheduleId]/respond` 补齐 `correct_answer` 与 `explanation` 字段。
- **错题落库增强**: 更新 review/test 写入逻辑，确保 `question_text`、`user_answer`、`correct_answer` 全部持久化到 `mistakes` 表。

修改文件：
- `src/app/api/review/[scheduleId]/respond/route.ts`
- `src/app/api/modules/[moduleId]/test/submit/route.ts`

---

## 2026-04-03 | M5：截图问 AI API 拆分

- **新增 OCR-only 接口**: `POST /api/books/[bookId]/screenshot-ocr` 专职识别截图。
- **重写 Ask 接口**: `POST /api/books/[bookId]/screenshot-ask` 改为接收 OCR 文本与问题，走 `handleRoute` 统一包装。
- **Prompt 模板化**: 接入 prompt 系统，系统指令改为中文。

修改文件：
- `src/lib/screenshot-ocr.ts`
- `src/app/api/books/[bookId]/screenshot-ocr/route.ts`
- `src/app/api/books/[bookId]/screenshot-ask/route.ts`

---

## 2026-04-03 | M5：Mistakes schema 扩展 + screenshot assistant 模板修复

- **Schema 迁移**: 为 `mistakes` 表补充题干、用户答案、正确答案列。
- **模板修复**: 修复 `screenshot_qa` 模板乱码，补齐 seed upsert 逻辑。

修改文件：
- `src/lib/db.ts`
- `src/lib/seed-templates.ts`

---

## 2026-04-03 | M4 milestone-audit 执行

- 对 M4 复习系统执行 milestone-audit，验证 architecture.md 与代码一致性
- 审计 5 个类别（页面/API/DB/AI 角色/状态流）全部一致
- 已补全 architecture.md 错题流转 section，标注 ⚠️

修改文件：
- `docs/architecture.md`
- `docs/journal/2026-04-03-m4-milestone-audit.md`

---

## 2026-04-03 | 工程流程：architecture.md 守护体系

- **milestone-audit skill**: 里程碑收尾时按改动范围定向审计 architecture.md。
- **brainstorming 强化**: 引入 Hard-Gate，发现不一致先修架构图。

修改文件：
- `.claude/skills/milestone-audit/SKILL.md`
- `CLAUDE.md`

---

## 2026-04-03 | M4：Review error_type 防御性归一化

- **错因归一化**: 新增 `normalizeReviewErrorType()`，将 AI 返回的文本收敛到库表合法值。

修改文件：
- `src/lib/review-question-utils.ts`
- `src/app/api/review/[scheduleId]/respond/route.ts`

---

## 2026-04-03 | M4：Review 系统 Bug 修复

- **出题验证放宽**: 非单选题噪声 options 不再导致整题跳过。
- **评分预算提升**: 响应 Token 上限提升至 8192，避免 JSON 截断。

修改文件：
- `src/app/api/review/[scheduleId]/generate/route.ts`
- `src/app/api/review/[scheduleId]/respond/route.ts`

---

## 2026-04-02 | M4：复习系统

- **核心链路**: GET /due, POST /generate, POST /respond, POST /complete。
- **前端集成**: ReviewSession 组件 + 首页待复习入口。

修改文件：
- `src/lib/db.ts`
- `src/app/api/review/**`
- `src/app/ReviewButton.tsx`

---

## 2026-04-02 | M3.5：里程碑衔接修复

- **复习触发**: 测试通过自动创建 review_schedule。
- **Prompt 重写**: 修复乱码 UTF-8 模板。

修改文件：
- `src/app/api/modules/[moduleId]/test/submit/route.ts`
- `src/lib/seed-templates.ts`

---

## 2026-04-02 | 基础设施：架构地图系统

- **docs/architecture.md**: 新增两层架构文档。

修改文件：
- `docs/architecture.md`

---

## 2026-04-02 | 基础设施：CCB 文件消息系统

- **文件协议**: 替代异步 `ask` 命令，使用 `.ccb/inbox/` 进行跨 Agent 通信。

修改文件：
- `docs/ccb-protocol.md`
- `AGENTS.md`
- `GEMINI.md`

---

## 2026-04-01 | 前端：AI 评价 Markdown 渲染

- **MarkdownRenderer**: 初次引入 Markdown 渲染组件（后被 AIResponse 替代）。

修改文件：
- `src/components/MarkdownRenderer.tsx`

---

## 2026-04-01 | M3 集成测试修复 — AI 代理 + JSON 解析

- **Turbopack 兼容**: serverExternalPackages 扩展。
- **解析加固**: 消毒控制字符，增强 JSON 稳定性。

修改文件：
- `next.config.ts`
- `src/lib/ai.ts`

---

## 2026-03-29 | Gemini Flash 兼容性修复

- **Token 提升**: 适配中文输出冗长特性，防止 JSON 截断。

---

## 2026-03-29 | M2: Coach AI - 前端修复 (Code Review Issues)

- **Bug 修复**: 解决笔记重复保存、实现 Q&A 进度恢复。

---

## 2026-03-28 | M2: Coach AI - 后端实现

- **核心 API**: 阅读笔记 CRUD, Q&A 出题/反馈, 学习笔记生成。

---

## 2026-03-28 | M2: Coach AI - 前端实现

- **核心页面**: ModuleLearning 状态机, QASession, NotesDisplay。

---

## 2026-03-28 | M1 完成：提取器 AI 里程碑正式关闭

- **KP 提取**: 完成 structure scan → block extraction → quality validation 全链路。

---

## 2026-03-21 | 架构重构：从多 Agent 迁移到 CCB + Skill 体系

- **CCB 转型**: 废弃旧 Agent 日志，建立 CCB 多模型协作规范。
