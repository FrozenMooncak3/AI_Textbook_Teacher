---
date: 2026-04-15
topic: 云部署阶段1数据层上云
type: plan
status: in_progress
keywords: [cloud, deployment, database, Supabase, phase-1]
---

# 云部署 · 阶段 1 实施计划（数据层上云）

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **执行方**：Codex（代码任务）+ 产品负责人（控制台任务）。Claude PM 派发 + 审核。

**Goal**：把 PDF 文件存储从本地磁盘迁到 Cloudflare R2，把 Next.js 部署到 Vercel，把 Postgres 切到 Neon 托管（均通过 Vercel Integration），本地 Docker Python OCR 仍运行，但改为从 R2 下载 PDF 跑 OCR，用 R2 object key 串起整条链路。

**Architecture**：阶段 1 只动"数据层"——文件存储 + DB 托管 + Next.js 平台化。OCR 计算仍在本地 Docker 跑（阶段 2 上 Cloud Run）。Python OCR server 的 3 个 PDF 端点从接受 `pdf_path`（本地绝对路径）改为 `r2_object_key`（R2 内对象路径），内部用 `boto3` 预签名 URL 下载到临时文件后跑现有 OCR 逻辑。截图 OCR (`/ocr`) 端点本阶段不动（仍走本地 tmpdir，阶段 2 改 base64 inline）。

**Tech Stack**：
- Next.js 15（已有）+ Vercel Hobby
- `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner`（新增 npm 依赖，S3 标准 API 对 R2）
- `boto3`（新增 Python 依赖，Python 侧 R2 下载）
- Neon Postgres（Vercel Integration，零手工 DSN）
- Docker Compose（本地 OCR server 仍沿用）

**关联 spec**：`docs/superpowers/specs/2026-04-12-cloud-deployment-design.md` § 4.1

---

## 阶段 1 不做的事（YAGNI）

阶段 1 **不碰**以下内容（留给阶段 2/3）：
- Cloud Run 部署 + Python OCR 上云（阶段 2）
- OCR provider 从 PaddleOCR 切到 Google Vision（阶段 2）
- Cloud Run Bearer token 鉴权（阶段 2）
- Python OCR server 的 4 个直写 Neon 函数（阶段 2 删除并迁到 Next.js callback）
- 截图 OCR (`/ocr`) base64 改造（阶段 2）
- `/api/ocr/callback` 新端点（阶段 2）
- 自定义域名 + Sentry + Vercel Analytics（阶段 3）

**代码中能看出"半成品"的地方**：Python OCR server 的 `/ocr` 截图端点仍保留本地 `image_path` 签名——这是预期的，因为截图流不依赖 R2（buffer → tmpdir → 本地 Docker，仍全本地）。

---

## 前置条件（产品负责人在 Codex 开工前完成）

以下步骤由产品负责人在各云服务控制台点击完成。Claude 会在用户遇到卡点时实时指导。

### P1. Cloudflare R2 bucket + API token

- [ ] 登 Cloudflare Dashboard（dash.cloudflare.com）
- [ ] 左侧栏 → R2 Object Storage → 如果是首次使用，绑支付卡（有永久免费层 10GB + 10M A 类 + 1M B 类 req/月）
- [ ] Create Bucket：名称 `ai-textbook-pdfs`，位置 `Automatic`
- [ ] R2 → Manage API Tokens → Create API Token：
  - Permissions: **Object Read & Write**（不要 Admin）
  - Specify bucket：只勾 `ai-textbook-pdfs`（决策 7 安全红线 3）
  - TTL：`Forever`（或设 90 天后自动轮换，看偏好）
- [ ] 记录 4 个值到密码管理器：
  - `Account ID`（R2 首页右侧栏）
  - `Access Key ID`（token 生成时显示）
  - `Secret Access Key`（token 生成时显示，只此一次可见）
  - `Bucket Name`：`ai-textbook-pdfs`

### P2. Vercel 账户 + 项目 + GitHub 连接

- [ ] 登 vercel.com（用 GitHub 账户 SSO 即可）
- [ ] New Project → Import Git Repository → 选 `ai-textbook-teacher` 仓库
- [ ] Framework Preset：自动识别为 Next.js
- [ ] Root Directory：保持默认（仓库根）
- [ ] Environment Variables：此时先不填，等阶段 1 Task 10 时统一配置
- [ ] 点 Deploy —— **预计首次部署会失败**（DB 连接报错），这是预期，等 P3/P4 做完才能成功

### P3. Neon Postgres（走 Vercel Integration，不手工 DSN）

