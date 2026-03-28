# CLAUDE.md — AI 教材精学老师

## 项目是什么
一个面向教材型文本的 AI 老师 Web App。用户上传 PDF，系统完成：
**模块拆解 → 读前指引 → 逐题 Q&A → 模块测试 → 错题诊断记录**
目标不是帮用户省时间，而是帮用户真正学扎实。

## 每次会话开始时
调用 session-init skill（通过 Skill 工具）。它会自动完成：
- 读取项目状态、决策日志、会话日志、CCB 协议
- 检查 git 状态和未完成工作
- 向用户汇报当前位置和建议下一步
- 注入 skill chain 路由

如果 session-init 不可用（如 skill 文件缺失），手动读取以下文件作为 fallback：
1. `docs/project_status.md` — 当前状态与下一步
2. `docs/decisions.md` — 已关闭的决策（不重新讨论）
3. `docs/journal/INDEX.md` — 会话日志索引
4. `docs/ccb-protocol.md` — CCB 多模型协作操作规范

## 想法与日志处理
当用户在开发过程中提出新想法或重要 insight 时：
1. **先评估**：这个想法是否正确？适合当前阶段还是未来？
2. **当前阶段**：纳入当前计划
3. **未来做 / 需要记住**：通过 journal skill 写入 `docs/journal/`，标注类型和状态
4. 不得跳过评估直接执行，也不得不记录就忽略

## 技术栈
- **框架**: Next.js 15 (App Router) + React + Tailwind CSS
- **AI**: Claude API，模型 `claude-sonnet-4-6`
- **数据库**: SQLite (`data/app.db`)，使用 `better-sqlite3`

## 产品不变量（任何功能实现都不得违反）
1. **用户必须读完原文才能进入 Q&A**，不能提供跳过按钮
2. **Q&A 已答的题不可修改**，只能继续向前
3. **测试阶段禁止查看笔记和 Q&A 记录**，界面上不得出现相关入口
4. **模块过关线是 80%**，这是硬规则，不是建议值，不得改为软提示
5. **Q&A 是一次一题 + 即时反馈**：显示一题 → 用户作答 → 立即显示评分和解析 → 点"下一题"继续

## 技术红线
- 不写 TypeScript `any`，不绕过类型系统
- 不在客户端代码中暴露 `ANTHROPIC_API_KEY`，API 调用只在服务端
- `data/app.db` 不得提交到 git（已在 `.gitignore` 中配置）
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
- `docs/changelog.md` — 变更日志
- `docs/journal/` — 会话日志（想法、决策推理、待跟进）

## 禁止事项
- 禁止引入多用户 / 登录 / 注册系统
- 禁止添加 MVP 范围外的功能（社区、个性化推荐、游戏化等）
- 禁止未经确认就修改产品不变量
- 禁止在未更新 `docs/project_status.md` 和 `docs/changelog.md` 的情况下声称任务完成

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
每次会话开始，先读 `.claude/skills/using-superpowers/SKILL.md` 并遵守其规则。

## 已关闭的决策
详见 `docs/decisions.md`，不重新讨论。
