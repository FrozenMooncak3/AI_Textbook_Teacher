# M4.5 PDF 上传重构 + 准备页 UX · Brainstorm WIP

**创建日期**: 2026-04-21
**里程碑**: M4.5 MVP 全流程可用冲刺
**用途**: compact 防御——记录 brainstorm 进度，避免 session 断档丢失状态
**最终产出**: `docs/superpowers/specs/2026-04-21-pdf-upload-refactor-design.md`

> ⚠️ compact 后恢复时**先读这个文件**，不要从 summary 重建——summary 会丢细节。

---

## 基础设定（不会变）

### 产品不变量

- **验收场景**：用户上传 14.2MB / 369 页 Chinese 教材，**perceived 5 秒内**进入"正在准备"状态，**perceived 30 秒内**能开始读第一模块
- **Moat 硬约束继承自 M4**：`kp.type` / `kp.importance` / `kp.detailed_content` / `kp.ocr_quality` 服务端保留，UI / API 响应禁止暴露
- **CLAUDE.md 不变量不得动**：必须读完原文才进 Q&A / 已答不可修改 / 测试禁看笔记 / 过关线 80%

### 架构不变量（本 brainstorm 锁定）

1. **Presigned URL 直传 R2**——浏览器 PUT 直连 R2，不走 Vercel function body（Vercel KB 官方亲口推荐；解 4.5MB 阻塞）
2. **保持现 OCR pipeline**（pymupdf4llm + Google Vision + Claude KP）——所有替代方案调研后不可信 / 延迟过高 / 成本过高
3. **不升级 Vercel Pro**——推迟到抖音推广启动前一天（用户操作）
4. **不拆短函数、不改 classify-extract 异步架构**——Fluid Compute 300s 够用
5. **准备页 UX 栈定型**：骨架屏（shimmer 动画，形状匹配真实内容）+ 步骤指示器 + Next.js Suspense 流式揭示

### 工程约束