- [ ] Vercel 项目 → Integrations → Marketplace → 搜 "Neon" → Install
- [ ] 一键创建新 Neon 项目：名字 `ai-textbook-teacher`，区域选 `AWS us-east-1 (N. Virginia)`（与 Vercel Hobby 默认 `iad1` 同区域，延迟最低）
- [ ] 授权后 Neon 会自动向 Vercel 项目注入 `DATABASE_URL`（生产）+ Preview 自动 DB branch 能力
- [ ] 首次 push 后 Neon dashboard 能看到 `main` branch（生产）+ 未来 PR 的 branch

### P4. Schema 初始化

- [ ] 本地跑 `scripts/init-neon-schema.ts`（Task 9 会建这个）把 `src/lib/schema.sql` 推到 Neon 生产 branch
- [ ] 或者：产品负责人用 Neon Console 的 SQL Editor 手动贴 `schema.sql` 内容执行

**P1-P4 完成前，Codex 任务 Task 10（Vercel env 配置 + 首次部署）会卡住，其他 code 任务不受影响。**

---

## 变更文件清单

**新建**：
- `src/lib/r2-client.ts` — R2 S3 SDK helper（PUT / presigned GET / delete），约 80 行
- `src/lib/r2-client.test.ts` — 单元测试（mocked S3 client）
- `scripts/init-neon-schema.ts` — 一次性跑的 schema 推送脚本，~20 行

**修改**：
- `package.json` — 加 2 个 npm 依赖
- `src/app/api/books/route.ts` — 上传写本地 → 写 R2；OCR fetch 改传 `r2_object_key`
- `src/app/api/books/[bookId]/pdf/route.ts` — 从本地读 → 302 redirect 到 R2 预签名 URL
- `scripts/ocr_server.py` — 3 个 PDF 端点接受 `r2_object_key`（用 boto3 下载到 tmpdir）
- `Dockerfile.ocr` — `pip install` 追加 `boto3`
- `docker-compose.yml` — `ocr` service 接收 R2 env vars
- `.env.example` — 新增 R2_* 配置行

**不改（阶段 2/3 处理）**：
- `src/app/api/books/[bookId]/screenshot-ocr/route.ts`
- `src/lib/screenshot-ocr.ts`
- `scripts/ocr_server.py` 的 `/ocr`（截图）端点、PaddleOCR fallback、4 个直写 Neon 函数
- `src/lib/auth.ts`（阶段 1 只验证环境变量名一致性，不改代码）

---

## 任务清单

### Task 1: 加 R2 SDK 依赖到 package.json

**Files:**
- Modify: `package.json`

- [ ] **Step 1: 加依赖**

```bash
npm install @aws-sdk/client-s3@^3 @aws-sdk/s3-request-presigner@^3
```

预期 `package.json` dependencies 新增：
```json
"@aws-sdk/client-s3": "^3.x.x",
"@aws-sdk/s3-request-presigner": "^3.x.x"
```

- [ ] **Step 2: 验证安装成功**

Run：`npm ls @aws-sdk/client-s3 @aws-sdk/s3-request-presigner`
Expected：列出两个包及版本号，无 `UNMET DEPENDENCY` 警告。

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore(deps): add @aws-sdk/client-s3 + s3-request-presigner for R2 integration"
```

---

### Task 2: 建 `src/lib/r2-client.ts` + 单元测试

**Files:**
- Create: `src/lib/r2-client.ts`
- Create: `src/lib/r2-client.test.ts`

设计约束：
- 不在模块顶层 `new S3Client()` —— 用懒初始化函数 `getR2Client()`，便于测试时替换
- 三个公开 API：`uploadPdf(bookId, buffer)`、`getSignedPdfUrl(objectKey, expirySeconds)`、`deletePdf(objectKey)`
- R2 object key 格式：`books/{bookId}/original.pdf`（spec § 6.3 约定）
- 配置读环境变量（R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY / R2_BUCKET），endpoint 用 `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
- 所有函数抛错向上传播（`handleRoute` 会捕获），不吞错不 fallback

- [ ] **Step 1: 写 failing test（`src/lib/r2-client.test.ts`）**

