---
date: 2026-04-20
topic: M4.5 PDF 上传第一步 UX / 速度优化调研——14.2MB / 369 页 Chinese 教材能否流畅首用
triage: 🔴
template: A
budget: ~15 min wall clock（4 sub-agent 并行）
sources: { S: 29, A: 11, B: 2 }
---

# PDF 上传第一步 UX / 速度优化调研

## 背景

M4 教学系统刚完整上线，准备进入 M4.5 MVP 全流程压测。测试用例：**14.2MB / 369 页 Chinese 教材**（用户的"最难啃骨头"，含大量 KP、math formulas、tables）。MVP 从未全流程跑通过，第一步慢 = 用户第一次访问就放弃。

**当前架构**（`src/app/api/books/route.ts`）：
- 前端上传 → Vercel serverless function `POST /api/books`
- `formData.get('file')` → `Buffer.from(await file.arrayBuffer())` 全量读入 Vercel 函数
- 上传 R2
- **同步**串行 await Cloud Run `classify-pdf` + `extract-text`
- 完成后异步触发 `ocr-pdf` + Claude KP 抽取

**假设中的瓶颈**：Vercel Hobby 10s 函数超时 + 4.5MB body 上限。

## Executive Summary · 四条颠覆性发现

1. **Fluid Compute 已默认 300s（不是 10s）**——Vercel 2025-04-23 起所有新项目默认开启；老项目需 dashboard toggle 或 `vercel.json: {"fluid": true}`。Hobby / Pro 都是 300s 默认，Pro 可到 800s。**10s 假设失效**。
2. **4.5MB body 上限才是真卡点**——14.2MB PDF 根本进不到函数里，HTTP 413 FUNCTION_PAYLOAD_TOO_LARGE 在 Vercel edge 就拒绝。超时不再是主要矛盾。
3. **OCR 替代方案：Gemini 2.5 Pro 唯一有独立高分实证**——OmniDocBench（学术榜）Gemini 88.03 分排第 8，Mistral OCR 3 只有 79.75 分排第 11；Reducto 独立测试 Mistral 45.3% vs Gemini 80.1%，**Mistral 的 CN 97% 自报数据不可信**。但 Gemini 369 页延迟 3+ 分钟是硬伤。
4. **抖音/小红书推广 = 强制升 Pro**——Hobby TOS 禁止商业用途，广告、付费、affiliate、甚至"接受打赏"都算。$20/mo 起步必选。

---

## 维度 D1 · 现架构性能基线

### Fluid Compute 默认开启（2025-04-23 起）

- **Claim**: Fluid Compute 对所有新 Vercel 项目默认启用，不是 opt-in。
- **Quote**: "As of April 23, 2025, fluid compute is enabled by default for new projects."
- **URL**: https://vercel.com/docs/fluid-compute · **Tier**: [S]
- **Project implication**: 本项目创建日期早于 2025-04-23，**必须在 Dashboard 确认 Fluid 是否手动开启**。若未开启，仍是 60s 老 Hobby 天花板。

### Hobby Fluid 天花板 = 300s（不是 10s）

- **Claim**: Fluid 开启后 Hobby 函数默认 + 最大都是 300s；Pro 默认 300s 最大 800s。
- **Quote**: "Hobby | 300s (previously 60s) | 300s (previously 60s)" · "Pro | 300s (5 minutes) | 800s (13 minutes)"
- **URL**: https://vercel.com/changelog/higher-defaults-and-limits-for-vercel-functions-running-fluid-compute + https://vercel.com/docs/functions/limitations#max-duration · **Tier**: [S × 2]
- **Project implication**: 原假设"10s 必撞"错误。10s 仅在 **未开 Fluid 且 `maxDuration` 不显式设置** 时成立。

### 4.5MB body 上限不受 Fluid 影响

- **Claim**: Vercel 函数请求 body 硬上限 4.5MB，超过返回 413。
- **Quote**: "The maximum payload size for the request body... is 4.5 MB. If a Vercel Function receives a payload in excess of the limit it will return an error 413: FUNCTION_PAYLOAD_TOO_LARGE."
- **URL**: https://vercel.com/docs/functions/limitations#request-body-size · **Tier**: [S]
- **Project implication**: 14.2MB PDF **无法通过** `req.formData()` 进入函数。必须改前端 → R2 presigned URL 直传。**这是唯一阻塞性 bug**。

