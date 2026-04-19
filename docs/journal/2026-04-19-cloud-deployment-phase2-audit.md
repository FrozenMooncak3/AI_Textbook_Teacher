---
date: 2026-04-19
topic: 云部署 Phase 2 里程碑审计（架构文档同步）
type: audit
status: resolved
keywords: [cloud-deployment, phase2, milestone-audit, architecture-sync, OCR, Cloud-Run, Google-Vision]
---

## 审计范围

Phase 2 commits `04f5107..6d918d0`，15 tasks 全 PASS。代码覆盖：
- `scripts/ocr_server.py`（OCR 服务 Paddle→Vision 迁移 + 鉴权 + 回调）
- `src/app/api/ocr/callback/route.ts`（新端点）
- `src/app/api/books/route.ts`（env + Bearer + DB 写迁移）
- `src/lib/screenshot-ocr.ts`（Buffer/base64 重写）
- `src/lib/ocr-auth.ts`（新文件，双层鉴权 helper）
- `src/middleware.ts`（hotfix：豁免 callback 路径）
- `src/app/globals.css`（hotfix：Tailwind v4 source 范围）
- `Dockerfile.ocr` · `docker-compose.yml` · `.env.example` · `cloudbuild.ocr.yaml`

## architecture.md 变更汇总

### ✅ 契约确认有效
- 模块三元组状态机（text_status / ocr_status / kp_extraction_status）— 未变
- 渐进式处理设计（文字页先解锁、扫描页异步）— 逻辑同前，底层换引擎
- `books.raw_text` 占位替换格式 `--- PAGE N ---\n[OCR_PENDING]` — 未变

### ⚠️ 已更新的契约
- **§0 摘要卡 核心 API**：新增 `POST /api/ocr/callback`（Bearer）
- **§0 摘要卡 部署**：OCR 从"阶段 2 待迁"→"已上线 Cloud Run (us-central1, Vision, IAM-only)"
- **§0 摘要卡 核心约束**：
  - 删 "OCR server 内存 ≥ 1GB（PaddleOCR）"（Vision 是云 API）
  - 删 "OCR 端点无认证"（已双层鉴权）
  - 改 Vercel 4.5MB 上限 → 🚨 归停车场 T2
  - 新增 "OCR 鉴权双层" 约束条
  - 新增 "Cloud Run OCR 不连 DB" 约束条
- **§PDF OCR 管道**：
  - 标题加 "Cloud Run 异步回调 2026-04-19"
  - 4 步流程所有端点入参改 `r2_object_key`（legacy `pdf_path` 拆除）
  - `/classify-pdf` 响应新增 `mixed_count` + `total_pages` 字段
  - `/extract-text` body 新增 `classifications` 参数（替代 DB SELECT）
  - `/ocr-pdf` 改异步模型，立即返回 202 + 后台 Thread + 三事件回调
  - `/ocr` 入参改 `image_base64`
  - 新增 `/health` 未鉴权说明
  - Provider 从"PaddleOCR 默认"→"google 唯一（PaddleOCR 管道已移除）"
- **§PDF OCR 管道 新增段**：Cloud Run → Vercel 回调契约（3 事件类型详细 schema）
- **§PDF OCR 管道 新增段**：middleware 豁免说明（避免下个里程碑改 middleware 时误删）
- **§部署架构**：
  - 标题加 "阶段 2 完成 2026-04-19"
  - OCR 段由"阶段 1 不可用"改为 Cloud Run 完整配置（URL + IAM + CD + Sentry）
  - 本地 Docker ocr 容器改 Google Vision + SA key mount
  - 环境变量三套（Vercel 生产 / Cloud Run / 本地 Docker）全量重写，HOST/PORT 替换为 URL/TOKEN/GCP_SA_KEY_JSON/NEXT_CALLBACK_URL
  - 新增 "OCR 通信鉴权双层" 段，详解 `buildOcrHeaders()` 和 `_post_callback()`
  - "⚠️ 阶段 2 待办约束" 整段删除，替换为 "⚠️ 阶段 3 待办"

### 🆕 新增跨模块依赖
- **Vercel middleware ↔ OCR callback 路由**：必须保持 `isPublicPath` 精确豁免 `/api/ocr/callback`，否则 Cloud Run 回调全 401；修改 middleware 时必读
- **src/lib/ocr-auth.ts ↔ 所有 OCR 调用方**：统一从 `buildOcrHeaders(targetUrl)` 取 headers（books/route.ts + screenshot-ocr.ts），避免散落的 token 拼装逻辑
- **Vision API 启用**：GCP 项目 `awesome-nucleus-403711` 必须启用 Cloud Vision API，否则 OCR 返回 403（Phase 2 smoke test 发现）

### 🔧 ⚠️ 标记变化
- **已摘除**：
  - OCR server 内存 ≥ 1GB 约束（Vision 是云 API）
  - OCR 端点无认证 ⚠️（已加双层）
- **新增**：
  - 🚨 Vercel 4.5MB body 上限阻塞大 PDF 上传（核心约束 + 阶段 3 待办两处标红）
- **保留**：
  - 无

## 下个里程碑注意事项

1. **M4 教学系统启动**：架构层面无依赖 Phase 2 的阻塞；可 dispatch
2. **Phase 3 启动时需检查**：
   - `GCP_SA_KEY_JSON` 明文存 Vercel env 是安全债，Phase 3 应迁移到 Secret Manager 或 Vercel Encrypted Env
   - 自定义域名切换后 `NEXT_CALLBACK_URL` 必须同步更新，否则 Cloud Run 回调跑到旧域名
   - Cloudflare R2 CORS 规则里 AllowedOrigins 需加新域名
3. **修 middleware 时警惕**：`/api/ocr/callback` 精确豁免不能丢，建议加回归测试（T15 已补 `scripts/test-ocr-callback-middleware.mjs`）

## 接口契约断裂风险扫描（无新风险）

- Next.js `/api/ocr/callback` 三事件 schema 与 Python `_post_callback()` 生成体完全一致（已代码对读）
- Python 所有业务端点统一走 `_require_bearer()`，鉴权零缺口
- `OCR_PROVIDER=google` 是默认且唯一，无配置漂移风险
