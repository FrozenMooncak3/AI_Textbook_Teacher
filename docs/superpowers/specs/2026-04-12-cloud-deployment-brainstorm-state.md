---
date: 2026-04-12
topic: 云部署Brainstorm进度追踪
type: spec
status: resolved
keywords: [cloud, deployment, brainstorm, WIP, compact-defense]
---

# 云部署 Brainstorm 进行中状态（WIP）

**创建日期**：2026-04-12
**用途**：compact 防御 + 新 session 恢复入口
**最终产出**：`docs/superpowers/specs/2026-04-12-cloud-deployment-design.md`（brainstorm 完成后生成）

> ⚠️ compact 或 clear 后恢复时**先读这个文件**，再读 `docs/architecture.md` 部署架构 section 的 ⚠️ 约束。

---

## 为什么立项（产品负责人视角）

- 产品负责人非技术，每次本地测试都踩环境坑（Docker、Python 依赖、OCR 模型加载、多端口调试）
- "测试等于痛苦"严重拖慢产品迭代
- 对比行业做法：
  - 大公司：本地 + staging + 生产（QA 团队）
  - 小团队：本地 + 生产（当前本项目状态）
  - **独立开发者：只有云环境**（最终选定方向）
- 决定走第三种——"推代码到 Git → 自动部署到云 → 浏览器打开测"

## 定位

**基础设施里程碑**（不加新功能），和功能里程碑（教学系统、留存机制）并列。

完成后所有后续功能里程碑的测试成本都大幅降低。

## 已拍的基础方向（不再讨论）

- **只保留云环境**，本地不跑任何服务，只写代码
- **已云化部分**：Neon Postgres（`DATABASE_URL` 已用）
- **待云化部分**：Next.js app + 轻量 Python 服务器（pymupdf 分类 + 提取，不含 PaddleOCR）
- **预算**：接受每月付费，上限预期 $10/月
- **测试路径**：push 到 master → 平台自动部署 → 浏览器打开测（可选 preview 环境）
- **中国大陆访问**：**主 App 走海外不做墙内优化**；国内通过介绍/众筹/候补/演示页承接，**不自建站走第三方平台**（摩点/开始吧 + 微信公众号 + 小红书/视频号），**MVP 完成后再启动国内链路**。"技术架构提前预留国内版分区能力"（见下方附加决策）
  - 2026-04-14 产品负责人澄清："MVP 主服务海外 / Web first / 国内只做介绍页+众筹页+候补页+演示页 / 国内众筹卖的是支持+抢先体验权益+共创资格 / 不承诺国内支持者立即稳定使用完整版 / 技术架构提前预留国内版分区能力"

## 已拍的决策

### 决策 1：OCR 处理方式（2026-04-14）

**拍定：选项 B — 换 OCR 引擎为 Google Cloud Vision，Python 服务器保留但瘦身**

- 代码里 `OCR_PROVIDER=google` 抽象已存在（Scanned PDF 里程碑 T4 实现），改一个环境变量 + 配 API key 即可切换
- Python 服务器职责收缩：pymupdf 页面分类 + pymupdf4llm 提取文字页，不加载 PaddleOCR 模型（内存 1GB → 200-300MB）
- 月费测算（MVP 100 活跃用户）：$5-6/月（OCR $2.25 + 轻量容器 $2-3）
- Google Vision 首 1000 次/月永久免费，早期大概率 $0
- 保留切 Mistral OCR 的可能性（如果中文/公式识别不达标，加 provider 抽象约半天工作量）

**完整调研记录**：[docs/research/2026-04-14-cloud-ocr-options.md](../../research/2026-04-14-cloud-ocr-options.md)（含所有来源 URL 和数字）

**不选的原因**：
- A 方案（自托管 PaddleOCR 上云）：月费贵 40-50%（$9-12 vs $5-6），冷启动慢，运维压力大
- C 方案（混合）：小规模下双份成本，不划算

### 决策 2：Next.js 部署平台（2026-04-14）

