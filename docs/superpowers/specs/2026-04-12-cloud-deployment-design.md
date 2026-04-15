# 云部署里程碑 · Design Spec

**立项日期**：2026-04-12
**Brainstorm 完成**：2026-04-15（10 决策 + 2 附加决策全部拍板）
**定位**：基础设施里程碑（不加新功能），与功能里程碑（教学系统、留存机制）并列
**WIP 历史**：`docs/superpowers/specs/2026-04-12-cloud-deployment-brainstorm-state.md`

---

## 1. 背景与目标

### 1.1 为什么立项

产品负责人非技术，本地测试每次踩环境坑（Docker / Python 依赖 / OCR 模型加载 / 多端口调试），"测试等于痛苦"严重拖慢产品迭代。对比行业：

| 模式 | 典型代表 | 是否适用 |
|---|---|---|
| 本地 + staging + 生产 + QA 团队 | 大公司 | 否（人手不够） |
| 本地 + 生产 | 小团队 | 当前状态（就是痛苦源） |
| 只有云环境 | 独立开发者 | **选定方向** |

产品负责人拍板："推代码到 Git → 自动部署到云 → 浏览器打开测。"

### 1.2 目标

完成本里程碑后：
1. 本地不跑任何服务，只写代码
2. push master → Vercel + Cloud Run 自动部署
3. push feature branch → 自动 preview 环境 + Neon DB branch
4. 后续功能里程碑（教学系统 / 留存机制）的测试成本大幅降低

### 1.3 非目标（YAGNI）

- 不做国内版主 App（走第三方平台承接，见附加决策 B）
- 不做多区域 / 多活部署（MVP 单区域够用）
- 不做容量规划 / load test（MVP 量级用免费层）
- 不做 staging 环境（Vercel preview + Neon branch 已等价）

---

## 2. 10 个核心决策汇总

> 每个决策的完整调研记录见 `docs/research/`（共 7 份）和 WIP state 文件的"已拍的决策"区。

| 决策 | 拍定 | 月费 | 关键文件 / 调研 |
|---|---|---|---|
| 1. OCR 处理方式 | **Google Cloud Vision** + Python 服务器瘦身（保留） | $0（MVP 免费层） | `research/2026-04-14-cloud-ocr-options.md` |
| 2. Next.js 部署平台 | **Vercel Hobby** | $0 | `research/2026-04-14-cloud-deployment-platform-options.md` |
| 3. Python 服务器平台 | **Google Cloud Run** | $0（永久免费层） | `research/2026-04-14-cloud-python-server-options.md` |
| 4. PDF 文件存储 | **Cloudflare R2** | $0（免费层 + egress 永久免费） | `research/2026-04-14-cloud-object-storage-options.md` |
| 5. 环境分离 | **生产 + Vercel preview + Neon DB branch**（方案 B2） | $0 | state file（概念级） |
| 6. CI/CD | **Cloud Run Continuous Deployment（UI 绑 GitHub）** | $0 | `research/2026-04-14-cloud-cicd-options.md` |
| 7. Secrets 管理 | **平台 env vars（Vercel + Cloud Run 各自配）**，不引入第三方 | $0 | `research/2026-04-15-cloud-secrets-options.md` |
| 8. 域名与 HTTPS | **自购 `.com` at Cloudflare Registrar** + DNS 分别指 Vercel/Cloud Run，不开代理 | ~$0.87/月（$10.46/年 / 12） | `research/2026-04-15-cloud-domain-https-options.md` |
| 9. 监控与错误追踪 | **Sentry + Vercel Analytics（built-in）** | $0 | state file（🟡 轻量） |
| 10. 分阶段实施 | **3 阶段拆分** | — | state file（🟡 轻量） |

**总月费预估**：~$0.87/月（全部在免费层内 + `.com` 年费）

### 2.1 附加决策 A：架构预留国内版分区能力（硬约束）

后续所有实施必须保持以下 4 条可切换：