- **不动 src/** 非上传相关文件（避免引入 M4 回归）
- **不引入新依赖**除非必要（`@aws-sdk/s3-request-presigner` 可能是唯一新增）
- **DB migration 原则**：加列不删列；向后兼容

---

## 调研

- `docs/research/2026-04-20-pdf-upload-speed-options.md` 🔴 · 29S+11A+2B——4 维度 sub-agent 调研
  - D1 现架构性能基线：pymupdf4llm ~1s/页，369 页 ~360s 接近 Fluid 300s 顶
  - D2 OCR 替代方案：Gemini 延迟 3+min / Mistral 独立测试 45% 打脸 / Claude 4× 贵 → 全不换
  - D3 UX 层：Nielsen 0.1/1/10s / ACM 骨架屏论文 / Harrison CHI 2010 进度条 / Figma 渐进 / Next.js loading.tsx
  - D4 Vercel 超时：Fluid 300s 默认 / 4.5MB body 硬限 / Hobby TOS 禁商业 / Vercel 官方推荐直传对象存储

- `docs/journal/2026-04-19-pdf-upload-size-limit.md` · T2 停车场，修复思路 presigned URL 直传 R2

- `docs/architecture.md` · 现有 `GET /api/books/[id]/pdf` 已做 302 R2 presigned GET URL，**服务端已有 R2 signing 能力**，只需扩展到 PUT

---

## 已拍死的决策（不再讨论）

### 锚定决策 0：M4.5 Scope 范围（2026-04-21 拍板）

**决策**：M4.5 只做 4 件事——(A) Vercel Dashboard 确认 Fluid Compute toggle（用户 5 分钟） + (B) Presigned URL 直传 R2（Codex + Gemini） + (C) 准备页 UX 栈（Gemini） + (D) 14.2MB 真书端到端压测（用户 + Claude）。

**拒绝替代方案**：
- ❌ OCR 技术替换（Gemini / Mistral / Claude native）—— 独立里程碑 benchmark 再决
- ❌ classify-pdf / extract-text 改异步 callback —— Fluid 300s 够用，现在改是复杂度税
- ❌ 拆短函数 —— 300s 下不必要
- ❌ start-qa redirectUrl tech debt —— 前端已 workaround，推 M5
- ❌ Vercel Pro 升级 —— 推迟到抖音上线前（用户 2026-04-21 明确）

**理由**：
- "最难啃 14.2MB / 369 页"MVP 验收硬门槛，不解这个 4.5MB 卡点所有用户都失败
- 新 OCR 无一可信候选（调研 D2 详述）
- 每项改动最小化 M4 回归风险

---

### 决策 1：Presigned URL 端点契约（2026-04-21 拍板）

**决策**：
- 端点：`POST /api/uploads/presign`，`requireAuth` 保护
- 输入：`{ filename, size (≤50MB), contentType: "application/pdf" }`
- 流程：
  1. 校验 session + 文件大小 ≤50MB
  2. `INSERT books` 行（`upload_status='pending'`）→ 获得 bookId
  3. 生成 R2 PUT presigned URL（TTL 900 秒 / 15 分钟）
  4. 返回 `{ bookId, uploadUrl, objectKey }`

**关键产品选择：预创建 book 行**（对比延迟到 confirm 时创建）
- 前端立即拿到 bookId → `router.push(/books/[bookId]/preparing)` → 满足"perceived 5s 进准备页"硬验收
- 代价：上传失败会留孤儿行（`upload_status='pending'` 永不变），由决策 2 的 cron 清理

**技术细节（已定）**：
- 方法：PUT（S3 SDK 默认，R2 S3 兼容）
- Key 格式：`<bookId>/<uuid>.pdf`（沿用现有约定）
- TTL：15 分钟（覆盖极慢网 14.2MB 2-5 分钟上传 + 缓冲）
- 认证：复用现有 `requireAuth` middleware
- 新增依赖：`@aws-sdk/s3-request-presigner`（唯一引入）

**拒绝替代方案**：
- ❌ 延迟到 confirm 创建 book → 慢网 14.2MB 要 30-120 秒才拿得到 bookId，fail 5s 验收
- ❌ TTL 60 秒 → 14.2MB 极慢网传不完
- ❌ 独立 `upload_sessions` 表 → 过度工程，bookId + upload_status 就够追踪

---

## 待 brainstorm 的决策（按依赖顺序）

### 决策 2：Upload 状态追踪与 DB schema（2026-04-21 拍板）

**现状**（读 `src/lib/schema.sql` 得到）：
- `books.parse_status` / `books.kp_extraction_status` 已有（classify 和 KP 阶段，pending/running/done）
- `books.file_path` 已存 R2 object key
- 无"上传阶段"状态列，无 file_size

**决策**：新增 2 列，不新增表。

```sql
ALTER TABLE books ADD COLUMN upload_status TEXT NOT NULL DEFAULT 'pending'
  CHECK(upload_status IN ('pending', 'confirmed'));
ALTER TABLE books ADD COLUMN file_size BIGINT DEFAULT 0;
```

**状态语义**：
- `pending` → book 行刚 INSERT，浏览器还在 PUT R2（或已失败留孤儿）
- `confirmed` → confirm 端点校验 R2 对象存在，进入现有 `parse_status` 流程

**复用 `file_path`** 存 R2 object key（不新增 `object_key`，最小化代码变动）。

**向后兼容 migration**（现有 M4 books 不受影响）：
```sql
ALTER TABLE books ADD COLUMN upload_status TEXT DEFAULT NULL;
UPDATE books SET upload_status = 'confirmed' WHERE upload_status IS NULL;
ALTER TABLE books ALTER COLUMN upload_status SET NOT NULL;
ALTER TABLE books ALTER COLUMN upload_status SET DEFAULT 'pending';
ALTER TABLE books ADD CONSTRAINT books_upload_status_check
  CHECK(upload_status IN ('pending', 'confirmed'));
```

**孤儿行策略（MVP 简化）**：
- **不做自动清理**（Hobby 不值得加 cron 基础设施）
- **列表 query 加 filter** `WHERE upload_status='confirmed'`——用户 `GET /api/books` 看不到孤儿
- 未来孤儿堆积影响查询再加 cron

**拒绝替代方案**：
- ❌ 独立 `upload_sessions` 表 → 过度工程，bookId 已足够追踪
- ❌ 3 态枚举 `pending/uploaded/confirmed` → `uploaded` 是 client-only 状态，DB 不需要
- ❌ cron 自动清理 → MVP 不值当
- ❌ 前置状态挤进 `parse_status` → 语义污染，现有 classify 代码会错乱

---

### 决策 3：Confirm 端点 + 触发链（2026-04-21 拍板）

**决策**：

**新端点** `POST /api/books/confirm`，与现有 `POST /api/books` 分开：
```
Body: { bookId: number, title: string }

流程：
1. requireAuth
2. SELECT books WHERE id=? AND user_id=?（校验归属，防越权）
3. if upload_status === 'confirmed' → 幂等短路返回
4. HEAD R2 对象（file_path 查得）→ 防伪造 bookId 跳过上传
5. UPDATE books SET upload_status='confirmed', parse_status='processing', title=?
6. 复用现 POST /api/books 的 classify+extract 链路（L107-213 整段迁移）
7. 返回 { bookId, processing: true }
```

**老 `POST /api/books` 改造**：
- **PDF 分支删除**（ext === 'pdf' → 返回 400 "use /api/uploads/presign"）
- **TXT 分支保留**（.txt 内容 < 4.5MB，无压力）

**触发链保持现架构**（锚定决策 0 已锁）：
- classify sync + extract sync（Cloud Run await）
- ocr-pdf fire-and-forget（scanned 页）
- KP extract fire-and-forget（`triggerReadyModulesExtraction`）

**失败处理**：沿用 `markOcrFailure` → `parse_status='error'`。准备页轮询见到 error 显示错误 + 重试按钮（文案决策 7 补）。

**⚠️ 已知风险（留给决策 8 压测验证）**：
14.2MB / 369 页 pure text PDF 的 classify+extract sync 链路理论上接近 Fluid 300s。
- 乐观（平均 0.3-0.5 s/页）→ 3 分钟内搞定
- 悲观（最坏 1 s/页）→ 369s 撞 300s 上限
- **MVP 策略**：先按此方案跑，14.2MB 真书压测验证。若撞墙 revisit 决策 0，把 extract 改 fire-and-forget + Cloud Run 回调（额外 1-2 天）

**拒绝替代方案**：
- ❌ 扩展 `POST /api/books` 加 `mode` 参数 → 分支臃肿
- ❌ confirm 不做 HEAD R2 直接信任前端 → 用户可伪造 bookId 触发 classify
- ❌ MVP 阶段提前改异步 → 复杂度翻倍，大概率用不上
- ❌ confirm 只翻状态不触发 classify（让独立 cron 触发）→ 多一次 round-trip 没必要

---

### 决策 4：前端上传组件（2026-04-21 拍板）

**决策**：改现有 `src/app/upload/page.tsx`，视觉骨架不动，重写"按按钮之后"的逻辑。

**状态机**：
```
idle           (选文件)
→ signing      (调 /api/uploads/presign)
→ uploading(%) (XHR PUT R2，onprogress 事件)
→ confirming   (调 /api/books/confirm)
→ redirecting  (router.push /books/[id]/preparing)
→ error        (任一阶段挂)
```

**上传方式**：XMLHttpRequest + `upload.onprogress`（fetch 无原生进度事件）。

**UI 差异**：
- 进度条 + "正在上传 {pct}%" 文案（14.2MB 慢网要 30-120 秒，无进度 = 用户以为卡死）
- `confirming` 状态文案 "整理中，马上好..."
- `error` 状态显示"重试"按钮（不自动重试，不加取消）
- 完成后跳转目标：`/books/[id]/preparing`（非 `/reader`）

**拒绝替代方案**：
- ❌ 自动重试 → 用户看不出是自动还是卡住，徒增困惑
- ❌ 加取消按钮 → 状态管理复杂度 3 倍，MVP 不值得
- ❌ 新建上传页 → 现有组件库 + 视觉骨架成熟，无必要重做
- ❌ fetch + ReadableStream → fetch 无原生进度，hack 成本高；XHR 老技术但是进度领域的专业工具

**关键历史教训**（2026-04-21 用户复盘）：
用户 Opus 4.6 时期多次请求进度条被 Claude 以 "MVP minimum" 否决。事实证明 14.2MB 慢网场景进度条是必须的。存 feedback memory `feedback_ux-user-signal.md` 防再犯。

---

### 决策 5：准备页结构（2026-04-21 拍板）

**决策**：

**路由**：新建 `/books/[bookId]/preparing`，不复用 `/reader` 条件渲染。处理完 `router.replace` 到 `/reader`（避免返回键回到准备页）。

**状态获取**：polling（每 2 秒 `GET /api/books/[bookId]/status`）。SSE 在 Vercel serverless 连接管理复杂，不值当。

**骨架屏**：
- 顶部：书名（用户填）+ 大字"正在为你准备这本书"
- 进度条：整本书完成度 0-100%（`parse_status / kp_extraction_status / 模块就绪数` 综合）
- 中部：模块卡片骨架 5-8 个，shimmer 左→右扫（符合中文阅读方向）
- 进度文案动态变化（上传完 → classify → 模块切分 → KP 提取）

**流式揭示（关键产品决策）**：
- 第一模块 KP 提取完成 → 解锁"开始阅读第一模块 →"按钮
- 理由：硬验收"perceived 30s 内开始读"，整本 3-5 分钟处理不允许等到全部完成
- 按钮初始灰色禁用 "准备中..."，第一模块就绪后变 amber 主色 "开始阅读第一模块 →"

**跳转方式**：**用户点按钮跳**，不自动跳。
- 理由：自动跳失控感强；手动有"我要开始学了"心理过渡；用户可临时离开去做别的事

**`GET /api/books/[bookId]/status` 返回结构**：
```ts
{
  bookId: number,
  uploadStatus: 'pending' | 'confirmed',
  parseStatus: 'pending' | 'processing' | 'done' | 'error',
  kpExtractionStatus: 'pending' | 'running' | 'done' | 'error',
  modules: [
    { id, orderIndex, title, kpExtractionStatus, ready: boolean }
  ],
  progressPct: number, // 综合计算，0-100
  firstModuleReady: boolean, // 第一模块 KP done 时为 true，解锁按钮
  estimatedSecondsRemaining: number | null
}
```

**拒绝替代方案**：
- ❌ 全部模块就绪才解锁 → fail "perceived 30s" 验收
- ❌ 自动跳转 → 用户失控感
- ❌ SSE 流式推送 → Vercel serverless 冷启动/超时/重连复杂
- ❌ 纯 loading 圈圈无细节 → 等几分钟看圈圈转太痛苦
- ❌ 复用 `/reader` 条件渲染 → 代码臃肿难维护

---

### 决策 6：R2 CORS 配置（2026-04-21 拍板）

**JSON 配置**：
```json
[
  {
    "AllowedOrigins": ["https://<production-domain>", "http://localhost:3000"],
    "AllowedMethods": ["PUT", "HEAD"],
    "AllowedHeaders": ["Content-Type"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

**操作主体**：用户登录 Cloudflare Dashboard 手动配置（R2 bucket → Settings → CORS Policy）。spec §4.1 写步骤文档。

**拒绝**：
- ❌ 脚本自动配 CORS → 首次引入 Cloudflare API 的复杂度，一次性操作不值当

### 决策 7：错误处理策略（2026-04-21 拍板）

**错误分类 + 中文文案**（详表见 spec §5）：

| 错误 | 用户文案 |
|---|---|
| 文件超 50MB | 文件太大，请控制在 50MB 以内 |
| 登录过期 | 会话已过期，请刷新页面 |
| 上传网络断 | 网络中断，请点击重试 |
| 15 分钟传不完 | 网络太慢，请换个网络重试 |
| 服务器处理挂 | 处理出错，请重试上传 |
| R2 对象对不上 | 上传不完整，请重试 |

**日志**：`logAction('book_upload_error', details, 'error')` 写 logs 表 + Sentry（已接）

**不做**：
- ❌ 自动重试 → 用户误以为卡住
- ❌ 独立第三方错误上报 → Sentry 已够

### 决策 8：14.2MB 端到端测试 checklist（2026-04-21 拍板）

**压测环境**：生产 Vercel Hobby（Fluid Compute ON）+ 真 Cloud Run + 真 R2

**功能通过标准**：
- [ ] 14.2MB / 369 页上传成功（进度条 0-100% 流畅）
- [ ] perceived 5s 跳准备页
- [ ] perceived 30s 第一模块就绪，按钮亮起
- [ ] 点按钮进 reader，Q&A 可触发
- [ ] 教学模式切换正常（M4 paywall 验证）

**回归 checklist**：
- [ ] TXT 小文件上传 work
- [ ] 小 PDF（<4.5MB）走新路径 OK
- [ ] M3 复习流程完整
- [ ] M4 teaching 流程完整

**性能上限**：处理总时长 <300 秒（Fluid 顶）。撞顶走决策 3 fallback：extract 改 fire-and-forget（额外 1-2 天）。

**失败回滚**：`git revert` + `vercel rollback`（向后兼容 migration 无需回滚）

**拒绝**：
- ❌ mock data 压测 → 不暴露真实延迟
- ❌ 本地 Docker 压测 → 用户机器无 Docker（见 `feedback_no-local-docker-smoke.md`）

---

## 当前进度

- ✅ 锚定决策 0：M4.5 Scope 范围
- ✅ 决策 1：Presigned URL 端点契约
- ✅ 决策 2：Upload 状态追踪与 DB schema
- ✅ 决策 3：Confirm 端点 + 触发链
- ✅ 决策 4：前端上传组件
- ✅ 决策 5：准备页结构
- ✅ 决策 6：R2 CORS 配置
- ✅ 决策 7：错误处理策略
- ✅ 决策 8：14.2MB 端到端测试 checklist
- 🎯 全部决策完成，进入 spec 完整性自检 + review loop

---

## 最终产出

完成后：
1. 所有决策固化到 `docs/superpowers/specs/2026-04-21-pdf-upload-refactor-design.md`（dual-write per BS-1 7b）
2. Spec review loop 通过
3. 用户批准 spec
4. 调 writing-plans skill 生成实现计划
5. 本 WIP 文件保留作决策 trail
6. 删除 MEMORY.md 临时 pointer
7. 更新 `docs/project_status.md` M4.5 启动