```typescript
import assert from 'node:assert/strict'
import test from 'node:test'

// 使用 dynamic import + env 注入测试依赖
async function loadR2ClientWithEnv(env: Record<string, string>) {
  const backup: Record<string, string | undefined> = {}
  for (const k of Object.keys(env)) {
    backup[k] = process.env[k]
    process.env[k] = env[k]
  }
  // 清掉模块缓存让懒初始化重跑
  const mod = await import(new URL('./r2-client.ts', import.meta.url).href)
  return { mod, restore: () => { for (const k of Object.keys(env)) { if (backup[k] === undefined) delete process.env[k]; else process.env[k] = backup[k] } } }
}

test('buildObjectKey returns books/<bookId>/original.pdf', async () => {
  const { mod, restore } = await loadR2ClientWithEnv({
    R2_ACCOUNT_ID: 'acct',
    R2_ACCESS_KEY_ID: 'k',
    R2_SECRET_ACCESS_KEY: 's',
    R2_BUCKET: 'b',
  })
  try {
    const key = (mod as { buildObjectKey: (id: number) => string }).buildObjectKey(42)
    assert.equal(key, 'books/42/original.pdf')
  } finally {
    restore()
  }
})

test('getSignedPdfUrl returns an https URL containing X-Amz-Signature', async () => {
  const { mod, restore } = await loadR2ClientWithEnv({
    R2_ACCOUNT_ID: 'acct',
    R2_ACCESS_KEY_ID: 'AKIA_TEST',
    R2_SECRET_ACCESS_KEY: 'secret',
    R2_BUCKET: 'test-bucket',
  })
  try {
    const url = await (mod as { getSignedPdfUrl: (k: string, s?: number) => Promise<string> })
      .getSignedPdfUrl('books/1/original.pdf', 300)
    assert.ok(url.startsWith('https://acct.r2.cloudflarestorage.com/test-bucket/books/1/original.pdf?'))
    assert.match(url, /X-Amz-Signature=/)
    assert.match(url, /X-Amz-Expires=300/)
  } finally {
    restore()
  }
})
```

- [ ] **Step 2: 跑 test，确认失败**

Run：`node --test --experimental-strip-types src/lib/r2-client.test.ts`
Expected：FAIL（`Cannot find module './r2-client.ts'` 或 `buildObjectKey is not a function`）。

- [ ] **Step 3: 写 `src/lib/r2-client.ts`**

```typescript
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

let cachedClient: S3Client | null = null

function readConfig(): {
  accountId: string
  accessKeyId: string
  secretAccessKey: string
  bucket: string
} {
  const accountId = process.env.R2_ACCOUNT_ID
  const accessKeyId = process.env.R2_ACCESS_KEY_ID
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY
  const bucket = process.env.R2_BUCKET
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
    throw new Error('R2 env vars missing: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET all required')
  }
  return { accountId, accessKeyId, secretAccessKey, bucket }
}

function getR2Client(): S3Client {
  if (cachedClient) return cachedClient
  const { accountId, accessKeyId, secretAccessKey } = readConfig()
  cachedClient = new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  })
  return cachedClient
}

export function buildObjectKey(bookId: number): string {
  if (!Number.isInteger(bookId) || bookId <= 0) {
    throw new Error(`Invalid bookId for R2 object key: ${bookId}`)
  }
  return `books/${bookId}/original.pdf`
}

export async function uploadPdf(bookId: number, buffer: Buffer): Promise<string> {
  const { bucket } = readConfig()
  const key = buildObjectKey(bookId)
  await getR2Client().send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: buffer,
    ContentType: 'application/pdf',
  }))
  return key
}

export async function getSignedPdfUrl(objectKey: string, expirySeconds = 3600): Promise<string> {
  const { bucket } = readConfig()
  return getSignedUrl(
    getR2Client(),
    new GetObjectCommand({ Bucket: bucket, Key: objectKey }),
    { expiresIn: expirySeconds }
  )
}

export async function deletePdf(objectKey: string): Promise<void> {
  const { bucket } = readConfig()
  await getR2Client().send(new DeleteObjectCommand({ Bucket: bucket, Key: objectKey }))
}
```

- [ ] **Step 4: 跑 test，确认通过**

Run：`node --test --experimental-strip-types src/lib/r2-client.test.ts`
Expected：PASS（2 passing）。

- [ ] **Step 5: Commit**

```bash
git add src/lib/r2-client.ts src/lib/r2-client.test.ts
git commit -m "feat(r2): add R2 S3 client helper with upload/presigned-url/delete"
```

---

### Task 3: 重构 POST `/api/books` 上传到 R2

**Files:**
- Modify: `src/app/api/books/route.ts:12` (删 `UPLOADS_DIR` 常量)
- Modify: `src/app/api/books/route.ts:2` (删 `writeFile, mkdir`、加 R2 client 导入)
- Modify: `src/app/api/books/route.ts:90-92` (本地落盘 → `uploadPdf`)
- 暂不改 `116/134/169` 处的 `pdf_path`——Task 6 一起改

- [ ] **Step 1: 修改 imports（line 2-3）**

把：
```typescript
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
```
改成：
```typescript
import { buildObjectKey, uploadPdf } from '@/lib/r2-client'
```

- [ ] **Step 2: 删除 `UPLOADS_DIR` 常量（line 12）**

删掉整行 `const UPLOADS_DIR = join(process.cwd(), 'data', 'uploads')`。

- [ ] **Step 3: 替换 mkdir + writeFile（lines 90-92）**

原代码：
```typescript
await mkdir(UPLOADS_DIR, { recursive: true })
const pdfPath = join(UPLOADS_DIR, `${bookId}.pdf`)
await writeFile(pdfPath, buffer)
```
改成：
```typescript
const r2ObjectKey = buildObjectKey(bookId)
await uploadPdf(bookId, buffer)
```

