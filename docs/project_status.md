# 项目状态（Project Status）

> 每次新 session 的第一个文件。保持"此刻的真实状态"。
> 每完成任何一个操作，必须更新这个文件。

---

## 当前状态（2026-04-17）

**方向**：MVP 扩展三线推进——扫描 PDF（**已完成**）→ 教学系统 → 留存机制，串行执行

**当前里程碑**：云部署（基础设施） — **阶段 1 已完成上线**（Vercel + Neon + R2），阶段 2（Cloud Run OCR）+ 阶段 3（域名+监控+secrets）待启动

**已完成（基础设施）**：**Session-Init Token Optimization** — Week 1-3 全部完成（2026-04-17）
- 3 个新 skill 创建（session-rules / skill-catalog / ccb-protocol-reference）+ memory-cleanup skill
- session-init 从 237 行瘦身到 141 行（-40%），Step 4/5 外迁 + marker 跳过机制
- CLAUDE.md @import session-rules，运行规则始终加载
- 3 个 INDEX 文件（journal/research/superpowers）全量覆盖 + frontmatter schema 标准化
- architecture.md §0 摘要卡，brainstorming 默认只读摘要卡
- 6 个 skill 更新（brainstorming/research/writing-plans/journal/claudemd-check/task-execution）
- 待用户验证：新 session /context token 实测（目标 ≤10%）

**最新完成**：
- **调研能力建设完成**（2026-04-15，3 commits 未 push）：新 skill `research-before-decision`（49946e9）+ brainstorming 升级 Research Trigger Check & BS-1 增量 spec（99ee882）+ CLAUDE.md 指针接入（03d206d）。解决 2026-04-14 OCR 决策捏造定价事件，关键决策前强制走 triage + S 级源 + sub-agent 并行 + 5 问硬 gate
- 设计资产：`docs/superpowers/specs/2026-04-14-research-capability-design.md`（10 决策）+ `docs/superpowers/plans/2026-04-15-research-capability.md`（6 tasks, 全部执行完毕）

**历史最近完成**：
- **扫描 PDF 9 tasks 全部完成**：T1-T7（Codex 后端）+ T8（Gemini 前端，1 次 retry 修 `any`/`console.error` 红线）+ T9（Claude 文档验证）
- 实际效果：文字页立即解锁阅读，扫描页后台 OCR 不阻塞；模块级独立状态追踪（text/ocr/kp），一就绪就可用
- 新 API：`GET /api/books/[bookId]/module-status` + `POST /api/books/[bookId]/extract?moduleId=N`
- 新 UI：StatusBadge 6 状态（加了 processing/readable）+ ProcessingPoller 模块级渲染 + ActionHub 按三元组 badge/可点击性
- 扫描 PDF 设计 spec + 实施计划（含 2 轮 review）存档于 `docs/superpowers/specs/` 和 `docs/superpowers/plans/`
- PDF 处理技术调研 → `docs/research/2026-04-11-pdf-processing-research.md`
- MVP 扩展首轮调研完成（竞品/学习科学/AI成本/护城河/用户定位）→ `docs/research/`
- 两种学习模式洞察 → `docs/journal/2026-04-11-two-learning-modes.md`
- MVP 扩展时间线 → `docs/superpowers/plans/2026-04-11-mvp-expansion-timeline.md`

