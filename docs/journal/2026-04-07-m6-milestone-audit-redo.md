---
date: 2026-04-07
topic: M6里程碑审计重做：4个严重断裂
type: journal
status: resolved
keywords: [M6, 审计重做, SQLite迁移遗漏, PostgreSQL, OCR]
---

# M6 Milestone Audit（重做）

**类型**: audit
**状态**: open（4 个严重断裂待修复）
**日期**: 2026-04-07

## 审计背景

首次 M6 audit（ee80bdc）仅发现文档级问题。本次重做发现 4 个严重断裂 + 3 个需更新项。

## 严重断裂

### 1. ocr_pdf.py 仍用 SQLite
- `scripts/ocr_pdf.py` 全文使用 `sqlite3.connect(db_path)`
- M6 迁移 PostgreSQL 时被遗漏（M6 计划中搜索 `ocr_pdf` 零结果）
- 影响：所有 PDF 上传后 OCR 结果丢失，书永远卡在 `processing`

### 2. books/route.ts 传 SQLite 路径
- `src/app/api/books/route.ts:107` 传 `--db-path data/app.db`
- 配合 #1 导致完整管道断裂

### 3. Docker 容器无法执行 OCR
- `Dockerfile` 是 node:20-alpine，不含 Python/scripts/PaddleOCR
- `books/route.ts` 尝试 `spawn(python)` 在 Docker 中立即失败
- 根因：M6 将 OCR 独立为 Docker 服务但未更新上传流程的调用方式

### 4. initDb() 没有自动调用入口
- 定义在 `db.ts:51` 但无调用者
- 新数据库 prompt_templates=0，所有 AI 功能不可用

## 需更新项

- OCR server 端口默认值：screenshot-ocr.ts=9876 vs ocr_server.py=8000
- docker-compose.yml 残留 SESSION_SECRET（应用未使用）
- architecture.md 缺 PDF OCR 管道描述（已补充）

## 修复计划

| 任务 | 内容 | 派发给 | 档位 |
|------|------|--------|------|
| T1 | OCR 管道迁移（#1+#2+#3+端口统一） | Codex | 重档 |
| T2 | initDb 启动 + docker-compose 清理（#4+SESSION_SECRET） | Codex | 轻档 |

## 根因分析

M6 brainstorming/planning 阶段未做 `grep -r sqlite` 全量扫描，导致 `ocr_pdf.py` 漏出迁移范围。首次 audit 只对比 architecture.md 与代码结构，未追踪"哪些文件仍引用旧技术栈"。