| 维度 | 海外版 | 未来国内版 | 当前状态 |
|---|---|---|---|
| DB 连接 | Neon Postgres | 阿里云 RDS / 腾讯云 CDB | `DATABASE_URL` 已配置化 ✅ |
| 文件存储 | Cloudflare R2（S3 API） | 阿里云 OSS / 腾讯云 COS（都兼容 S3） | R2 用 `@aws-sdk/client-s3`，选型已对齐 ✅ |
| OCR provider | Google Vision | 阿里云 OCR / 腾讯云 OCR / PaddleOCR | `OCR_PROVIDER` 抽象已在 Scanned PDF T4 实现 ✅ |
| 前端 i18n | `next-intl` 或等价 | 纯中文版 | 待实施（非本里程碑范围） |

### 2.2 附加决策 B：国内链路策略（MVP 完成后启动）

- 不自建国内站主 App
- 众筹走摩点 / 开始吧，候补走微信公众号，内容走小红书 / 视频号
- 演示页用录屏视频 + 截图（不接真 API）
- 卖点是"支持 + 抢先体验权益 + 共创资格"，不承诺立即稳定使用完整版

---

## 3. 目标架构（to-be）

```
                    ┌─────────────────────────────────────┐
                    │    Cloudflare Registrar (.com)      │
                    │        + Cloudflare DNS             │
                    │      (灰色云，仅解析不代理)          │
                    └────────────┬────────────────────────┘
                                 │
                ┌────────────────┴────────────────┐
                │                                  │
         ┌──────▼───────┐                 ┌────────▼──────────┐
         │ brand.com    │                 │ api.brand.com     │
         │ www.brand.com│                 │ (Cloud Run        │
         │ (Vercel)     │                 │  Preview custom   │
         │              │                 │  domain)          │
         └──────┬───────┘                 └────────┬──────────┘
                │                                  │
         ┌──────▼───────────┐             ┌────────▼──────────┐
         │ Next.js 15 App   │             │ Python OCR Server │
         │ (Hobby plan)     │             │ (scale-to-zero)   │
         │ + Analytics      │             │ + Sentry          │
         │ + Sentry         │             │                   │
         └──────┬─────┬─────┘             └───────┬───────────┘
                │     │                           │
        ┌───────┘     └──────┐                    │
        │                    │                    │
 ┌──────▼──────┐      ┌──────▼────────┐    ┌──────▼────────┐
 │ Neon        │      │ Cloudflare R2 │◄───┤ Google Vision │
 │ Postgres    │      │ (PDF storage) │    │ API (OCR)     │
 │ + Vercel    │      │ S3 标准 API   │    │               │
 │ Integration │      │ egress 0 费   │    │               │
 │ (DB branch  │      │               │    │               │
 │  per PR)    │      │               │    │               │
 └─────────────┘      └───────────────┘    └───────────────┘

  CI/CD：
  - Vercel: push master → 自动部署生产 / push feature → 自动 preview
  - Cloud Run: UI 绑 GitHub + includedFiles=scripts/**,Dockerfile* → 自动 build + deploy
```

### 3.1 组件职责清单

| 组件 | 职责 | 运行位置 |
|---|---|---|
| Next.js App | 用户界面 + 业务 API + DB 读写 + 调 OCR server | Vercel |
| Python OCR Server | PDF 分类（pymupdf）+ 文字页提取（pymupdf4llm）+ 扫描页 OCR（Google Vision） | Cloud Run |
| Neon Postgres | 用户数据 + 书/模块/KP/QA/测试 | Neon（海外区） |
| Cloudflare R2 | PDF 原件存储 + 预签名 URL 分发 | Cloudflare |
| Google Vision API | 扫描页 OCR 引擎 | Google（同 Cloud Run 区域，低延迟） |
| Sentry | 错误追踪（Next.js + Python 两端） | Sentry SaaS |
| Vercel Analytics | 流量 + Web Vitals（built-in，不加 SDK） | Vercel |

### 3.2 数据流

**用户上传 PDF**：
1. 浏览器 → Next.js API `/api/books/upload`
2. Next.js 后端 → R2（用 `@aws-sdk/client-s3` PUT 对象）
3. Next.js 后端 → Neon（写 book 记录，存 R2 object key）
4. Next.js 后端返回 book ID + status=processing