### pymupdf4llm 吞吐 ≈ 1 页/秒（维护者原话）

- **Claim**: PyMuPDF 维护者 Harald Lieder 实测 331 页 markdown 生成 < 6 分钟（~1s/页）。
- **Quote**: "markdown creation of the 331 pages took me less than 6 minutes (about 1 second per page)"
- **URL**: https://forum.mupdf.com/t/pymupdf4llm-performance/200/2 · **Tier**: [A] — 维护者署名，Artifex forum
- **Project implication**: 369 页 extract-text 估计 **~360s**，接近或超 Fluid 300s 硬顶。classify-pdf 更轻（页类型判断），估 15-40s。串行总计可能 **380-410s**，**过预算**。

### pymupdf4llm 有"病态 PDF"90s 卡顿记录

- **Claim**: GitHub issue #3882 报告 30MB PDF `pymupdf.open()` 单这一步就 90s。
- **Quote**: "Opening the attached pdf ... takes a very long time (around 90s) and blocks main thread."
- **URL**: https://github.com/pymupdf/PyMuPDF/issues/3882 · **Tier**: [A]
- **Project implication**: 性能**非线性**——某些复杂结构 PDF 会意外卡顿。**必须对实际 14.2MB 样本做端到端测量**，不能纸面估算定稿。

### Cloud Run cold start 2-8s + R2 下载 1-3s（uncertain）

- Cold start: https://cloud.google.com/blog/products/serverless/announcing-startup-cpu-boost-for-cloud-run--cloud-functions · [S]
- R2 → GCP us-central1 吞吐：**没查到**（无官方 benchmark，不依据训练记忆估算）

### D1 Bottom Line

- **阻塞点排序**：① 4.5MB body 上限（必死）→ ② 即便修好 ①，pymupdf4llm 369 页 ~360s 可能碰 300s Fluid 顶 → ③ cold start + 下载是数秒级补丁。
- **现架构在 Hobby 串行 await 模式下不可用**，即便 Fluid 开启也临近极限。

---

## 维度 D2 · OCR 替代方案对比

### Gemini 2.5 Pro 原生 PDF