**拍定：Vercel Hobby**（$0/月，100GB 带宽，零代码改动）

**选择逻辑链**：
- 产品策略澄清后（2026-04-14 同日），墙内稳定不再是主 App 的硬约束 → 解锁了之前被 CF Workers 压制的 Vercel
- MVP 阶段看重"快速上线验证产品"，$0 + 零改动 + 原生 Next.js + 自动 preview URL > CF Workers 的 $5 + 1 天改动 + OpenNext 适配
- 100GB 带宽在 MVP 早期绰绰有余
- 容易反悔：代码零修改，将来迁 CF Workers / Fly / 自建都不会卡

**完整调研记录**：[docs/research/2026-04-14-cloud-deployment-platform-options.md](../../research/2026-04-14-cloud-deployment-platform-options.md)（含所有候选方案数据和来源 URL）

**不选的原因**：
- CF Workers + OpenNext：需改 1 天代码（db 切 Hyperdrive + 文件上传切 R2），墙内优势因策略变化而不再关键
- Fly.io 香港：路由实测绕 SYD/LAS/日本，名义在墙边但实际和普通海外部署无异
- 纯国内部署：海外核心用户（留学生）访问慢，MVP 阶段不做

### 决策 3：轻量 Python 服务器部署平台（2026-04-14）

**拍定：Google Cloud Run**（MVP 实际 $0/月 + 同家调 Vision API 延迟最低）

**关键数据**（2026-04-14 WebSearch 核实）：
- 永久免费层：2M 请求/月 + **180,000 vCPU-秒** + **360,000 GiB-秒**（来源：cloud.google.com/run/pricing）
- MVP 实际消耗（3500 次/月 × 5 秒，512 MB RAM）：约 **10% vCPU / 2.4% 内存**免费额度（仍远低于免费层上限）
- 冷启动 500ms-2s（对我们场景无感：前端已有"处理中"状态）
- 同家机房调 Google Vision API 延迟最低

**代码/运维适配**：
- Python server 打成 Docker 镜像（当前 `scripts/ocr_server.py` 已容器化，改 Dockerfile 即可）
- Cloud Run scale-to-zero 原生，15 分钟无请求自动休眠
- Next.js → Python server 之间加**共享密钥认证**（约 30-40 分钟代码工作）
- **文件系统约束**：Cloud Run 容器 stateless，PDF 必须走对象存储（**强化决策 4 的硬约束**，本地卷路径从"可选"变"禁用"）

**完整调研记录**：[docs/research/2026-04-14-cloud-python-server-options.md](../../research/2026-04-14-cloud-python-server-options.md)

**不选的原因**：
- Railway（$5/月）：Vision API 跨云延迟，月费高于 Cloud Run 免费层
- Fly.io（$5.92/月）：香港路由绕路优势已破，没买到差异化价值
- Render（$7/月）：最贵，免费层冷启动 30s+ 不可用

### 决策 4：PDF 文件存储（2026-04-14）

**拍定：Cloudflare R2**（MVP $0/月 + egress 永久 0 费用 + S3 标准 API）

**关键数据**（2026-04-14 WebSearch 核实）：
- 存储 $0.015/GB/月（前 10GB 免费）
- **Egress 永久 0 费用**（决定性差异：阅读器反复取 PDF 不怕账单暴涨）
- Class A 操作（PUT/List）$4.50/百万（前 1M/月免费）
- Class B 操作（GET/HEAD）$0.36/百万（前 10M/月免费）
- MVP 1GB 存储 + 200 PUT + 10K GET 全在免费层内 → **实际 $0/月**

**代码/运维适配**：
- 用 `@aws-sdk/client-s3`（Vercel 和 Cloud Run 都能用同一套代码）
- `region: 'auto'` + endpoint `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`
- 环境变量 4 个：`R2_ACCOUNT_ID` / `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` / `R2_BUCKET`
- 主站给前端发**预签名 URL**（PDF 阅读器直接从 R2 取，不经 Next.js 服务器，省带宽）
- 代码改造估算：2-3 小时（替换 `src/lib/uploads.ts` + Python OCR server 读取路径）

