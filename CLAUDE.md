# CLAUDE.md — AI 教材精学老师

## 项目是什么
一个面向教材型文本的 AI 老师 Web App。用户上传 PDF，系统完成：
**模块拆解 → 读前指引 → 逐题 Q&A → 模块测试 → 错题诊断记录**
目标不是帮用户省时间，而是帮用户真正学扎实。

## 每次会话开始时
`docs/project_status.md` 由 SessionStart hook 自动注入 system prompt（F.3，2026-04-18）。`session-rules` skill 通过本文件 `@import` 自动加载运行规则。然后调用 session-init skill（通过 Skill 工具）：
- 跑 git status + log，扫 journal INDEX parked 段
- 输出 CEO 仪表盘 + 下一步建议
- 不重读 project_status.md（hook 已注入）
- 不主动读 `decisions.md` / `ccb-protocol.md`（前者是已关闭归档，不重讨；后者抽成 `ccb-protocol-reference` skill 按需加载）

PreCompact hook 每 session 首次 /compact 强制拦一次，要求先更新 project_status.md 再放行。

如果 session-init skill 不可用（skill 文件缺失），fallback：手动读 `docs/project_status.md` + `docs/journal/INDEX.md`。

## 想法与日志处理
当用户在开发过程中提出新想法或重要 insight 时：
1. **先评估**：这个想法是否正确？适合当前阶段还是未来？
2. **当前阶段**：纳入当前计划
3. **未来做 / 需要记住**：通过 journal skill 写入 `docs/journal/`，标注类型和状态
4. 不得跳过评估直接执行，也不得不记录就忽略

## 技术栈
- **框架**: Next.js 15 (App Router) + React + Tailwind CSS
- **AI**: Vercel AI SDK（多模型），默认 `anthropic:claude-sonnet-4-6`，通过 `AI_MODEL` 环境变量切换 provider/模型
- **数据库**: PostgreSQL（M6 从 SQLite 迁移），使用 `pg` 驱动

## 架构地图
`docs/architecture.md` 是系统现状的唯一真相源。所有里程碑设计必须基于它，不得凭记忆假设。
任何改动代码结构的工作完成后，必须同步更新。

## 产品不变量（任何功能实现都不得违反）
1. **用户必须读完原文才能进入 Q&A**，不能提供跳过按钮
2. **Q&A 已答的题不可修改**，只能继续向前
3. **测试阶段禁止查看笔记和 Q&A 记录**，界面上不得出现相关入口
4. **模块过关线是 80%**，这是硬规则，不是建议值，不得改为软提示
5. **Q&A 是一次一题 + 即时反馈**：显示一题 → 用户作答 → 立即显示评分和解析 → 点"下一题"继续

## 部署
- **生产**（阶段 1 ✅ 上线）：Vercel（Next.js）+ Neon Postgres + Cloudflare R2（PDF 存储）+ OCR 容器（阶段 2 迁 Cloud Run）
- **本地开发**：Docker Compose（app + db + ocr 三容器）
- **环境变量**：`DATABASE_URL` / `ANTHROPIC_API_KEY` / `AI_MODEL` / `OCR_SERVER_URL` / `OCR_SERVER_TOKEN` / `NEXT_CALLBACK_URL` / `SENTRY_DSN` / R2 四件套（`R2_*`）
- **Next.js standalone**：`output: 'standalone'`，生产镜像不含 node_modules

## 技术红线
- 不写 TypeScript `any`，不绕过类型系统
- 不在客户端代码中暴露 `ANTHROPIC_API_KEY`，API 调用只在服务端
- 不在生产代码中留 `console.log`

## CCB 角色分工
| 角色 | 身份 | 指令文件 | 文件边界 |
|------|------|----------|----------|
| **Claude** | PM + 架构师（不写业务代码） | 本文件 | `docs/**`、`CLAUDE.md`、`AGENTS.md`、`GEMINI.md` |
| **Codex** | 后端工程师 | `AGENTS.md` | `src/app/api/**`、`src/lib/**`、`scripts/**` |
| **Gemini** | 前端工程师 | `GEMINI.md` | `src/app/**`（非 api）、`src/components/**` |