> `pdfPath` 变量在此 Step 完成后已不在作用域。下方 Step 4 会把 OCR fetch body 里的字段值从 `pdfPath` 改为 `r2ObjectKey`（字段名仍是 `pdf_path`，Task 6 才统一改字段名）。

- [ ] **Step 4: 把 3 处 OCR fetch body 的字段值切到 `r2ObjectKey`**

把 lines 116、134、169 的 body：
```typescript
body: JSON.stringify({ pdf_path: pdfPath, book_id: bookId }),
```
改成：
```typescript
body: JSON.stringify({ pdf_path: r2ObjectKey, book_id: bookId }),
```

字段名 `pdf_path` 暂留——Python 在 Task 5 会兼容两个字段名，Task 6 才把字段名也切到 `r2_object_key`。这一步让类型检查通过、让本地跑时上传不炸。

- [ ] **Step 5: 本地 type check**

Run：`npx tsc --noEmit`
Expected：无错误。

- [ ] **Step 6: Commit**

```bash
git add src/app/api/books/route.ts
git commit -m "feat(upload): write PDFs to R2 instead of local data/uploads"
```

---

### Task 4: 重构 GET `/api/books/[bookId]/pdf` 返回 302 redirect

**Files:**
- Modify: `src/app/api/books/[bookId]/pdf/route.ts` (全文重写 body 部分)

- [ ] **Step 1: 修改 imports**

把：
```typescript
import { readFile } from 'fs/promises'
import { join } from 'path'
```
改成：
```typescript
import { buildObjectKey, getSignedPdfUrl } from '@/lib/r2-client'
```

- [ ] **Step 2: 替换本地读取逻辑（lines 33-46）**

原代码：
```typescript
const pdfPath = join(process.cwd(), 'data', 'uploads', `${id}.pdf`)
try {
  const fileBuffer = await readFile(pdfPath)
  return new NextResponse(fileBuffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Length': String(fileBuffer.length),
      'Cache-Control': 'private, max-age=3600',
    },
  })
} catch {
  return NextResponse.json({ error: 'PDF file not found', code: 'FILE_NOT_FOUND' }, { status: 404 })
}
```
改成：
```typescript
const objectKey = buildObjectKey(id)
try {
  const signedUrl = await getSignedPdfUrl(objectKey, 3600)
  return NextResponse.redirect(signedUrl, 302)
} catch (error) {
  return NextResponse.json(
    { error: 'PDF file not accessible', code: 'FILE_NOT_FOUND', details: String(error) },
    { status: 404 }
  )
}
```

- [ ] **Step 3: 本地 type check**

Run：`npx tsc --noEmit`
Expected：无错误。

- [ ] **Step 4: 本地冒烟测试（需本地 dev server + R2 凭据）**

在 `.env.local` 配齐 R2_* 后，`npm run dev`，手动：
- 在浏览器打开已有 book：`/books/<id>/reader`
- 观察 Network 面板：`/api/books/<id>/pdf` 应返回 302 → R2 `*.r2.cloudflarestorage.com` URL
- PDF viewer 能正常显示内容

若验证通过才继续。

- [ ] **Step 5: Commit**

```bash
git add src/app/api/books/[bookId]/pdf/route.ts
git commit -m "feat(pdf): serve PDFs via R2 presigned URL 302 redirect"
```

---

### Task 5: 更新 `scripts/ocr_server.py` 接受 `r2_object_key`（boto3 下载到 tmpdir）

**Files:**
- Modify: `scripts/ocr_server.py`

设计约束：
- 只改 `/classify-pdf`、`/extract-text`、`/ocr-pdf` 3 个 PDF 端点
- **不改**：`/ocr`（截图）、PaddleOCR 代码、4 个直写 Neon 的函数、Google OCR 分支——全是阶段 2 的事
- 兼容策略：同时接受 `r2_object_key` 和 `pdf_path`，优先用前者，阶段 2 移除 `pdf_path`
- R2 下载用 `boto3` S3 compatibility + presigned URL get object；临时文件用 `tempfile.NamedTemporaryFile(delete=False)`，处理完 `os.unlink`

- [ ] **Step 1: 在文件头加 boto3 import 和 R2 下载 helper**

