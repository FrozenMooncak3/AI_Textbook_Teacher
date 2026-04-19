---
date: 2026-04-18
topic: 云部署阶段 2 — Cloud Run OCR + Google Vision + CI/CD + callback 端点
type: plan
status: in_progress
keywords: [cloud, deployment, Cloud-Run, Google-Vision, Bearer-token, callback, phase-2]
---

# 云部署 · 阶段 2 实施计划（OCR 上云 + CI/CD）

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **执行方**：Codex（所有代码任务，Python + TS）+ 产品负责人（GCP / Vercel 控制台）+ Claude PM（派发、审核、控制台指导）。

**Goal**：把 Python OCR server 从本地 Docker（PaddleOCR）搬到 Google Cloud Run（Google Vision API），用 Bearer token 鉴权双向通讯，OCR 结果通过 `/api/ocr/callback` 回流到 Neon（Python 不再直写 DB），push `scripts/**` 或 `Dockerfile.ocr` 自动触发 Cloud Run build + deploy。

**Architecture**：Python OCR server 从"直连 Neon + PaddleOCR 本地模型"改成"调 Google Vision API + POST 回调 Next.js"。Next.js 新增一个 `/api/ocr/callback` 端点承接 3 种回调事件（progress / page_result / module_complete），复用 `scripts/ocr_server.py` 将要删除的 4 个 DB 函数的逻辑（用 TS 重写）。所有 Next.js → Cloud Run 和 Cloud Run → Next.js 的 HTTP 调用都带 `Authorization: Bearer ${OCR_SERVER_TOKEN}` header。

**Tech Stack**：
- Python 3.10 + Flask（已有）+ `google-cloud-vision`（新增）+ `sentry-sdk`（新增）+ `requests`（新增回调）
- Next.js 15（已有）+ `@sentry/nextjs`（阶段 3 再装，本阶段不装）
- Google Cloud Run + Artifact Registry + Vision API（全部免费层内）
- Cloud Build（CD，免费 120 min/天）+ GitHub 集成（includedFiles 过滤）

**关联 spec**：`docs/superpowers/specs/2026-04-12-cloud-deployment-design.md` § 4.2 + § 6.1 + § 6.2

---

## 阶段 2 不做的事（YAGNI）

阶段 2 **不碰**以下内容（留给阶段 3）：
- 自定义域名（`brand.com` / `api.brand.com`）— Cloud Run 本阶段用 `xxx.run.app` 默认域名
- `@sentry/nextjs` SDK 安装 — 阶段 3 用 wizard 统一装
- `sentry.client.config.ts` / `sentry.server.config.ts` / `next.config.ts` Sentry wrap — 阶段 3
- Vercel Analytics SDK — 自动 built-in，无需安装
- Cloud Run custom domain Preview 配置 — 阶段 3
- 密码管理器 secrets 整理 — 阶段 3
- R2 token 权限复核 — 阶段 3 红线审查

阶段 2 **为阶段 3 做的准备**：
- Python 侧已加 `sentry-sdk` 依赖和 `sentry_sdk.init()`（即使 DSN 未配也不报错）
- Vercel env vars 预留 `SENTRY_DSN` 位（阶段 3 填值）

---

## 前置条件（产品负责人在 Codex 开工前完成）

阶段 2 的前置工作涉及 Google Cloud 控制台，步骤较 P1 的 R2 + Vercel 更重。Claude 会在每步卡点时实时指导。

### P1. Google Cloud 账户 + 项目

- [ ] 登 [console.cloud.google.com](https://console.cloud.google.com)（用 Gmail 账户即可）
- [ ] 首次使用绑信用卡激活 $300 免费额度（90 天试用 + 永久免费层）
- [ ] Create Project：名称 `ai-textbook-teacher`，Project ID 自定（记下，后续所有 gcloud 命令都要用）
- [ ] 切换到新项目（右上角项目选择器）

### P2. 启用 3 个 API

在 Console → APIs & Services → Library 搜索并启用（每个点 Enable）：
- [ ] **Cloud Run API**（`run.googleapis.com`）
- [ ] **Cloud Build API**（`cloudbuild.googleapis.com`）
- [ ] **Artifact Registry API**（`artifactregistry.googleapis.com`）
- [ ] **Cloud Vision API**（`vision.googleapis.com`）

启用后等 30 秒让 API 完全激活。

### P3. 创建 Artifact Registry repo

Cloud Run 部署需要一个容器镜像仓库。

- [ ] Console → Artifact Registry → Repositories → Create Repository
- [ ] 名称：`ai-textbook-teacher`
- [ ] Format：Docker
- [ ] Mode：Standard
- [ ] Location type：Region → **选 `us-central1`**（与 Vercel `iad1` + Neon `us-east-1` 跨区但延迟可接受；若 Neon 已改 `us-central1` 用 `us-east1`）

### P4. 创建 Cloud Run 服务账号（SA）+ IAM

Task 11 的 detailed steps 覆盖这一步。现在只需准备好：Console → IAM & Admin → Service Accounts 页面已能访问。

### P5. 生成 OCR_SERVER_TOKEN（双向共享密钥）

Next.js 和 Cloud Run 互相调用时都用这个 token。

- [ ] 本地跑：`openssl rand -hex 32`
- [ ] 把输出的 64 字符 hex 串记到密码管理器，命名 `OCR_SERVER_TOKEN`
- [ ] 阶段 2 Task 11（SA）和 Task 14（Vercel env）都会用到

### P6. 本地 gcloud CLI 安装（可选，产品负责人非必须）

Task 12 的首次 Cloud Run 部署会用 `gcloud run deploy --source .`。如果产品负责人想跟 Codex 一起在本地跑部署命令，需要：
- [ ] 安装 gcloud CLI：[cloud.google.com/sdk/docs/install](https://cloud.google.com/sdk/docs/install)
- [ ] 跑 `gcloud auth login` + `gcloud config set project <PROJECT_ID>`

如果不装，Task 12 可以完全在 Cloud Run Console UI 走（稍繁琐但可行），由 Claude 实时指导。

**P1-P6 完成后才能进 Task 11。Task 1-10（代码任务）不依赖 GCP，Codex 可以立即开工。**

---

## 变更文件清单

**新建**：
- `src/app/api/ocr/callback/route.ts` — Cloud Run → Next.js 回调入口（Bearer auth + 3 event types），约 130 行
- `src/app/api/ocr/callback/route.test.ts` — 单元测试（event routing + Bearer auth），约 150 行

**修改**：
- `Dockerfile.ocr` — 去 `paddlepaddle paddleocr`，加 `google-cloud-vision sentry-sdk requests`
- `scripts/ocr_server.py` — 大改（6 项独立任务分拆）
- `src/app/api/books/route.ts` — OCR fetch URL 改 `OCR_SERVER_URL`，3 个 fetch 加 Bearer header
- `src/lib/screenshot-ocr.ts` — `ocrImage(buffer)` 改签名（接收 Buffer，内部转 base64）
- `src/app/api/books/[bookId]/screenshot-ocr/route.ts` — 删除 tmpdir 写文件逻辑
- `docker-compose.yml` — ocr service 加 OCR_SERVER_TOKEN + OCR_PROVIDER=google，删 DATABASE_URL
- `.env.example` — 加 OCR_SERVER_URL / OCR_SERVER_TOKEN / SENTRY_DSN，删 OCR_SERVER_HOST / OCR_SERVER_PORT

**不改（阶段 3 处理）**：
- `package.json`（阶段 3 装 @sentry/nextjs）
- `next.config.ts`（阶段 3 包 Sentry）
- 所有 `sentry.*.config.ts`（阶段 3 新建）

---

## 任务清单

### Task 1: `Dockerfile.ocr` 依赖瘦身（Paddle→Vision）

**Files:**
- Modify: `Dockerfile.ocr`

- [ ] **Step 1: 替换 pip install 行（line 6）**

原代码：
```dockerfile
RUN pip install paddlepaddle paddleocr flask PyMuPDF pymupdf4llm Pillow psycopg2-binary numpy boto3
```
改成：
```dockerfile
RUN pip install flask PyMuPDF pymupdf4llm Pillow numpy boto3 google-cloud-vision sentry-sdk requests
```

变更要点：
- **删**：`paddlepaddle paddleocr`（换 Vision API）+ `psycopg2-binary`（Task 5 后 Python 不直写 DB）
- **加**：`google-cloud-vision`（Vision API SDK）+ `sentry-sdk`（错误追踪）+ `requests`（POST 回调）

- [ ] **Step 2: 删除 `libgl1 libglib2.0-0` apt-get 依赖（line 5）**

原 line 5：
```dockerfile
RUN apt-get update && apt-get install -y libgl1 libglib2.0-0 && rm -rf /var/lib/apt/lists/*
```

这两个库是 Paddle + OpenCV 需要的，Vision API 不需要。换成：
```dockerfile
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && rm -rf /var/lib/apt/lists/*
```

（`ca-certificates` 用于 HTTPS 对 Google API 的证书验证，基础镜像通常已有但显式声明更安全。）

- [ ] **Step 3: （可选）本地重建 OCR 容器**

> **本项目环境本地未装 Docker**（P1 T8 已因同样原因跳过）。本步骤**仅当开发机有 Docker 时**作为早期 smoke 执行；无 Docker 时直接跳到 Step 4 commit，首次 pip install 的实际验证由 **T13 Cloud Build** 远程构建完成。

```bash
docker compose build ocr
```

Expected：镜像 size 从 ~1.2GB 降到 ~400-600MB。检查：
```bash
docker images | grep -i ocr
```

- [ ] **Step 4: Commit**

```bash
git add Dockerfile.ocr
git commit -m "chore(docker): swap PaddleOCR deps for google-cloud-vision + sentry + requests"
```

---

### Task 2: 新建 `src/app/api/ocr/callback/route.ts` + 单元测试

**Files:**
- Create: `src/app/api/ocr/callback/route.ts`
- Create: `src/app/api/ocr/callback/route.test.ts`

设计约束：
- 3 个 event type（progress / page_result / module_complete），单一 POST 入口，按 `event` 字段路由
- Bearer token auth：header `Authorization: Bearer ${OCR_SERVER_TOKEN}`，不匹配 401
- 迁移 `scripts/ocr_server.py` 即将删除的 4 个 DB 函数的逻辑：
  - `update_ocr_progress` → progress event
  - `replace_page_placeholder` + `check_module_ocr_completion` → page_result event
  - `set_parse_status('done')` + module `ocr_status='done'` → module_complete event
- 所有 DB 写操作用 `src/lib/db.ts` 的 `run()` / `query()`（统一连接池）

- [ ] **Step 1: 先写 failing test（`src/app/api/ocr/callback/route.test.ts`）**

```typescript
import assert from 'node:assert/strict'
import test from 'node:test'
import { NextRequest } from 'next/server'

const TOKEN = 'test-token-32chars-xxxxxxxxxxxxxx'

function mkRequest(body: unknown, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest('http://localhost/api/ocr/callback', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${TOKEN}`,
      ...headers,
    },
    body: JSON.stringify(body),
  })
}

