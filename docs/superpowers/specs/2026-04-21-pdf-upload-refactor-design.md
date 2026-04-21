# M4.5 PDF 上传重构 + 准备页 UX 设计

**日期**: 2026-04-21
**里程碑**: M4.5 MVP 全流程可用冲刺
**状态**: 🚧 brainstorm 进行中（WIP state: `2026-04-21-pdf-upload-refactor-brainstorm-state.md`）

---

## 目标

解决"14.2MB / 369 页 Chinese 教材无法端到端通过"的 MVP 阻塞问题。硬卡点是 Vercel 函数 4.5MB body 上限，软卡点是首次体验感知慢。

**验收**：用户上传 14.2MB PDF → perceived 5s 进入"正在准备"状态 → perceived 30s 内能开始读第一模块。

---

## 调研依据

- `docs/research/2026-04-20-pdf-upload-speed-options.md` 🔴（29S+11A+2B 源）

---

## 1. Data Model

### 1.1 books 表新增列

新增 2 列，不新增表：

```sql
ALTER TABLE books ADD COLUMN upload_status TEXT NOT NULL DEFAULT 'pending'
  CHECK(upload_status IN ('pending', 'confirmed'));
ALTER TABLE books ADD COLUMN file_size BIGINT DEFAULT 0;
```

**状态语义**：
- `pending`：book 行刚 INSERT（由 `/api/uploads/presign` 创建），浏览器还在 PUT R2，或已失败留孤儿
- `confirmed`：`/api/books/confirm` 校验 R2 对象存在后切换，进入现有 `parse_status` / `kp_extraction_status` 流程

**不新增 object key 列**：现有 R2 key 由 `buildObjectKey(bookId)` 派生（= `books/<bookId>/original.pdf`），是全 repo 约定，`GET /api/books/[bookId]/pdf/route.ts` 就是这样拿对象的。新路径沿用——`/presign` 签发 PUT URL 时 key 也用 `buildObjectKey(bookId)`，`/confirm` HEAD 验证时再用同一函数推。DB 的 `file_path` 列当前未被任何代码读写（schema 定义的死列），不动。

### 1.2 向后兼容 migration

现有 M4 处理过的 books 不受影响：

```sql
ALTER TABLE books ADD COLUMN upload_status TEXT DEFAULT NULL;
UPDATE books SET upload_status = 'confirmed' WHERE upload_status IS NULL;
ALTER TABLE books ALTER COLUMN upload_status SET NOT NULL;
ALTER TABLE books ALTER COLUMN upload_status SET DEFAULT 'pending';
ALTER TABLE books ADD CONSTRAINT books_upload_status_check
  CHECK(upload_status IN ('pending', 'confirmed'));

ALTER TABLE books ADD COLUMN file_size BIGINT DEFAULT 0;
```

### 1.3 孤儿行处理（MVP 简化）

- **不加 cron 自动清理**（Hobby 不值得加基础设施）
- **仅列表端点加过滤**：`GET /api/books`（书籍列表）加 `WHERE upload_status = 'confirmed'`。
  - **书级端点不过滤**（`GET /api/books/[bookId]/status` / `/pdf` / `/modules/*` 等）——准备页需要在 `upload_status='pending'` 时也能查到 book 做状态推进；`requireBookOwner` 已用 user_id 防越权。
- 孤儿 book 行（upload_status='pending' 超过 15 分钟 presigned TTL）静默留 DB，不影响用户界面
- 未来孤儿积累影响查询时再加 cron

### 1.4 不变的部分

现有 `parse_status` / `kp_extraction_status` / `ocr_current_page` / `ocr_total_pages` 等列语义不动，只是从"confirm 之后才开始 pending → running → done"。

---

## 2. APIs

### 2.1 新增：Presigned URL 签发

**端点**：`POST /api/uploads/presign`

**认证**：`requireAuth` middleware（复用现有模式）

**输入（Zod schema）**：
```ts
{
  filename: z.string().min(1).max(255),
  size: z.number().int().positive().max(50 * 1024 * 1024), // 50MB hard cap
  contentType: z.literal("application/pdf"),
}
```