**OCR 处理（后台触发）**：
1. Next.js API `/api/books/[id]/extract` 发起 OCR 任务
2. Next.js 后端 → Cloud Run OCR server（Bearer token 鉴权，body 带 R2 object key）
3. Cloud Run OCR server → R2（预签名 URL 下载 PDF）
4. Cloud Run OCR server 内部：pymupdf 分类 → 文字页 pymupdf4llm 提取 → 扫描页 Google Vision API
5. Cloud Run OCR server → POST 回调 `https://<brand>.com/api/ocr/callback`（进度更新、单页结果、模块完成三种 event）
6. Next.js callback 端点 → Neon（写入 OCR 结果 + 更新模块状态）

**截图问 AI（同步调用）**：
1. 浏览器 → Next.js `/api/books/[bookId]/screenshot-ocr`（带 PNG buffer）
2. Next.js 把 buffer 转 base64 → POST Cloud Run `/ocr`（Bearer token + `{image_base64: "..."}`）
3. Cloud Run 调 Google Vision 同步返回 text
4. Next.js 返回 text 给前端

### 3.3 OCR 完成后数据回流：采用 (b) 回调 Next.js 写 DB

**决策**（2026-04-15 spec review 阶段定）：Cloud Run OCR 完成后，**POST 回调 Next.js API 由 Next.js 写 Neon**，Cloud Run 不持有 `DATABASE_URL`。

**决策链**：
1. 决策 7 的 Cloud Run SA 最小权限原则只授予 "Cloud Vision AI User" + "Artifact Registry Reader"，不授 DB 访问权
2. 单向数据流（Cloud Run → Next.js → Neon）减少 schema 变更时的双端同步负担
3. Next.js 侧已有 DB 访问基础设施（`pg` 连接池、事务、错误处理），复用即可
4. Cloud Run → Next.js 的鉴权用同一个 `OCR_SERVER_TOKEN`（双向共享，简化 secrets 管理）

**含义（工作量影响，阶段 2 plan 需反映）**：
- `scripts/ocr_server.py` 中现有的 4 个直写 Neon 函数必须**删除并迁移**到 Next.js callback 端点：
  - `update_ocr_progress`
  - `write_ocr_result`
  - `replace_page_placeholder`
  - `check_module_ocr_completion`
- Python 侧改为：OCR 完成/进度变化时 POST 到 `NEXT_CALLBACK_URL`（/api/ocr/callback）
- Next.js 侧新建 `src/app/api/ocr/callback/route.ts` 接收回调并 Bearer token 鉴权

### 3.4 API 端点契约修正（spec review 发现）

现有 Python 端点（`scripts/ocr_server.py`）接受 `pdf_path`（本地文件路径），需要改造为接受 `r2_object_key` 并在 Cloud Run 内部从 R2 下载：

| 端点 | 现在接受 | 改造后接受 |
|---|---|---|
| `/classify-pdf` | `{pdf_path: "..."}` | `{r2_object_key: "..."}` |
| `/extract-text` | `{pdf_path: "..."}` | `{r2_object_key: "..."}` |
| `/ocr-pdf` | `{pdf_path: "..."}` | `{r2_object_key: "..."}` |
| `/ocr`（截图 OCR） | `{image_path: "..."}`（本地 tmpdir 路径） | `{image_base64: "..."}`（base64 inline，截图通常 <1MB） |

**为什么 `/ocr` 用 base64 而非 R2**：截图是一次性内容，不值得上传到 R2 再清理；base64 对 <1MB 图片在 HTTP body 里完全合理。

**Python 侧新增依赖**：`@aws-sdk/client-s3` 不适用（Python 生态），改用 `boto3` 或直接 `requests` 调 R2 预签名 URL。推荐 `boto3`（S3 兼容，官方维护）。

---

## 4. 阶段划分（决策 10 展开）

### 4.1 阶段 1：数据层上云（预估 1-2 天 Codex 工作量）

**范围**：R2 + Neon + Vercel 首次部署

**关键工作**：
1. R2 bucket 创建 + API token 配置（bucket scope 权限，见决策 7 安全红线 3）
2. `src/lib/uploads.ts` 重写：本地文件路径 → `@aws-sdk/client-s3` PUT + GET（预签名 URL）
3. Python OCR server 读取路径调整（从本地卷 → R2 预签名 URL 下载）
4. Neon Vercel Integration 装上（产品负责人登 Neon dashboard 操作约 15-20 分钟）
5. Vercel 项目初始化 + 首次部署（跑在 `xxx.vercel.app`）
6. Vercel env vars 配置（按决策 7 清单，敏感项勾 Sensitive）