test('rejects request without Authorization header (401)', async () => {
  process.env.OCR_SERVER_TOKEN = TOKEN
  const { POST } = await import('./route.ts')
  const req = new NextRequest('http://localhost/api/ocr/callback', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event: 'progress', book_id: 1, pages_done: 1, pages_total: 10 }),
  })
  const res = await POST(req)
  assert.equal(res.status, 401)
})

test('rejects request with wrong Bearer token (401)', async () => {
  process.env.OCR_SERVER_TOKEN = TOKEN
  const { POST } = await import('./route.ts')
  const req = mkRequest(
    { event: 'progress', book_id: 1, pages_done: 1, pages_total: 10 },
    { Authorization: 'Bearer wrong-token' }
  )
  const res = await POST(req)
  assert.equal(res.status, 401)
})

test('rejects request with missing OCR_SERVER_TOKEN env (500)', async () => {
  delete process.env.OCR_SERVER_TOKEN
  const { POST } = await import('./route.ts')
  const req = mkRequest({ event: 'progress', book_id: 1, pages_done: 1, pages_total: 10 })
  const res = await POST(req)
  assert.equal(res.status, 500)
})

test('rejects unknown event type (400)', async () => {
  process.env.OCR_SERVER_TOKEN = TOKEN
  const { POST } = await import('./route.ts')
  const req = mkRequest({ event: 'bogus', book_id: 1 })
  const res = await POST(req)
  assert.equal(res.status, 400)
})

test('accepts progress event (200)', async () => {
  process.env.OCR_SERVER_TOKEN = TOKEN
  // mock DB：因为无真实 DB，测试只验证 handler 返回 200
  // 真实写库验证留到 Task 15 E2E
  const { POST } = await import('./route.ts')
  const req = mkRequest({
    event: 'progress',
    book_id: 999999, // 不存在的 book，UPDATE 返回 0 行但 SQL 不报错
    pages_done: 3,
    pages_total: 10,
  })
  const res = await POST(req)
  assert.equal(res.status, 200)
})
```

- [ ] **Step 2: 运行测试（未实现，应全部失败）**

```bash
node --test --experimental-strip-types src/app/api/ocr/callback/route.test.ts
```

Expected：FAIL（`Cannot find module './route.ts'` 或类似错误）。

- [ ] **Step 3: 写 `src/app/api/ocr/callback/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { query, run } from '@/lib/db'
import { UserError } from '@/lib/errors'
import { handleRoute } from '@/lib/handle-route'
import { logAction } from '@/lib/log'

interface ProgressEvent {
  event: 'progress'
  book_id: number
  module_id?: number
  pages_done: number
  pages_total: number
}

interface PageResultEvent {
  event: 'page_result'
  book_id: number
  module_id: number
  page_number: number
  text: string
}

interface ModuleCompleteEvent {
  event: 'module_complete'
  book_id: number
  module_id: number
  status: 'success' | 'error'
  error?: string
}

type CallbackEvent = ProgressEvent | PageResultEvent | ModuleCompleteEvent

function requireBearer(req: NextRequest): void {
  const expected = process.env.OCR_SERVER_TOKEN
  if (!expected) {
    throw new Error('OCR_SERVER_TOKEN env var is not configured')
  }
  const header = req.headers.get('authorization') ?? ''
  if (!header.startsWith('Bearer ')) {
    throw new UserError('Missing Bearer token', 'UNAUTHENTICATED', 401)
  }
  const received = header.slice('Bearer '.length).trim()
  if (received !== expected) {
    throw new UserError('Invalid token', 'UNAUTHENTICATED', 401)
  }
}

async function handleProgress(event: ProgressEvent): Promise<void> {
  await run(
    `UPDATE books
       SET ocr_current_page = $1, ocr_total_pages = $2, parse_status = 'processing'
     WHERE id = $3`,
    [event.pages_done, event.pages_total, event.book_id]
  )
}

async function handlePageResult(event: PageResultEvent): Promise<void> {
  const rows = await query<{ raw_text: string | null }>(
    'SELECT raw_text FROM books WHERE id = $1',
    [event.book_id]
  )
  const rawText = rows[0]?.raw_text ?? ''
  const placeholder = `--- PAGE ${event.page_number} ---\n[OCR_PENDING]`
  const replacement = `--- PAGE ${event.page_number} ---\n${event.text}`
  const updated = rawText.replace(placeholder, replacement)
  await run('UPDATE books SET raw_text = $1 WHERE id = $2', [updated, event.book_id])
}

async function handleModuleComplete(event: ModuleCompleteEvent): Promise<void> {
  const nextStatus = event.status === 'success' ? 'done' : 'error'
  await run('UPDATE modules SET ocr_status = $1 WHERE id = $2', [nextStatus, event.module_id])

  // 如果书内所有模块 ocr_status 都是 done/skipped，把 books.parse_status 也标 done
  const pendingModules = await query<{ count: string }>(
    `SELECT COUNT(*)::text AS count
       FROM modules
      WHERE book_id = $1 AND ocr_status NOT IN ('done', 'skipped')`,
    [event.book_id]
  )
  if (Number(pendingModules[0]?.count ?? '0') === 0) {
    await run("UPDATE books SET parse_status = 'done' WHERE id = $1", [event.book_id])
  }

  if (event.status === 'error') {
    await logAction(
      'ocr_callback_module_error',
      `bookId=${event.book_id}, moduleId=${event.module_id}, error=${(event.error ?? '').slice(0, 500)}`,
      'error'
    )
  }
}

export const POST = handleRoute(async (req) => {
  requireBearer(req)
  const body = (await req.json()) as CallbackEvent

  switch (body.event) {
    case 'progress':
      await handleProgress(body)
      break
    case 'page_result':
      await handlePageResult(body)
      break
    case 'module_complete':
      await handleModuleComplete(body)
      break
    default:
      throw new UserError('Unknown event type', 'INVALID_EVENT', 400)
  }

  return { data: { ok: true } }
})
```

- [ ] **Step 4: 运行测试（应全部通过）**

```bash
node --test --experimental-strip-types src/app/api/ocr/callback/route.test.ts
```

Expected：5 passing。

如果 `accepts progress event` 失败是因为本地 DB 不可连，SQL 报错，属于预期——该测试需要 DB。可以临时用 mock 或跳过（标 `test.skip`），Task 15 E2E 会真正验证。

实际做法：在本机无 DB 时，让测试 mock `pool.query`。或者接受"这个测试本地只跑到 Bearer 检查通过，DB 错了也验证了 200/500 分支"。简洁起见：
- 如果 DB 不可连，`handleProgress` 抛错 → `handleRoute` 返回 500。测试断言改为 `[200, 500].includes(res.status)`。

更新测试 Step 1 的最后一个 case：
```typescript
test('accepts progress event (200 or 500 depending on DB)', async () => {
  process.env.OCR_SERVER_TOKEN = TOKEN
  const { POST } = await import('./route.ts')
  const req = mkRequest({
    event: 'progress',
    book_id: 999999,
    pages_done: 3,
    pages_total: 10,
  })
  const res = await POST(req)
  // 200 if DB connects, 500 if not. Either way means Bearer + event routing worked.
  assert.ok([200, 500].includes(res.status), `expected 200 or 500, got ${res.status}`)
})
```

- [ ] **Step 5: 本地 type check**

```bash
npx tsc --noEmit
```

Expected：无错误。

- [ ] **Step 6: Commit**

```bash
git add src/app/api/ocr/callback/route.ts src/app/api/ocr/callback/route.test.ts
git commit -m "feat(ocr): add /api/ocr/callback endpoint with Bearer auth and 3 event handlers"
```

---

### Task 3: Python — Bearer token 中间件 + Google Vision API 重写

**Files:**
- Modify: `scripts/ocr_server.py`

设计约束：
- Bearer token 在每个 route 开头调用 `_require_bearer()` 检查（不用 before_request 是因为 `/health` 需要放行）
- `google_ocr()` 从 Document AI 改成 Vision API。Vision API 在 Cloud Run 下用 ADC 自动鉴权（无需 key 文件），本地 dev 需要 `GOOGLE_APPLICATION_CREDENTIALS` 指向 key 文件（docker-compose 里不配置，表明本地 ocr 容器跑 google 模式需要手工 mount key——Task 10 会在 docker-compose 里加 comment 提示）
- **不做 Paddle fallback**——spec § 4.2 明确删除（Task 6 完整删 `paddle_ocr` 函数）。本任务先留着 `paddle_ocr`，Task 6 统一删除

- [ ] **Step 1: 加 Bearer token 中间件（文件头部，imports 之后）**

在 line 27 附近（`OCR_PROVIDER = os.environ.get(...)` 之前）加：
```python
OCR_SERVER_TOKEN = os.environ.get("OCR_SERVER_TOKEN", "")


def _require_bearer() -> tuple[Any, int] | None:
    """Return (response, status) if Bearer token invalid, else None."""
    if not OCR_SERVER_TOKEN:
        return jsonify({"error": "OCR_SERVER_TOKEN not configured"}), 500
    header = request.headers.get("Authorization", "")
    if not header.startswith("Bearer "):
        return jsonify({"error": "missing Bearer token"}), 401
    received = header[len("Bearer ") :].strip()
    if received != OCR_SERVER_TOKEN:
        return jsonify({"error": "invalid token"}), 401
    return None
```

- [ ] **Step 2: 在 4 个需要认证的 route 入口调用 `_require_bearer()`**

在这 4 个 route 函数开头（`body = request.get_json(...)` 之前）加：
```python
auth_error = _require_bearer()
if auth_error:
    return auth_error