在 line 15 附近（`from paddleocr import PaddleOCR` 之后）加：
```python
import tempfile
import boto3
from botocore.client import Config


def _r2_client():
    account_id = os.environ.get("R2_ACCOUNT_ID")
    access_key = os.environ.get("R2_ACCESS_KEY_ID")
    secret_key = os.environ.get("R2_SECRET_ACCESS_KEY")
    if not account_id or not access_key or not secret_key:
        raise RuntimeError(
            "R2 env vars missing: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY all required"
        )
    return boto3.client(
        "s3",
        endpoint_url=f"https://{account_id}.r2.cloudflarestorage.com",
        aws_access_key_id=access_key,
        aws_secret_access_key=secret_key,
        config=Config(signature_version="s3v4"),
    )


def _download_pdf_from_r2(object_key: str) -> str:
    """Download PDF from R2 to a temp file, return the local path. Caller must os.unlink."""
    bucket = os.environ.get("R2_BUCKET")
    if not bucket:
        raise RuntimeError("R2_BUCKET env var missing")
    tmp = tempfile.NamedTemporaryFile(suffix=".pdf", delete=False)
    tmp.close()
    _r2_client().download_file(bucket, object_key, tmp.name)
    return tmp.name


def _resolve_pdf_input(body: dict) -> str:
    """Accept either r2_object_key (preferred) or legacy pdf_path. Return local path (caller must unlink if downloaded)."""
    r2_key = str(body.get("r2_object_key", "")).strip()
    if r2_key:
        return _download_pdf_from_r2(r2_key)
    legacy_path = str(body.get("pdf_path", "")).strip()
    if legacy_path:
        return legacy_path
    raise ValueError("missing r2_object_key or pdf_path")


def _cleanup_if_temp(path: str, downloaded: bool) -> None:
    if downloaded:
        try:
            os.unlink(path)
        except OSError:
            pass
```

- [ ] **Step 2: 改 `/classify-pdf` 端点（lines 406-462）**

把：
```python
pdf_path = str(body.get("pdf_path", "")).strip()
...
if not pdf_path:
    return jsonify({"error": "missing pdf_path"}), 400
```
改成：
```python
r2_key = str(body.get("r2_object_key", "")).strip()
legacy_path = str(body.get("pdf_path", "")).strip()
if not r2_key and not legacy_path:
    return jsonify({"error": "missing r2_object_key (or legacy pdf_path)"}), 400

downloaded = bool(r2_key)
try:
    pdf_path = _download_pdf_from_r2(r2_key) if r2_key else legacy_path
except Exception as error:
    return jsonify({"error": f"R2 download failed: {error}"}), 500
```

并在 `doc = fitz.open(pdf_path)` / `doc.close()` 后加 cleanup：
```python
finally:
    doc.close()
    _cleanup_if_temp(pdf_path, downloaded)
```

- [ ] **Step 3: 同样改 `/extract-text` 端点（lines 465-523）**

按 Step 2 相同模式替换 `pdf_path` 读取；cleanup 放 `finally`。

- [ ] **Step 4: 同样改 `/ocr-pdf` 端点（lines 526-556）**

注意：`/ocr-pdf` 是异步的（后台 thread）。修改方式：
- 主线程读 `r2_object_key`，**同步**下载到 tmpdir 得到 local path
- 把 local path 连同 `downloaded=True` 标志传给后台 thread
- 后台 `process_pdf_ocr` 函数签名加 `downloaded: bool` 参数，完成时清理

具体改动：
```python
# 主路由里
try:
    pdf_path = _download_pdf_from_r2(r2_key) if r2_key else legacy_path
    downloaded = bool(r2_key)
except Exception as error:
    return jsonify({"error": f"R2 download failed: {error}"}), 500

# 路由返回 202 前启动 thread，传入 downloaded 标志
worker = threading.Thread(
    target=process_pdf_ocr,
    args=(pdf_path, book_id, database_url, downloaded),
    daemon=True,
)
```

`process_pdf_ocr` 函数加 `downloaded=False` 默认参数，`finally` 块清理：
```python
def process_pdf_ocr(pdf_path: str, book_id: int, database_url: str, downloaded: bool = False) -> None:
    try:
        # ... existing logic unchanged ...
    finally:
        _cleanup_if_temp(pdf_path, downloaded)
```

- [ ] **Step 5: 不改 `/ocr`（截图端点）**

`/ocr` 端点（lines 387-403）继续接受本地 `image_path`——截图流在阶段 1 不走 R2，保持原样。

- [ ] **Step 6: 本地单元验证（可选）**

没有现成 Python 测试框架。改 pass 后会在 Task 8 的冒烟测试中端到端验证。

- [ ] **Step 7: Commit**

```bash
git add scripts/ocr_server.py
git commit -m "feat(ocr): accept r2_object_key in PDF endpoints (boto3 download to tmpdir)"
```

---

### Task 6: Next.js OCR 调用位点 body 改为 `r2_object_key`

**Files:**
- Modify: `src/app/api/books/route.ts` (lines 116, 134, 169)

Task 3 里已经把 `pdf_path: pdfPath` 改成 `pdf_path: r2ObjectKey`（字段名未变，值变了）——这一步正式把字段名也换掉。

- [ ] **Step 1: 替换字段名（3 处）**