**完整调研记录**：[docs/research/2026-04-14-cloud-object-storage-options.md](../../research/2026-04-14-cloud-object-storage-options.md)

**不选的原因**：
- Backblaze B2：存储便宜 2.5 倍但 egress 只有 3× 免费额度，1000 用户规模 egress 会超限；MVP 用量下两家都 $0 差异不明显
- Vercel Blob：非 S3 API，破坏附加决策 A.2 模块化，且单价比 R2 贵 10 倍

### 决策 5：环境分离（2026-04-14）

**拍定：生产 + preview + Neon 独立 DB branch**（方案 B2）

**关键数据**：
- Vercel 原生支持 preview：非 master 分支 push 后自动生成独立 URL（`<project>-git-<branch>-<hash>.vercel.app`）
- Neon 免费层送 **10 个 DB branch**
- Vercel + Neon 官方集成：每个 preview 自动克隆生产 DB 当前快照，销毁时自动清理
- 月费增量：**$0**（全在 Neon/Vercel 免费层内）

**工作流**：
1. Codex/Gemini 开分支 `feature/xxx` → push
2. Vercel 自动起 preview URL + Neon 自动克隆 DB branch
3. 产品负责人打开 preview URL 测试（独立数据，不影响生产）
4. 测过后 merge 到 master → Vercel 自动上生产
5. 分支销毁 → preview URL + Neon branch 同步销毁

**代码/运维适配**：
- Vercel 项目启用 preview deploys（**默认开启**，不用改）
- 安装 Neon Vercel Integration（一次性 15-20 分钟）：Neon dashboard → Integrations → Vercel
- Codex 改代码：`DATABASE_URL` 按环境注入（preview branch 一个 URL，生产一个 URL——Neon integration 自动处理注入）

**不选的原因**：
- A（纯生产）：任何改动立刻见用户，MVP 阶段风险太大
- C（额外持久 dev 环境）：1 人团队用不到，每个 feature branch 本身就是独立试验田

### 决策 6：CI/CD（2026-04-14）

**拍定：Cloud Run Continuous Deployment（UI 绑定 GitHub）**

**核心思路**：Vercel 端 push 自动部署保持不变（原生行为）；Python server 端用 Cloud Run 控制台的 "Continuous Deployment" 绑 GitHub，push 后 Cloud Build 自动 build + 推 Artifact Registry + 部署 Cloud Run。

**关键数据**（2026-04-14 WebSearch 核实）：
- Cloud Build 免费层：**120 build-minutes/天**（e2-standard-2 永久免费），MVP 预估 15-25 分钟/天
- Artifact Registry 免费层：**0.5 GB 永久免费**（按 billing account 汇总）；Python 镜像 400-800MB，需定期清理旧 revision 或接受 $0.10-0.15/月超额
- 文件路径过滤 UI 原生支持：`includedFiles: scripts/**,Dockerfile*` 避免前端改动空跑
- 无需写 `cloudbuild.yaml`（UI 配置 + Dockerfile 即可，底层自动创建 Cloud Build trigger）
- MVP 实际月费：**$0**（Cloud Build + Artifact Registry 双双在免费层内）

**代码/运维适配**：
- UI 配置 10-15 分钟（Cloud Run Console → Set up continuous deployment → 授权 GitHub App → 选仓库/分支/Dockerfile 路径/includedFiles）
- `scripts/Dockerfile` 保证 COPY 路径干净，不拉 node_modules
- Vercel 端保持 Vercel 自己的自动部署，互不影响
- 月度运维：登 Artifact Registry 删旧镜像，约 2 分钟

**完整调研记录**：[docs/research/2026-04-14-cloud-cicd-options.md](../../research/2026-04-14-cloud-cicd-options.md)