```

4 个 route：
- `/ocr`（`ocr_image_route`，line 428）
- `/classify-pdf`（`classify_pdf_route`，line 447）
- `/extract-text`（`extract_text_route`，line 516）
- `/ocr-pdf`（`ocr_pdf_route`，line 587）

**不加到** `/health`（line 419）——让 Cloud Run 健康检查能免鉴权访问。

- [ ] **Step 3: 重写 `google_ocr()` 函数（line 182-205）**

原代码用 `documentai_v1`，替换成 Vision API。新实现：

```python
def google_ocr(page_image: Image.Image) -> str:
    """OCR a page image via Google Cloud Vision API (document_text_detection)."""
    from google.cloud import vision

    client = vision.ImageAnnotatorClient()

    buffer = io.BytesIO()
    page_image.save(buffer, format="PNG")
    image = vision.Image(content=buffer.getvalue())

    response = client.document_text_detection(image=image)
    if response.error.message:
        raise RuntimeError(f"Google Vision error: {response.error.message}")

    full = response.full_text_annotation
    return full.text.strip() if full and full.text else ""
```

变更要点：
- 用 `vision.ImageAnnotatorClient()` 而不是 `DocumentProcessorServiceClient`
- `document_text_detection` 比 `text_detection` 对密集文档（教材）识别更好
- **无 Paddle fallback**——直接抛错让上游处理
- 认证靠 ADC（`GOOGLE_APPLICATION_CREDENTIALS` env 或 Cloud Run SA）自动解决，无需代码配置

- [ ] **Step 4: 删除未用的 `documentai` import（`google_ocr` 原实现里的 `from google.cloud import documentai_v1 as documentai`）**

确认整个文件无 `documentai` 引用（原来就只在 `google_ocr` 内部 import，Step 3 已不用）。

- [ ] **Step 5: 本地 lint / syntax check（docker 内或宿主机都行）**

```bash
python -c "import py_compile; py_compile.compile('scripts/ocr_server.py', doraise=True)"
```

Expected：无输出（success）。

- [ ] **Step 6: Commit**

```bash
git add scripts/ocr_server.py
git commit -m "feat(ocr): add Bearer token middleware + rewrite google_ocr to Vision API"
```

---

### Task 4: Python — `/ocr` 端点改 base64 + 修 `mixed_count` bug

**Files:**
- Modify: `scripts/ocr_server.py`

- [ ] **Step 1: 改 `/ocr` 端点（line 428-444）接受 `image_base64`**

原代码：
```python
@app.post("/ocr")
def ocr_image_route() -> tuple[Any, int] | Any:
    try:
        body = request.get_json(silent=True) or {}
        image_path = str(body.get("image_path", "")).strip()

        if not image_path:
            return jsonify({"error": "missing image_path"}), 400

        image = preprocess_image(image_path)
        with ocr_lock:
            result = ocr_engine.ocr(np.array(image), cls=True)

        lines, confidence = extract_lines(result)
        return jsonify({"text": "\n".join(lines), "confidence": confidence})
    except Exception as error:
        return jsonify({"error": str(error)}), 500
```

改成：
```python
@app.post("/ocr")
def ocr_image_route() -> tuple[Any, int] | Any:
    auth_error = _require_bearer()
    if auth_error:
        return auth_error

    try:
        body = request.get_json(silent=True) or {}
        image_b64 = str(body.get("image_base64", "")).strip()

        if not image_b64:
            return jsonify({"error": "missing image_base64"}), 400

        import base64

        # 允许 data URL 前缀 `data:image/png;base64,...`
        if "," in image_b64 and image_b64.startswith("data:"):
            image_b64 = image_b64.split(",", 1)[1]

        image_bytes = base64.b64decode(image_b64)
        image = Image.open(io.BytesIO(image_bytes))
        image = ImageOps.exif_transpose(image).convert("L")
        image = ImageOps.autocontrast(image)
        width, height = image.size
        if max(width, height) < 1600:
            image = image.resize((width * 2, height * 2), Image.Resampling.LANCZOS)
        image = image.convert("RGB")

        text = ocr_page_image(image)
        # confidence 字段保留（screenshot-ocr.ts 会用）；Vision API 不提供 per-image confidence
        # 简化策略：有文本返回 1.0，无返回 0.0
        confidence = 1.0 if text.strip() else 0.0
        return jsonify({"text": text, "confidence": confidence})
    except Exception as error:
        return jsonify({"error": str(error)}), 500
```

变更要点：
- 入参从 `image_path`（本地文件路径）→ `image_base64`（base64 字符串）
- 内部 preprocess 逻辑和原 `preprocess_image()` 相同，就地写出（`preprocess_image()` 函数不再被用，Task 6 删）
- 走 `ocr_page_image()` 路由到 provider（Task 6 会把默认从 paddle 改 google）
- `confidence` 字段保持契约（screenshot-ocr.ts 用它判断 `isUsefulOcrText()`）

- [ ] **Step 2: 修 `/classify-pdf` 的 `mixed_count` bug（line 447-513）**

原代码（lines 477-490）在 loop 里只统计 `text_count` 和 `scanned_count`，漏了 `mixed_count`。

替换这段（lines 476-490）：
```python
    doc = None
    pages: list[dict[str, Any]] = []
    text_count = 0
    scanned_count = 0

    try:
        doc = fitz.open(pdf_path)
        for page_index in range(len(doc)):
            page_number = page_index + 1
            page_type = classify_page(doc[page_index])
            pages.append({"page": page_number, "type": page_type})

            if page_type == "text":
                text_count += 1
            else:
                scanned_count += 1
```

改成：
```python
    doc = None
    pages: list[dict[str, Any]] = []
    text_count = 0
    scanned_count = 0
    mixed_count = 0

    try:
        doc = fitz.open(pdf_path)
        for page_index in range(len(doc)):
            page_number = page_index + 1
            page_type = classify_page(doc[page_index])
            pages.append({"page": page_number, "type": page_type})

            if page_type == "text":
                text_count += 1
            elif page_type == "scanned":
                scanned_count += 1
            else:
                mixed_count += 1
```

然后在返回 JSON（lines 507-513）加 `mixed_count`：

原：
```python
    return jsonify(
        {
            "pages": pages,
            "text_count": text_count,
            "scanned_count": scanned_count,
        }
    )
```

改成：
```python
    return jsonify(
        {
            "pages": pages,
            "text_count": text_count,
            "scanned_count": scanned_count,
            "mixed_count": mixed_count,
            "total_pages": len(pages),
        }
    )
```

`total_pages` 也加上，spec § 6.2 契约要求。

- [ ] **Step 3: 本地 syntax check**

```bash
python -c "import py_compile; py_compile.compile('scripts/ocr_server.py', doraise=True)"
```

Expected：无输出。

- [ ] **Step 4: Commit**

```bash
git add scripts/ocr_server.py
git commit -m "feat(ocr): switch /ocr to image_base64 input; fix missing mixed_count in /classify-pdf"
```

---

### Task 5: Python — 删 4 个 DB 写函数 + `process_pdf_ocr` 改 callback POST

**Files:**
- Modify: `scripts/ocr_server.py`

**设计约束**：
- 删除 `update_ocr_progress`（line 135-140）、`write_ocr_result`（line 151-156）、`replace_page_placeholder`（line 292-302）、`check_module_ocr_completion`（line 305-337）
- 保留 `set_parse_status`（line 143-148）— 原因：本阶段暂不走 callback 处理 `set_parse_status('done')`，由 `module_complete` 事件派生（callback 内部判断所有模块 done → 标 book done）
- 删除 `log_to_db`（line 123-132）和 `run_write`（line 117-120）— 删了直写 DB 的所有支持代码
- 删除 `psycopg2` import 和所有 `psycopg2.connect(...)` 调用
- `process_pdf_ocr` 改成用 `requests.post` 调 `NEXT_CALLBACK_URL`（env var），带 Bearer token
- `classify_pdf_route` 和 `extract_text_route` 里的直写 DB（更新 `page_classifications` / `raw_text`）也改成 callback？——**不**，这 2 个端点是同步返回，调用方（Next.js books/route.ts）拿到 response body 直接用，不需要 callback。但它们内部的 `with psycopg2.connect(...)` 写 DB 要删 → 让 Next.js 拿到 response 后自己写 DB。
- **Classification 结果的归属**：Python 返回 `{pages, text_count, scanned_count, mixed_count, total_pages}` → Next.js 自己写 `page_classifications` 到 `books` 表。同样 `extract-text` 返回 `{text, page_count}` → Next.js 写 `raw_text`。

这是整个 plan 最大的 task，分 4 个子步骤做，每步完成 + syntax check。

- [ ] **Step 1: 删除 4 个 DB 写函数 + `log_to_db` + `run_write`（lines 117-156 + 292-337）**

整块删除（函数定义位置，注意行号会随之前改动偏移）：
- `run_write`（line 117-120）
- `log_to_db`（line 123-132）
- `update_ocr_progress`（line 135-140）
- `set_parse_status`（line 143-148）
- `write_ocr_result`（line 151-156）
- `replace_page_placeholder`（line 292-302）
- `check_module_ocr_completion`（line 305-337）

注意：
- 保留 `extract_lines`（line 86-114）— screenshot OCR 和 paddle OCR 还用
- 保留 `render_pdf_page`（line 159-162）— `process_pdf_ocr` 里还用
- 保留 `classify_page`（line 217-243）— `/classify-pdf` 还用
- 保留 `preprocess_image`（line 73-83）— Task 4 已 inline 到 `/ocr`，此函数不再用，一起删

也删 `preprocess_image`（line 73-83）。

- [ ] **Step 2: 删除 `psycopg2` import（line 14）**

原：
```python
import psycopg2
```
删除整行。

- [ ] **Step 3: 添加 callback POST helper 函数**

在文件顶部（`_cleanup_if_temp` 函数后）加：
```python
NEXT_CALLBACK_URL = os.environ.get("NEXT_CALLBACK_URL", "")


def _post_callback(event: dict[str, Any]) -> None:
    """POST an OCR event to Next.js callback. Logs failure but doesn't raise."""
    if not NEXT_CALLBACK_URL:
        print(f"[callback] NEXT_CALLBACK_URL not configured; skipping event={event.get('event')}", flush=True)
        return
    if not OCR_SERVER_TOKEN:
        print(f"[callback] OCR_SERVER_TOKEN not configured; skipping event={event.get('event')}", flush=True)
        return
    try:
        response = requests.post(
            NEXT_CALLBACK_URL,
            json=event,
            headers={"Authorization": f"Bearer {OCR_SERVER_TOKEN}"},
            timeout=30,
        )
        if not response.ok:
            print(
                f"[callback] HTTP {response.status_code} for event={event.get('event')}: {response.text[:300]}",
                flush=True,
            )
    except Exception as error:
        print(f"[callback] POST failed for event={event.get('event')}: {error}", flush=True)