**输出**：
```ts
{
  bookId: number,    // 新建 books 行的 id，前端立即可用
  uploadUrl: string, // R2 presigned PUT URL，TTL 900 秒
  objectKey: string, // = `books/<bookId>/original.pdf`（由 buildObjectKey(bookId) 派生，前端参考值）
}
```

**流程**：
1. 校验请求 schema + session
2. `INSERT INTO books (user_id, title, raw_text, parse_status, kp_extraction_status, upload_status, file_size) VALUES ($userId, $filename, '', 'pending', 'pending', 'pending', $size) RETURNING id` → 获得 bookId
   - `title` 用 filename 做占位（confirm 阶段 UPDATE 为用户输入的书名）
   - `raw_text = ''` 与现有 PDF 分支一致（L85 当前写法）
   - **不写 file_path**（沿用 `buildObjectKey` 约定，§1.1）
3. `const objectKey = buildObjectKey(bookId)` （= `books/<bookId>/original.pdf`，与现有 pdf GET 端点同源）
4. 调用 `@aws-sdk/s3-request-presigner` 的 `getSignedUrl(PutObjectCommand, { expiresIn: 900 })` 生成 PUT URL
5. 返回 `{ bookId, uploadUrl, objectKey }`

**关键产品含义**：前端收到响应即 `router.push(/books/[bookId]/preparing)`，后台浏览器继续直传 R2。满足"perceived 5s 进入准备页"硬验收。

**孤儿清理**：上传失败或用户取消时，book 行停留 `upload_status='pending'`。由决策 2 的 cron 扫超时（>1 小时）清理。

**新增依赖**：`@aws-sdk/s3-request-presigner`（唯一引入）。现有 `GET /api/books/[id]/pdf` 已有 R2 signing 能力，确认仅需扩展到 PUT。

**错误码**：
- 401：未登录
- 400：schema 校验失败（文件超限 / contentType 错 / filename 空）
- 500：DB 写入或 R2 签名失败

### 2.2 新增：上传完成 Confirm

**端点**：`POST /api/books/confirm`

**认证**：`requireAuth`

**输入**：
```ts
{
  bookId: z.number().int().positive(),
  title: z.string().min(1).max(255),
}
```

**输出**：
```ts
{ bookId: number, processing: true }
```

**流程**（sync 部分，≤1s 内返回）：
1. 校验 session + schema
2. `SELECT id, user_id, upload_status, parse_status, file_size FROM books WHERE id = $1 AND user_id = $2`——不存在或不归属当前用户 → 404
3. **幂等短路（区分成功/失败）**：
   - `upload_status === 'confirmed' && parse_status !== 'error'` → 立刻返回 `{ bookId, processing: true }`（已在处理中或已完成，防重入触发重复 classify）
   - `upload_status === 'confirmed' && parse_status === 'error'` → 失败态不重试本接口，直接 409 `{ error: 'processing_failed', hint: '请删除重新上传' }`——前端拿 409 跳 `/upload`（见 §5.2 重试策略）
4. `HeadObjectCommand(buildObjectKey(bookId))` 向 R2 验证对象存在 + 大小与 `file_size` 匹配 → 不存在或 size mismatch → 400 "upload incomplete"
5. `UPDATE books SET upload_status='confirmed', parse_status='processing', title=$2 WHERE id=$1` （title 覆写 presign 阶段的 filename 占位）
6. **启动 fire-and-forget 处理链**（不 await）：`void runClassifyAndExtract(bookId, buildObjectKey(bookId)).catch(...)`，内部跑现 `POST /api/books` L107-213 的 classify + extract 链路；失败时 `markOcrFailure` 置 `parse_status='error'`。
7. 立刻返回 `{ bookId, processing: true }`

**为什么 fire-and-forget**：
- 14.2MB / 369 页 classify+extract 理论耗时接近 300s（调研 D1）
- 若同步 await，upload 页 'confirming' 状态可能卡 3-5 分钟，fail 感知 5s 验收
- fire-and-forget 后 confirm 1s 内返回，上传页立刻 `router.push(/preparing)`，处理进度由准备页 polling 展示
- Vercel Fluid Compute 下 fire-and-forget 函数调用在父函数返回后继续执行（需验证：§4.2 步骤）

**幂等保证**：步骤 3 + 步骤 5 的 `UPDATE` 原子序列，多次 confirm 同一 bookId 只触发一次 classify。