**不选的原因**：
- A 方案（平台原生 only，手敲 `gcloud run deploy`）：每次改 Python 都要手动，易忘、无历史、难长期维护
- B 方案（GitHub Actions 统一）：首次 WIF 配置 30-60 分钟，多引入一个生态；MVP 还没有 lint/test 流程，"跨平台统一"的优势发挥不出来。未来若要加自动测试，C→B 切换无代码成本

### 决策 7：Secrets 管理（2026-04-15）

**拍定：方案 A — 平台 env vars（Vercel + Cloud Run 各自配）**

**核心思路**：Vercel dashboard 配一套 env vars，Cloud Run 控制台配一套 env vars，**不引入第三方 secret manager**。

**关键发现**（让 secrets 清单大幅缩小）：
1. **Google Vision 凭据消失**：Cloud Run 运行时挂的服务账号授 "Cloud Vision AI User" 角色，Python 客户端自动用 ADC（Application Default Credentials），**不需要 JSON key 文件、不需要 API key、不需要 env var**
2. **DATABASE_URL 自动管理**：决策 5 的 Neon Vercel Integration 自动为每个环境（生产/每个 preview）注入，**不手动配**
3. **净剩 shared secrets 只有 5 个**：`R2_ACCOUNT_ID` / `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` / `R2_BUCKET` / `OCR_SERVER_TOKEN`

**关键数据**（2026-04-15 WebSearch 核实）：
- Vercel env vars：默认加密存储 + "Sensitive" 标记防 UI/API 读取 + 64 KB/deployment 限额（我们只用几百字节）
- Cloud Run env vars：在 Google 安全边界内 + IAM 控制 + 原生支持从 Secret Manager 挂载（未来升级路径）
- Google Secret Manager 免费层：6 active versions + 10K access/月（MVP 不需要但留作升级路径）
- Doppler free tier 3 用户、Infisical free tier 5 用户：都够用但引入第三方依赖

**代码/运维适配**：
- Vercel dashboard：5 shared vars + 3 only-Vercel vars（`ANTHROPIC_API_KEY` / `AI_MODEL` / session secret），敏感值勾选 "Sensitive"
- Cloud Run 控制台：5 shared vars + `OCR_PROVIDER=google`（无 Vision key 变量）
- 轮换流程：两边手动同步改一次（MVP 阶段几乎不动）
- **安全红线（免费但必做）**：
  1. Vercel 敏感 secrets 勾 "Sensitive"（防 UI 展示/API 读取）
  2. Cloud Run SA 最小权限（只给 "Cloud Vision AI User" + "Artifact Registry Reader"）
  3. R2 API Token 范围限制在 `ai-textbook-pdfs` 单 bucket + "Object Read & Write"
  4. 全量 secrets 清单同步到密码管理器（1Password / Bitwarden）做 off-platform 备份

**完整调研记录**：[docs/research/2026-04-15-cloud-secrets-options.md](../../research/2026-04-15-cloud-secrets-options.md)

**不选的原因**：
- 方案 B（Google Secret Manager 统一）：Vercel 侧无原生集成，需写 SDK + 配 Workload Identity Federation（30-60 分钟）换取"5 字段省去双端同步"的收益，不成比例；未来真要升级，Cloud Run 侧原生挂载 GSM 是 10 分钟事
- 方案 C（Doppler / Infisical 统一）：引入第三方账号依赖，1 人团队边际收益小；若第三方涨价或挂掉要迁移

**升级触发条件**（写明免得以后忘）：
- Secrets 数量 > 15（当前 5）
- 轮换频率 > 1 次/月（当前近乎 0）
- 多个 service 共享（当前只有 2 个 service）
- 团队 > 3 人（当前 1 人 + CCB）

### 决策 8：域名与 HTTPS（2026-04-15）

**拍定：方案 B — 自购 `.com` 根域名 + DNS 分别指向 Vercel / Cloud Run（不套 CDN 代理）**

**核心思路**：Cloudflare Registrar 买 `<brand>.com`，Cloudflare 免费 DNS 解析（灰色云，不开代理）；根域名 + www 指 Vercel，子域 `api.brand.com` 指 Cloud Run；SSL 两端各自自动 Let's Encrypt。