Lines 116、134、169 原本：
```typescript
body: JSON.stringify({ pdf_path: r2ObjectKey, book_id: bookId }),
```
改成：
```typescript
body: JSON.stringify({ r2_object_key: r2ObjectKey, book_id: bookId }),
```

- [ ] **Step 2: 本地 type check**

Run：`npx tsc --noEmit`
Expected：无错误。

- [ ] **Step 3: Commit**

```bash
git add src/app/api/books/route.ts
git commit -m "feat(ocr): switch OCR request body from pdf_path to r2_object_key"
```

---

### Task 7: Dockerfile.ocr + docker-compose.yml + .env.example

**Files:**
- Modify: `Dockerfile.ocr`
- Modify: `docker-compose.yml`
- Modify: `.env.example`

- [ ] **Step 1: `Dockerfile.ocr` line 6 追加 `boto3`**

把：
```dockerfile
RUN pip install paddlepaddle paddleocr flask PyMuPDF pymupdf4llm Pillow psycopg2-binary numpy
```
改成：
```dockerfile
RUN pip install paddlepaddle paddleocr flask PyMuPDF pymupdf4llm Pillow psycopg2-binary numpy boto3
```

> 注：`paddlepaddle paddleocr` 在阶段 2 会删除，阶段 1 保留（Phase 1 OCR 仍本地 Paddle 跑）。

- [ ] **Step 2: `docker-compose.yml` 给 `ocr` service 加 R2 env**

在 `ocr.environment` 段（line 31-37）加 4 行：
```yaml
    - R2_ACCOUNT_ID=${R2_ACCOUNT_ID}
    - R2_ACCESS_KEY_ID=${R2_ACCESS_KEY_ID}
    - R2_SECRET_ACCESS_KEY=${R2_SECRET_ACCESS_KEY}
    - R2_BUCKET=${R2_BUCKET}
```

同样在 `app.environment`（line 6-11）加这 4 行（Next.js 侧也需要上传/签 URL）。

- [ ] **Step 3: `.env.example` 末尾追加 R2 配置块**

```bash
# ============================================================
# Cloudflare R2（PDF 文件存储）
# 在 Cloudflare Dashboard → R2 → Manage API Tokens 里创建 bucket-scope token
# ============================================================
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=ai-textbook-pdfs
```

- [ ] **Step 4: 本地重建 OCR 容器**

Run：`docker compose build ocr && docker compose up -d`
Expected：`boto3` 已安装，OCR server 能正常启动。

- [ ] **Step 5: Commit**

```bash
git add Dockerfile.ocr docker-compose.yml .env.example
git commit -m "chore(docker): wire R2 env vars + add boto3 to ocr image"
```

---

### Task 8: 本地端到端冒烟测试（R2 + 本地 Docker OCR）

**Files:** 无代码变更，只是验证 Task 1-7 能端到端工作。

验证前置：
- `.env.local` 已填真实 R2 凭据
- 本地 DB（`docker compose up db`）跑着
- 本地 OCR 容器（`docker compose up ocr`）跑着
- `npm run dev` 在 3000 端口

- [ ] **Step 1: 上传 PDF 冒烟**

- 浏览器打开 `http://localhost:3000/upload`
- 上传一份小 PDF（文字页为主，避免长 OCR 卡冒烟）
- 预期：返回 bookId，Cloudflare R2 Dashboard 能看到 `books/<bookId>/original.pdf`
- 预期：Neon 本地 schema 里（或本地 Postgres）`books` 表新记录 `parse_status='processing'` 或 `'done'`

- [ ] **Step 2: PDF viewer 冒烟**

- 访问 `http://localhost:3000/books/<bookId>/reader`
- 浏览器 DevTools Network tab 看 `/api/books/<bookId>/pdf` 返回 302，跳转到 `*.r2.cloudflarestorage.com/...?X-Amz-Signature=...`
- PDF viewer 正常渲染页面

- [ ] **Step 3: OCR 冒烟（扫描 PDF）**

- 上传一份扫描 PDF
- 观察 docker compose ocr logs：应看到 `classify-pdf` / `extract-text` / `ocr-pdf` 调用
- 容器内临时文件在调用结束后被清理（不堆积）
- `books.raw_text` 最终有内容，`parse_status='done'`

- [ ] **Step 4: 截图 OCR 冒烟（验证阶段 1 没破坏截图流）**

- 在 `/books/<id>/reader` 截图问 AI
- OCR 应正常返回文字（这部分走本地 `tmpdir`，未改）

- [ ] **Step 5: 失败路径冒烟**

- 临时在 `.env.local` 把 `R2_SECRET_ACCESS_KEY` 改错，重启 dev server
- 再上传：预期 500 错误，日志清晰报 R2 credentials 错
- 改回正确值，重启

- [ ] **Step 6: 无 commit**

本任务不产 diff。验证通过后在 plan 勾选 checkbox 即可。

---