**云部署里程碑进度**（基础设施）：
- **阶段 1 ✅ 完成**（2026-04-16）：R2 文件存储 + Vercel 部署 + Neon Postgres + OCR 代码层兼容。生产冒烟通过（注册/登录/上传/PDF阅读器均可用，OCR 预期不可用）。10 tasks（T1-T7+T9 Codex 执行，T8 跳过，T10 用户+Claude 协作部署）。
- **阶段 2 ⬜ 未开始**：Cloud Run OCR + CI/CD + Google Vision
- **阶段 3 ⬜ 未开始**：自定义域名 + 监控 + Secrets 管理
- 决策 1（OCR 处理方式）已拍：**Google Vision**（2026-04-14，调研 `docs/research/2026-04-14-cloud-ocr-options.md`）
- 决策 2（Next.js 部署平台）已拍：**Vercel Hobby**（2026-04-14，调研 `docs/research/2026-04-14-cloud-deployment-platform-options.md`）
- 决策 3（轻量 Python 服务器部署平台）已拍：**Google Cloud Run**（2026-04-14，调研 `docs/research/2026-04-14-cloud-python-server-options.md`）— MVP $0/月（永久免费层够用）+ 同家调 Vision API 延迟最低 + scale-to-zero 原生
- 决策 4（PDF 文件存储）已拍：**Cloudflare R2**（2026-04-14，调研 `docs/research/2026-04-14-cloud-object-storage-options.md`）— MVP $0/月 + egress 永久 0 费用 + S3 标准 API（保留模块化切换能力）
- 决策 5（环境分离）已拍：**生产 + preview + Neon DB branch**（方案 B2）（2026-04-14）— Vercel 原生 preview + Neon 免费 10 个 branch + 官方集成自动克隆/销毁，月费 $0
- 决策 6（CI/CD）已拍：**Cloud Run Continuous Deployment（UI 绑定 GitHub）**（2026-04-14，调研 `docs/research/2026-04-14-cloud-cicd-options.md`）— Cloud Build 120 min/天免费 + Artifact Registry 0.5 GB 免费 + 文件路径过滤 `scripts/**,Dockerfile*` 避免空跑 + 0 YAML 全 UI 配置，月费 $0
- 决策 7（Secrets 管理）已拍：**平台 env vars（Vercel + Cloud Run 各自配）**（2026-04-15，调研 `docs/research/2026-04-15-cloud-secrets-options.md`）— Vision 凭据通过 Cloud Run SA 的 ADC 自动解决（不用 key 文件）+ DATABASE_URL 已由 Neon 集成自动管理，净剩 5 个 shared secrets 手动同步；不引入 Secret Manager/Doppler，月费 $0
- 决策 8（域名与 HTTPS）已拍：**自购 `.com` + Cloudflare Registrar + Vercel/Cloud Run 各自自动 SSL（不开 Cloudflare 代理）**（2026-04-15，调研 `docs/research/2026-04-15-cloud-domain-https-options.md`）— `.com` at-cost $10.46/年不涨价 + 工信部 ICP 白名单唯一确认 TLD + Auth cookie Bearer token 无跨子域问题；Cloud Run 自定义域名仍 Preview（生产阶段跟进 GA）
- 决策 9（监控与错误追踪）已拍：**Sentry（错误追踪，覆盖 Next.js + Python）+ Vercel Analytics（built-in 流量/Web Vitals）**（2026-04-15，🟡 轻量决策）— Sentry 免费层 5K errors/月 + Vercel Hobby 内置 Analytics，两者功能不重叠，月费 $0
- 决策 10（分阶段实施）已拍：**3 阶段拆分**（① 数据层上云 R2+Vercel+Neon / ② OCR 上云 Cloud Run + CD / ③ 域名+监控+secrets 收尾），3-5 天 Codex 工作量（2026-04-15，🟡 轻量决策）— 每阶段独立可验收可上线可回退
- 产品策略：MVP 海外优先，国内走第三方平台（摩点/开始吧+微信公众号+小红书/视频号）承接，**MVP 完成后再启动国内链路**
- 架构预留 4 条国内版分区硬约束（DB/文件存储/OCR/前端 i18n 配置化）
- **下一步**：WIP state → 正式 design spec `docs/superpowers/specs/2026-04-12-cloud-deployment-design.md` → spec review 循环 → writing-plans 写阶段 1 plan

**排队中的里程碑（等云部署上线后启动 dispatch）**：
- **M4 教学系统最小闭环**（2026-04-16 设计全完成）：
  - **L1 引擎核心 brainstorm 完成**（2026-04-15）：决策 1/3/4/6/12 已拍，spec §2-§4 已写
  - **L2 UI 层 brainstorm 完成**（2026-04-16）：决策 8/9/10/11 已拍，spec §5.1-§5.4 已写 + subagent review 7 项修复通过
  - **L3 延后**：决策 2/5/7/13（session 生命周期/cost tracking/中断恢复/任务拆分），L1+L2 实施稳定后再拍
  - **Implementation plan 完成**：L1 Task 0-11（Codex 后端）+ L2 Task 12-19（Codex 3 API + Gemini 7 前端 task）+ Task D1-D3（Claude 文档）
  - plan: `docs/superpowers/plans/2026-04-15-m4-teaching-mode.md`
  - spec: `docs/superpowers/specs/2026-04-15-m4-teaching-mode-design.md`
  - WIP trail: `docs/superpowers/specs/2026-04-15-m4-teaching-mode-brainstorm-state.md`
  - 护城河原则写入项目记忆：KP type / importance 永不暴露到 UI
  - **启动条件**：云部署上线 + 验收通过 → 开新 session，L1 Codex dispatch + L2 Tier A Gemini 可并行
  - 关键新组件：BookTOC（书级目录+引导态）、ObjectivesList（Phase 0 激活页）、ModeSwitchDialog（模式切换弹窗）、Modal（通用弹窗）