**关键发现**（让 3 方案变 1 方案）：
1. **TLD 必选 `.com`**：工信部 ICP 白名单约 159 个 TLD，**只有 `.com` 确认在列**；`.app` / `.io` / `.ai` 都"没查到"官方批复——选这些等于未来进国内要换域名
2. **注册商必选 Cloudflare Registrar**：全行业唯一 at-cost 定价，`.com` $10.46/年**永远不涨价**（批发价）；GoDaddy/Namecheap 首年低价续费翻倍，不考虑
3. **不开 Cloudflare Proxy**：Vercel 官方明确不推荐开启代理（破坏边缘优化 + SSL 证书双层冲突）→ 方案 C 直接砍掉
4. **Auth cookie 跨子域无影响**：Next.js → Cloud Run 是 Bearer token server-to-server，浏览器从不直接访问 Cloud Run，SameSite/CORS 不适用

**关键数据**（2026-04-15 4 个 sub-agent 并行 WebSearch 核实）：
- `.com` 年费：$10.46（Cloudflare Registrar，at-cost 续费同价）
- Vercel 自定义域名：A 记录指 `76.76.21.21` + CNAME 指 `cname.vercel-dns.com`，自动 Let's Encrypt
- **Cloud Run 自定义域名仍 Preview（未 GA）as of 2026-04**：支持 `asia-east1` / `asia-northeast1` / `asia-southeast1`（够用），自动 Let's Encrypt
- 月费增量：**$0**（$10.46 / 12 ≈ $0.87/月，总预算仍在 $10/月以内）

**代码/运维适配**：
- 首次配置一次性 20-30 分钟：注册 + Vercel 加域 + Cloud Run 加域 + 等 DNS 传播
- DNS 托管 Cloudflare（免费 + 灰色云纯解析，不开橙色云代理）
- 日常运维：年度续费自动扣款；Cloud Run Preview → GA 时跟进（Google 发 GA 公告时再看是否需要改配置）
- **附加决策 A 落地**：未来进国内就独立买 `.cn` + 国内服务器 + ICP 备案，海外/国内两套独立站（业界主流做法：飞书 `larksuite.com` + `feishu.cn`）

**风险 flag**：
- Cloud Run 自定义域名 Preview 状态，生产阶段建议每季度查 GA 进度
- `.com` 商标要先在 trademarks.justia.com（US）+ 中国商标网查重，避免侵权

**完整调研记录**：[docs/research/2026-04-15-cloud-domain-https-options.md](../../research/2026-04-15-cloud-domain-https-options.md)

**不选的原因**：
- 方案 A（平台子域 `xxx.vercel.app` / `xxx.run.app`）：伤品牌可信度（付费留学生看到 `vercel.app` 会怀疑正规性）+ 关闭了 ICP 备案可能 + 换域名要重做所有推广素材
- 方案 C（`.com` + Cloudflare 橙色云代理）：Vercel 官方不推荐，SSL 证书双层冲突，Cloud Run Preview 自定义域名在代理层下验证失败

### 决策 9：监控与错误追踪（2026-04-15）

**拍定：方案 C — Sentry（错误追踪）+ Vercel Analytics（built-in 流量 / Web Vitals）组合**

**核心思路**：两者功能不重叠——Sentry 覆盖 Next.js + Python 两端的**错误堆栈聚合 + 源码映射 + 报警**；Vercel Analytics 提供流量 / 首屏速度（Hobby 内置，不用选）。

**Triage 档位**：🟡 轻量决策——3 选项但极易反悔（改 SDK + env var 即可），不产独立调研文件。

**选 C 而非 A/B 的决策链**：
1. 1 人团队做付费产品给真实用户，崩溃盲飞会伤品牌和留存 → 砍掉 A（不做）
2. 只靠 Vercel 自带看不到 Cloud Run OCR 端崩溃 + 无 error aggregation → 砍掉纯 B
3. Sentry 免费层 5K errors/月（MVP 量级远低于此）+ 覆盖 Next.js 和 Python 两端 → 推荐 C
4. Vercel Analytics 是 built-in，不用选，本来就有 → C 实际上是 "C + B" 叠加