### Task 9: 建 `scripts/init-neon-schema.ts`（一次性 schema 推送工具）

**Files:**
- Create: `scripts/init-neon-schema.ts`

产品负责人需要把 `src/lib/schema.sql` 推到 Neon 生产 branch。两种方式：
- (A) Neon Console → SQL Editor → 贴 schema 内容（无需本工具）
- (B) 用本工具：`npx tsx scripts/init-neon-schema.ts`

为保险起见建这个工具（如果未来要重建 DB，比手动复制快）。**Task 10 部署前 schema 必须先到位**。

- [ ] **Step 1: 建文件**

```typescript
#!/usr/bin/env -S node --experimental-strip-types
import { readFile } from 'fs/promises'
import { Pool } from 'pg'

async function main() {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    console.error('DATABASE_URL env var is required')
    process.exit(1)
  }
  const schemaPath = new URL('../src/lib/schema.sql', import.meta.url)
  const schema = await readFile(schemaPath, 'utf8')
  const pool = new Pool({ connectionString: databaseUrl })
  try {
    await pool.query(schema)
    console.log('schema applied successfully')
  } finally {
    await pool.end()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
```

- [ ] **Step 2: 本地试跑（指向本地 DB）**

Run：`DATABASE_URL=postgresql://dev:dev@localhost:5432/textbook_teacher node --experimental-strip-types scripts/init-neon-schema.ts`
Expected：`schema applied successfully`（schema 是幂等的 CREATE TABLE IF NOT EXISTS）。

- [ ] **Step 3: 指向 Neon 生产 branch 跑一次**

Run：`DATABASE_URL=<Neon 生产 DSN> node --experimental-strip-types scripts/init-neon-schema.ts`
Expected：`schema applied successfully`，Neon Console 的 Tables 面板能看到 24 张表。

- [ ] **Step 4: Commit**

```bash
git add scripts/init-neon-schema.ts
git commit -m "chore(db): add one-shot schema push script for Neon bootstrap"
```

---

### Task 10: Vercel 项目 env vars 配置 + 首次部署验证

**Files:** 无代码变更（产品负责人在 Vercel Dashboard 操作 + Claude 指导）。

- [ ] **Step 1: Vercel 项目 → Settings → Environment Variables 配置**

**Production** 环境勾选：
```
DATABASE_URL              # Neon Integration 自动注入，不用手填
ANTHROPIC_API_KEY         # [Sensitive] 勾
AI_MODEL                  # 填 anthropic:claude-sonnet-4-6（或当前在用的）
R2_ACCOUNT_ID             # [Sensitive] 勾
R2_ACCESS_KEY_ID          # [Sensitive] 勾
R2_SECRET_ACCESS_KEY      # [Sensitive] 勾
R2_BUCKET                 # ai-textbook-pdfs
OCR_SERVER_HOST           # 先填 127.0.0.1（阶段 2 替换为 OCR_SERVER_URL）
OCR_SERVER_PORT           # 先填 8000（阶段 2 删除）
```

**Preview** 环境全部勾 "Apply to Preview"——让 feature branch 也能跑（DB 会自动切 Neon branch）。

> **`SESSION_SECRET` 不在列表里**：Claude 预扫源码确认 `src/lib/auth.ts` 只用 bcrypt + random session tokens + pg sessions 表，没有任何代码读取 `SESSION_SECRET`。spec § 6.1 应同步删除此条（Task 10 Step 1.5 提供复核命令）。

- [ ] **Step 1.5: 复核没有遗漏的 SESSION_SECRET 引用（spec review flag）**

Run：`grep -rn 'SESSION_SECRET' src/`
Expected：无任何结果（empty output）。若有命中——立即 dispatch 给 Claude PM 评估。

若复核通过，再 dispatch 给 Claude 同步以下两处文档：
- `docs/superpowers/specs/2026-04-12-cloud-deployment-design.md` § 6.1 删除 SESSION_SECRET 行
- `.env.example` 不存在该项就不动，存在则删

- [ ] **Step 2: 触发首次部署（前置：Task 9 schema 已推到 Neon 生产 branch）**

- 产品负责人确认 Neon Console → Tables 面板能看到 24 张表（Task 9 Step 3 验收点）
- 产品负责人 push 一个无害 commit 到 master（如 `docs: trigger deploy`）
- Vercel Dashboard 应自动 build
- Build log 无报错

- [ ] **Step 3: 生产冒烟**

- 打开 Vercel 给的 `<project>.vercel.app` URL
- 登录/注册（Neon 生产 branch 存数据）
- 上传一份小 PDF（走 R2）
- **注意**：OCR 会 fail，因为 Cloud Run 还没部署（阶段 2），`OCR_SERVER_HOST=127.0.0.1` 从 Vercel 端打不通——这是预期
- 验收只看：上传成功 → R2 能看到对象 → book 记录 `parse_status='processing'`

