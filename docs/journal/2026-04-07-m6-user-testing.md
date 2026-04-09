# M6 用户测试

**类型**: testing
**状态**: open
**日期**: 2026-04-07

## 本 session 完成

1. **M6-hotfix 执行完毕**（task-execution，2 任务均通过 review）
   - T1: OCR 管道迁移（082e6ea）— spawn→HTTP, sqlite→psycopg2, 端口统一 8000
   - T2: 启动初始化（aa813b5）— instrumentation.ts + 移除 SESSION_SECRET

2. **本地测试验证通过**
   - initDb: 12 prompt templates 正常
   - OCR /ocr-pdf 端点: 接受请求、验证文件、后台处理
   - 上传 2 页测试 PDF → OCR 秒完成 → raw_text 正确写入 PostgreSQL
   - parse_status 生命周期: processing → done

3. **用户实际测试开始，发现问题**
   - `page.tsx:52` — `book.created_at.slice(0, 10)` 崩溃（PostgreSQL 返回 Date 对象不是字符串）→ 已热修复为 `new Date(book.created_at).toISOString().slice(0, 10)`
   - 用户报告"有很多问题" — 具体问题清单待下个 session brainstorm 收集

## 环境状态

- Dev server: localhost:3000
- OCR server: localhost:8000（需带 DATABASE_URL 环境变量启动）
- DB: Neon PostgreSQL（.env.local）
- 用户密码已重置为 test123（frozenmooncak3@gmail.com）
- OCR server 本地启动命令: `DATABASE_URL=$(grep DATABASE_URL .env.local | cut -d= -f2- | tr -d '\r') python scripts/ocr_server.py`

## 下一步

- brainstorming: 收集用户发现的所有问题，制定统一修复计划