**代码/运维适配**（一次性约 1 小时）：
- Next.js 端：`npm install @sentry/nextjs` + `npx @sentry/wizard@latest -i nextjs`（含 env var 配置）
- Python 端：`pip install sentry-sdk` + `scripts/ocr_server.py` 启动时 `sentry_sdk.init(dsn=...)`
- Sentry DSN 走平台 env vars（决策 7 方案 A，Vercel + Cloud Run 各配一份；两端可用同一 DSN）
- 报警规则：邮件/飞书（可选，5 分钟配）

**月费增量**：**$0**（Sentry 免费层 + Vercel Analytics Hobby 内置）

**需核实**：实施前打开 sentry.io/pricing 确认最新免费层限额（2025 下半年调整过，MVP 量级仍够用，但上线前应核实具体数字）

**不选的原因**：
- A（不做监控）：一个 bug 卡死所有扫描 PDF 用户，三天后才从用户抱怨中发现，MVP 付费产品不能接受
- B（只用 Vercel 自带）：Cloud Run OCR 崩溃要登 Google Console 翻原始日志，无 error aggregation，长期维护成本高

### 决策 10：分阶段实施策略（2026-04-15）

**拍定：方案 B — 拆 3 阶段，每阶段独立可测、可上线、可回退**

**核心思路**：10 个决策的改动一口气做太集中，10 个微 PR 又太碎；3 阶段兼顾上线速度与可诊断性。

**Triage 档位**：🟡 轻量决策——实施节奏策略，无外部事实核对，仅产品负责人偏好。

**3 阶段拆分**：

**阶段 1：数据层上云（预估 1-2 天）**
- R2 bucket 建好 + `src/lib/uploads.ts` 改成 S3 SDK
- Neon Vercel Integration 装上（DATABASE_URL 自动注入）
- Vercel 首次部署 Next.js（跑在 `xxx.vercel.app` 子域）
- 决策 5 的 preview + Neon branch 机制启用
- **验收标准**：能上传 PDF 到 R2、能从 R2 读回、`xxx.vercel.app` 可访问应用核心流程

**阶段 2：OCR 上云（预估 1-2 天）**
- Python server 改引擎为 Google Vision（`OCR_PROVIDER=google`）
- `scripts/Dockerfile` 瘦身（去 PaddleOCR 模型和依赖）
- Cloud Run 首次手动部署测试（确认 Docker 镜像 + env vars 正确）
- Cloud Run CD UI 绑 GitHub（push 自动部署 + `includedFiles` 过滤）
- Next.js → Cloud Run 的 `OCR_SERVER_TOKEN` 鉴权落地
- **验收标准**：git push 后 Cloud Run 自动更新 + 扫描 PDF 端到端可跑完整流程（推迟已久的云环境实测终于可做）

**阶段 3：域名 / 监控 / 收尾（预估半天-1 天）**
- 注册 `.com` + DNS 切到 Cloudflare Registrar
- Vercel 加自定义域 + Cloud Run 加 `api.<brand>.com`
- Sentry 两端装 SDK（Next.js + Python）
- Vercel + Cloud Run env vars 按决策 7 清单整理 + 安全红线 4 项落实（Sensitive 标记 / SA 最小权限 / R2 token bucket scope / 密码管理器备份）
- **验收标准**：`https://<brand>.com` 可访问 + `https://api.<brand>.com` 响应 OCR + Sentry 能捕获测试错误 + 所有 secrets 按红线审查通过

**总预估**：3-5 天 Codex 工作量（不含产品负责人测试等待时间）