- [ ] **Step 4: Preview 环境冒烟**

- 本地开 feature branch：`git checkout -b test/phase1-preview`
- Push 后 Vercel 自动起 preview + Neon 自动起新 branch
- Preview URL 能访问，登录后看到空数据库（新 branch 从生产克隆 schema 但空数据）
- 小心：如果 Neon 是克隆生产（含数据），会看到数据 —— 这取决于 Neon Integration 的配置

- [ ] **Step 5: 清理 test branch**

Run：
```bash
git checkout master
git branch -D test/phase1-preview
git push origin --delete test/phase1-preview
```
Neon 的对应 DB branch 会自动销毁。

- [ ] **Step 6: 无 commit**

本任务不产 diff。

---

## 最终验收清单（阶段 1 完成标志）

所有以下都必须通过才算阶段 1 完成：

- [ ] 本地 dev server 能上传 PDF 到 R2（Cloudflare Dashboard 可见 object）
- [ ] 本地 dev server 能通过 `/api/books/[id]/pdf` 302 redirect 让浏览器拿到 PDF
- [ ] 本地 Docker OCR 能从 R2 下载 PDF 处理，临时文件清理干净
- [ ] Vercel 生产环境能访问 `<project>.vercel.app`
- [ ] Vercel 生产能登录/注册 / 写数据到 Neon 生产 branch
- [ ] Vercel 生产能上传 PDF → R2 有记录 + Neon 有 book 记录
- [ ] 产品负责人 push 到 master 自动触发 Vercel build + deploy
- [ ] 产品负责人 push 到 feature branch 自动起 Vercel preview + Neon 自动开 DB branch
- [ ] 本地 Docker 和 Vercel 之间代码保持兼容（同一份 master 能两地跑）
- [ ] `.env.example` 文档完整（新协作者能复刻配置）
- [ ] 阶段 1 改动的 11 个文件在 master 的 git 历史里清晰（按 Task 原子 commit）

---

## 风险与回滚

### 局部失败的回滚路径

| 场景 | 回滚 |
|---|---|
| R2 上传失败 | `.env.local` 里 comment 掉 R2_* 让代码走报错路径；或 `git revert` 到 Task 3 之前 |
| PDF viewer 显示破图 | `git revert` Task 4，回到本地读路径；需同时把 R2 里的 PDF 往 `data/uploads/` 重传（此阶段数据量小） |
| Vercel 首次部署失败 | 看 build log；DB 连不上就是 P3/P4 没做；env 缺失就补 |
| Neon DB branch 超出免费层 10 个 | 清理旧 feature branch 让 Neon 自动销毁 |
| `scripts/ocr_server.py` boto3 下载超时 | 检查 R2 token permission scope；回退到阶段 1 前 commit |

### 阶段 1 之后如果阶段 2 彻底失败，阶段 1 工作不浪费

- R2 依然工作
- Vercel + Neon 依然工作
- OCR 可临时继续本地 Docker 跑（`OCR_SERVER_HOST=localhost` 的网络穿透也行，但产品负责人非技术不推荐）
- 要整块回滚：`git revert` Task 1-10 的所有 commit，把 Vercel 项目 disable 即可（数据保留）

---

## 执行顺序说明（给 Codex）

**派发顺序**：按 Task 1 → Task 10 线性。每个 Task 完成 + code review 通过 + commit 后再开始下一个。

**Task 5 和 Task 6 紧耦合**：Task 5 完成后 master 处于"Python 端兼容两种字段"的临时状态；Task 6 完成后才真正切到 r2_object_key。两个 Task 合并到同一 PR 也可接受，由 Claude PM 在派发时决定。

**Task 9（init-neon-schema）必须在 Task 10 前跑**：Task 10 的首次部署需要 Neon 已有 schema，否则 Vercel 后端任何 SQL query 都会 500。Task 9 的 Step 3 必须先指向 Neon 生产 DSN 跑成功。

**Task 10（Vercel 部署）需前置条件 P1-P4 + Task 9**：产品负责人在 Task 1-8 任何时间点把账户 + Integration 准备好都行。Task 10 是 checkpoint，不是单独 coding task。

**回归测试的位置**：每个 Task 的 Step 里含 type check / smoke test。Task 8 是独立的端到端冒烟。

---

## Spec 对齐声明

本 plan 严格对齐 `docs/superpowers/specs/2026-04-12-cloud-deployment-design.md` § 4.1 阶段 1 范围 + § 6.1 env vars + § 6.3 R2 对象路径约定 + spec review flag（Task 10 Step 1.5 复核 `SESSION_SECRET` 未引用）。

阶段 2（OCR 上云 + provider 切 Google Vision + callback 端点）和阶段 3（域名 + Sentry + secrets 审查）的 plan 等阶段 1 完成后再写，避免过早 plan 被阶段 1 实际经验过期。