**失败语义**：classify / extract 任一阶段挂 → `markOcrFailure` 置 `parse_status='error'`。准备页 polling 读到 `parseStatus === 'failed'`（§2.4 做 `done→completed`/`error→failed` 归一化）→ 停止轮询 + 显示错误 + "重新上传"按钮。

### 2.3 调整：`POST /api/books`

**PDF 分支删除**：ext === 'pdf' → 返回 `400 { error: 'Use /api/uploads/presign for PDF uploads' }`。

**TXT 分支保留**：.txt 文件 < 4.5MB（已有 `rawText.length < 100` 下限校验），formData 无压力，现有逻辑不动。

**目的**：强制所有 PDF 走 presign → confirm 新路径，避免老接口潜伏的 4.5MB 坑。

### 2.4 调整：准备页状态轮询端点

> ⚠️ **现状**：`src/app/api/books/[bookId]/status/route.ts` **已存在**（M1 扫描 PDF 时建的，ProcessingPoller / ActionHub 等旧消费方靠它）。本决策在既有响应上**追加**字段，不能覆写也不删旧字段。

**端点**：`GET /api/books/[bookId]/status`（现有）

**认证**：`requireBookOwner`（现有沿用）

**输入**：路径参数 `bookId`

**输出（新旧字段合并）**：
```ts
{
  // 现有字段（M1 保留，ProcessingPoller 继续读）
  parseStatus: 'pending' | 'processing' | 'completed' | 'failed',  // 归一化后（done → completed, error → failed）
  ocrCurrentPage: number,
  ocrTotalPages: number,
  parse_status: string,           // 原始 DB 值（snake_case 保留）
  kp_extraction_status: string,   // 原始 DB 值（snake_case 保留）
  ocr_current_page: number,
  ocr_total_pages: number,

  // 新增字段（M4.5 准备页专用）
  bookId: number,
  uploadStatus: 'pending' | 'confirmed',
  kpExtractionStatus: 'pending' | 'processing' | 'completed' | 'failed',  // 归一化后（与 parseStatus 同规则，若有 running/done 输入一律映射）
  modules: Array<{
    id: number,
    orderIndex: number,
    title: string,
    kpExtractionStatus: 'pending' | 'processing' | 'completed' | 'failed',
    ready: boolean,               // kpExtractionStatus === 'completed'
  }>,
  progressPct: number,            // 0-100
  firstModuleReady: boolean,      // modules[0]?.kpExtractionStatus === 'completed'
  estimatedSecondsRemaining: number | null,  // 首版返回 null
}
```

**流程**：
1. 复用现有 `requireBookOwner(req, id)` 校验
2. `SELECT id, upload_status, parse_status, kp_extraction_status, ocr_current_page, ocr_total_pages FROM books WHERE id = $1`（**不过滤 upload_status**，§1.3 已说明）
3. `SELECT id, order_index, title, kp_extraction_status FROM modules WHERE book_id = $1 ORDER BY order_index`
4. 归一化枚举值（复用现有 route.ts 第 42-47 行的 `done → completed` / `error → failed` 映射，扩展到 `kp_extraction_status`）
5. 计算 `progressPct`（分段）：
   - `upload_status === 'pending'` → `0`
   - `upload_status === 'confirmed' && parseStatus === 'pending'` → `5`
   - `parseStatus === 'processing'` → `10 + (ocr_current_page / max(ocr_total_pages,1)) * 30` （10-40 区间）
   - `parseStatus === 'completed' && kpExtractionStatus !== 'completed'` → `40 + (readyModuleCount / max(totalModuleCount,1)) * 55` （40-95 区间）
   - `kpExtractionStatus === 'completed'` → `100`
   - 设计说明：故意留 95→100 最后冲刺 gap（Harrison CHI 2010 "backwards decelerating" 进度条心理学），`kp_extraction_status` 进入 `completed` 瞬间跳 100 比线性接近更令人满意
6. `firstModuleReady = modules[0]?.kp_extraction_status === 'completed'`
7. `estimatedSecondsRemaining = null` （首版）
8. 返回合并后 JSON

