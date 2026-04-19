---
date: 2026-04-19
topic: PDF 上传走 presigned URL 直传 R2（绕过 Vercel 4.5MB 函数上限）
type: journal
status: parked
keywords: [PDF-upload, presigned-URL, R2, Vercel-function-limit, infrastructure]
urgency: infra-affecting
---

## 问题

2026-04-19 Phase 2 云部署 smoke test 时，用户上传 7.84MB 扫描 PDF 返回"网络请求失败"。

根因：Vercel serverless function 默认 body 上限 **4.5MB**。`src/app/api/books/route.ts` POST 用 `formData.get('file')` 整包接收 PDF 再 `uploadPdf()` 到 R2，所有 >4.5MB 的 PDF 都会被 Vercel 入口拒掉，代码层面根本执行不到。

## 影响范围

- 扫描版 PDF 图文混合体积常见 5-20MB
- 手机扫描 app 生成的多页 PDF 容易超限
- 当前 MVP 直接用 app 的主路径就被堵死在"上传大书"场景

## 决策 + 为什么

**暂停**，不在 T15 修 — 这是预存在的 M3 遗留限制，和 Phase 2 云迁移无关，Phase 2 目标（OCR 迁 Cloud Run + IAM 鉴权 + callback）已全绿。

**归为 T2 基础设施停车场**，独立里程碑评估。

## 修复思路（未来做时参考）

1. 新增 `POST /api/books/upload-url`：前端发 `{ filename, size }`，服务端验用户权限、生成 R2 presigned PUT URL（60s 有效），返回 `{ uploadUrl, objectKey, bookId }`
2. 前端 `PUT` 直传 R2（不经 Vercel 函数，R2 支持大文件）
3. 前端上传完调 `POST /api/books`（或 `POST /api/books/{bookId}/ingest`）传 `{ title, objectKey }`，后端插 DB 行 + 触发 classify-pdf
4. 客户端进度条：用 XHR `upload.onprogress` 监听 R2 PUT 进度

## 用户 insight

- 用户自然就想传大扫描件（财报 369 页等），4.5MB 是极低门槛
- 和 R2 CORS 一起，这是云上部署才暴露的"本地测试看不见"类问题

## 待跟进

- [idea:parked] 实现 presigned URL 上传（T2 基础设施），立项时同时加客户端上传进度条