**验收标准**：
- [ ] 本地开发机能 push → Vercel 自动部署
- [ ] `xxx.vercel.app` 可访问，登录/上传 PDF 功能正常
- [ ] PDF 上传后能存到 R2（dashboard 可见 object）
- [ ] 数据写入 Neon 生产 branch（SQL 客户端可查）
- [ ] 开 feature branch push 后 Vercel 自动起 preview + Neon 自动开新 DB branch
- [ ] PDF reader（`react-pdf-viewer`）能正常加载 PDF：`/api/books/[bookId]/pdf` 返回 302 → R2 预签名 URL，浏览器可跟随

**变更清单**（spec review 修正 2026-04-15）：
| 文件 | 操作 | 负责方 |
|---|---|---|
| `src/lib/r2-client.ts` | **新建**（R2 S3 SDK helper + 预签名 URL 生成） | Codex |
| `src/app/api/books/route.ts` | **重构** lines 90-92（`writeFile`/`mkdir` → R2 PUT）+ `UPLOADS_DIR` 常量删除 | Codex |
| `src/app/api/books/[bookId]/pdf/route.ts` | **重构**：从 `data/uploads/${id}.pdf` 本地读 → 改为 302 redirect 到 R2 预签名 URL | Codex |
| `src/lib/db.ts` | 无需改（DATABASE_URL env 自动切） | — |
| `package.json` | 加 `@aws-sdk/client-s3` / `@aws-sdk/s3-request-presigner` | Codex |
| **Codex 首任务 verify** | 确认 `SESSION_SECRET` env var 名称与 `src/lib/auth.ts` 一致（spec review flag） | Codex |
| Vercel 项目 | 初始化 + env vars 配置 | 产品负责人 + Claude 指导 |
| Neon Vercel Integration | 首次装（Neon Console → Vercel Integration tab，一键 UI） | 产品负责人 |
| Cloudflare R2 bucket + token | 首次创建（bucket-scope token，决策 7 安全红线 3） | 产品负责人 |

**不在阶段 1 范围内但会在阶段 2 影响 OCR 端的**（提前说明，避免混淆）：
- `src/app/api/books/[bookId]/screenshot-ocr/route.ts`：当前写本地 tmpdir 发 OCR，**阶段 2** 改为 base64 inline（见 3.4）
- `src/lib/screenshot-ocr.ts`：`ocrImage` 函数签名和调用方式**阶段 2** 调整

### 4.2 阶段 2：OCR 上云（预估 1-2 天 Codex 工作量）

**范围**：Python server 改引擎 + Cloud Run 部署 + CD 配置

**关键工作**：
1. `scripts/ocr_server.py` OCR provider 切到 Google Vision（`OCR_PROVIDER=google`）
2. `scripts/Dockerfile` 瘦身（去 PaddleOCR 模型 + 依赖，镜像 1GB+ → 400-800MB）
3. Cloud Run service 首次手动部署测试（`gcloud run deploy --source .`）
4. Cloud Run 服务账号（SA）配置 + IAM 授权（Vision User / Artifact Registry Reader，最小权限红线 2）
5. Cloud Run CD UI 绑 GitHub（includedFiles: `scripts/**,Dockerfile*`）
6. Next.js → Cloud Run 调用加 Bearer token（`OCR_SERVER_TOKEN`）
7. 阶段 1 留的 ⚠️ 数据回流问题（3.3）最终定方案并实施

