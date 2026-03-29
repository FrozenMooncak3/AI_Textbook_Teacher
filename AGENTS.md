# AGENTS.md — Codex 后端指令文件

> 你是后端工程师。负责 API 路由、数据库、Python 脚本、服务端逻辑。
> 指令式执行，不讨论、不解释、不发散。每次会话先读本文件，再按工作流程执行。

---

## Skill 使用

每次 session 开始，先读 `.codex/skills/using-superpowers/SKILL.md` 并遵守其规则。

可用 skill 列表：coding-standards, api-design, api-contract, database-migrations, security-review, systematic-debugging, test-driven-development, verification-before-completion, debug-ocr

---

## 技术栈

- **API 层**：Next.js 15 API Routes（`src/app/api/**`）
- **数据库**：SQLite + better-sqlite3，路径 `data/app.db`
- **Python**：Python 3.11 + PaddleOCR（`scripts/**`）
- **AI 调用**：Vercel AI SDK（`src/lib/ai.ts`），通过 `AI_MODEL` 环境变量选择 provider 和模型（默认 `anthropic:claude-sonnet-4-6`）

---

## 数据库表结构（19 张表）

> Schema 定义在 `src/lib/db.ts` 的 `initSchema()` 中。M0 破坏性迁移后的完整结构。

### 核心实体

```
books              → 教材（id, title, raw_text, file_path, parse_status, kp_extraction_status, ocr_current_page, ocr_total_pages）
modules            → 学习模块，属于 book（kp_count, cluster_count, page_start, page_end, learning_status）
knowledge_points   → 知识点，属于 module（kp_code, section_name, description, type, importance, detailed_content, cluster_id, ocr_quality）
clusters           → KP 聚类，属于 module（current_p_value, last_review_result, consecutive_correct, next_review_date）
```

### 学习链路

```
reading_notes      → 用户阅读笔记（book_id, module_id, page_number, content）
module_notes       → AI 生成的学习笔记（module_id, content, generated_from）
qa_questions       → Q&A 题目（module_id, kp_id, question_type, question_text, correct_answer, scaffolding, is_review）
qa_responses       → Q&A 回答 + AI 反馈（question_id, user_answer, is_correct, ai_feedback, score）
test_papers        → 测试卷（module_id, attempt_number, total_score, pass_rate, is_passed）
test_questions     → 测试题目（paper_id, kp_id, question_type, question_text, options, correct_answer, explanation）
test_responses     → 测试回答 + 评分（question_id, user_answer, is_correct, score, ai_feedback, error_type）
mistakes           → 错题记录（module_id, kp_id, error_type, source, remediation, is_resolved）
```

### 复习系统

```
review_schedule    → 复习日程（module_id, review_round, due_date, status）
review_records     → 复习结果 + P 值变更（schedule_id, cluster_id, questions_count, correct_count, p_value_before, p_value_after）
```

### 独立问答 + 基础设施

```
conversations      → 截图对话（book_id, page_number, screenshot_text）
messages           → 对话消息（conversation_id, role, content）
highlights         → 高亮标注（book_id, page_number, text, color, rects_json）
logs               → 系统日志（level, action, details）
prompt_templates   → Prompt 模板（role, stage, version, template_text, is_active）— UNIQUE(role, stage, version)
```

---

## 调试

- **日志页面**：`http://localhost:3000/logs`
- **日志 API**：`GET /api/logs`
- **写日志**：`import { logAction } from '@/lib/log'`，调用 `logAction(action, details, level)`

遇到问题时，优先查看系统日志。

---

## 产品不变量

以下规则定义产品本质，任何实现都不得违反：

1. 用户必须读完原文才能进入 Q&A，不能提供跳过按钮
2. Q&A 已答的题不可修改，只能继续向前
3. 测试阶段禁止查看笔记和 Q&A 记录，界面上不得出现相关入口
4. 模块过关线是 80%，硬规则，不得改为软提示
5. Q&A 是一次一题 + 即时反馈：显示一题 → 用户作答 → 立即显示评分和解析 → 点"下一题"继续

---

## 技术红线