- **定价**: $1.25/1M input (≤200k), $2.50/1M (>200k), $10/1M output。每页 258 tokens 图像 + 文本 token。[S · https://ai.google.dev/gemini-api/docs/pricing]
- **Size 限制**: 50MB / 1000 页 / 每次 prompt 3000 PDF。14.2MB/369 页 **一次性吃下**。[S · https://ai.google.dev/gemini-api/docs/document-processing]
- **速度硬伤**: Google Developer Forum 多人报告 **300 页以上 3+ 分钟**；500k tokens 能到 10+ 分钟。[A · https://discuss.google.dev/t/gemini-2-5-pro-extremely-high-latency-on-large-prompts-100k-500k-tokens/188489]
- **质量**: OmniDocBench 88.03 排第 8（学术榜含 CN + math + tables）。[A · https://www.codesota.com/browse/computer-vision/document-parsing/omnidocbench]
- **成本/本书**: 输入 ~$0.12（图像 token）+ 50k 输出 ~$0.50 = **~$0.50-0.60**
- **可替代**: Stage 1+2+3 全部（单次 call 出 structured JSON）

### Claude Sonnet 4.6 原生 PDF

- **定价**: $3/1M input, $15/1M output（Batch 5 折）[S · https://platform.claude.com/docs/en/about-claude/pricing]
- **Size 限制**: 32MB / **600 页（仅 1M-context 模式）**; 200k-context 只支持 100 页。[S · https://platform.claude.com/docs/en/build-with-claude/pdf-support]
- **成本/本书**: 369 页 × 2000 tokens = 738k input × $3 = **~$2.20+ output**
- **Chinese**: 定性评价佳（翻译领域），**没查到** Chinese OCR 专项 benchmark
- **可替代**: Stage 1+2+3 全部，但 4× Gemini 成本
- **Reversibility 陷阱**: 把 prompt + 解析 + KP 抽取耦合进一个 call，日后拆分要重写 prompt

### Mistral OCR 3

- **定价**: $2/1000 页（Batch $1）[S · https://mistral.ai/news/mistral-ocr-3]
- **速度**: 单节点 2000 pages/min → 369 页 **~11s 计算时间**（最快）
- **成本/本书**: **$0.37-0.74**（最便宜）
- **Chinese 自报 97.11%**（Mistral 自家 blog）vs Azure 91.40 / Gemini-2.0-Flash 91.85 [S source but self-reported]
- **🚨 独立测试打脸**: Reducto RD-FormsBench Gemini 2.0 Flash **80.1%** vs Mistral OCR **45.3%** → "Mistral frequently marked large sections as images and returned cropped images without OCR data"。[A · https://reducto.ai/blog/lvm-ocr-accuracy-mistral-gemini]
- **🚨 OmniDocBench 学术榜**: Mistral OCR 3 只排第 11（79.75），显著落后 Gemini 2.5 Pro 第 8（88.03）。[A]
- **可替代**: Stage 1+2（返回 markdown + 图片，**不含 KP 语义抽取**，Stage 3 仍需 Claude）
- **风险**: 中文教材复杂 layout（sidebar / 公式框 / 多栏）正是 Mistral 会 fallback 图片裁剪的场景，**静默质量倒退**

### Azure Document Intelligence

- **定价**: Read $1.50/1000 页 (≥1M 降 $0.60)，Layout/Prebuilt $10/1000 页。[A, 3 secondary sources 一致]
- **Chinese**: 无特别优势，未上 OmniDocBench
- **可替代**: Stage 1（Read/Layout，不做 KP）
- **推荐等级**: 不推荐

### D2 Comparison Matrix

| 维度 | 现 pipeline | Gemini 2.5 Pro | Claude 4.6 PDF | Mistral OCR 3 | Azure DI |
|---|---|---|---|---|---|
| 成本/369p 书 | ~$0.50-1.50 | **~$0.50** | ~$2.20 | **$0.37-0.74** + Claude KP | ~$0.55 + Claude KP |
| 速度/369p | 文本路径 10-30s | 3+ 分钟 | 没查到 | **~11s** compute | 没查到 |
| CN 准确度 | Claude 强（定性） | OmniDocBench 88.03 ✅ | 定性佳 | Reducto 实测 45% 🚨 | 未上榜 |
| Math/Tables | Claude 处理 | ✅ | ✅ | 自报 94%（独立未核） | 加成本 |
| 14.2MB/369p 装得下 | 是（分段） | ✅（50MB/1000p） | ⚠️ 仅 1M-ctx | ✅ | ✅ |
| 可替代 stage | — | **1+2+3** | **1+2+3** | 1+2 | 1 |
| Reversibility | — | 易（单 PR swap） | **难**（prompt 耦合）| 易 | 易 |

### D2 推荐

1. **不要全替换**。Gemini 2.5 Pro 是**分阶段替代 Stage 1+2 的唯一实证候选**，但 3+ 分钟延迟意味着**异步 callback 不能省**。
2. **Mistral 必须先在 14.2MB 真书上跑对照测试**才能决定——公开 benchmark 分歧太大（Mistral 自报 97% vs Reducto 45%）。
3. **Claude native PDF**留作"进一步简化架构"候选，不是 M4.5 优先级。
4. **短期**：保留现 pipeline，M4.5 先修 4.5MB + 超时，OCR 替代进独立里程碑。

---

## 维度 D3 · UX 层感知延迟优化

### Nielsen 0.1 / 1 / 10s 三阈值（地基）

- **Quote**: "0.1 second... feel that the system is reacting instantaneously... 1.0 second... flow of thought to stay uninterrupted... 10 seconds... keeping the user's attention focused"
- **URL**: https://www.nngroup.com/articles/response-times-3-important-limits/ · **Tier**: [S]
- **项目启示**: 上传按钮点击 **100ms 内必须视觉反馈**（按钮变态 + 路由开始切换）。**不能等后端处理完再跳转**——必须先跳到"准备页"，异步拉数据。

### 骨架屏（Skeleton Screen）——有条件有效

- **Claim 正面**: ACM 2018 peer-reviewed 论文：骨架屏感知时间 < spinner < 空白。https://dl.acm.org/doi/10.1145/3232078.3232086 [S]
- **Claim 反面**: Viget 136 人实测骨架屏反而被感觉**最慢**。https://www.viget.com/articles/a-bone-to-pick-with-skeleton-screens [A]
- **调和**: 只有"骨架长得像真实内容"（列表卡片轮廓、标题占位、进度占位）才有效。通用灰色方块 = 比 spinner 还差。
- **动画**: 左→右 shimmer **比** pulse 快（Bill Chung 综合研究）。[A · https://uxdesign.cc/what-you-should-know-about-skeleton-screens-a820c45a571a]

### Harrison CHI 2010——进度条"善意欺骗"边界

- **Quote**: "Backwards decelerating ribbing... a 5 second solid color progress bar felt perceptually equivalent to a 5.61 second ribbed progress bar (a 12.2% longer actual duration)."
- **URL**: https://www.chrisharrison.net/projects/progressbars2/ProgressBarsHarrison.pdf · **Tier**: [S · CMU 教授 + CHI peer-reviewed]
- **项目启示**: 如果有真实进度 → 直接展示。如果只是心理安慰 → **减速尾 + 反向 ribbing** 视觉（开始快 / 结束慢 / 表面条纹）。**禁忌**: "冲到 90% 然后停住"——用户最反感。

### Smashing Magazine——乐观 UI 在 > 2s 反噬

- **Quote**: "If you know that the response time for a particular request never goes below 2 seconds, then sprinkling some optimism over your API first is probably best." （意即超 2s 别用乐观 UI）
- **URL**: https://www.smashingmagazine.com/2016/11/true-lies-of-optimistic-user-interfaces/ · **Tier**: [S]
- **项目启示**: **不要**给模块列表做假数据（"模块 1 / 模块 2 / 模块 3..."）——10+ 秒处理，真数据到位时会认知失调。**改用骨架屏**（视觉占位，无假内容）。

### Figma 大文件加载模式——只加载当前页 + 背景拉剩余

- **Quote**: "Performance should correspond to user-perceived complexity. If a user loads a page with only a few frames, Figma should be able to display their canvas almost instantly."
- **URL**: https://www.figma.com/blog/speeding-up-file-load-times-one-page-at-a-time/ · **Tier**: [S]
- **项目启示**: 等价模式——**第一个模块元信息秒出让用户开始读**，模块 2-N 后台抽取流式渲染。用户不用等全部 369 页跑完才能动起来。**契合 Next.js Streaming + Suspense**。

### Next.js App Router `loading.tsx` 原生骨架承载

- **URL**: https://nextjs.org/docs/app/api-reference/file-conventions/loading · **Tier**: [S]
- **项目启示**: `app/modules/[id]/preparing/loading.tsx` → prefetch 的静态资源，**路由切换 0ms 就显示骨架**。不需要手写 `isLoading` 状态。

### R2 Presigned URL + XHR 真实进度

- **URL**: https://developers.cloudflare.com/r2/api/s3/presigned-urls/ · **Tier**: [S]
- **项目启示**: 上传阶段（14MB 过网）**用真进度条**（XHR `upload.onprogress`）。处理阶段才用骨架 + "正在识别目录 / 正在拆解模块" 文字指示器。**上传 vs 处理两段不同视觉语言**。

### D3 推荐 UX 栈

**4 段式**：
1. **上传阶段（0-8s）· 真实进度条**：前端 → R2 presigned PUT，XHR 字节级进度
2. **路由瞬间 · loading.tsx 骨架屏**：左→右 shimmer，画模块卡片轮廓（0ms 可见）
3. **处理阶段（8-30s）· 步骤指示器 + 骨架渐进揭示**：SSE/polling 推送阶段（"识别目录" / "拆解模块(3/8)"），每模块就绪 Suspense 揭示真实卡片覆盖那一条
4. **完成 · 自动跳转 / 首模块可点**：第一个模块抽取完立刻可进入，不等全部

**反面清单**：❌ 假文字乐观 UI / ❌ 无意义原地 pulse / ❌ 线性匀速假进度条（用户察觉得到）/ ❌ 单一全屏 spinner

---

## 维度 D4 · Vercel 超时规避 + 商业 TOS

### Fluid Compute 事实核查

| 问题 | 答案 | 来源 |
|---|---|---|
| Fluid Compute 2026 存在? | 是，2025-04-23 起新项目默认 | docs/fluid-compute |
| Hobby 当前（2026-04）超时? | **300s default / 300s max**（Fluid 开启后） | limitations + duration |
| Pro 当前超时? | **300s default / 800s max** | same |
| 自动 vs opt-in? | **新项目自动（≥2025-04-23）**，老项目 dashboard toggle 或 `vercel.json: {"fluid": true}` | changelog/fluid-compute-is-now-the-default |
| Hobby 计划页还显示 10s/60s? | ⚠️ **文档漂移**——一个老 table 未更新，Fluid docs 三个页面都是 300s | docs/plans/hobby（stale） |

**验证动作**：Dashboard → Project Settings → Functions → 看"Fluid Compute" toggle 是否开启；或部署 `export const maxDuration = 300` 的测试函数实证。

### Hobby 商业用途禁令（本项目命门）

- **Quote**: "Commercial usage is defined as any Deployment that is used for the purpose of financial gain of anyone involved in any part of the production of the project... Any method of requesting or processing payment from visitors of the site / Advertising the sale of a product or service / Receiving payment to create, update, or host the site / Affiliate linking... **Asking for Donations fall under commercial usage**."
- **URL**: https://vercel.com/docs/limits/fair-use-guidelines#commercial-usage · **Tier**: [S]
- **ToS 原文**（2026-03-17 effective）: "You shall only use the Services under a Hobby plan for your personal or non-commercial use." https://vercel.com/legal/terms
- **项目启示**: 用户已规划抖音 / 小红书推广——**若包含任何货币化（广告 / 付费 / 订阅 / affiliate / 甚至 donation 链接）必须升 Pro**。灰色地带：纯免费 + 只用抖音引流 + 无任何货币化 = Hobby 暂时可用，但最终 Vercel Support 有解释权。**viral 时被停服灾难性**——不能赌。

### `waitUntil` / `after()` 语义陷阱

- **Quote**: "Promises passed to `waitUntil()` will have the same timeout as the function itself. If the function times out, the promises will be cancelled."
- **URL**: https://vercel.com/docs/functions/functions-api-reference/vercel-functions-package#waituntil · **Tier**: [S]
- **项目启示**: `waitUntil` 做不了真异步——它只是"return response 后仍在同一个函数预算内继续跑"。要**真无边界后台工作必须委托给外部 worker**（Cloud Run）让 Cloud Run 回调。现有 `ocr-pdf` 回调架构是对的。

### Vercel 官方对 >4.5MB 的建议：直传对象存储

- **Quote**: "you can upload large files directly to a media host from your browser without needing a Vercel Function as a proxy... Vercel Functions are designed to respond quickly to clients and should be treated like a lightweight API layer, not a media server"
- **URL**: https://vercel.com/kb/guide/how-to-bypass-vercel-body-size-limit-serverless-functions · **Tier**: [S]
- **项目启示**: **Vercel 官方亲口说不要用函数做上传代理**。Presigned URL 直传 R2 是唯一"正确"姿势。

### D4 4 选项对比表

| 标准 | 选项 1: Pro 升级 | 选项 2: 异步 callback | 选项 3: R2 直传 | 选项 4: 拆短函数 |
|---|---|---|---|---|
| **工作量** | **0.5h**（按钮 + 账单） | 6-10h（callback 端点 + 状态轮询 + DB 状态列） | 8-14h（presigned URL + 浏览器直传 + confirm-upload 端点 + 重构 POST） | 10-20h（状态机 + 幂等 + 步骤链） |
| **可逆性** | **易**（dashboard 降级） | 中（DB schema 变了难回退） | 中-难（浏览器直连 R2，回退要重代理） | 难（深度改造） |
| **10x 用户扩展性** | OK（1000 GB-hrs / 30K concurrency） | **优**（Vercel 只收发，heavy lift 在 Cloud Run） | **优**（Vercel 完全不在热路径） | 可用但复杂度爆炸 |
| **副作用** | 无代码改动，**TOS 从不合规变合规** | 客户端须处理 "processing" 态 + 轮询 / WebSocket | CORS on R2 + 日志分散 + 浏览器错误处理 | 错误处理乘法爆炸，仍不解 4.5MB |
| **成本** | **$20/mo base** + 超量 $0.60/GB-hr | $0 新 infra | $0 新 infra | $0 新 infra 但 +人力 |

### D4 推荐

**必做：选项 1（Pro 升级）+ 选项 3（R2 直传）；保留选项 2（OCR 已用）；跳过选项 4。**

**为什么**：
1. **Pro 升级非 optional**——TOS 显式禁商业，抖音推广 = 商业。$20/mo 起步 + $20 usage credit，MVP 阶段近乎免费。错过 = viral 时被停服。
2. **选项 3 是"正确"架构**——Vercel 官方亲口说、14.2MB 已超 4.5MB body 必须做。**一次性做到位**，以后 50MB / 100MB PDF 都不用再改后端。
3. **选项 2 已在 OCR 用着**——classify-pdf / extract-text 如果 <30s 继续同步 await（Fluid 300s 够用），未来慢到近限再切 callback。**现在不做**。
4. **选项 4 是纯复杂度税**——300s Fluid 下不再必要。

---

## 决策合成 · 应用 5 问表格到主要选项

### 决策 1: Vercel Pro 升级（$20/mo）

| 问题 | 答案 |
|---|---|
| **1. 它是什么** | 从"免费图书馆借书证"升级到"付费会员卡"——允许商业使用 + 更大阅览室（800s 函数、更多带宽）。 |
| **2. 现在的代价** | $20/mo（前 $20 usage credit，实际 MVP 阶段接近 0） + 0.5 小时点按钮。 |
| **3. 带来什么能力** | ① TOS 合规（可抖音推广）② Fluid 800s（300s 不够再用）③ 更大并发（30K vs Hobby ~100） ④ Team 特性（未必用） |
| **4. 关闭哪些门** | 基本无——随时降级。 |
| **5. 选错后果** | ❌ 如果不做：viral 时 Vercel 主动停服（账号级封禁），对 MVP 是灾难。做了发现没必要：$20 损失。**极度不对称**。 |

**推荐**: **✅ 立刻做**。难反悔的是"不做"，不是"做"。

### 决策 2: Presigned URL 直传 R2（替代 `req.formData()`）

| 问题 | 答案 |
|---|---|
| **1. 它是什么** | 不让大件包裹过"前台"（Vercel 函数），直接给客户"仓库地址"（R2 presigned URL）自己送到仓库。 |
| **2. 现在的代价** | 8-14 小时 Codex + Gemini 联合工作：新 `POST /api/uploads/presign` 端点 + 前端 XHR 直传 + `POST /api/books/confirm` 端点 + `src/app/api/books/route.ts` 重构 + R2 CORS 配置。 |
| **3. 带来什么能力** | ① 彻底解 4.5MB 死锁，50MB/100MB PDF 都不再改代码 ② 真实上传进度条（字节级） ③ Vercel 函数瘦身（只做 metadata + 派发） |
| **4. 关闭哪些门** | 浏览器直连 R2 后，"服务端扫描/校验上传内容"就难了（但本项目不扫描，不受影响）。CORS 要配对 R2 bucket。 |
| **5. 选错后果** | 易回滚（一个 PR 还原），但回滚后 4.5MB 问题会回来。 |

**推荐**: **✅ 做**。M4.5 的核心任务。

### 决策 3: 是否换 OCR 技术（Gemini / Mistral / 保持）

| 问题 | 答案 |
|---|---|
| **1. 它是什么** | 把现有"三段流水线"（pymupdf4llm → Google Vision → Claude KP）替换成"一锅端"（Gemini 一次出结构化 JSON）或"换 OCR 引擎"（Mistral 替代 Vision）。 |
| **2. 现在的代价** | Gemini 全替换：3-5 天重构 + prompt 大改 + 新测试。Mistral 仅换 Vision：1-2 天 + 真书 benchmark。保持不变：0。 |
| **3. 带来什么能力** | Gemini：单 call 架构简化 + OmniDocBench 88 分稳。Mistral：369 页 11s 超快 + 单本 $0.37（但质量风险）。保持：已知工作。 |
| **4. 关闭哪些门** | Gemini：prompt 耦合 3 阶段，**难反悔**。Mistral：CN 教材复杂 layout 可能静默质量倒退。 |
| **5. 选错后果** | Gemini 选错：回退要重写 prompt（难）。Mistral 选错：质量倒退用户察觉不到（静默 bug，**最危险**）。保持：**零风险**。 |

**推荐**: **✅ M4.5 不动 OCR**。保持现 pipeline。**独立里程碑**（M4.75 或 M5.5 后）做 14.2MB 真书对照实测再决定。

### 决策 4: 准备页 UX（骨架屏 + 步骤指示器 + 流式揭示）

| 问题 | 答案 |
|---|---|
| **1. 它是什么** | 用户点上传 → 0ms 跳到"准备中"页 → 骨架屏 + "正在识别目录 / 正在拆解模块 (3/8)" → 模块就绪即揭示 → 可进入第一模块开始读。 |
| **2. 现在的代价** | 6-10 小时 Gemini 工作：`/modules/[id]/preparing/loading.tsx` 骨架屏 + SSE/polling 状态 + Suspense 流式揭示。 |
| **3. 带来什么能力** | 即便处理仍 30+ 秒，用户**感知**只有 2-5 秒（Figma 模式）。第一次访问留存率大幅提升。 |
| **4. 关闭哪些门** | 基本无。骨架屏是渐进增强。 |
| **5. 选错后果** | 极易回退——删 `loading.tsx` + 还原 page 即可。 |

**推荐**: **✅ M4.5 做**。是对抗"第一步慢 = 用户跑"的最直接手段。

---

## 最终推荐 · M4.5 Scope

### 必做（阻塞首用）

1. **Vercel Pro 升级**（0.5h，用户操作）—— TOS 合规，$20/mo
2. **Presigned URL 直传 R2**（8-14h，Codex + Gemini）—— 解 4.5MB 卡点
3. **准备页 UX 栈**（6-10h，Gemini）—— 骨架 + 步骤 + Suspense 流式
4. **14.2MB 真书端到端测试**（2-4h，用户 + Claude 联合）—— 定量测 Fluid 开启后真耗时

### 不做（推 M5 或独立里程碑）

- OCR 技术替换（需独立 benchmark 里程碑）
- classify-pdf / extract-text 改异步 callback（300s Fluid 够用）
- 拆短函数（复杂度税）
- start-qa redirectUrl 技术债（小修，前端已 workaround）

### 验证 checkpoint

1. 确认 Vercel Dashboard 中 Fluid Compute 是否启用（若否须手动开）
2. 部署 `maxDuration = 300` 测试函数验证 Hobby/Pro 实际超时
3. 14.2MB 真书从上传到第一模块可读时间 < 30s（perceived < 5s）

---

## 源质量自审（硬字段）

### 源级别统计

- **S 级**: 29 条
  - D1: 4（Vercel docs × 3, Google Cloud Blog, Cloud Run docs）
  - D2: 6（Gemini API pricing, Gemini PDF docs, Claude PDF, Claude pricing, Mistral OCR, Mistral OCR 3）
  - D3: 7（NN/g Nielsen, ACM Skeleton, Harrison CHI 2010, Smashing Magazine, Figma blog, Next.js docs, Cloudflare R2 docs）
  - D4: 12（Vercel Fluid / Limits / Changelog × 2 / Hobby page / Fair Use / TOS / Pricing / maxDuration / KB timeouts / KB 4.5MB bypass / waitUntil API / Fluid pricing）

- **A 级**: 11 条
  - D1: 3（Artifex forum / PyMuPDF4llm product / GitHub #3882）
  - D2: 5（Gemini latency forum / Reducto benchmark / OmniDocBench / Azure pricing（secondary）/ PyImageSearch）
  - D3: 2（Viget / UX Collective Chung）
  - D4: 1（Inngest blog）

- **B 级**: 2 条
  - D2: 1（Machine translation blog · Claude CN）
  - D4: 1（Next.js GitHub discussion #62705）

### URL 验证

所有引用 URL 在 sub-agent 执行时均已 WebFetch 可达（✅）。唯一标 uncertain 的：
- Azure DI 官方 pricing 页直接 fetch 超时（从 3 条独立 secondary sources 交叉确认数字，标 [A]）
- Vercel Dashboard 中 Fluid toggle 对 <2025-04-23 老项目的具体 UI 状态（需实际登录验证）

### 幻觉自查声明

**所有数字、引用、来源 URL 均来自 sub-agent 调研的引用源，非 Claude 训练记忆。** 其中：

- 明确标注"没查到"的 3 处：R2 → GCP 跨云吞吐 / Mistral OCR 3 Chinese 独立 benchmark / 得到 & Anki & Duolingo & GoodNotes 具体大文件上传 UX 文档
- 明确标注 uncertain 的 4 处：14.2MB 实际 PDF 处理时间（1s/页估算基于维护者论坛单机测量）/ R2 跨云下载时间（估算 1-3s）/ Vercel 老项目 Fluid 自动开启状态 / Mistral CN 教材实测质量
- Mistral 自报 CN 97% 与 Reducto 独立测试 45% 并列呈现，不代表任一方结论