操作规范（语言、派发流程、模型调度、Git、Review）见 `docs/ccb-protocol.md`。

## Claude 的文件边界
- **可写**：`docs/**`、`.claude/skills/**`、`CLAUDE.md`、`AGENTS.md`、`GEMINI.md`
- **不写**：`src/**`、`scripts/**`、`package.json`

## 协调文件
- `docs/superpowers/plans/` — 里程碑实现计划
- `docs/superpowers/specs/` — 设计文稿
- `docs/research/` — 关键决策前的调研报告（research-before-decision skill 产出）
- `docs/changelog.md` — 变更日志
- `docs/journal/` — 会话日志（想法、决策推理、待跟进）

## 禁止事项
- 邀请码注册为可选（填了校验，不填跳过），不做社交功能
- 禁止添加 MVP 范围外的功能（社区、个性化推荐、游戏化等）
- 禁止未经确认就修改产品不变量
- 禁止在未更新 `docs/project_status.md`、`docs/changelog.md` 和 `docs/architecture.md` 的情况下声称任务完成
- 禁止在里程碑收尾时跳过 milestone-audit（architecture.md 全量验证）
- 禁止 `docs/project_status.md` 鲜度失守——里程碑切换 / 关键决策 / architecture 变动 / 新 spec 产生 / 阻塞变化时必须同步更新（该文件由 SessionStart hook 注入到每个 session，失守即误导后续所有决策）

## 与项目负责人的沟通协议

> 项目负责人不具备技术背景，以高管视角参与决策。
> 所有技术汇报必须遵守以下格式，不得使用技术术语堆砌。

### 汇报技术选项时，每个选项必须回答 5 个问题
1. **它是什么**：用生活类比一句话说清楚，不解释原理
2. **现在的代价**：时间/复杂度，不是技术细节
3. **它给我们带来什么**：具体能力，不是抽象优点
4. **它关闭了哪些未来的门**：用了它之后，什么事会变难
5. **选错了后果是什么**：最坏情况，有多难纠正

### 所有技术决策必须标注可逆性
- **容易反悔**：改了代价小，直接给推荐，不必过度讨论
- **难以反悔**：牵一发动全身，必须慢下来让负责人参与决策

### 其他原则
- 永远给出明确推荐，不只列选项让负责人自己猜
- 选项最多 3 个，超过 3 个先筛选再汇报
- 不确定时明说，不用技术自信掩盖判断模糊

## Skill 使用
每次会话首次启动时调用 session-init skill（CEO 仪表盘 + git 状态 + 停车场扫描）。`docs/project_status.md` 由 SessionStart hook 自动注入 system prompt，skill 不重读该文件。运行规则通过 CLAUDE.md `@import` 自动加载（`session-rules` skill）；skill 使用手册按需加载（`skill-catalog` skill）。Compact/resume 后 session-init 通过 `.ccb/session-marker` 自动跳过，只刷新仪表盘。PreCompact hook 在 compact 前强制拦一次，要求先更新 `project_status.md` 再放行（每 session 一次，幂等）。详见 `.claude/skills/session-init/SKILL.md`。

**调研能力**：做关键决策前（3+ 选项 / 难反悔 / 跨领域 / 用户明确要求），brainstorming skill 会自动触发 `research-before-decision` skill。新 skill 硬执行 "CLAUDE.md 5 问表格"、权威加权源质量（S 级 = 满足 6 条信号中 ≥3 条）、每维度派 sub-agent 并行调研、落盘到 `docs/research/` 作为项目知识库。详见 `.claude/skills/research-before-decision/SKILL.md`。

## 已关闭的决策
详见 `docs/decisions.md`，不重新讨论。

@.claude/skills/session-rules/SKILL.md