**选择理由**：
- **追加不覆写**：避免 break 现有 ProcessingPoller 消费路径（M3/M4 回归风险）
- **归一化映射与现 route.ts 一致**：`done→completed` / `error→failed` 是既有约定
- **Polling（2s）优于 SSE**：Vercel serverless 对长连接管理差（冷启动 / 重连 / 超时），2s 轮询给 UI 足够流畅

**错误码**：
- 401：`requireBookOwner` 未登录 / 越权
- 404：book 不存在或不归属当前用户
- 500：DB 查询失败

---

## 3. Frontend

### 3.1 上传组件

**文件**：`src/app/upload/page.tsx`（改造现有，非新建）

**视觉骨架不动**：侧边栏、标题、拖拽框、书名输入、提交按钮均沿用组件库现有样式。

**状态机**：
```ts
type UploadStatus =
  | 'idle'                           // 用户选文件阶段
  | 'signing'                        // POST /api/uploads/presign
  | { kind: 'uploading'; pct: number } // XHR PUT R2，pct 0-100
  | 'confirming'                     // POST /api/books/confirm
  | 'redirecting'                    // router.push 准备页
  | { kind: 'error'; message: string }
```

**上传技术**：`XMLHttpRequest` + `xhr.upload.onprogress`
- 原因：fetch 无原生 body 进度事件；ReadableStream polyfill 在生产各浏览器表现不稳
- `xhr.upload.onprogress = e => setStatus({ kind: 'uploading', pct: (e.loaded/e.total)*100 })`

**文件类型分流**（按钮点击前或点击时判断 `file.name.endsWith('.pdf')`）：
- **PDF** → 走本节描述的新 presign → PUT → confirm 链路
- **非 PDF（.txt 等）** → 保留旧路径：`POST /api/books` with FormData（TXT < 4.5MB 无压力，§2.3 TXT 分支保留）；完成后 `router.push(/books/${bookId}/reader)`

**流程（PDF 分支，按钮点击后）**：
1. 置 `signing`，`POST /api/uploads/presign { filename, size, contentType: 'application/pdf' }` → 拿 `{ bookId, uploadUrl, objectKey }`
2. 构造 `XMLHttpRequest`，`xhr.open('PUT', uploadUrl)`，`xhr.setRequestHeader('Content-Type', 'application/pdf')`
3. 绑 `upload.onprogress` 更新 `uploading(%)` 状态
4. 绑 `xhr.onload` / `xhr.onerror` 处理 PUT 完成或失败
5. PUT 成功 → 置 `confirming`，`POST /api/books/confirm { bookId, title }`（confirm 1s 内返回——§2.2 已拆 sync/async；处理挂在后端 fire-and-forget 跑，UI 不等）
6. confirm 返回 200 → 置 `redirecting`，`router.push(/books/${bookId}/preparing)`
7. confirm 返回 409（已失败态） → 置 `error`，message="上一次处理失败，请删除书重新上传"
8. 任一阶段 4xx/5xx/网络挂 → 置 `error`，显示重试按钮

**UI 变化**：
- `signing` 状态：文案 "正在准备上传..."（通常 <1s，一闪而过）
- `uploading(pct)` 状态：进度条 + "正在上传 {pct}%" + 文件大小 "X.X / Y.Y MB"
- `confirming` 状态：文案 "整理中，马上好..."
- `error` 状态：错误提示 + "重试"按钮（重置到 idle 状态）

**行为约束**：
- 不加取消按钮（状态管理复杂度高，MVP 不值得）
- 不自动重试（用户会误以为卡住）
- 跳转目标改为 `/books/${bookId}/preparing`（决策 5）

### 3.2 准备页路由 + 骨架屏

**路由**：新建 `src/app/books/[bookId]/preparing/page.tsx`

**Next.js App Router `loading.tsx`**：同目录放 `loading.tsx`，Next.js 在 navigation 初始瞬间自动显示（0ms 骨架），避免白屏。

**组件树**：
```
<PreparingPage>
  <BookHeader title={book.title} />
  <ProgressBar pct={progressPct} label={statusText} />
  <ModuleSkeletonGrid>
    {modules.map(m => m.ready ? <ModuleReadyCard /> : <ModuleSkeletonCard />)}
  </ModuleSkeletonGrid>
  <StartButton disabled={!firstModuleReady} onClick={goToReader} />
</PreparingPage>
```

