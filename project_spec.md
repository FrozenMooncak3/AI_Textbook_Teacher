# project_spec.md

## 1. Project Overview

### Project Name

AI 教材精学老师

### One-line Summary

一个面向教材型文本的单模式 AI 老师：用户先读原文，系统再通过结构拆解、读前引导、逐题互动式问答、模块测试与复习提醒，帮助用户真正把知识学扎实。

### Why This Project Exists

当前用户已经在使用 Claude Code + 长指令 + 手动维护学习流程的方式学习《手把手教你读财报》这类教材型书籍。现有方法有效，但存在明显痛点：

1. 整个流程高度依赖手工维护，使用成本高。
2. 需要频繁提醒 AI 重读规则、遵守流程、记录复习。
3. 体验像半自动工作流，而不是一个顺滑的软件产品。
4. 用户不喜欢传统做笔记，但又希望学得扎实。
5. 用户担心错过作者真正想传达的重点知识与结构。

本项目的目标不是替代阅读，而是把这套已经验证有效、但目前过于手工化的学习流程，产品化为一个更自然、稳定、可持续执行的软件系统。

---

## 2. Product Requirements

### 2.1 Target User

第一版只服务一类明确用户：

* 学习对象主要是教材型、知识密度高、适合拆解与测试的文本内容。
* 愿意认真读原文，而不是想让 AI 直接代读。
* 不喜欢传统做笔记，但想真正学扎实。
* 能接受被提问、被测试、被要求复习。
* 需要 AI 帮助维持学习流程，而不是只需要总结工具。

### 2.2 Core Problem

> 当用户阅读教材型文本时，现有 AI 工作流无法稳定、顺滑地承担"拆结构—读前引导—读后提问—测试过关—复习提醒"这一整套学习流程，导致用户虽然能学，但需要付出过高的维护成本。

### 2.3 Product Promise

> 上传教材型文本后，系统能帮助用户稳定完成：模块拆解、读前引导、逐题互动式问答、模块测试、错题记录与复习提醒。

### 2.4 Success Criteria

1. 用户能够顺利用本产品完成至少一个真实教材章节的学习。
2. 用户不再需要频繁手动提醒系统遵守学习流程。
3. 用户主观感受到学习体验比当前 Claude Code 手工工作流更顺滑。
4. 产品能够稳定跑通"讲—练—测—复"最小闭环。

---

## 3. MVP Definition

### 3.1 MVP Scope

第一版 MVP 只做一个模式：**教材精学模式**。

MVP 核心能力只有五个：
1. 结构拆解（生成模块地图）
2. 读前指引
3. 逐题互动式 Q&A
4. 模块测试
5. 错题记录（复习提醒在 Phase 2 实现）

### 3.2 确认的产品决策

| 决策点 | 确认方案 |
|--------|---------|
| Q&A 呈现方式 | 聊天风格：一次一题，下方有回答输入框，点"下一题"进入下一题，全部答完后 AI 逐题评价 |
| 测试时机 | 软性提醒（建议明天再做），用户可选择继续或稍后 |
| 原文阅读位置 | App 内展示文本内容，提供跳转原文按钮 |
| 测试未通过处理 | AI 诊断每道错题的错误类型，给出对应补救建议 |

### 3.3 MVP User Flow

1. 用户上传 `.txt` 文件，填写书名。
2. 系统处理文本，AI 扫描结构、提取知识点，生成模块地图。
3. 展示模块地图（每个模块的标题、知识点数量、预计题数、核心技能）。
4. 用户选择一个模块开始学习。
5. **读前准备**：展示任务锚（这个模块学完能判断什么、重点是什么、容易混淆的地方）+ 跳转原文按钮。
6. 用户在 app 内阅读原文，阅读完毕点击"我读完了"。
7. **Q&A 阶段**：每次显示一道题，下方有回答输入框，用户作答后点"下一题"，全部答完后 AI 逐题给出评分 + 解析 + 纠偏。
8. **进入测试**：显示软性提醒"建议明天再做效果更好"，用户可选择现在或稍后。
9. 用户独立作答（无提示，无法查看笔记），提交。
10. AI 评分，判断是否通过（≥80%）。
11. 未通过：AI 诊断每道错题的错误类型，给出补救建议。
12. 通过：模块标记完成，错题存入记录。