**验收标准**：
- [ ] push `scripts/*.py` 或 `Dockerfile.ocr` 后 Cloud Run 自动 build + deploy（Cloud Build 历史可见）
- [ ] push 前端代码（非上述路径）Cloud Build **不触发**（验证 includedFiles 过滤）
- [ ] Cloud Run OCR server 能接收 `api.<临时 Cloud Run 默认域名>.run.app` 请求
- [ ] 扫描 PDF 端到端：上传 → 后台 OCR → 模块可阅读（推迟已久的云环境实测终于可做）
- [ ] 无 `OCR_SERVER_TOKEN` 的请求被 401 拒绝
- [ ] Google Vision 调用无报 401 / 403（SA 凭据 ADC 正常）
- [ ] `/api/ocr/callback` 能接收 Cloud Run 回调并写入 Neon（3 个 event 类型都验证：`progress`、`page_result`、`module_complete`）
- [ ] `mixed_count` bug 修复：`src/app/api/books/route.ts` 的 `nonTextPages` 不再 NaN
- [ ] 截图 OCR（`/ocr` 端点）base64 路径可用
- [ ] 全量 OCR 端点改为接受 `r2_object_key`（旧的 `pdf_path` 已废弃）

**进入阶段 2 的前置条件**：
- 阶段 1 所有验收标准 passed
- 3.3 回调方案（b）的决策不变（本 spec 已定，无需重新讨论）

**变更清单**（spec review 修正 2026-04-15）：
| 文件 | 操作 | 负责方 |
|---|---|---|
| `scripts/ocr_server.py` | **多项改动**：① 4 个端点从 `pdf_path` → `r2_object_key`（用 boto3 从 R2 下载到临时文件再跑现有逻辑）；② `/ocr` 端点从 `image_path` → `image_base64`；③ 加 Bearer token 鉴权中间件；④ 删除 `update_ocr_progress`/`write_ocr_result`/`replace_page_placeholder`/`check_module_ocr_completion` 4 个直写 Neon 函数；⑤ 改为 POST 回调到 `NEXT_CALLBACK_URL`；⑥ **修 `mixed_count` bug**：返回值增加 `mixed_count` 字段（或让 `src/app/api/books/route.ts` 不再解构它）；⑦ 默认 `OCR_PROVIDER=google`，**删除 PaddleOCR fallback**（lines 164-166） | Codex |
| `Dockerfile.ocr`（repo 根，**不是** `scripts/Dockerfile`）| 瘦身：line 6 的 `pip install` 去掉 `paddlepaddle paddleocr`，加 `google-cloud-vision sentry-sdk boto3 requests` | Codex |
| `src/app/api/books/route.ts` | **多处改动**：① lines 113/131/166 的 OCR fetch 加 `Authorization: Bearer ${OCR_SERVER_TOKEN}` header + body 改为 `r2_object_key`；② lines 124-129 `mixed_count` 解构处修 bug（与 Python 端返回值匹配） | Codex |
| `src/lib/screenshot-ocr.ts` | `ocrImage(tempImagePath)` → `ocrImage(imageBuffer)`（内部转 base64 + 发 JSON body + 加 Bearer token）；调用方同步改 | Codex |
| `src/app/api/books/[bookId]/screenshot-ocr/route.ts` | 删除本地 `tmpdir()` 写文件逻辑，直接把 buffer 传给 `ocrImage()` | Codex |
| `src/app/api/ocr/callback/route.ts` | **新建**：接收 Cloud Run 回调，Bearer token 鉴权，写 Neon（复用 `scripts/ocr_server.py` 删掉的 4 个函数的逻辑，移植为 TS） | Codex |
| env var 废弃 | `OCR_SERVER_HOST` + `OCR_SERVER_PORT` 统一废除，只用 `OCR_SERVER_URL`（影响 `src/app/api/books/route.ts:108-109` + `src/lib/screenshot-ocr.ts:4-5`） | Codex |
| Cloud Run service + SA | 首次创建 + IAM（只授 Vision User + Artifact Registry Reader） | 产品负责人 + Claude 指导 |
| Cloud Run CD（UI 绑 GitHub） | 首次配置（`includedFiles: scripts/**,Dockerfile.ocr`） | 产品负责人 |

### 4.3 阶段 3：域名 / 监控 / 收尾（预估半天-1 天）

**范围**：域名接入 + Sentry 集成 + secrets 安全红线落实

**关键工作**：
1. 品牌名确定（产品负责人选，WHOIS + US 商标网 + 中国商标网查重）
2. Cloudflare Registrar 注册 `<brand>.com`
3. Cloudflare DNS 配置（灰色云纯解析）：
   - A 记录 `@` → `76.76.21.21`（Vercel apex）
   - CNAME `www` → `cname.vercel-dns.com`
   - CNAME `api` → Cloud Run 给的目标