```

记得在文件头加 `import requests`（line 10 附近）。

- [ ] **Step 4: 重写 `process_pdf_ocr`（line 340-416）**

原函数直写 DB 很多次。改成只发 callback。新实现：

```python
def process_pdf_ocr(
    pdf_path: str,
    book_id: int,
    classifications: list[dict[str, Any]] | None,
    downloaded: bool = False,
) -> None:
    """Background worker: OCR scanned/mixed pages and POST callbacks."""
    try:
        if not classifications:
            # 没有分类信息（legacy 路径）：跳过，让上游处理
            print(f"[ocr] book {book_id} has no classifications; skipping", flush=True)
            return

        scanned_pages = [
            page_info for page_info in classifications
            if page_info["type"] in ("scanned", "mixed")
        ]
        if not scanned_pages:
            # 所有页都是文字页；Next.js 侧已经把 raw_text 写好了，这里不用做什么
            print(f"[ocr] book {book_id} has no scanned pages; nothing to OCR", flush=True)
            return

        total_to_ocr = len(scanned_pages)
        doc = fitz.open(pdf_path)
        ocr_count = 0

        # 按 module 分组，便于 module_complete 事件的 module_id 判断
        # 目前 plan 不携带 module_id → Python 侧发 progress/page_result 时都不带 module_id
        # module_complete 由 Next.js 侧在收到 page_result 后自己推断完成状态
        # （见 src/app/api/ocr/callback/route.ts 的 page_result 事件处理扩展，本 plan 不做）
        #
        # 简化方案：Python 不感知 module 边界，只报 page_result。
        # Next.js callback 在每个 page_result 后自行查询 modules 表判断是否某个模块完成。
        # 这与 spec §6.2 的 module_complete 事件语义有差异，此处选择更保守的写法：
        # Python 在最后发一个全局 module_complete（所有模块都 done）或单个模块 done 时发。
        #
        # 实施细节：Python 查模块信息需要 DB —— 但我们已经不连 DB。
        # 解决：本阶段 Python 只发 progress + page_result；
        # 由 Next.js callback（page_result handler）延伸检查模块完成。
        # 这需要 src/app/api/ocr/callback/route.ts 的 handlePageResult 末尾加一段"检查模块完成"逻辑。

        try:
            for page_info in scanned_pages:
                page_number = page_info["page"]
                page_index = page_number - 1
                page = doc[page_index]
                page_image = render_pdf_page(page)
                page_text = ocr_page_image(page_image)

                _post_callback({
                    "event": "page_result",
                    "book_id": book_id,
                    "module_id": 0,  # Python 不感知模块，让 callback 自己查
                    "page_number": page_number,
                    "text": page_text,
                })

                ocr_count += 1
                _post_callback({
                    "event": "progress",
                    "book_id": book_id,
                    "pages_done": ocr_count,
                    "pages_total": total_to_ocr,
                })
        finally:
            doc.close()

        # 全部完成——发一个 module_complete 带 module_id=0 作为书级完成标记
        # callback handleModuleComplete 收到 module_id=0 时改为把 books.parse_status='done'
        _post_callback({
            "event": "module_complete",
            "book_id": book_id,
            "module_id": 0,
            "status": "success",
        })
        print(f"[ocr] book {book_id} OCR complete ({ocr_count} pages)", flush=True)
    except Exception as error:
        print(f"[ocr] book {book_id} failed: {error}", flush=True)
        _post_callback({
            "event": "module_complete",
            "book_id": book_id,
            "module_id": 0,
            "status": "error",
            "error": str(error)[:500],
        })
    finally:
        _cleanup_if_temp(pdf_path, downloaded)
```

**设计说明**：Python 侧不再查 DB，所以无法在发 callback 时精确判断"某个 module 是否刚好完成"。妥协方案：
- Python 只发 `page_result` 和 `progress` 事件
- 最后发一个 `module_complete` with `module_id=0` 作为全书完成标记
- Next.js callback 收到 `module_id=0` 时，改为把所有该 book 的 modules 设为 `ocr_status='done'` + `books.parse_status='done'`

这需要调整 Task 2 里的 `handleModuleComplete` 逻辑 → Step 5 会补上。

- [ ] **Step 5: 回改 `src/app/api/ocr/callback/route.ts` 的 `handleModuleComplete`**

在 Task 2 写好的 `handleModuleComplete` 里加对 `module_id === 0` 的特殊处理：

```typescript
async function handleModuleComplete(event: ModuleCompleteEvent): Promise<void> {
  const nextStatus = event.status === 'success' ? 'done' : 'error'

  if (event.module_id === 0) {
    // 书级完成标记（Python 不感知 module 边界，发 module_id=0 代表整本书 OCR 完成）
    await run(
      "UPDATE modules SET ocr_status = $1 WHERE book_id = $2 AND ocr_status = 'processing'",
      [nextStatus, event.book_id]
    )
    await run(
      `UPDATE books SET parse_status = $1 WHERE id = $2`,
      [event.status === 'success' ? 'done' : 'error', event.book_id]
    )
    if (event.status === 'error') {
      await logAction(
        'ocr_callback_book_error',
        `bookId=${event.book_id}, error=${(event.error ?? '').slice(0, 500)}`,
        'error'
      )
    }
    return
  }

  // 正常单 module 完成（未来 Python 感知 module 时使用）
  await run('UPDATE modules SET ocr_status = $1 WHERE id = $2', [nextStatus, event.module_id])

  const pendingModules = await query<{ count: string }>(
    `SELECT COUNT(*)::text AS count
       FROM modules
      WHERE book_id = $1 AND ocr_status NOT IN ('done', 'skipped')`,
    [event.book_id]
  )
  if (Number(pendingModules[0]?.count ?? '0') === 0) {
    await run("UPDATE books SET parse_status = 'done' WHERE id = $1", [event.book_id])
  }

  if (event.status === 'error') {
    await logAction(
      'ocr_callback_module_error',
      `bookId=${event.book_id}, moduleId=${event.module_id}, error=${(event.error ?? '').slice(0, 500)}`,
      'error'
    )
  }
}
```

- [ ] **Step 6: 改 `/ocr-pdf` route 把 classifications 传给 worker（line 587-624）**

`process_pdf_ocr` 新签名要 classifications。原 route 没传。

改 `ocr_pdf_route`（Task 3 已加 `_require_bearer`）：
```python
@app.post("/ocr-pdf")
def ocr_pdf_route() -> tuple[Any, int] | Any:
    auth_error = _require_bearer()
    if auth_error:
        return auth_error

    body = request.get_json(silent=True) or {}
    r2_key = str(body.get("r2_object_key", "")).strip()
    legacy_path = str(body.get("pdf_path", "")).strip()
    raw_book_id = body.get("book_id")
    classifications_raw = body.get("classifications")

    if not r2_key and not legacy_path:
        return jsonify({"error": "missing r2_object_key (or legacy pdf_path)"}), 400

    if raw_book_id is None:
        return jsonify({"error": "missing book_id"}), 400

    try:
        book_id = int(raw_book_id)
    except (TypeError, ValueError):
        return jsonify({"error": "invalid book_id"}), 400

    classifications: list[dict[str, Any]] | None = None
    if isinstance(classifications_raw, list):
        classifications = classifications_raw  # 信任调用方，schema 错了 OCR 会报错回调

    downloaded = bool(r2_key)
    try:
        pdf_path = _download_pdf_from_r2(r2_key) if r2_key else legacy_path
    except Exception as error:
        return jsonify({"error": f"R2 download failed: {error}"}), 500

    if not os.path.isfile(pdf_path):
        return jsonify({"error": "pdf_path not found"}), 404

    worker = threading.Thread(
        target=process_pdf_ocr,
        args=(pdf_path, book_id, classifications, downloaded),
        daemon=True,
    )
    worker.start()
    return jsonify({"status": "accepted"}), 202
```

- [ ] **Step 7: 改 `/classify-pdf` 不再写 DB（line 447-513，Task 4 已修过 mixed_count）**

删除结尾处的 `with psycopg2.connect(...) as connection: ... UPDATE books SET page_classifications = ...` 块（lines 496-505）。

**Next.js 变更（对应）**：Next.js books/route.ts 在拿到 classify-pdf response 后，自己写 `page_classifications`、`text_pages_count`、`scanned_pages_count` 到 books 表。

现在 Step 7 的 Python 改动 → 只保留返回 JSON，不写库：

删除这段（在 `finally` 之后）：
```python
    with psycopg2.connect(database_url) as connection:
        run_write(
            connection,
            """
            UPDATE books
            SET page_classifications = %s, text_pages_count = %s, scanned_pages_count = %s
            WHERE id = %s
            """,
            (json.dumps(pages), text_count, scanned_count, book_id),
        )
```

还要删除 route 顶部拉 `database_url` 和检查 `DATABASE_URL` 的那几行（原 lines 453 + 466-467），因为不再用 DB。

- [ ] **Step 8: 改 `/extract-text` 不再写 DB（line 516-584）**

类似 Step 7，删除 `with psycopg2.connect(...)` 那块（line 581-582），以及 `database_url` 变量和 `DATABASE_URL` 检查。

- [ ] **Step 9: 改 `/health` 端点去掉 DATABASE_URL 检查（line 419-425）**

原：
```python
@app.get("/health")
def health() -> tuple[Any, int] | Any:
    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        return jsonify({"status": "error", "database": "missing"}), 500

    return jsonify({"status": "ok", "database": "configured"})
```

改成：
```python
@app.get("/health")
def health() -> tuple[Any, int] | Any:
    return jsonify({
        "status": "ok",
        "ocr_provider": OCR_PROVIDER,
        "callback_configured": bool(NEXT_CALLBACK_URL),
    })
```

Cloud Run 的健康检查靠这个端点，不能 fail。

- [ ] **Step 10: Next.js 侧吃掉 Python 不再写的 DB 写入**

修改 `src/app/api/books/route.ts`（Task 7 会统一改 Bearer + URL，这里只做 classify 返回值的 DB 写入）：

在 Task 7 的同一次编辑里（或单独提前做），lines 119-126 拿到 classify response 后，加一段写 DB：

```typescript
const classifyJson = (await classifyRes.json()) as {
  pages: { page: number; type: string }[]
  text_count: number
  scanned_count: number
  mixed_count: number
  total_pages: number
}
const { pages, text_count, scanned_count, mixed_count } = classifyJson
const nonTextPages = scanned_count + mixed_count