**Polling 逻辑**：
- `useEffect` + `setInterval(2000)` 调 `GET /api/books/[bookId]/status`
- 收到响应更新本地状态；`firstModuleReady === true` 时启用按钮
- 卸载组件时清理 interval

**骨架屏动画**：Tailwind `animate-pulse` 或自定义 shimmer CSS（linear-gradient 左→右扫，2s 循环）

**完成状态**：`parse_status === 'done' && 全部模块 ready` 时，骨架屏全部变真实模块卡片；按钮文案从"开始阅读第一模块 →"变成"开始阅读 →"。

**跳转**：用户点按钮 → `router.replace(/books/${bookId}/reader)`（replace 不 push，避免返回键回到准备页）

### 3.3 流式揭示策略

**不使用 Next.js Suspense streaming**（无法与客户端 polling 结合，用纯客户端状态管理即可）。

**渐进揭示逻辑**：
- 初始：所有模块骨架屏
- Polling 更新：`modules[i].ready === true` → 该模块骨架变真实卡片（标题 + KP 数）
- 第一模块 ready → 按钮从灰色变 amber，文案"开始阅读第一模块 →"
- 全部 ready → 按钮文案"开始阅读 →"

**视觉过渡**：骨架卡片淡出 + 真实卡片淡入，300ms transition。

---

## 4. Infrastructure

### 4.1 R2 CORS 配置

**JSON 模板**（粘贴到 Cloudflare Dashboard → R2 → `<bucket>` → Settings → CORS Policy）：