4. Vercel 项目加自定义域 + Cloud Run 加自定义域（`api.<brand>.com`）
5. Sentry 两端集成：
   - Next.js: `@sentry/nextjs` + wizard 配置
   - Python: `sentry-sdk` + `sentry_sdk.init()`
6. Secrets 安全红线 4 项审查：
   - Vercel 敏感 secrets 勾 "Sensitive"
   - Cloud Run SA 权限复核（只保留 Vision User + Artifact Registry Reader）
   - R2 token 权限复核（bucket scope + Object Read & Write）
   - 全量 secrets 同步到密码管理器

**验收标准**：
- [ ] `https://<brand>.com` 可访问（HTTPS 正常，SSL 证书有效）
- [ ] `https://api.<brand>.com` 可接收 OCR 请求（HTTPS 正常）
- [ ] Sentry 能捕获测试错误（主动在代码里抛 Error 验证）
- [ ] Vercel Analytics dashboard 能看到访问量
- [ ] 密码管理器里有完整 secrets 清单
- [ ] 所有安全红线 4 项 checked

**变更清单**（spec review 修正 2026-04-15）：
| 文件 | 操作 | 负责方 |
|---|---|---|
| `package.json` | 加 `@sentry/nextjs` | Codex |
| `Dockerfile.ocr` | line 6 `pip install` 追加 `sentry-sdk`（若阶段 2 已加则此步跳过） | Codex |
| `scripts/ocr_server.py` | `sentry_sdk.init(dsn=os.getenv("SENTRY_DSN"))` 启动时调用 | Codex |
| `sentry.client.config.ts` | **新建**（Sentry wizard 生成） | Codex |
| `sentry.server.config.ts` | **新建**（Sentry wizard 生成） | Codex |
| `sentry.edge.config.ts` | **新建**（Sentry wizard 生成） | Codex |
| `next.config.ts` | wizard 包 Sentry 构建插件（`withSentryConfig`） | Codex |
| `instrumentation.ts` | **新建**（wizard 生成，Next.js 15 入口） | Codex |
| Cloudflare Registrar / DNS | 首次配置 | 产品负责人 |
| Vercel / Cloud Run 自定义域名 | 首次配置 | 产品负责人 |
| Sentry 账号 / 项目 | 首次创建 | 产品负责人 |
| 密码管理器备份 | 整理录入 | 产品负责人 |

---

## 5. 风险与回滚

### 5.1 识别的风险

| 风险 | 可能性 | 影响 | 缓解 |
|---|---|---|---|
| Google Vision 中文 / 公式识别不达标 | 中 | 需换 OCR provider | `OCR_PROVIDER` 抽象已做，切 Mistral OCR 约半天 |
| Cloud Run 自定义域名 Preview 状态突变 | 低 | api 子域临时不可用 | 回滚到 `xxx.run.app` + Vercel rewrite 代理（临时方案） |
| R2 egress 免费承诺政策变化 | 低 | 账单暴涨 | 切 Backblaze B2（同 S3 API，代码层 endpoint 改一个变量） |
| Neon 免费 10 branch 被占满 | 低 | 新 preview 起不来 | 定期清理旧 feature branch（自动销毁已做） |
| Vercel Hobby 带宽超限（100GB/月） | 低（MVP 远低） | 需升 Pro $20/月 | 按实际监控调整 |
| Sentry 免费层限额突变 | 低 | 错误采集被截断 | 只发 error 级别，不发 info（减少量） |
| Cloud Run 冷启动影响用户体验 | 中（15 分钟空闲后） | 首次 OCR 延迟 1-2 秒 | UI 已有"处理中"状态，用户无感 |
| 附加决策 A 被后续实施违反 | 中 | 未来国内版无法分区 | 本 spec 第 2.1 明确清单，所有 PR 自审 |

### 5.2 回滚路径

**阶段 1 回滚**：
- Vercel 项目未删除前，本地仍可跑旧 Docker Compose
- R2 数据不回滚（只是多存一份）
- Neon 数据库保留（`DATABASE_URL` 切回本地即可）