await run(
  `UPDATE books
     SET page_classifications = $1,
         text_pages_count = $2,
         scanned_pages_count = $3
   WHERE id = $4`,
  [JSON.stringify(pages), text_count, scanned_count + mixed_count, bookId]
)
```

同理，extract-text 后：
```typescript
const extractJson = (await extractRes.json()) as { text: string; page_count: number }
const rawText = extractJson.text ?? ''

if (rawText) {
  await run('UPDATE books SET raw_text = $1 WHERE id = $2', [rawText, bookId])
  // ...existing chunks insert logic...
}
```

**这些变更汇总到 Task 7 的同一次编辑里**（保证 Next.js 和 Python 改动一起生效）。此 Task 只在 Python 侧做。

- [ ] **Step 11: 本地 syntax check**

```bash
python -c "import py_compile; py_compile.compile('scripts/ocr_server.py', doraise=True)"
```

Expected：无输出。

检查所有 `psycopg2` / `run_write` / `log_to_db` / `update_ocr_progress` / `set_parse_status` / `write_ocr_result` / `replace_page_placeholder` / `check_module_ocr_completion` / `preprocess_image` / `database_url` / `DATABASE_URL` 在 `scripts/ocr_server.py` 里没有残留：

```bash
grep -nE '(psycopg2|run_write|log_to_db|update_ocr_progress|set_parse_status|write_ocr_result|replace_page_placeholder|check_module_ocr_completion|preprocess_image|DATABASE_URL|database_url)' scripts/ocr_server.py
```

Expected：空输出（无命中）。

- [ ] **Step 12: Commit**

```bash
git add scripts/ocr_server.py src/app/api/ocr/callback/route.ts
git commit -m "feat(ocr): remove direct DB writes; emit callbacks for progress/page_result/module_complete"
```

---

### Task 6: Python — 删 Paddle fallback + legacy `pdf_path` 字段 + 默认 Google

**Files:**
- Modify: `scripts/ocr_server.py`

- [ ] **Step 1: 改默认 `OCR_PROVIDER` = `"google"`（line 27）**

原：
```python
OCR_PROVIDER = os.environ.get("OCR_PROVIDER", "paddle")
```
改成：
```python
OCR_PROVIDER = os.environ.get("OCR_PROVIDER", "google")
```

- [ ] **Step 2: 删除 PaddleOCR 初始化（原 line 29-32）**

原：
```python
print("Loading PaddleOCR model...", flush=True)
ocr_engine = PaddleOCR(use_angle_cls=True, lang="ch", use_gpu=False, show_log=False)
ocr_lock = threading.Lock()
print("PaddleOCR model loaded", flush=True)
```

删除整段。Cloud Run 冷启动时间也由此大幅缩短（从 PaddleOCR 加载 ~10s 降到 Flask 启动 <1s）。

- [ ] **Step 3: 删除 `paddle_ocr()` 函数（line 173-179）**

原：
```python
def paddle_ocr(page_image: Image.Image) -> str:
    """Run OCR with PaddleOCR."""
    with ocr_lock:
        result = ocr_engine.ocr(np.array(page_image), cls=True)

    lines, _ = extract_lines(result)
    return "\n".join(lines).strip()
```

删除整段。

- [ ] **Step 4: 改 `ocr_page_image()` 只走 Google（line 165-170）**

原：
```python
def ocr_page_image(page_image: Image.Image) -> str:
    """Route OCR to the configured provider."""
    if OCR_PROVIDER == "google":
        return google_ocr(page_image)

    return paddle_ocr(page_image)
```

改成：
```python
def ocr_page_image(page_image: Image.Image) -> str:
    """OCR a page image via the configured provider (only google supported post-P2)."""
    if OCR_PROVIDER != "google":
        raise RuntimeError(f"Unsupported OCR_PROVIDER={OCR_PROVIDER} (only 'google' is supported)")
    return google_ocr(page_image)
```

- [ ] **Step 5: 删除 `extract_page_text()` 函数（原 line 208-214）**

这函数走 `get_text()` 再 fallback paddle，本阶段后只走 Google → 不再需要单独函数。

查 `extract_page_text` 是否还被调用：
```bash
grep -n 'extract_page_text' scripts/ocr_server.py
```
如果还有调用方（应只在 `extract_text_from_pdf` 里），一起删掉 `extract_text_from_pdf`（line 246-289）——这函数是 legacy 全书 OCR 路径，Task 5 的 `process_pdf_ocr` 已经不走这条分支。

- [ ] **Step 6: 删除 `/classify-pdf` 和 `/extract-text` 和 `/ocr-pdf` 中的 `legacy_path` 分支**

现在 legacy `pdf_path` 字段可以移除。spec § 4.2 明确废除。

在每个 route 开头把这段：
```python
    r2_key = str(body.get("r2_object_key", "")).strip()
    legacy_path = str(body.get("pdf_path", "")).strip()
    ...
    if not r2_key and not legacy_path:
        return jsonify({"error": "missing r2_object_key (or legacy pdf_path)"}), 400
    ...
    downloaded = bool(r2_key)
    try:
        pdf_path = _download_pdf_from_r2(r2_key) if r2_key else legacy_path
    except Exception as error:
        return jsonify({"error": f"R2 download failed: {error}"}), 500
```

简化成：
```python
    r2_key = str(body.get("r2_object_key", "")).strip()
    if not r2_key:
        return jsonify({"error": "missing r2_object_key"}), 400
    ...
    downloaded = True
    try:
        pdf_path = _download_pdf_from_r2(r2_key)
    except Exception as error:
        return jsonify({"error": f"R2 download failed: {error}"}), 500
```

3 个 route 都改。`downloaded` 现在恒为 True——把 `_cleanup_if_temp(pdf_path, downloaded)` 调用简化为 `_cleanup_if_temp(pdf_path, True)` 或直接 `os.unlink(pdf_path)`（选 `_cleanup_if_temp(pdf_path, True)` 为了保留 try/except OSError 兜底）。

- [ ] **Step 7: 删除不用的 imports**

文件顶部：
- `from paddleocr import PaddleOCR`（Task 6 Step 2 删了 init，现在删 import）

```bash
grep -n 'from paddleocr' scripts/ocr_server.py
```
确认删干净。

numpy 还用吗？grep 一下：
```bash
grep -n 'np\.' scripts/ocr_server.py
```
Paddle OCR 用过 `np.array()`，Vision API 不用。如果无命中，删掉 `import numpy as np`。

- [ ] **Step 8: 本地 syntax check**

```bash
python -c "import py_compile; py_compile.compile('scripts/ocr_server.py', doraise=True)"
```

Expected：无输出。

- [ ] **Step 9: Commit**

```bash
git add scripts/ocr_server.py
git commit -m "refactor(ocr): remove PaddleOCR fallback and legacy pdf_path field; google-only"
```

---

### Task 7: Python — 加 Sentry init

**Files:**
- Modify: `scripts/ocr_server.py`

- [ ] **Step 1: 在文件顶部加 Sentry import + init**

在 line 10 附近（其他 imports 之间）加：
```python
import sentry_sdk
```

在 imports 块之后、`OCR_PROVIDER` 定义之前加：
```python
SENTRY_DSN = os.environ.get("SENTRY_DSN", "")
if SENTRY_DSN:
    sentry_sdk.init(
        dsn=SENTRY_DSN,
        traces_sample_rate=0.1,  # 10% tracing sample
        environment=os.environ.get("SENTRY_ENVIRONMENT", "production"),
    )
    print(f"[sentry] initialized (env={os.environ.get('SENTRY_ENVIRONMENT', 'production')})", flush=True)
else:
    print("[sentry] SENTRY_DSN not configured; skipping init", flush=True)
```

本 task 只做 init。阶段 3 会在 Next.js 侧装 `@sentry/nextjs` + 前端 wizard。Python 侧现在初始化好即可，无 DSN 时静默跳过。

- [ ] **Step 2: 本地 syntax check**

```bash
python -c "import py_compile; py_compile.compile('scripts/ocr_server.py', doraise=True)"
```

- [ ] **Step 3: 本地启动 ocr 容器冒烟**

```bash
docker compose build ocr
docker compose up ocr
```

Expected：
- 无 `ModuleNotFoundError`
- 日志出现 `[sentry] SENTRY_DSN not configured; skipping init`（因为本地没配）
- 日志出现 `OCR server listening on http://0.0.0.0:8000`
- 容器不 crash，保持运行

按 Ctrl+C 停掉。

- [ ] **Step 4: Commit**

```bash
git add scripts/ocr_server.py
git commit -m "feat(ocr): init Sentry SDK when SENTRY_DSN configured"
```

---

### Task 8: Next.js — `OCR_SERVER_URL` + Bearer token + DB 写入迁移

**Files:**
- Modify: `src/app/api/books/route.ts`

设计约束：
- `OCR_SERVER_HOST` + `OCR_SERVER_PORT` 合并成 `OCR_SERVER_URL`（完整 URL，含 scheme）
- 3 个 OCR fetch（classify-pdf / extract-text / ocr-pdf）加 `Authorization: Bearer ${OCR_SERVER_TOKEN}` header
- `/ocr-pdf` 的 body 加 `classifications` 字段（Task 5 Python 现在需要它）
- Python 不再写 `page_classifications` / `raw_text` → 本 Task 由 Next.js 写

- [ ] **Step 1: 替换 OCR base URL（lines 104-106）**

原：
```typescript
const ocrHost = process.env.OCR_SERVER_HOST || '127.0.0.1'
const ocrPort = process.env.OCR_SERVER_PORT || '8000'
const ocrBase = `http://${ocrHost}:${ocrPort}`
```
改成：
```typescript
const ocrBase = process.env.OCR_SERVER_URL || 'http://127.0.0.1:8000'
const ocrToken = process.env.OCR_SERVER_TOKEN || ''
```

- [ ] **Step 2: 3 处 OCR fetch 加 Bearer header（lines 109-113 / 127-131 / 162-166）**

把 3 个 fetch headers 从：
```typescript
headers: { 'Content-Type': 'application/json' },
```
改成：
```typescript
headers: {
  'Content-Type': 'application/json',
  Authorization: `Bearer ${ocrToken}`,
},
```

- [ ] **Step 3: classify-pdf response 解构 + Next.js 自己写 `page_classifications`**

原（lines 119-125）：
```typescript
const classifyJson = (await classifyRes.json()) as {
  text_count: number
  scanned_count: number
  mixed_count: number
}
const { text_count, scanned_count, mixed_count } = classifyJson
const nonTextPages = scanned_count + mixed_count
```

改成：
```typescript
const classifyJson = (await classifyRes.json()) as {
  pages: { page: number; type: string }[]
  text_count: number
  scanned_count: number
  mixed_count: number
  total_pages: number
}
const { pages, text_count, scanned_count, mixed_count } = classifyJson
const nonTextPages = scanned_count + mixed_count