**冻结中**：
- **扫描 PDF 端到端人工测试**：因本地 OCR server 起不来推迟，改为云环境测试

**里程碑收尾**：
- ✅ milestone-audit 已完成（2026-04-12，架构 ⚠️ 4 条新增约束已写入 architecture.md）
- ⏳ claudemd-check 待跑

**Advisory 累计**：11 条（T6: 3 + T7: 3 + T8: 5），其中 2 条已在清理任务修复（40f895b + 277738d），剩余 9 条经人工评估为 by-design，不单独追修。

**架构**：CCB 多模型协作（Claude PM + Codex 后端 + Gemini 前端），Superpowers + Skill 体系，Hook 自动化守卫

---

## 里程碑总览

> 里程碑定义以设计 spec（Section 6）为准。

| 里程碑 | 内容 | 状态 |
|--------|------|------|
| M0 | 地基重建：19 张表 + prompt 模板系统 + bug 修复 | **已完成**（2026-03-22） |
| M1 | 提取器 AI：上传 PDF → 三阶段 KP 提取 → KP 表和模块地图写入 DB → 模块地图页面 | **已完成**（2026-03-28） |
| M2 | 教练 AI（核心）：读前指引 → 阅读（笔记+截图问答）→ Q&A（4 种题型+即时反馈+预生成）→ 学习笔记生成 | **已完成**（2026-03-29） |
| M3 | 考官 AI：测试出题 → 盲测 → 评分 → 80% 过关 → 错题诊断 | **已完成**（2026-04-01） |
| M3.5 | 里程碑衔接修复：测试→复习调度触发 + schema 清理 + reviewer prompt 重写 | **已完成**（2026-04-02） |
| M4 | 复习系统：复习调度（3/7/15/30/60 天）→ 聚类出题 → P 值更新 → 前端复习会话 | **已完成**（2026-04-02） |
| M5 | 功能补完：截图问 AI 两步流程 + AIResponse Markdown 渲染 + 正确答案展示 + 仪表盘 + 错题诊断 | **已完成**（2026-04-03） |
| M5.5 | 稳固 & App Shell：侧栏导航 + 白屏修复 + OCR 自动触发 + 进度显示 + LoadingState | **已完成**（2026-04-04） |
| M6 | MVP Launch：PostgreSQL 迁移 + 用户账号 + 大 PDF 分块 + PDF 阅读器 + 部署上线 | **已完成**（2026-04-06） |
| UX Redesign | Amber Companion 设计系统全覆盖 + 页面合并 + 考试/复习重写 + 共享组件 | **已完成**（2026-04-09） |
| Component Library | 33 组件从 Stitch 落地 + 全页面重写 + 旧组件清理 + Radix UI | **已完成**（2026-04-09） |
| Scanned PDF | 文字+扫描混合 PDF 渐进处理 + 模块级状态 + 前端可阅读态 | **已完成**（2026-04-12） |
| Cloud Deploy P1 | R2 文件存储 + Vercel 部署 + Neon Postgres + OCR 代码层兼容 | **已完成**（2026-04-16） |

### Scanned PDF 完成内容

| 任务 | 描述 | 执行者 | 状态 |
|------|------|--------|------|
| T1 | DB Schema + Docker Foundation | Codex | ✅ |
| T2 | OCR Server — /classify-pdf | Codex | ✅ |
| T3 | OCR Server — /extract-text (pymupdf4llm) | Codex | ✅ |
| T4 | OCR Server — 仅扫描页 OCR + Provider 抽象 | Codex | ✅ |
| T5 | text-chunker 页范围追踪 | Codex | ✅ |
| T6 | kp-extraction 按模块重写 | Codex | ✅ |
| T7 | API 路由（upload + extract + module-status） | Codex | ✅ |
| T8 | 前端模块级处理 UI | Gemini | ✅ (1 retry: any/console 红线) |
| T9 | 集成验证 + 文档 | Claude | ✅ |

### M6 完成内容