**阶段 2 回滚**：
- Cloud Run revision 保留历史，Console 一键切流量到旧版本
- 回滚到本地 Python server：Next.js 的 `OCR_SERVER_URL` env var 切回 localhost

**阶段 3 回滚**：
- 域名不续费即过期（不影响 `xxx.vercel.app` 继续工作）
- Sentry 卸 SDK 即可，不影响功能

---

## 6. 代码契约（对 architecture.md 的增量）

以下新增约束将在实施完成时补充到 `docs/architecture.md` 部署架构 section：

### 6.1 环境变量总览

**Vercel 侧**（Next.js App）：
```
DATABASE_URL              # Neon Integration 自动注入，不手配
ANTHROPIC_API_KEY         # Sensitive
AI_MODEL                  # 如 anthropic:claude-sonnet-4-6
R2_ACCOUNT_ID             # Sensitive
R2_ACCESS_KEY_ID          # Sensitive
R2_SECRET_ACCESS_KEY      # Sensitive
R2_BUCKET                 # ai-textbook-pdfs
OCR_SERVER_URL            # https://api.<brand>.com（废弃旧的 OCR_SERVER_HOST/PORT）
OCR_SERVER_TOKEN          # Sensitive（双向共享，Vercel→Cloud Run 和 Cloud Run→Vercel 回调都用此）
SENTRY_DSN                # 可非 Sensitive
SENTRY_AUTH_TOKEN         # Sensitive（CI 上传 sourcemap 用）
SESSION_SECRET            # Sensitive（阶段 1 Codex 首任务 verify 名称与 src/lib/auth.ts 一致）
```

**Cloud Run 侧**（Python OCR Server）：
```
R2_ACCOUNT_ID
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
R2_BUCKET
OCR_PROVIDER              # google（默认，PaddleOCR fallback 已删除）
OCR_SERVER_TOKEN          # 与 Vercel 同一值，双向鉴权
SENTRY_DSN                # 可复用 Vercel 的同一 DSN
NEXT_CALLBACK_URL         # https://<brand>.com/api/ocr/callback（3.3 采用 (b) 方案必需）
```

**废除的 env vars**（迁移时清理）：
- `OCR_SERVER_HOST` + `OCR_SERVER_PORT` → 统一为 `OCR_SERVER_URL`
- `DATABASE_URL` 不再存在于 Cloud Run 侧（3.3 决策后 Python 不直写 DB）
- `GOOGLE_APPLICATION_CREDENTIALS` 不配置（Cloud Run SA + ADC 自动解决）

**注意**：Google Vision 凭据**不走 env var**——由 Cloud Run SA 的 ADC 自动解决（见决策 7 调研）。

### 6.2 Next.js ↔ Cloud Run 接口契约（spec review 修正 2026-04-15）

所有请求都带 `Authorization: Bearer ${OCR_SERVER_TOKEN}` + `Content-Type: application/json`。token 双向共用。

**Next.js → Cloud Run**（现有 4 个端点，改造后）：

```
POST https://api.<brand>.com/classify-pdf
Body: { "r2_object_key": "books/<bookId>/original.pdf" }
Response: { "text_count": N, "scanned_count": N, "mixed_count": N, "total_pages": N }
         ⚠ mixed_count 字段在 bug 修复后始终返回（当前版本不返回导致 NaN bug）
```

```
POST https://api.<brand>.com/extract-text
Body: { "r2_object_key": "books/<bookId>/original.pdf", "module_id": N, "book_id": "..." }
Response: { "status": "accepted" }（实际结果通过 /api/ocr/callback 回流）
```

```
POST https://api.<brand>.com/ocr-pdf
Body: { "r2_object_key": "books/<bookId>/original.pdf", "module_id": N, "book_id": "..." }
Response: { "status": "accepted" }（异步，通过 /api/ocr/callback 回流进度和最终结果）
```

```
POST https://api.<brand>.com/ocr
Body: { "image_base64": "<base64 encoded PNG/JPG, typically <1MB>" }
Response: { "text": "..." }  ← 同步返回，截图 OCR 是同步即时调用
```

**Cloud Run → Next.js 回调**（4 种场景，端点统一）：