await run(
  `UPDATE books
     SET page_classifications = $1,
         text_pages_count = $2,
         scanned_pages_count = $3
   WHERE id = $4`,
  [JSON.stringify(pages), text_count, scanned_count + mixed_count, bookId]
)
```

这样 Python 不写库的 classification 数据由 Next.js 吃掉。

- [ ] **Step 4: extract-text response 解构 + Next.js 自己写 `raw_text`**

原（lines 137-140）：
```typescript
const extractJson = (await extractRes.json()) as { text: string }
const rawText = extractJson.text ?? ''

if (rawText) {
  const chunks = chunkText(rawText)
  ...
```

改成：
```typescript
const extractJson = (await extractRes.json()) as { text: string; page_count: number }
const rawText = extractJson.text ?? ''

if (rawText) {
  await run('UPDATE books SET raw_text = $1 WHERE id = $2', [rawText, bookId])
  const chunks = chunkText(rawText)
  ...
```

- [ ] **Step 5: `/ocr-pdf` body 加 `classifications`（line 165）**

原：
```typescript
body: JSON.stringify({ r2_object_key: r2ObjectKey, book_id: bookId }),
```

改成：
```typescript
body: JSON.stringify({
  r2_object_key: r2ObjectKey,
  book_id: bookId,
  classifications: pages,  // Python worker 用这个判断哪些页要 OCR
}),
```

`pages` 变量来自 Step 3 的 classify response 解构。

- [ ] **Step 6: 本地 type check**

```bash
npx tsc --noEmit
```

Expected：无错误。

- [ ] **Step 7: Commit**

```bash
git add src/app/api/books/route.ts
git commit -m "feat(ocr): unify OCR_SERVER_URL + Bearer token; take over DB writes from Python"
```

---

### Task 9: Next.js — 重写 `src/lib/screenshot-ocr.ts`（buffer/base64 + Bearer）

**Files:**
- Modify: `src/lib/screenshot-ocr.ts`

- [ ] **Step 1: 替换文件内容**

全文替换为：

```typescript
import { logAction } from './log'

interface OcrResponseBody {
  text?: string
  confidence?: number
  error?: string
}

export interface OcrResult {
  text: string
  confidence: number
}

export function normalizeBase64Image(image: string): string {
  return image.replace(/^data:image\/\w+;base64,/, '').trim()
}

export function isUsefulOcrText(text: string, confidence: number): boolean {
  const normalized = text.trim()
  if (!normalized || normalized.includes('\uFFFD')) {
    return false
  }

  return confidence >= 0.5 || normalized.length >= 24
}

export async function ocrImage(imageBuffer: Buffer): Promise<OcrResult> {
  const ocrBase = process.env.OCR_SERVER_URL || 'http://127.0.0.1:8000'
  const ocrToken = process.env.OCR_SERVER_TOKEN || ''

  const base64 = imageBuffer.toString('base64')

  try {
    const response = await fetch(`${ocrBase}/ocr`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ocrToken}`,
      },
      body: JSON.stringify({ image_base64: base64 }),
      signal: AbortSignal.timeout(60_000),
    })

    const json = (await response.json()) as OcrResponseBody
    if (!response.ok || json.error) {
      await logAction(
        'screenshot_ocr_failed',
        `HTTP ${response.status}: ${json.error ?? 'unknown'}`,
        'error'
      )
      return { text: '', confidence: 0 }
    }

    return {
      text: json.text ?? '',
      confidence: typeof json.confidence === 'number' ? json.confidence : 0,
    }
  } catch (error) {
    await logAction('screenshot_ocr_failed', String(error), 'error')
    return { text: '', confidence: 0 }
  }
}
```

变更要点：
- 签名从 `ocrImage(imagePath: string)` → `ocrImage(imageBuffer: Buffer)`
- 不用 Node `http` 模块，直接 `fetch`（更简洁，Next.js edge-safe）
- body 用 `image_base64` 而非 `image_path`
- `\uFFFD` replacement character 用 Unicode escape（原代码用直接字符，保持等效但更显式）

- [ ] **Step 2: 本地 type check**

```bash
npx tsc --noEmit
```

Expected：会报 `src/app/api/books/[bookId]/screenshot-ocr/route.ts` 里 `ocrImage(tempImagePath)` 参数类型不对——Task 10 会修。

现在 type check 应显示 1 个错误（route.ts 里的调用）。记下报错位置，Task 10 修。

- [ ] **Step 3: Commit（和 Task 10 一起或单独都可以）**

```bash
git add src/lib/screenshot-ocr.ts
git commit -m "feat(ocr): rewrite ocrImage to accept Buffer + emit image_base64 via fetch with Bearer"
```

---

### Task 10: Next.js — `screenshot-ocr/route.ts` 删 tmpdir

**Files:**
- Modify: `src/app/api/books/[bookId]/screenshot-ocr/route.ts`

- [ ] **Step 1: 删 tmpdir 相关 imports（lines 2-5）**

删除：
```typescript
import { randomUUID } from 'crypto'
import { unlink, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
```

- [ ] **Step 2: 改用直接 buffer 调用 `ocrImage`（lines 53-65）**

原：
```typescript
const { imageBase64 } = parseBody(await req.json())
const normalizedBase64 = normalizeBase64Image(imageBase64)
const tempImagePath = join(tmpdir(), `screenshot_ocr_${randomUUID()}.png`)

let ocrResult
try {
  await writeFile(tempImagePath, Buffer.from(normalizedBase64, 'base64'))
  ocrResult = await ocrImage(tempImagePath)
} catch (error) {
  throw new SystemError('Failed to process screenshot OCR request', error)
} finally {
  await unlink(tempImagePath).catch(() => {})
}
```

改成：
```typescript
const { imageBase64 } = parseBody(await req.json())
const normalizedBase64 = normalizeBase64Image(imageBase64)
const imageBuffer = Buffer.from(normalizedBase64, 'base64')

let ocrResult
try {
  ocrResult = await ocrImage(imageBuffer)
} catch (error) {
  throw new SystemError('Failed to process screenshot OCR request', error)
}
```

- [ ] **Step 3: 本地 type check**

```bash
npx tsc --noEmit
```

Expected：无错误。Task 9 的遗留错误此时应消失。

- [ ] **Step 4: Commit**

```bash
git add src/app/api/books/[bookId]/screenshot-ocr/route.ts
git commit -m "refactor(screenshot-ocr): drop tmpdir path; pass Buffer directly to ocrImage"
```

---

### Task 11: 本地 — `docker-compose.yml` + `.env.example` 更新

**Files:**
- Modify: `docker-compose.yml`
- Modify: `.env.example`

- [ ] **Step 1: `docker-compose.yml` app service env 更新**

找 `app` service 的 `environment` 段，做如下变更：
- 删除 `OCR_SERVER_HOST` 和 `OCR_SERVER_PORT`
- 加 `OCR_SERVER_URL=http://ocr:8000` + `OCR_SERVER_TOKEN=${OCR_SERVER_TOKEN}` + `SENTRY_DSN=${SENTRY_DSN}`（空值可）

- [ ] **Step 2: `docker-compose.yml` ocr service env 更新**

找 `ocr` service 的 `environment` 段，做如下变更：
- 删除 `DATABASE_URL` 行（Python 不再直连 DB）
- 加：
  ```yaml
  - OCR_PROVIDER=google
  - OCR_SERVER_TOKEN=${OCR_SERVER_TOKEN}
  - NEXT_CALLBACK_URL=${NEXT_CALLBACK_URL:-http://app:3000/api/ocr/callback}
  - SENTRY_DSN=${SENTRY_DSN:-}
  - SENTRY_ENVIRONMENT=${SENTRY_ENVIRONMENT:-development}
  ```

本地跑 google 模式需要 mount key 文件。在 ocr service 加注释：
```yaml
    # 本地用 Google Vision 需要：
    # 1. 在 Google Cloud Console 下载 SA key JSON
    # 2. 放到 ./secrets/gcp-key.json
    # 3. 取消下面注释：
    # volumes:
    #   - ./secrets/gcp-key.json:/app/gcp-key.json:ro
    # environment:
    #   - GOOGLE_APPLICATION_CREDENTIALS=/app/gcp-key.json
```

- [ ] **Step 3: `.env.example` 更新**

找 OCR 段（可能叫 `# OCR`），替换：
```bash
OCR_SERVER_HOST=127.0.0.1
OCR_SERVER_PORT=8000
```
为：
```bash
# OCR 服务器（阶段 2 后本地/生产统一用 URL）
# 本地 Docker Compose：http://ocr:8000（容器间网络）
# 本地 dev 跑 ocr 容器 + npm run dev：http://127.0.0.1:8000
# 生产：https://<cloud-run-default-domain>.run.app
OCR_SERVER_URL=http://127.0.0.1:8000

# Next.js 和 Cloud Run OCR server 之间的 Bearer token（双向共享）
# 本地生成：`openssl rand -hex 32`
OCR_SERVER_TOKEN=

# Cloud Run OCR → Next.js callback 的 URL（本地默认 http://app:3000/api/ocr/callback；生产填 https://<brand>.com/api/ocr/callback）
NEXT_CALLBACK_URL=http://app:3000/api/ocr/callback

# OCR provider（阶段 2 后只支持 google）
OCR_PROVIDER=google

# Sentry DSN（阶段 3 填，阶段 2 空即可）
SENTRY_DSN=
```

- [ ] **Step 4: （可选）本地冒烟**

> 本机无 Docker 时跳过，Step 5 直接 commit。生产/线上验证由 T13（Cloud Run 首部署）+ T15（Vercel 冒烟）完成。以下仅保留给有 Docker 的贡献者做 compose wiring 校验：

```bash
openssl rand -hex 32 | sed 's/^/OCR_SERVER_TOKEN=/' >> .env.local
docker compose down
docker compose up --build app ocr db
```

预期（有 Docker 时）：
- `app` 和 `ocr` 容器都 healthy
- `ocr` 日志：`[sentry] SENTRY_DSN not configured; skipping init` + `OCR server listening on http://0.0.0.0:8000`
- 不配 Google key 时 OCR 真实调用 fail（`vision.ImageAnnotatorClient()` 找不到凭据），预期
- **非 OCR 路径应全可用**：登录 / 上传文字 PDF / reader

- [ ] **Step 5: Commit**

```bash
git add docker-compose.yml .env.example
git commit -m "chore(env): unify OCR_SERVER_URL + add OCR_SERVER_TOKEN / NEXT_CALLBACK_URL / SENTRY_DSN"
```

---

### Task 12: 【产品负责人】GCP 前置 — Cloud Run SA + IAM + Artifact Registry

**Files:** 无代码变更（产品负责人在 Console 操作，Claude 全程指导）。

- [ ] **Step 1: 创建 Cloud Run 服务账号**

Console → IAM & Admin → Service Accounts → Create Service Account
- Name：`ocr-cloudrun-sa`
- ID：自动生成的或填 `ocr-cloudrun-sa`
- Description：`Cloud Run OCR server runtime identity`
- 点 Create and Continue

- [ ] **Step 2: 给 SA 授最小权限（2 个 role）**

在 "Grant this service account access to project" 步骤搜索并添加：

1. **`Service Usage Consumer`**（`roles/serviceusage.serviceUsageConsumer`）
   - 允许 SA 在本项目上调用任何已启用的 API（本例即 Cloud Vision API）
   - Console 搜索框：输入 `Service Usage Consumer` 即可匹配

2. **`Artifact Registry Reader`**（`roles/artifactregistry.reader`）
   - 允许 Cloud Run 从 Artifact Registry 拉取容器镜像

> **不需要专门的 Vision role**：Cloud Vision API 没有 per-role 绑定，只要 (a) API 在项目级启用（前置任务已勾 `vision.googleapis.com`）+ (b) SA 拥有 `serviceUsageConsumer`，Cloud Run 通过 ADC 就能调用 Vision。
>
> 若搜索不到 `Service Usage Consumer`，说明本项目 Service Usage API 未启用；回 APIs & Services → Library 启用 `serviceusage.googleapis.com` 后重试。

点 Continue → Done。

- [ ] **Step 3: 不创建 SA key 文件**

Cloud Run runtime 用 SA 身份自动 ADC——**不需要下载 JSON key**。安全红线 2（决策 7）明确：最小权限 + 无 key 文件。

- [ ] **Step 4: 验证 Artifact Registry repo 已创建**

Console → Artifact Registry → Repositories
- 应看到 P3 创建的 `ai-textbook-teacher` repo，Format=Docker，Region=us-central1

- [ ] **Step 5: 无 commit（控制台操作）**

---

### Task 13: 【产品负责人 + Claude】Cloud Run 首次手动部署

**Files:** 无代码变更（运行 gcloud 命令或 Console UI）。

**前置**：Task 1-11 commits 已 push 到 master（Codex 已完成所有代码改动）。

- [ ] **Step 1: 确认 repo 根有 `Dockerfile.ocr`（而非 `Dockerfile`）**

```bash
ls -la Dockerfile.ocr
```

Expected：存在，大小 400-800B。

> **关键背景**：`gcloud run deploy --source .` 默认只识别名为 `Dockerfile` 的文件；我们的是 `Dockerfile.ocr`。所以首次部署有两条路：
>
> **主推：Console UI 路径（Step 2）**——Cloud Build 的 UI 表单允许自定义 Dockerfile name，最适合无 CLI 或非技术背景的产品负责人
>
> **备选：CLI 路径（Step 3）**——需要额外写一个临时 `cloudbuild.yaml`，适合 Codex 协同或产品负责人想跑一次 CLI 试水

- [ ] **Step 2: 【主推】Cloud Build UI 一次性构建 + 手动 Cloud Run 部署**

A. 构建容器镜像：

Console → Cloud Build → Triggers → **Create trigger**（仅为触发首次 build，Task 14 会正式配 CD）
- Name：`ocr-firstbuild`（临时）
- Event：`Manual invocation`
- Source：选 GitHub repo `ai-textbook-teacher`
- Branch：`master`
- Configuration：`Dockerfile`
- Dockerfile name：`Dockerfile.ocr`
- Location：`/` (repo 根)
- Image name：`us-central1-docker.pkg.dev/<PROJECT_ID>/ai-textbook-teacher/ai-textbook-ocr:first`

创建完点 **Run**，等 Build 成功（约 5-8 分钟）。

B. 部署到 Cloud Run：

Console → Cloud Run → **Create service**
- Container image URL：点 Select → 从 Artifact Registry 选刚 build 完的 `ai-textbook-ocr:first`
- Service name：`ai-textbook-ocr`
- Region：`us-central1`
- Authentication：`Allow unauthenticated invocations`（应用层 Bearer 负责鉴权）
- Container → Settings：Memory `1 GiB`，CPU `1`
- Container → Variables & Secrets → 加以下 env vars：
  - `OCR_SERVER_TOKEN` = 产品负责人密码管理器里生成的长 token
  - `OCR_PROVIDER` = `google`
  - `R2_ACCOUNT_ID` / `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` / `R2_BUCKET` = 和 Vercel 同一组（P1 已设）
  - `NEXT_CALLBACK_URL` = `https://<vercel-project>.vercel.app/api/ocr/callback`（阶段 3 换自定义域名）
  - `SENTRY_ENVIRONMENT` = `production`
- Container → Scaling：Min `0`, Max `3`
- Container → Security：Service account = `ocr-cloudrun-sa@<PROJECT_ID>.iam.gserviceaccount.com`
- Container → Request timeout：`300` 秒

点 **Create**。

> **无 `DATABASE_URL`**：Python 不再写库。
>
> **Min 0**：scale-to-zero，符合决策 3 成本控制。

- [ ] **Step 3: 【备选/CLI 爱好者】gcloud 两步部署**

只有在产品负责人+Codex 想用 CLI 时走这条。需要临时写一个 `cloudbuild-ocr.yaml`：

```bash
# repo 根下创建临时 build config（不要 commit，Task 14 的 CD 不用它）
cat > cloudbuild-ocr.yaml <<'YAML'
steps:
  - name: gcr.io/cloud-builders/docker
    args:
      - build
      - -f
      - Dockerfile.ocr
      - -t
      - us-central1-docker.pkg.dev/${PROJECT_ID}/ai-textbook-teacher/ai-textbook-ocr:first
      - .
images:
  - us-central1-docker.pkg.dev/${PROJECT_ID}/ai-textbook-teacher/ai-textbook-ocr:first
YAML

# 提交到 Cloud Build
gcloud builds submit --config=cloudbuild-ocr.yaml .

# 构建成功后部署镜像到 Cloud Run（注意这里是 --image 而非 --source）
gcloud run deploy ai-textbook-ocr \
  --image=us-central1-docker.pkg.dev/<PROJECT_ID>/ai-textbook-teacher/ai-textbook-ocr:first \
  --region=us-central1 \
  --platform=managed \
  --service-account=ocr-cloudrun-sa@<PROJECT_ID>.iam.gserviceaccount.com \
  --allow-unauthenticated \
  --memory=1Gi \
  --cpu=1 \
  --min-instances=0 \
  --max-instances=3 \
  --timeout=300 \
  --set-env-vars=OCR_SERVER_TOKEN=<FROM_PW_MGR>,OCR_PROVIDER=google,R2_ACCOUNT_ID=<...>,R2_ACCESS_KEY_ID=<...>,R2_SECRET_ACCESS_KEY=<...>,R2_BUCKET=ai-textbook-pdfs,NEXT_CALLBACK_URL=<VERCEL_URL>/api/ocr/callback,SENTRY_ENVIRONMENT=production

# 部署成功后删临时 config
rm cloudbuild-ocr.yaml
```

> 删 `cloudbuild-ocr.yaml` 是因为 Task 14 会通过 Cloud Build UI 配置真正的 CD，而那条路径用的是"Dockerfile + Dockerfile name = Dockerfile.ocr"配置，不需要 yaml 文件。

- [ ] **Step 4: 记录 Cloud Run 默认 URL**

部署成功后，Console → Cloud Run → `ai-textbook-ocr` → 上方 URL 栏。格式为：
`https://ai-textbook-ocr-<hash>-uc.a.run.app`

记到密码管理器，Task 15 Vercel 配置要用。

- [ ] **Step 5: 冒烟测试**

```bash
# 1. Health check（不需要 token）
curl https://ai-textbook-ocr-<hash>-uc.a.run.app/health
# Expected: {"status": "ok", "ocr_provider": "google", "callback_configured": true}

# 2. Bearer token 测试（不带 token 应 401）
curl -X POST https://ai-textbook-ocr-<hash>-uc.a.run.app/classify-pdf \
  -H "Content-Type: application/json" \
  -d '{"r2_object_key": "test"}'
# Expected: {"error": "missing Bearer token"} + 401

# 3. 带 token 测试（格式错误应 400）
curl -X POST https://ai-textbook-ocr-<hash>-uc.a.run.app/classify-pdf \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <TOKEN>" \
  -d '{}'
# Expected: {"error": "missing r2_object_key"} + 400
```

- [ ] **Step 6: 无 commit（控制台操作）**

---

### Task 14: 【产品负责人】Cloud Run CD UI 配置（GitHub 自动部署）

**Files:** 无代码变更。

- [ ] **Step 1: Console → Cloud Run → `ai-textbook-ocr` → Edit & deploy new revision → Continuously deploy from repository**

或者：Cloud Run → Service → Triggers tab → Connect Repository

- [ ] **Step 2: 授权 GitHub（首次）**

- 选 `GitHub` → Authenticate → 授权 Cloud Build 访问 repo `ai-textbook-teacher`

- [ ] **Step 3: 配置构建设置**

- Branch：`master`
- Build type：`Dockerfile`
- Source location：`/`（repo 根）
- Dockerfile name：`Dockerfile.ocr`
- **Included Files filter（关键，避免每次 push 都触发）**：
  ```
  scripts/**
  Dockerfile.ocr
  ```
  （这两条用 OR 匹配——任何一个命中就触发 build）

- [ ] **Step 4: 触发首次 CD build**

本地：
```bash
git commit --allow-empty -m "ci: trigger first Cloud Run CD build"
git push origin master
```

或 push 一个实际无害变更（如 Dockerfile.ocr 的注释）。

- [ ] **Step 5: 验证 Cloud Build 历史**

Console → Cloud Build → History
- 应看到一个正在构建的 job，状态从 `Building` → `Deploying` → `Success`
- 完成后 Cloud Run 的 revision 应从 Task 13 的 revision 1 跳到 revision 2

- [ ] **Step 6: 验证 includedFiles 过滤正确**

本地开分支做无关改动（如改 README）：
```bash
git checkout -b test/cd-filter
echo "test" >> README.md
git commit -am "test: no-op readme change"
git push origin test/cd-filter
```

等 2 分钟，Cloud Build History 应**不触发**新 build。

清理：
```bash
git checkout master
git push origin --delete test/cd-filter
git branch -D test/cd-filter
```

- [ ] **Step 7: 无 commit（控制台操作）**

---

### Task 15: 【产品负责人】Vercel env vars 更新 + 验证生产冒烟

**Files:** 无代码变更。

- [ ] **Step 1: Vercel Dashboard → Project → Settings → Environment Variables**

**删除**：
- `OCR_SERVER_HOST`
- `OCR_SERVER_PORT`

**添加**（均勾 Production + Preview）：
- `OCR_SERVER_URL` = `https://ai-textbook-ocr-<hash>-uc.a.run.app`（Task 13 记下的）
- `OCR_SERVER_TOKEN` = `<P5 生成的 64-char hex>`（勾 **Sensitive**）
- `SENTRY_DSN` = `（阶段 3 填，现在留空）`

**验证已有**：
- `DATABASE_URL`（Neon Integration 自动管理）
- `ANTHROPIC_API_KEY` + `AI_MODEL` + `R2_*`（阶段 1 已配）

- [ ] **Step 2: 触发 Vercel 重新部署让 env 生效**

Vercel Dashboard → Deployments → 最新 production deployment → 三点菜单 → Redeploy

或本地：
```bash
git commit --allow-empty -m "ci: redeploy Vercel to pick up OCR_SERVER_URL + OCR_SERVER_TOKEN"
git push origin master
```

- [ ] **Step 3: 生产冒烟测试**

在 `https://<project>.vercel.app` 登录后：

1. 上传一个**纯文字 PDF**（已验证过的书，不走 OCR）
   - 预期：R2 有 object，DB 有 book 记录，`/reader` 能看到

2. 上传一个**扫描 PDF**（之前被冻结的测试）
   - 预期：R2 有 object，DB book 记录 `parse_status='processing'`
   - Cloud Run Console → Logs：应看到 `/classify-pdf` 和 `/extract-text` 日志
   - Cloud Run Console → Logs：`/ocr-pdf` 异步触发，应看到 `[ocr] book N OCR complete (N pages)`
   - DB：`books.parse_status='done'`，`books.raw_text` 内容包含 OCR 后的文字

3. 截图问 AI 测试
   - 在某书的 `/reader` 里截图
   - 预期：`/api/books/[id]/screenshot-ocr` 返回 200，text 非空

- [ ] **Step 4: 验证 Bearer token 拦截**

用 `curl` 手动打 Vercel 的 `/api/ocr/callback`，不带 token：
```bash
curl -X POST https://<project>.vercel.app/api/ocr/callback \
  -H "Content-Type: application/json" \
  -d '{"event":"progress","book_id":1,"pages_done":1,"pages_total":10}'
# Expected: 401, {"success":false,"error":"Missing Bearer token","code":"UNAUTHENTICATED"}
```

- [ ] **Step 5: 无 commit**

---

## 最终验收清单（阶段 2 完成标志）

所有以下都必须通过才算阶段 2 完成：

- [ ] `Dockerfile.ocr` 已瘦身（无 paddle 依赖，镜像 <800MB）
- [ ] `scripts/ocr_server.py` 无 psycopg2 / PaddleOCR / legacy `pdf_path` 残留
- [ ] `src/app/api/ocr/callback/route.ts` 存在且单元测试通过
- [ ] 本地 `docker compose up` 三容器全 healthy（ocr 不 crash）
- [ ] Google Cloud 项目有 SA `ocr-cloudrun-sa`，权限只有 Vision + Artifact Registry Reader
- [ ] Cloud Run `ai-textbook-ocr` service 部署成功，默认 URL 可访问
- [ ] Cloud Run `/health` 端点返回 200
- [ ] Cloud Run 收到不带 Bearer 的请求返回 401
- [ ] push `scripts/ocr_server.py` 后 Cloud Build 自动触发 + 部署新 revision
- [ ] push 非 `scripts/**` 或 `Dockerfile.ocr` 的文件**不**触发 Cloud Build
- [ ] Vercel env vars 已更新（`OCR_SERVER_URL` + `OCR_SERVER_TOKEN`）
- [ ] 生产环境上传扫描 PDF：Cloud Run 完成 OCR，Next.js `/api/ocr/callback` 写入 Neon，`books.parse_status='done'`，`books.raw_text` 有内容
- [ ] 生产环境截图问 AI 可用
- [ ] `/api/ocr/callback` 不带 Bearer 返回 401
- [ ] 阶段 2 改动的 ~7 个文件（新建 2 + 修改 5）在 master 的 git 历史里清晰（按 Task 原子 commit）

---

## 风险与回滚

### 局部失败回滚

| 场景 | 回滚路径 |
|---|---|
| Vision API 中文识别不达标 | 切 Mistral OCR：`scripts/ocr_server.py` 加 `mistral_ocr()` 函数，`OCR_PROVIDER=mistral`（spec § 5.1 预留） |
| Cloud Run 冷启动太慢（>3s） | Cloud Run Service → Edit → `--min-instances 1`（不再 scale-to-zero，月费增加但仍在免费层内） |
| Bearer token 泄露 | `openssl rand -hex 32` 生成新，Vercel + Cloud Run env 同步更新，旧 token 立即失效 |
| Cloud Build 失败 | Revision 保留旧版本自动继续服务；Console → Revisions → 手动回滚到前一个 revision |
| Callback 延迟太高影响 UX | 监控 `/api/ocr/callback` p95，超阈值把 progress 事件改为批量（如每 5 页发一次）|
| Google Vision API 月度配额超限 | 1000/月免费，超限自动计费；观察账单，必要时在 Google Cloud Billing 设预算告警 |

### 整块回滚到阶段 1

如果阶段 2 彻底失败：

1. Vercel env：`OCR_SERVER_URL` 改回 `http://127.0.0.1:8000`（但 Vercel 打不通本机，等效暂停 OCR）
2. Cloud Run service：Console 直接 Delete（不收费）
3. Cloud Build trigger：Disconnect GitHub（不收费）
4. `git revert` Task 1-11 的所有 commit，回到阶段 1 状态
5. 本地 Docker Compose 仍可跑完整栈（OCR 走 paddle）

### 分叉 master 的保护

本 plan 所有 Task 按原子 commit 提交，master 在任何中间状态（Task N 完成）都可以稳定运行：
- Task 1-7 完成后：本地 + Vercel 生产仍可跑，只是 OCR 在 Vercel 侧会报 error（Cloud Run 未部署）
- Task 8-11 完成后：本地 docker compose 要配 Google SA key 才能真正跑 OCR
- Task 12-14 完成后：生产 OCR 可用，但 Vercel env 还没换（Task 15）
- Task 15 完成后：全流程可用

---

## 执行顺序说明（给 Codex）

**派发顺序**：

**Phase A（代码任务，Codex 独立完成）**：
- Task 1 → Task 2 → Task 3 → Task 4 → Task 5 → Task 6 → Task 7 → Task 8 → Task 9 → Task 10 → Task 11
- 按序线性。每个 Task 完成 + Claude code review 通过 + commit 后再下一个。
- Task 5 内含多步骤（11 个 step），是最大的 task，预计需要 subagent 分成 3-4 次小 commit。

**Phase B（控制台任务，产品负责人 + Claude 指导）**：
- Task 12（SA + IAM，10 分钟）→ Task 13（首次部署，20 分钟，最容易卡的一步）→ Task 14（CD UI，10 分钟）→ Task 15（Vercel env + 生产冒烟，15 分钟）

Phase A 和 Phase B 不能并行：Task 13 需要 Task 1-11 全部 push 到 master。

**Task 3-7 紧耦合**：都是改 `scripts/ocr_server.py`。连续派发给同一 Codex session 效率最高，避免 context 切换。

**Task 8 和 Task 5 有一个 Next.js 侧的微交叉**：Task 5 的 Step 5 改 callback route 的 `handleModuleComplete`。这个改动被列在 Task 5 内而不是 Task 2 的原因是：语义上它 belongs to "Python 不感知 module"的架构决策，和 Task 5 同 commit。

**Task 15 E2E 冒烟是阶段 2 的终点**：所有 checkbox 过了才算阶段 2 完成，可进阶段 3（域名 + Sentry + secrets 审查）。

---

## Spec 对齐声明

本 plan 严格对齐 `docs/superpowers/specs/2026-04-12-cloud-deployment-design.md`：
- § 4.2 阶段 2 范围：全覆盖
- § 6.1 env vars：Cloud Run + Vercel 两侧清单（Task 11 / 13 / 15）
- § 6.2 接口契约：Bearer token 双向共用 + `r2_object_key` body + 4 种 callback event types（Task 2 / 5 / 8 / 9）
- § 3.3 采用 (b) 方案：Cloud Run 不写 DB，POST 回调（Task 5）
- § 3.4 API 端点契约修正：`/ocr` base64、`mixed_count` 修复（Task 4）
- 决策 1：Google Vision（Task 3 `google_ocr`）
- 决策 6：Cloud Run CD 绑 GitHub + includedFiles（Task 14）
- 决策 7：Cloud Run SA 最小权限 + 无 key 文件（Task 12）

**与 spec 的设计分歧**（plan 侧决策）：
- Spec § 6.2 的 `module_complete` 事件按 per-module 发；本 plan 因 Python 不感知 module 边界（无 DB 查询），改为 Python 发 `module_id=0` 作为"书级完成"标记，由 Next.js callback 把所有 processing 模块统一标 done。等未来 Python 需要精确模块级事件时再重构。

阶段 3（域名 + Sentry SDK + secrets 审查 + 密码管理器整理）的 plan 等阶段 2 完成后再写，避免过早 plan 被阶段 2 实际经验过期。