**选 B 而非 A/C 的决策链**：
1. 产品负责人会在每个阶段完成后实测 → 早发现问题比一次集中上所有东西更快
2. `.com` 注册 + DNS 生效 24-48 小时 → 放阶段 3 不阻塞阶段 1-2（前期用 `xxx.vercel.app` 过渡）
3. 扫描 PDF 端到端测试已被推迟（见 project_status）→ 阶段 2 完成后终于可测，是关键里程
4. 一次到位（A）风险集中：10 个新东西同时上，bug 难定位根因
5. 10 个微 PR（C）协调成本高：上下文切换多，人疲劳

**不选的原因**：
- A（一次到位）：集成 bug 难定位，可能推迟 2-3 天上线，且无法在中途实测
- C（10 个微 PR）：碎片化严重，上下文切换成本大于收益

**下一步流程**：
1. 本 WIP state 文件转为正式 design spec `docs/superpowers/specs/2026-04-12-cloud-deployment-design.md`
2. 跑 spec review 循环（subagent 深审 + 产品负责人 review）
3. 进 writing-plans skill 写**阶段 1** 的详细 plan（阶段 2/3 的 plan 等阶段 1 完成后再写，避免过早 plan 因阶段 1 经验过期）
4. task-execution 派发给 Codex 执行阶段 1

### 附加决策 A：架构预留国内版分区能力（2026-04-14 硬约束）

后续所有决策必须满足以下 4 条，不得锁死"只能海外"或"只能国内"：

1. **DB 连接配置化**（已做）：`DATABASE_URL` 环境变量，未来可切 Neon 国内 project 或阿里云 RDS
2. **文件存储选 S3 兼容接口**（影响决策 4）：如 R2 / B2，未来可无缝切阿里云 OSS / 腾讯云 COS
3. **OCR provider 抽象**（决策 1 已做）：`OCR_PROVIDER=google|paddle|aliyun`
4. **前端 i18n 就位**：文案走 `next-intl` 之类，避免硬编码，未来可出纯中文版

### 附加决策 B：国内链路策略（2026-04-14，MVP 完成后启动）

**方向**：不自建国内站，全走第三方平台

| 需求 | 走哪里 | 为什么 |
|---|---|---|
| 众筹支付 | 摩点 / 开始吧 / 好好众筹 | 平台自带主体资质 + 国内支付，抽佣 5-8% |
| 候补登记 | 微信公众号粉丝沉淀 | 墙内最稳 + $0 + 后续可推送 |
| 介绍内容 | 小红书 / 视频号 / 公众号文章 | 避开 ICP 备案 + 算法分发 |
| 演示页 | **录屏视频 + 截图**（发小红书/B 站/众筹项目页） | 不接真 API，不涉及墙内访问主站 |

**启动时点**：MVP 主 App 完成、具备可演示状态后启动。当前阶段只记策略方向，不做执行。

**产品负责人的卖点定位（2026-04-14）**：国内众筹卖的是"支持 + 抢先体验权益 + 共创资格"，**不承诺**国内支持者立即稳定使用完整版。

## 已识别的上云约束（从 milestone-audit 搬运）

`docs/architecture.md` 部署架构 section 已写入 ⚠️ 标记：

1. OCR server 内存需求 ≥ 1GB（PaddleOCR 模型加载）；首次启动需下载模型，冷启动慢
2. `uploads` volume 共享依赖：若 app 与 ocr 跨主机部署，PDF 文件传递方式需重设计（URL / 对象存储 / 流式上传）
3. OCR server 当前无认证，Docker 内网可用；暴露到公网必须加 auth 或放 VPC 内
4. `DATABASE_URL` 被 app 和 ocr 两侧直连，Neon pooler 连接数限制要考虑

---

## 待 brainstorm 的关键决策（按依赖顺序）

（全部 10 个决策已拍完，无待 brainstorm 项）

---

## 当前进度