```
POST https://<brand>.com/api/ocr/callback
Body 示例（进度更新）:
{
  "event": "progress",
  "book_id": "...",
  "module_id": N,
  "pages_done": N,
  "pages_total": N
}

Body 示例（单页 OCR 结果）:
{
  "event": "page_result",
  "book_id": "...",
  "module_id": N,
  "page_number": N,
  "text": "..."
}

Body 示例（模块完成）:
{
  "event": "module_complete",
  "book_id": "...",
  "module_id": N,
  "status": "success" | "error",
  "error": "..."
}

Response: { "ok": true }
```

**Next.js callback 端点职责**（`src/app/api/ocr/callback/route.ts` 新建）：
- 验证 Bearer token
- 根据 `event` 类型路由到对应的 DB 更新逻辑（迁移自 `scripts/ocr_server.py` 删除的 4 个函数）
- 写入 Neon
- 返回 ack

### 6.3 文件路径契约

- **R2 bucket 路径**：`books/<bookId>/original.pdf`
- **不再使用**：`data/uploads/*` 本地目录（阶段 1 完成后 remove 或仅作 local dev fallback）

---

## 7. 测试策略

### 7.1 阶段级验收（见 4.1 / 4.2 / 4.3 的 checklist）

每阶段有明确的 checklist，产品负责人在云环境实测。

### 7.2 端到端冒烟测试（阶段 3 完成后）

脚本或手动：
1. 在 `https://<brand>.com` 注册新账号
2. 上传一本混合 PDF（文字页 + 扫描页）
3. 等待后台 OCR（通过 ProcessingPoller 观察）
4. 进模块做 Q&A → 测试 → 复习完整流程
5. 主动触发一个错误 → Sentry dashboard 应看到

### 7.3 不做

- 不做自动化集成测试（MVP 阶段优先上线验证产品）
- 不做 load test（MVP 量级用免费层）

---

## 8. 下一步

本 design spec 完成后的路径：

1. **Spec review 循环**（brainstorming skill Step 7）：
   - Claude 构建 spec-document-reviewer 的 prompt（含本 spec + architecture.md + 相关源代码文件路径）
   - Dispatch general-purpose agent 深审
   - 按 agent 反馈修订 spec，最多 3 次循环
2. **产品负责人 review spec 文件**（brainstorming skill Step 8）
3. **进 writing-plans skill**（brainstorming skill Step 9）：
   - 写 `docs/superpowers/plans/2026-04-??-cloud-deployment-phase1.md`（阶段 1 详细 plan）
   - 阶段 2 / 阶段 3 的 plan 等阶段 1 完成后再写（避免过早 plan 因阶段 1 经验过期）
4. **task-execution 派发阶段 1 给 Codex** 执行

---

## 9. 附录：调研文件索引

| 决策 | 调研文件 |
|---|---|
| 1. OCR | [2026-04-14-cloud-ocr-options.md](../../research/2026-04-14-cloud-ocr-options.md) |
| 2. Next.js 平台 | [2026-04-14-cloud-deployment-platform-options.md](../../research/2026-04-14-cloud-deployment-platform-options.md) |
| 3. Python 平台 | [2026-04-14-cloud-python-server-options.md](../../research/2026-04-14-cloud-python-server-options.md) |
| 4. 对象存储 | [2026-04-14-cloud-object-storage-options.md](../../research/2026-04-14-cloud-object-storage-options.md) |
| 5. 环境分离 | （概念级，无独立调研） |
| 6. CI/CD | [2026-04-14-cloud-cicd-options.md](../../research/2026-04-14-cloud-cicd-options.md) |
| 7. Secrets | [2026-04-15-cloud-secrets-options.md](../../research/2026-04-15-cloud-secrets-options.md) |
| 8. 域名 HTTPS | [2026-04-15-cloud-domain-https-options.md](../../research/2026-04-15-cloud-domain-https-options.md) |
| 9. 监控 | （🟡 轻量，无独立调研） |
| 10. 分阶段 | （🟡 轻量，无独立调研） |

WIP 历史：[2026-04-12-cloud-deployment-brainstorm-state.md](./2026-04-12-cloud-deployment-brainstorm-state.md)
