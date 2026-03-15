# 变更日志（Changelog）

> 记录每次完成的功能和修改，包含日期、内容、涉及文件。
> 目的：Context 压缩后，新对话的 Claude 读这个文件可以知道"代码里现在有什么"。
> 规则：每完成一个功能或修改，必须在这里追加一条记录。

---

## 2026-03-14 | Phase 0：项目地基

**完成内容**：项目 Setup 全部完成，文档体系建立。

**具体操作**：
- 初始化 Next.js 15 项目（TypeScript + Tailwind）
- 安装核心依赖：`@anthropic-ai/sdk`、`better-sqlite3`
- 创建 `CLAUDE.md`（项目核心指令）
- 创建 `project_spec.md`（产品规格书，含确认的流程决策）
- 创建 `docs/learning_flow.md`（学习规则，Q&A / 测试 / 评分 / 错题）
- 创建 `docs/ROADMAP.md`（Phase 0-3 路线图）
- 创建 `docs/architecture.md`（技术架构）
- 创建 `docs/decisions.md`（决策日志，初始化 7 条决策）
- 创建 `docs/changelog.md`（本文件）
- 修复 `.gitignore`：加入 `data/*.db` 保护数据库文件
- 创建 `data/` 目录

**修改的文件**：
- 新增：`project_spec.md`、`docs/learning_flow.md`、`docs/ROADMAP.md`、`docs/decisions.md`、`docs/changelog.md`、`data/.gitkeep`
- 修改：`CLAUDE.md`、`.gitignore`

**当前状态**：Phase 0 完成，尚未写任何业务代码。

---

## 2026-03-15 | Phase 0：补丁——决策更新与沟通协议

**完成内容**：Phase 0 补充更新，反映今日讨论确认的决策变更。

**具体操作**：
- 推翻 PDF 处理旧决策：app 改为服务端自动处理文件转换，用户上传 PDF 即可
- 确认技术栈（Next.js / SQLite / Claude API / Tailwind）经用户讨论后正式锁定
- CLAUDE.md 新增"与项目负责人的沟通协议"（高管技术汇报格式 + 可逆性判断框架）
- CLAUDE.md 删除"禁止在 app 内处理 PDF"禁令

**修改的文件**：
- 修改：`CLAUDE.md`、`docs/decisions.md`、`docs/ROADMAP.md`

---

## 2026-03-15 | Phase 1 第1步：数据库建表

**完成内容**：6 张表全部创建，app 启动时自动初始化。

**具体操作**：
- 创建 `src/lib/db.ts`：数据库连接单例 + `initSchema()` 建表逻辑
- 启用 WAL 模式（写性能优化）和外键约束
- 验证：`node` 直接运行确认 6 张表正常创建

**修改的文件**：
- 新增：`src/lib/db.ts`

---

## 2026-03-15 | Phase 1 第2步：文件上传 API + 上传页面

**完成内容**：用户可上传 PDF 或 TXT 文件，服务端提取文本存入数据库，跳转至教材页。

**具体操作**：
- 安装 `pdf-parse`（新版 API 使用 `PDFParse` 类）
- 创建 `src/lib/parse-file.ts`：统一处理 PDF/TXT 文本提取
- 创建 `src/app/api/books/route.ts`：POST 上传 + GET 列表
- 创建 `src/app/upload/page.tsx`：上传页面（文件拖选 + 教材名称输入）
- 验证：API 返回 201，数据库写入正常

**修改的文件**：
- 新增：`src/lib/parse-file.ts`、`src/app/api/books/route.ts`、`src/app/upload/page.tsx`
- 修改：`package.json`（新增 pdf-parse 依赖）

---

## 2026-03-15 | Phase 1 第3步：模块地图生成 + 展示页面

**完成内容**：上传教材后，AI 分析原文并生成学习模块地图，模块地图页面展示所有模块。

**具体操作**：
- 创建 `src/lib/claude.ts`：Claude 客户端单例
- 创建 `src/app/api/modules/route.ts`：POST 生成模块（调用 Claude API）+ GET 查询模块
- 创建 `src/app/books/[bookId]/page.tsx`：模块地图 Server Component
- 创建 `src/app/books/[bookId]/ModuleMap.tsx`：Client Component，含生成按钮 + 模块卡片列表

**修改的文件**：
- 新增：`src/lib/claude.ts`、`src/app/api/modules/route.ts`、`src/app/books/[bookId]/page.tsx`、`src/app/books/[bookId]/ModuleMap.tsx`

**注意**：需要在 `.env.local` 中配置 `ANTHROPIC_API_KEY` 才能调用 Claude API

---

## 2026-03-15 | Phase 1 第4步：读前指引 + 原文视图

**完成内容**：进入模块后，AI 生成读前指引（目标/重点/易错点），用户阅读原文后才能进入 Q&A。

**具体操作**：
- 创建 `src/app/api/modules/[moduleId]/guide/route.ts`：生成读前指引
- 创建 `src/app/api/modules/[moduleId]/status/route.ts`：PATCH 更新模块学习状态
- 创建 `src/app/books/[bookId]/modules/[moduleId]/page.tsx`：模块页面（Server Component）
- 创建 `src/app/books/[bookId]/modules/[moduleId]/ModuleLearning.tsx`：读前指引 + 原文视图（Client Component）

**修改的文件**：
- 新增：4个文件（见上）

---

## 2026-03-15 | Phase 1 第5步：Q&A 页面（逐题交互 + AI 评分）

**完成内容**：完整 Q&A 流程——AI 出题、逐题作答（已答不可改）、全部答完后 AI 逐题评分。

**具体操作**：
- `src/app/api/modules/[moduleId]/questions/route.ts`：GET 获取/生成题目（按 KP 数量出题，缓存到 DB）
- `src/app/api/qa/[questionId]/respond/route.ts`：POST 保存回答（已答不可修改，硬约束）
- `src/app/api/modules/[moduleId]/evaluate/route.ts`：POST AI 逐题评分，含错误类型诊断
- `src/app/books/[bookId]/modules/[moduleId]/qa/page.tsx`：Q&A 页面（Server Component）
- `src/app/books/[bookId]/modules/[moduleId]/qa/QASession.tsx`：完整交互状态机（loading → answering → evaluating → results）

**修改的文件**：
- 新增：5个文件（见上）

---

<!-- 后续每完成一个功能，在此处追加，格式如下：

## YYYY-MM-DD | Phase X：功能名称

**完成内容**：[做了什么]

**修改的文件**：
- 新增：[文件列表]
- 修改：[文件列表]
- 删除：[文件列表]

**备注**：[遇到的问题、临时方案、待优化点]

-->