```json
[
  {
    "AllowedOrigins": [
      "https://<production-domain>",
      "http://localhost:3000"
    ],
    "AllowedMethods": ["PUT", "HEAD"],
    "AllowedHeaders": ["Content-Type"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

**操作步骤（用户执行一次性）**：
1. 登录 Cloudflare Dashboard
2. 进入 R2 → 选中 production bucket（现有教材 PDF 存的那个）
3. Settings → CORS Policy
4. 粘贴 JSON，保存
5. 2-3 分钟生效

**字段说明**：
- `AllowedOrigins`：生产域名 + localhost（本地开发）
- `AllowedMethods`：`PUT`（presign 上传）+ `HEAD`（confirm 端点验证对象存在）
- `AllowedHeaders.Content-Type`：浏览器 PUT 时带的必填头
- `ExposeHeaders.ETag`：R2 返回的对象指纹（未来可用于重试幂等性校验）
- `MaxAgeSeconds`：3600（1 小时 preflight 缓存，减少 OPTIONS 请求）

### 4.2 Vercel Fluid Compute 确认

**操作步骤（用户执行一次性）**：
1. 登录 Vercel Dashboard
2. 进入项目 → Settings → Functions
3. 确认 "Fluid Compute" toggle 为 ON
4. 若未开启 → 手动启用（2025-04-23 后新项目默认 ON，旧项目需手动）

**验证**：项目 Deploy Log 应显示 `Runtime: Fluid`。

**重要性**：若 Fluid 未开，Hobby 默认 function timeout 是 10s，classify-pdf（14.2MB 估 30-60s）必然超时失败。这是 M4.5 的硬前置条件。

---

## 5. Error Handling

### 5.1 错误分类表

| 错误类型 | 触发点 | HTTP | 用户文案 | logAction action |
|---|---|---|---|---|
| 文件超限 | `/presign` schema 校验（size > 50MB） | 400 | 文件太大，请控制在 50MB 以内 | `book_upload_oversize` |
| 未登录 | `requireAuth` | 401 | 会话已过期，请刷新页面 | `book_upload_unauthorized` |
| 签发失败 | `/presign` R2/DB 异常 | 500 | 系统繁忙，请稍后重试 | `book_upload_presign_error` |
| 上传网络断 | XHR onerror / ontimeout | - | 网络中断，请点击重试 | `book_upload_network_error` |
| 签名过期 | PUT 返回 403 / SignatureDoesNotMatch | - | 网络太慢，请换个网络重试 | `book_upload_signature_expired` |
| R2 对象不存在 | `/confirm` HEAD 失败 | 400 | 上传不完整，请重试 | `book_upload_missing_object` |
| 已失败态 | `/confirm` 发现 upload_status=confirmed + parse_status=error | 409 | 上一次处理失败，请删除书重新上传 | `book_confirm_already_failed` |
| 处理失败（后端） | classify / extract fire-and-forget 挂 | - | 处理出错，请删除书重新上传 | `book_ocr_failed`（复用现有） |

### 5.2 实现细节

**前端状态机（按场景区分）**：

| 场景 | 页面 | 重试按钮动作 |
|---|---|---|
| presign / XHR PUT / confirm 阶段错误 | `/upload` | 重置状态机到 `idle`，保留已选文件和已填标题，用户点一下重新发起 |
| 已失败态（confirm 返回 409） | `/upload` | 文案 "上一次处理失败，请删除书重新上传"，按钮跳 `/books`（用户手动在书列表删后再 `/upload`） |
| 后端 classify/extract 挂（parseStatus=failed） | `/preparing` | 停止轮询，显示错误 + "重新上传"按钮 → `router.replace(/books)`（同上，用户手动删再重传） |

**后端日志**：
- 所有错误走 `await logAction(action, details, 'error')` 写入 logs 表
- `SENTRY_DSN` 环境变量已配，`@sentry/nextjs` 自动捕获未处理异常

**失败书清理**：
- MVP 不提供"自动重试本书"路径——已 INSERT 的书失败后由用户在书列表页手动删除，避免状态机复杂化
- 未来改成原地重试前提：confirm 端点需支持"重置 parse_status 重新跑 classify"，不在 M4.5 范围

### 5.3 不做的（明确 Out of Scope）

- ❌ 自动重试（用户误以为卡住）
- ❌ 独立第三方错误上报系统（Sentry 已够）
- ❌ 错误统计面板（M4.5 不涉及）

---

## 6. Testing

### 6.1 压测环境

- **生产 Vercel Hobby**（Fluid Compute ON）
- **真 Cloud Run**（非 mock）
- **真 R2**（非本地存储）
- **测试文件**：用户"最难啃骨头" 14.2MB / 369 页 Chinese 教材

理由：mock 数据不暴露真实延迟；本地 Docker 此机器未装（`feedback_no-local-docker-smoke.md`）。

### 6.2 功能通过标准

- [ ] 14.2MB / 369 页 Chinese 教材上传成功
- [ ] 进度条 0-100% 流畅显示，无卡顿
- [ ] `perceived 5s` 内跳准备页（从点击"开始智能学习"按钮到准备页首屏）
- [ ] `perceived 30s` 内第一模块就绪，"开始阅读第一模块 →"按钮亮起
- [ ] 点按钮进 `/books/[id]/reader`，PDF + 模块列表正常显示
- [ ] 第一模块触发 Q&A，AI 响应正常
- [ ] 教学模式切换 work（M4 paywall 正确显示 / 付费可用）

### 6.3 回归 checklist（既有功能不坏）

- [ ] TXT 小文件上传仍 work（老 `POST /api/books` TXT 分支）
- [ ] 小 PDF（<4.5MB）走新 presign → confirm 路径 OK
- [ ] M3 复习流程完整（`upload_status` 新列不破坏复习 query）
- [ ] M4 teaching 流程完整（教学页不受影响）
- [ ] `GET /api/books/[id]/pdf` 302 重定向仍 work

### 6.4 性能上限与 fallback

- **目标**：confirm 内 fire-and-forget 启动的 classify+extract 总时长 < 300 秒（Fluid 函数实例存活上限；超时后 Fluid 会杀进程，`parse_status='processing'` 永远不变）
- **可观测性**：准备页 polling `parseStatus === 'processing'` 超过 5 分钟不动 → 前端认定 stuck（用户在上面看到"卡住不动的进度条"），引导点击"重新上传"走 §5.2 失败清理
- **若撞顶**：决策 3 的 fallback plan
  - 方案：`classify-pdf` / `extract-text` 改 Cloud Run 本身 fire-and-forget（让 Cloud Run 在自己容器内跑完），完成后回调 Next.js `/api/internal/extract-done` 更新 DB
  - 现状：`ocr-pdf` 已用这种 pattern（`src/app/api/ocr/callback/route.ts`），新 callback 路由可仿此建
  - 工作量：1-2 天
  - 触发条件：14.2MB 压测实测 Fluid 函数总时长超 300s（且 classify 已是 Cloud Run 内跑，不是 Next.js 本地 pymupdf）

### 6.5 失败回滚

- `git revert` 相关 commits（presign、confirm、preparing 页、upload 页改造）
- `vercel rollback` 到上一个稳定 deployment
- DB migration **不需要回滚**：向后兼容，现有 books 已标 `upload_status='confirmed'`，不影响 M4 数据

---

## 7. Change List

### 7.1 新增文件

- `src/app/api/uploads/presign/route.ts` — Presigned URL 签发端点（决策 1，spec §2.1）
- `src/app/api/books/confirm/route.ts` — 上传完成 Confirm 端点（决策 3，spec §2.2）
- `src/app/books/[bookId]/preparing/page.tsx` — 准备页主组件（决策 5，spec §3.2）
- `src/app/books/[bookId]/preparing/loading.tsx` — Next.js App Router 初始骨架屏（spec §3.2）

### 7.2 调整文件

- `src/app/api/books/[bookId]/status/route.ts` — **已存在**，在现有响应上**追加** `bookId / uploadStatus / kpExtractionStatus / modules / progressPct / firstModuleReady / estimatedSecondsRemaining` 字段；旧字段（`parseStatus / ocrCurrentPage / ocrTotalPages / parse_status / kp_extraction_status / ocr_current_page / ocr_total_pages`）必须保留，ProcessingPoller 等旧消费方依赖（决策 5，spec §2.4）
- `src/app/api/books/route.ts` — PDF 分支删除（返回 400 引导到 presign），TXT 分支保留（决策 3，spec §2.3）
- `src/app/upload/page.tsx` — 重写"按按钮之后"的逻辑，视觉骨架不动，新增 PDF/TXT 分流（决策 4，spec §3.1）
- `src/lib/r2-client.ts` — 新增 `buildPresignedPutUrl(bookId)` 函数（内部用 `buildObjectKey(bookId)` 派生 key，不新增 key 格式约定）

### 7.3 数据库

- **Schema 文件**：`src/lib/schema.sql` 在 books 表定义后追加 `ALTER TABLE books ADD COLUMN IF NOT EXISTS upload_status ...` + `file_size` 两条幂等 DDL（与现有 `learning_mode` 加列模式一致，L27-28）
- **生产 migration**：Neon 执行 §1.2 的完整 migration 序列（先 NULL 默认 → 回填 'confirmed' → NOT NULL → DEFAULT 'pending' → CHECK）
  - 现有 books 回填 `upload_status='confirmed'`
  - 新书默认 `'pending'`
  - `file_size` 默认 0（现有 books 留 0；新书 presign 时 INSERT 写入请求中的 size）

### 7.4 依赖

- **新增**：`@aws-sdk/s3-request-presigner`（唯一新增依赖，用于 PUT presigned URL 签发）

### 7.5 基础设施（用户手动一次性操作）

- Cloudflare R2 CORS 配置（spec §4.1）
- Vercel Dashboard Fluid Compute toggle 确认（spec §4.2）

### 7.6 文档

- `docs/architecture.md` — 更新上传流程图 + 接口契约段（新增 presign / confirm 端点，status 端点字段扩展）
- `docs/changelog.md` — M4.5 完成时追加
- `docs/journal/INDEX.md` — 移除 `2026-04-19-pdf-upload-size-limit.md` 的 T2 停车场 pointer（M4.5 解决了这个阻塞）
- `CLAUDE.md`（如存在相关行）— 若有"Vercel Hobby 4.5MB 上限"之类的说明，M4.5 完成后删除

---

## 8. Out of Scope（M4.5 明确不做）

- OCR 技术替换（Gemini / Mistral / Claude native）→ 独立里程碑 benchmark
- classify-pdf / extract-text 改异步 callback → Fluid 300s 够用
- 拆短函数 → 300s 下不必要
- start-qa redirectUrl tech debt → 推 M5
- Vercel Pro 升级 → 推迟到抖音推广启动前

---

## Appendix · 决策 trail

保留 `2026-04-21-pdf-upload-refactor-brainstorm-state.md` 作长期决策 trail（拒绝方案 + 理由 + 调研溯源）。