| 任务 | 描述 | 执行者 | 状态 |
|------|------|--------|------|
| T1 | PostgreSQL Foundation (db.ts + schema) | Codex | ✅ |
| T2 | Convert lib/ files to async | Codex | ✅ |
| T3 | Convert API routes (books+conversations+logs) | Codex | ✅ |
| T4 | Convert API routes (modules+review+qa) | Codex | ✅ |
| T5 | Auth system backend | Codex | ✅ |
| T6 | Auth frontend + server page conversion | Gemini | ✅ |
| T7 | Large PDF chunking | Codex | ✅ (1 retry) |
| T8 | PDF reader replacement (react-pdf-viewer) | Gemini | ✅ |
| T9 | Bug fixes (auth guards + security) | Codex | ✅ |
| T10 | Deployment (Docker + compose) | Codex | ✅ |
| T11 | Smoke test + docs update | Claude | ✅ |

### M5 完成内容

| 任务 | 描述 | 状态 |
|------|------|------|
| T1 | Schema migration: mistakes 表 + screenshot_qa 模板修复 | ✅ |
| T2 | AIResponse 组件 + react-markdown 依赖 | ✅ |
| T3 | 截图问 AI API 拆分（screenshot-ocr + screenshot-ask 重写） | ✅ |
| T4 | 正确答案/解析：review/respond + test/submit 返回值增强 | ✅ |
| T5 | Dashboard + Mistakes 后端 API | ✅ |
| T6 | AiChatDialog 前端两步流程 | ✅ |
| T7 | ReviewSession/TestSession 正确答案展示 + AIResponse 迁移 | ✅ |
| T8 | Dashboard + Mistakes 前端页面 | ✅ |
| T9 | AIResponse 全站 rollout | ✅ |

### 依赖关系

```
M0 → M1 → M2 → M3 → M4 → M5
              ↑
       独立问答通道（已有，持续可用）
```

---

## 核心架构变化（相比旧 Phase 1/2）

- **5 个 AI 角色**：提取器 / 教练 / 考官 / 复习官 / 助手，各有独立 prompt 模板
- **KP 成为一级实体**：知识点有独立表，驱动所有学习活动
- **即时反馈**：Q&A 每题答完立即反馈（不再是全部答完后批量）
- **P-value 复习权重**：动态权重系统控制复习题量
- **数据库从 12 张表扩展到 24 张表**（M6: +users, invite_codes, sessions），PostgreSQL 部署

---

## 已有资产（Phase 1 + Phase 2 遗留，M0 后部分复用）

- Phase 1 完整学习流程可运行（上传 → 模块 → Q&A → 测试 → 错题）
- Phase 2 PDF 阅读器 + 截图问 AI 后端已完成
- PaddleOCR 常驻 HTTP 服务（`scripts/ocr_server.py`）
- Vercel AI SDK 多模型客户端（`src/lib/ai.ts`，支持 Anthropic/Google/OpenAI 兼容 provider）

---

## 历史记录

| 日期 | 里程碑 |
|------|--------|
| 2026-03-14 | Phase 0 完成，文档体系建立 |
| 2026-03-15 | Phase 1 完成，完整学习流程可运行 |
| 2026-03-17 | 引入多 Agent 架构 |
| 2026-03-18 | Phase 2 启动，后端 M1-M5 全部完成 |
| 2026-03-21 | 架构迁移到 CCB + Skill 体系 |
| 2026-03-21 | MVP 重新设计，目标用户定位中国留学生 |
| 2026-03-21 | 旧文件清理，文档体系精简 |
| 2026-03-22 | M0 Task 0-5 完成（schema 重写 + prompt 模板 + bug 修复） |
| 2026-03-22 | **M0 完成**：最终验证通过（8/8 checks） |
| 2026-03-28 | **Hook 自动化完成**：4 个 hook + structured-dispatch skill + claudemd-check 更新 |
| 2026-03-28 | **第三次 brainstorming 实施完成**：session-init skill + retrospective skill + 6 skill chain 声明 + CLAUDE.md/using-superpowers 更新 |
| 2026-03-29 | **M2 完成**：教练 AI 全部代码 + review 修复完成，6 项 fix 已 push |
| 2026-03-29 | **多模型抽象层完成**：Vercel AI SDK 集成，12 个调用点迁移，`AI_MODEL` 环境变量切换 |
| 2026-03-29 | **Session-Init 升级 + Skill 治理**：CEO 仪表盘、skill 合规审计、skill 合并/清理（26→22） |
