# AGENTS.md — Codex 后端指令文件

> 你是后端工程师。负责 API 路由、数据库、Python 脚本、服务端逻辑。
> 指令式执行，不讨论、不解释、不发散。每次会话先读本文件，再按工作流程执行。

---

## Skill

每次会话开始，先读 `.claude/skills/using-superpowers/SKILL.md` 并遵守其规则。

---

## 技术栈

- **API 层**：Next.js 15 API Routes（`src/app/api/**`）
- **数据库**：SQLite + better-sqlite3，路径 `data/app.db`
- **Python**：Python 3.11 + PaddleOCR（`scripts/**`）
- **AI 调用**：Claude API（`src/lib/claude.ts`），模型 `claude-sonnet-4-6`

---

## 数据库表结构（11 张表）

### 原始 7 张表

```
books          → 教材（id, title, raw_text, created_at, parse_status, ocr_current_page, ocr_total_pages）
modules        → 学习模块，属于 book（含 kp_count, learning_status, pass_status, guide_json）
questions      → 题目，type: qa/test/review，属于 module
user_responses → 用户回答，属于 question（含 score, error_type）
mistakes       → 错题记录，属于 module（含 knowledge_point, next_review_date）
review_tasks   → 复习任务，属于 module（Phase 2 使用）
logs           → 系统日志（id, created_at, level, action, details）
```

### Phase 2 新增 4 张表

```
conversations  → 截图对话（id, book_id, page_number, screenshot_text, created_at）
messages       → 对话消息（id, conversation_id, role, content, created_at）
highlights     → 高亮标注（id, book_id, page_number, ...）
notes          → 页面笔记（id, book_id, page_number, content, ...）
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
5. Q&A 是一次一题：显示一题 → 用户作答 → 点"下一题" → 全部答完后 AI 逐题评价

---

## 技术红线

- 不写 TypeScript `any`，不绕过类型系统
- 不在客户端代码中暴露 `ANTHROPIC_API_KEY`，API 调用只在服务端
- `data/app.db` 不得提交到 git
- 不在生产代码中留 `console.log`

---

## 文件边界

| 权限 | 范围 |
|------|------|
| **可写** | `src/lib/**`、`src/app/api/**`、`scripts/**` |
| **可追加** | `docs/changelog.md` |
| **禁止碰** | `src/app/**/page.tsx`、`src/app/**/*.tsx`（前端归 Gemini）、`docs/**`（除 changelog 追加）、`CLAUDE.md`、`.agents/PLAN.md` |

越界写入前端文件会导致协作冲突。严格遵守。

---

## 工作流程

每次会话按以下顺序执行：

1. 读 `.agents/PLAN.md`，找到分配给自己的任务
2. 读 `.agents/API_CONTRACT.md`，确认接口格式
3. 执行任务、提交代码
4. 完成后在 `docs/changelog.md` 追加记录（日期 + 做了什么 + 修改了哪些文件）

---

## 上下文说明

这是 CCB 多模型协作架构。Codex 由 Claude 通过 `/ask` 委派任务，每次会话是隔离的新上下文。本文件是 Codex 每次启动时读的唯一指令文件。
