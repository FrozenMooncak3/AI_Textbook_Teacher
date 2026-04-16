---
date: 2026-04-02
topic: M3到M4里程碑启动代码审计首次执行
type: journal
status: resolved
keywords: [代码审计, M4, 复习系统, schema, prompt模板]
---

## 背景

M3 完成后准备进入 M4（复习系统）brainstorming。用户要求先全面检查现有代码，确认 M4 spec 假设是否与代码现状一致。这是第一次执行"里程碑启动代码审计"流程。

## 审计范围

读了以下代码：
- `src/lib/db.ts` — 全部 schema（19 张表）
- `src/lib/seed-templates.ts` — 所有 prompt 模板
- `src/lib/mistakes.ts` — 错题记录/查询
- `src/app/api/modules/[moduleId]/test/generate/route.ts` — 考试出题
- `src/app/api/modules/[moduleId]/test/submit/route.ts` — 考试提交+评分
- `src/app/api/modules/[moduleId]/generate-questions/route.ts` — QA 出题
- `src/app/books/[bookId]/modules/[moduleId]/test/TestSession.tsx` — 考试前端
- `src/app/books/[bookId]/modules/[moduleId]/ModuleLearning.tsx` — 学习流程前端
- `src/app/books/[bookId]/modules/[moduleId]/qa/QASession.tsx` — QA 前端
- `src/app/page.tsx` — 首页

## 发现的 6 个问题（M3.5 范围）

### 问题 1: 测试通过不触发复习调度
**位置**: `test/submit/route.ts:235-237`
**现状**: 测试通过只做 `learning_status = 'completed'`
**缺失**: 没有创建 `review_schedule` 第一条记录（round 1, due = today+3 天），没有根据错题更新 cluster P 值
**影响**: M4 复习流程无法启动——没有调度数据

### 问题 2: clusters.next_review_date 和 review_schedule 冗余
**位置**: `db.ts:110` vs `db.ts:201-209`
**现状**: `clusters` 表有 `next_review_date`（per-cluster），`review_schedule` 有 `due_date`（per-module）
**冲突**: spec 说"复习按模块触发"，所以调度应该在 module 级别，cluster 级别的 `next_review_date` 是多余的
**建议**: 删除 `clusters.next_review_date`，或重定义为 P=1 跳级用途

### 问题 3: reviewer prompt 模板是乱码
**位置**: `seed-templates.ts:341-343`
**现状**: `reviewer` / `review_generation` 的 template_text 是损坏的 UTF-8 编码
**对比**: M3 的 examiner 模板已用正常中文重写，reviewer 需要同样处理
**影响**: M4 复习官 AI 无法正常工作

### 问题 4: QA 穿插 20% 复习题逻辑缺失
**位置**: `generate-questions/route.ts:162-163`
**现状**: 硬编码 `past_mistakes: '(No past mistakes - first learning cycle)'`，`is_review` 始终为 0
**spec 要求**: QA 阶段穿插 20% 来自历史模块的复习题
**决定**: 用户决定**放到 M4 之后**做，不纳入 M3.5

### 问题 5: 首页没有复习入口
**位置**: `page.tsx`
**现状**: 只有书目列表
**spec 要求**: 首页显示"你今天有 N 个复习任务"
**归属**: M4 前端任务

### 问题 6: 复习流程 API 和前端完全缺失
**现状**: 无复习到期查询 API、复习出题 API、复习提交 API、复习前端页面
**归属**: M4 核心开发

## M3.5 定义

问题 1-3 是 M4 的前置修复，必须先做：
- **M3.5-T1**: 测试通过后创建 review_schedule + 更新 cluster P 值
- **M3.5-T2**: 评估 `clusters.next_review_date` 去留
- **M3.5-T3**: 重写 reviewer prompt 模板（参照 examiner 模板格式）

问题 4 已被用户决定推迟。问题 5-6 是 M4 正式内容。

## 用户 insight

- "每一个 milestone 开始的时候必须先检查之前代码，以防里程碑接入错位"
- "代码量越来越多，这个步骤会越来越难，而且出错概率大"
- 已将此规则写入 CLAUDE.md 和 session-init（规则 6）

## 流程产出

此次审计产出了新的系统规则：**里程碑启动代码审计**——每个里程碑 brainstorming 前强制读代码、对比 spec、输出差异报告。已写入：
- `CLAUDE.md` — "里程碑启动前置检查"章节
- `.claude/skills/session-init/SKILL.md` — 规则 6 + 触发表更新