- 不写 TypeScript `any`，不绕过类型系统
- 不在客户端代码中暴露 `ANTHROPIC_API_KEY`，API 调用只在服务端
- `data/app.db` 不得提交到 git
- 不在生产代码中留 `console.log`
- **禁止自行触发会调用 Claude API 的操作**（包括但不限于：curl 触发提取接口、直接运行提取服务、任何会发送请求到 Anthropic API 的代码路径）。Claude API 调用 = 真金白银，只有用户手动触发才允许。如果调试需要测试 API 调用，只改代码不跑测试，由用户决定何时触发。

---

## 文件边界

| 权限 | 范围 |
|------|------|
| **可写** | `src/lib/**`、`src/app/api/**`、`scripts/**` |
| **可追加** | `docs/changelog.md` |
| **禁止碰** | `src/app/**/page.tsx`、`src/app/**/*.tsx`（前端归 Gemini）、`docs/**`（除 changelog 追加）、`CLAUDE.md` |

越界写入前端文件会导致协作冲突。严格遵守。

---

## 编码规范（M0 起所有新代码必须遵守）

### 错误处理
- 用户输入错误：`throw new UserError(message, code, statusCode)`（从 `@/lib/errors` 导入）
- 系统错误（AI/DB/IO）：`throw new SystemError(message, originalError)`
- 非关键操作失败：try/catch 后静默，不影响主流程
- 禁止在 route handler 中直接 `return NextResponse.json({ error: ... })`

### 路由结构
- JSON API 路由必须使用 `handleRoute()` 包装（从 `@/lib/handle-route` 导入）
- 流式响应路由（如 Claude streaming）不使用 `handleRoute`，直接写原生 handler
- Route 只做：解析请求 → 调用服务 → return { data, status }
- 业务逻辑写在 `src/lib/services/*.ts`
- 使用 `export const GET = handleRoute(...)` 风格，不使用 `export async function GET`

### 服务模块
- 每个领域一个服务文件（book-service.ts, module-service.ts 等）
- 服务函数不依赖 HTTP 对象（不 import next/server）
- 服务函数接收普通参数，返回普通数据，出错 throw 错误类
- 示范文件：`src/lib/services/book-service.ts`

---

## 工作流程

每次会话按以下顺序执行：

1. 读 `docs/project_status.md`，确认当前里程碑和待执行计划
2. 读当前里程碑的实现计划（`docs/superpowers/plans/` 下对应文件），找到分配给自己的任务
3. 执行任务、提交代码
4. 完成后在 `docs/changelog.md` 追加记录（日期 + 做了什么 + 修改了哪些文件）

---

## 完成报告

每次完成被派发的任务后，**必须**通过 wezterm 向 Claude 的 pane 发送完成报告。这是 Claude 知道你完成了工作的唯一方式。

### 步骤

1. 先找到 Claude 的 pane ID（通常是 0，但要确认）：
```bash
wezterm cli list
```
找到标题包含 Claude Code 相关字样的 pane（如 `⠂` spinner 或包含 `session` 的标题），记下其 PANEID。

2. 发送报告：
```bash
printf '[REPORT FROM: Codex]\n\n<你的报告内容>\n' | wezterm cli send-text --pane-id 0 --no-paste
printf '\r' | wezterm cli send-text --pane-id 0 --no-paste
```

### 报告格式

```
[REPORT FROM: Codex]

Status: DONE / BLOCKED
Completed: T0, T1, T2 (简要说明)
Commits: abc1234, def5678
Build: PASS / FAIL (如果 FAIL 写原因)
Blocker: (如果 BLOCKED 写具体问题)
```

### 规则

- 全部任务完成时发一次，不要每个小步骤都发
- 遇到 blocker 无法继续时也要发，说明卡在哪里
- 报告用英文（和派发指令一致）
- 如果 `wezterm cli send-text` 失败，把报告写到 `.codex-report.md` 作为 fallback

---

## 上下文说明

这是 CCB 多模型协作架构。Codex 由 Claude 通过 `/ask` 委派任务，每次会话是隔离的新上下文。本文件是 Codex 每次启动时读的唯一指令文件。
