# Agent 1 工作日志

> 每完成一项工作，追加一条记录。Master Agent 通过此文件了解你的进度。
> 格式：`[日期 时间] [状态] 做了什么 | 修改的文件`
> 状态标签：START（开始）/ DONE（完成）/ BLOCK（被阻塞）/ NOTE（发现问题，未修改）

---

## 记录区（从这里往下追加）

[2026-03-18] [DONE] M1 Agent 1 任务全部完成 | scripts/ocr_pdf.py, src/app/api/books/[bookId]/pdf/route.ts, src/lib/claude.ts
- 修复 OCR 坏页崩溃：ocr_pdf.py 加页级别 try/except，跳过坏页记日志继续
- 创建 GET /api/books/[bookId]/pdf API：返回 PDF 二进制流，404 处理符合 API_CONTRACT
- claude.ts 加 timeout: 60_000（60s 超时）
- 重置 bookId=6 OCR 状态并重跑，新脚本已在后台运行

[2026-03-18] [START] M2 Agent 1：截图问 AI 后端

[2026-03-18] [DONE] M2 Agent 1 任务全部完成 | src/lib/db.ts, src/app/api/books/[bookId]/screenshot-ask/route.ts, src/app/api/conversations/[conversationId]/messages/route.ts, scripts/ocr_image.py
- db.ts 新增 conversations 和 messages 两张表
- 创建 POST /api/books/[bookId]/screenshot-ask：base64截图 → PaddleOCR提取文字 → Claude解读 → 存对话记录
- 创建 POST /api/conversations/[conversationId]/messages：带历史上下文追问
- 创建 scripts/ocr_image.py：截图OCR脚本（Node.js通过execFile调用）
- 截图OCR速度验证：半页裁剪 3.97s（目标<5s），通过
- 所有接口符合 API_CONTRACT.md 格式，错误响应统一 {error, code}
- NOTE: reader/page.tsx 有 SSR 错误（ssr:false in Server Component），属 Agent 2 文件边界，已记录未修改

[2026-03-18] [START] M3 Agent 1：OCR 后台化 + 进度 API

[2026-03-18] [DONE] M3 Agent 1 任务全部完成 | src/lib/db.ts, scripts/ocr_pdf.py, src/app/api/books/[bookId]/status/route.ts
- db.ts 新增 ocr_current_page 和 ocr_total_pages 两列（ALTER TABLE 迁移）
- ocr_pdf.py 改为逐页更新 ocr_current_page（原来每 10 页），启动时写入 ocr_total_pages
- status API 扩展：返回 { parseStatus, ocrCurrentPage, ocrTotalPages }，符合 API_CONTRACT.md
- status API 兼容旧数据：parse_status='done' 映射为 'completed'，'error' 映射为 'failed'
- POST /api/books 上传流程无需改动，已是后台 spawn 模式
- 已验证：bookId=6 OCR 运行中，API 返回 {"parseStatus":"processing","ocrCurrentPage":1,"ocrTotalPages":189}

[2026-03-18] [START] M4 Agent 1：目录导航 TOC API

[2026-03-18] [DONE] M4 Agent 1 任务全部完成 | scripts/extract_toc.py, src/app/api/books/[bookId]/toc/route.ts
- 创建 extract_toc.py：用 PyMuPDF 提取 PDF 内嵌书签，输出 JSON
- 创建 GET /api/books/[bookId]/toc API：调用 Python 脚本，返回 { items: [{title, page, level}] }
- 修复 Windows 环境 Python stdout 中文编码问题（PYTHONIOENCODING=utf-8）
- 已验证：bookId=5 返回 37 个书签，bookId=6（无书签）返回空数组，bookId=999 返回 404
- 接口符合 API_CONTRACT.md 格式，额外返回 level 字段方便前端做缩进

[2026-03-18] [DONE] 截图 OCR 修复：常驻服务 + 错误日志 | scripts/ocr_server.py, src/app/api/books/[bookId]/screenshot-ask/route.ts
- 新增 scripts/ocr_server.py：PaddleOCR 常驻 HTTP 服务（端口 9876），模型只加载一次
- screenshot-ask API 改为调用本地 OCR HTTP 服务，用 http.request 绕过 HTTP_PROXY
- ocrImage() 的 catch 块加 logAction 错误日志
- 超时从 30s 提升到 60s
- 根本原因：每次 execFile 都重新加载 PaddleOCR 模型（10-20s），撞 30s 超时
- 启动方式：`python scripts/ocr_server.py`（需在 Next.js 之前或同时启动）

[2026-03-18] [START] M5 Agent 1：高亮标注 + 页面笔记（数据库 + CRUD API）

[2026-03-18] [DONE] M5 Agent 1 任务全部完成 | src/lib/db.ts, src/app/api/books/[bookId]/highlights/route.ts, src/app/api/books/[bookId]/notes/route.ts
- db.ts 新增 highlights 表（id, book_id, page_number, text, color, rects_json, created_at）
- db.ts 新增 notes 表（id, book_id, page_number, content, created_at, updated_at）
- highlights API：GET（按页筛选）、POST（新增）、DELETE（按 id 删除）
- notes API：GET（按页筛选）、POST（新增）、PUT（编辑）、DELETE（按 id 删除）
- 所有接口符合统一错误格式 {error, code}
- 已验证：创建、查询、删除均正常