### 3.4 Pass Gate

* 单选题正确率 ≥ 80% 才标记通过。
* 未通过进入补救流程：AI 诊断错误类型（知识盲点 / 程序性失误 / 概念混淆 / 粗心），给出对应建议。

---

## 4. Product Principles

1. **用户必须读原文**：产品不是"AI 替你读"，而是"AI 带你学"。
2. **AI 是老师，不是摘要机器**：核心是追问、测试、记录错题、安排复习。
3. **流程稳定优先**：第一版追求流程顺滑稳定，而不是表现上很智能但不稳定。
4. **一个强模式**：第一版只做教材精学模式，不覆盖所有场景。

---

## 5. Out of Scope（第一版不做）

1. 多用户 / 登录系统
2. 多模式学习路由
3. 复杂个性化学习策略推荐
4. 社区、分享、协作功能
5. 高级 gamification
6. MCP / hooks / subagents 等高级工程化能力

---

## 6. Technical Design

### 6.1 Tech Stack

* **Frontend**: Next.js 15 (App Router)
* **UI**: React + Tailwind CSS
* **Backend**: Next.js API Routes
* **LLM**: Claude API (`claude-sonnet-4-6`)
* **Storage**: SQLite (`better-sqlite3`)，数据库文件：`data/app.db`
* **Text Input**: 用户使用外部工具 `pdf2txt-chinese` 预处理 PDF，上传 `.txt` 文件
* **Auth**: MVP 不做，单用户本地使用
* **Deployment**: Vercel（Phase 3）

### 6.2 System Architecture

```
Presentation Layer  →  pages: upload / module map / Q&A / test
        ↓
Application Layer   →  API routes: /api/books, /api/modules, /api/qa, /api/test
        ↓
Learning Engine     →  Claude API calls: module map generation, Q&A, test generation, error diagnosis
        ↓
Data Layer          →  SQLite: books, modules, questions, user_responses, mistakes, review_tasks
```

### 6.3 Key Domain Objects

```
Book          → id, title, raw_text, created_at, parse_status
Module        → id, book_id, title, summary, order_index, kp_count, learning_status, pass_status
Question      → id, module_id, type(qa/test/review), prompt, answer_key, explanation, order_index
UserResponse  → id, question_id, response_text, score, error_type
MistakeRecord → id, module_id, knowledge_point, error_type, next_review_date
ReviewTask    → id, module_id, task_type, due_date, status
```

### 6.4 Core Data Flows

**Flow A: 文本上传**
用户上传 .txt → 存储原文 → Claude 提取结构 → 生成模块地图 → 存入数据库

**Flow B: 模块学习**
进入模块 → 生成读前指引 → 用户读原文 → Q&A（逐题）→ AI 逐题评价

**Flow C: 模块测试**
软性提醒 → 独立作答 → AI 评分 → 通过/未通过 → 错题诊断

**Flow D: 错题记录**
错题存入 MistakeRecord → 复习任务写入 ReviewTask（Phase 2 提醒）

---

## 7. Open Questions（待确认，不阻碍开工）

1. 测试题支持哪些题型？（MVP 先做单选 + 思考题）
2. 复习提醒节奏：固定间隔还是手动触发？（Phase 2 再定）
3. 是否保存完整对话历史，还是只保存结果摘要？（先保存结果摘要）

---

## 8. Version

* Current version: v0.2
* Status: Flow confirmed, ready for Phase 1 Build
* 更新时间: 2026-03-14