- ✅ 基础方向已拍（只保留云环境）
- ✅ 上云约束已识别（4 条 ⚠️）
- ✅ 产品负责人策略澄清：MVP 海外优先 + 国内走第三方平台 + MVP 后启动国内链路（2026-04-14）
- ✅ 决策 1 已拍：Google Vision（2026-04-14，调研见 docs/research/2026-04-14-cloud-ocr-options.md）
- ✅ 决策 2 已拍：Vercel Hobby（2026-04-14，调研见 docs/research/2026-04-14-cloud-deployment-platform-options.md）
- ✅ 决策 3 已拍：Google Cloud Run（2026-04-14，调研见 docs/research/2026-04-14-cloud-python-server-options.md）
- ✅ 决策 4 已拍：Cloudflare R2（2026-04-14，调研见 docs/research/2026-04-14-cloud-object-storage-options.md）
- ✅ 决策 5 已拍：生产 + preview + Neon DB branch（方案 B2）（2026-04-14，无外部调研需求，概念级决策）
- ✅ 决策 6 已拍：Cloud Run Continuous Deployment UI 绑 GitHub（2026-04-14，调研见 docs/research/2026-04-14-cloud-cicd-options.md）
- ✅ 决策 7 已拍：平台 env vars（Vercel + Cloud Run 各自配，不引入第三方 secret manager）（2026-04-15，调研见 docs/research/2026-04-15-cloud-secrets-options.md）
- ✅ 决策 8 已拍：自购 `.com` + DNS 分别指 Vercel / Cloud Run（Cloudflare Registrar，不开代理）（2026-04-15，调研见 docs/research/2026-04-15-cloud-domain-https-options.md）
- ✅ 决策 9 已拍：Sentry（错误追踪）+ Vercel Analytics（built-in）组合（2026-04-15，🟡 轻量决策，无独立调研文件）
- ✅ 决策 10 已拍：3 阶段拆分实施（数据层 → OCR → 域名/监控），3-5 天 Codex 工作量（2026-04-15，🟡 轻量决策）
- ✅ 附加决策 A：架构预留国内版分区 4 条硬约束（2026-04-14）
- ✅ 附加决策 B：国内链路"不自建站全走第三方"，MVP 完成后启动（2026-04-14）
- 🎉 **全部 10 决策拍完**，下一步：转正式 design spec + spec review 循环 + writing-plans 阶段 1
- 每完成一个决策更新本文件的"已拍"和"待 brainstorm"区

---

## 恢复指南（下次 session）

1. 读本文件（含"已拍的决策"区和"当前进度"）
2. 读 `docs/architecture.md` 末尾「部署架构」section 的 ⚠️ 4 条约束
3. 读已完成调研：
   - `docs/research/2026-04-14-cloud-ocr-options.md`（决策 1）
   - `docs/research/2026-04-14-cloud-deployment-platform-options.md`（决策 2）
   - `docs/research/2026-04-14-cloud-python-server-options.md`（决策 3）
   - `docs/research/2026-04-14-cloud-object-storage-options.md`（决策 4）
   - 决策 5 无外部调研（概念级决策，直接记在 state file）
   - `docs/research/2026-04-14-cloud-cicd-options.md`（决策 6）
   - `docs/research/2026-04-15-cloud-secrets-options.md`（决策 7）
   - `docs/research/2026-04-15-cloud-domain-https-options.md`（决策 8）
   - 决策 9 无独立调研文件（🟡 轻量决策，直接记在 state file）
4. 从决策 10（分阶段实施）开始 brainstorm
5. 按 CLAUDE.md "与项目负责人沟通协议" 的 5 问格式给选项
6. 拍定前若涉及外部信息（定价、性能），必须先 WebSearch/WebFetch 实际查证，不能凭训练记忆（见 MEMORY.md Research Before Recommendation）
7. 后续所有决策必须满足附加决策 A 的 4 条架构预留硬约束（不得锁死"只能海外"或"只能国内"）
8. 每拍定一个决策，更新本文件的"已拍"区

## 最终产出

brainstorm 全部完成后：
1. 本文件转为 `docs/superpowers/specs/2026-04-12-cloud-deployment-design.md`（正式 design spec）
2. 进 writing-plans 写 `docs/superpowers/plans/2026-04-??-cloud-deployment-plan.md`
3. 进 task-execution 派发给 Codex（后端 / 部署配置） 和 Gemini（如果前端需要调整）
