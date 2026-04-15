# 云部署 OCR 方案调研

**调研日期**：2026-04-14
**用途**：云部署里程碑决策 1（OCR 处理方式）的选型依据
**关联文件**：
- [cloud-deployment-brainstorm-state.md](../superpowers/specs/2026-04-12-cloud-deployment-brainstorm-state.md)
- [2026-04-11-pdf-processing-research.md](./2026-04-11-pdf-processing-research.md)（上一次 OCR 调研，2026-04-11，关注点为"本地 PDF 处理技术选型"）

---

## 一、调研范围与来源标准

**范围**（按 brainstorming 阶段用户确认的 β 方案）：
1. 云 OCR API 现行定价（Google / Mistral / AWS Textract / Azure / Aliyun / Tencent）
2. 容器部署平台定价 + 免费层（Railway / Fly.io / Render / Vercel）
3. OCR 质量对比（中英混排教材场景）
4. 中国大陆访问 Vercel / Google Cloud 的现状

**来源分级**：
- **S 级**（必须）：官方定价页、官方文档
- **A 级**（辅助）：2025-2026 独立 benchmark、官方新闻页、GitHub 仓库
- **拒绝**：无日期的老帖、凭记忆的断言

---

## 二、云 OCR API 定价（MVP 小量场景相关）

| Provider | 标准档价格 | 免费层 | 来源 |
|---|---|---|---|
| **Mistral OCR** | $1 / 1000 页（batch $0.50）| 无明确免费层 | [Mistral 官方 news 页](https://mistral.ai/news/mistral-ocr) |
| Google Cloud Vision | $1.50 / 1000 次 | 首 1000 次/月**永久免费** + 新用户 $300 信用额度 | [Cloud Vision Pricing](https://cloud.google.com/vision/pricing) |
| AWS Textract | $1.50 / 1000 页（>1M 降到 $0.60）| 新用户前 3 月 1000 页/月 | [AWS Textract Pricing](https://aws.amazon.com/textract/pricing/) |
| Azure AI Vision | ~$1.50 / 1000 次 | 5000 次/月（部分功能）| [Azure Computer Vision Pricing](https://azure.microsoft.com/en-us/pricing/details/computer-vision/)（搜索结果 B 级，官方页 WebFetch 超时未拿到原始数据）|
| 阿里云通用 OCR | 阶梯：<1万次 ¥82.5/1000 = **$11.6/1000**；1-10万 ¥49.5/1000；10-50万 ¥41.5/1000；50-100万 ¥24.8/1000；>100万 ¥9/1000 | 需购资源包 | [阿里云 OCR 按量付费](https://help.aliyun.com/zh/ocr/product-overview/pay-as-you-go) |
| 腾讯云通用印刷体 | 阶梯：<1万次 ¥150/1000 = **$21/1000**；1-10万 ¥100/1000；10-100万 ¥60/1000 | 首 1000 次/月免费 | [腾讯云 OCR 计费](https://cloud.tencent.com/document/product/866/17619) |

**关键观察**：
- 中国云只有跑到 >100 万次/月才变得比西方便宜。MVP 小量档下，**腾讯云比 Google 贵 14 倍、阿里云贵 8 倍**
- Mistral OCR 按"页"计费而不是"次"，对多页文档最划算
- Google 和 AWS 小量档价格打平，但 Google 的永久免费层更划算

---

## 三、OCR 质量对比

### Mistral 官方发布 benchmark（[来源](https://mistral.ai/news/mistral-ocr)）

> 注意：自家发布的 benchmark，数据偏优是预期的，但具体数字至少说明他们在中文上做了针对性优化。

| Provider | 中文准确率 | 综合分 |
|---|---|---|
| **Mistral OCR 2503** | **97.11%** | 94.89% |
| Gemini-2.0-Flash | 91.85% | 88.69% |
| Azure OCR | 91.40% | — |
| Google Doc AI | 90.89% | — |
| GPT-4o | — | 89.77% |

### 独立 benchmark（[CodeSOTA 2026 OCR 榜](https://www.codesota.com/ocr)）

- **PaddleOCR-VL 7B** 综合分 92.86 排第一，超过 GPT-5.4 和 Gemini 2.5 Pro
- **但这是 7B 参数大模型**，内存需求 4-8GB，和我们当前运行的 PaddleOCR 3.x 轻量版不是同一个量级
- 我们当前 PaddleOCR 3.x 的质量没有独立 benchmark 和云 API 直接对比

### 2026-04-11 上一次调研的数据对照

| 服务 | 中文准确率 | 每千页成本 |
|---|---|---|
| Google Document AI | 95%+ | $1.50 |
| Azure Layout | 93%+ | $10.00（注：2026-04-14 调研到 Azure AI Vision Read 是 $1.50/1000，与 Document Intelligence / Form Recognizer 不同）|
| AWS Textract | 88%+ | $10.00（同上，这是 AnalyzeDocument 的价，DetectDocumentText 是 $1.50/1000）|
| 国内 API（百度/阿里）| 96%+ | $0.42-0.55 |
| 自托管 PaddleOCR GPU | 95%+ | $0.10-0.50 摊销 |

> 两次调研价差的原因：2026-04-11 的数字可能是 AnalyzeDocument / Document Intelligence 这类**结构化文档**接口，我们实际需要的是**纯 OCR**（DetectDocumentText / AI Vision Read），后者价格显著更低。

---

## 四、容器部署平台（选项 A 自托管所需）

| 平台 | 最低档 | 1GB 常驻容器实际成本 | 来源 |
|---|---|---|---|
| **Railway** | $5/月 Hobby（含 $5 usage 额度）| ~$10-15/月（1GB + 24×7 额度吃光）| [Railway Pricing](https://docs.railway.com/pricing/plans) |
| **Fly.io** | 纯 pay-as-you-go（2024-10 后取消订阅制免费层）| shared-CPU-2x 1GB ~$9/月 | [Fly.io Pricing](https://fly.io/pricing/) |
| **Render** | $7 Starter（512MB，装不下 PaddleOCR）| 需升 Standard $25/月 | [Render Pricing](https://render.com/pricing) |
| **Vercel** | Hobby $0（非商用）/ Pro $20 | Serverless 函数默认 2GB，但 OCR 冷启动不实际 | [Vercel Pricing](https://vercel.com/pricing) |

### 轻量 Python 容器（不含 PaddleOCR，仅 pymupdf 分类 + 提取）

内存需求 ~200-300MB，可以塞入更便宜的档位：

| 平台 | 最低档成本 |
|---|---|
| Railway | $5/月额度大概率够 |
| Fly.io | 256MB shared ~$2/月 |
| Render | $7 Starter 够 |

---

## 五、中国大陆访问情况

| 服务 | 墙内状况 | 来源 |
|---|---|---|
| **Vercel `*.vercel.app`** | **DNS 被污染 + SNI 443 被阻** | [vercel/community GitHub Discussion #803](https://github.com/vercel/community/discussions/803) |
| **Vercel 自定义域名** | 通常可访问，绑 Cloudflare 更稳 | [Vercel KB: China Access](https://vercel.com/kb/guide/accessing-vercel-hosted-sites-from-mainland-china) |
| Google Cloud API | 无中国节点，可达但不稳 | [21CloudBox: Google Cloud China](https://www.21cloudbox.com/support/google-cloud-china.html) |
| Mistral API（欧洲） | 未查到明确数据 | — |
| Railway / Fly.io | 未查到明确数据（大概率和 Vercel 类似）| — |

### 关键 insight

墙内访问主要影响**浏览器 → 我们服务器**这条链路，**不影响服务器 → OCR API** 这条链路（服务器在海外，OCR API 在海外，两者直通）。

因此 OCR provider 选谁都不受墙影响，墙内问题只和 Next.js 应用部署平台相关（决策 2 处理）。

---

## 六、MVP 场景月费测算

**假设**：100 活跃用户 × (50 页教材 × 30% 扫描页 + 20 次截图) = **3500 次 OCR / 月**

| 方案 | OCR 月费 | 容器月费 | 合计 |
|---|---|---|---|
| **Mistral OCR + 轻量 Python 容器** | $3.5（3500/1000 × $1）| $2-3 | **$5.5-6.5/月** |
| **Google Vision + 轻量 Python 容器** | $3.75 - 1000 免费 = $2.25 | $2-3 | **$5-6/月** |
| 自托管 PaddleOCR（Fly.io 1GB） | $0 | $9 | $9/月 |
| 自托管 PaddleOCR（Railway） | $0 | $10-12 | $10-12/月 |
| 阿里云 OCR（小量档） | ¥288 = $40 | 海外容器 $2-3 | **$40-43/月** |
| 腾讯云 OCR（小量档） | ¥375 = $53 | 海外容器 $2-3 | **$53-56/月** |

---

## 七、决策

### 已拍（2026-04-14）

**选项 B - 换 OCR 引擎为 Google Cloud Vision**
- 代码里已有 `OCR_PROVIDER=google` 抽象（Scanned PDF 里程碑 T4 实现），改一个环境变量 + 配 API key 即可
- Python 服务器保留，但瘦身：只做 pymupdf 分类 + pymupdf4llm 提取，不再加载 PaddleOCR 模型（内存降至 200-300MB）
- 月费 MVP 规模 **$5-6**，比 A 方案便宜 40-50%
- 首 1000 次/月永久免费，MVP 早期大概率实际 $0
- Google Vision 业界稳定质量，用了十年
- 如果实测中文识别质量不够，后续切 Mistral（加 provider 抽象，~半天工作量）

### 附加决策：不支持中国大陆访问

- 用户当前主要目标群体是留学生，基本在海外
- 如果未来需要覆盖国内用户，再立项"国服"（切阿里云 OCR + 国内部署平台 + 自定义域名 + ICP 备案）
- 当前阶段不为墙内优化任何技术选型

### 不选 Mistral 的原因（尽管账面更好）

- 代码目前只支持 `paddle` 和 `google` 两个 provider，切 Mistral 要加一个 provider（额外 ~半天工作量）
- 官方 benchmark 是自家数据，独立验证少
- Google Vision 有永久免费层，Mistral 没明确免费层
- **保留切 Mistral 的可能性**：如果 Google 中文质量不达预期，再切

### 不选 A（自托管）的原因

- MVP 规模下月费贵 40-50%（$9-12 vs $5-6）
- 1GB PaddleOCR 容器冷启动慢（模型加载 10-20s）
- 容器运维复杂度对非技术负责人是负担
- 未来用户量真的大到需要自托管（比如月 OCR 调用 >50 万），再切回来（代码抽象保留）

### 不选 C（混合）的原因

- 小规模下双份成本 + 复杂度，没省钱
- 只在"一条路月万次 + 另一条路月百次"这种极端不对称场景才划算

---

## 八、后续 gap（本次调研没查到 / 需要实测的事）

1. **Azure AI Vision Read 官方精确定价**：本次 WebFetch 超时，只拿到 B 级搜索结果（$1.50/1000）。如果将来考虑切 Azure，需要重新核实
2. **我们自己教材 PDF 的实际 OCR 质量**：没有独立 benchmark 对比 PaddleOCR 3.x vs Google Vision vs Mistral 在**我们具体的中英混排教材页面**上的识别准确率。需要部署后抽样实测
3. **Mistral / Railway / Fly.io 的墙内访问**：暂时不影响决策（因为决定不支持墙内），未来开国服时再查
4. **公式识别**：当前用户的教材如果有大量数学公式（工科教材），Google Vision 和 PaddleOCR 都不是强项。Mistral OCR 声称支持 LaTeX/Markdown 输出，公式场景可能更好——这是未来可能切 Mistral 的触发条件之一

---

## 九、参考资料汇总

### OCR API
- [Google Cloud Vision Pricing](https://cloud.google.com/vision/pricing)
- [Mistral OCR News](https://mistral.ai/news/mistral-ocr)
- [AWS Textract Pricing](https://aws.amazon.com/textract/pricing/)
- [Azure Computer Vision Pricing](https://azure.microsoft.com/en-us/pricing/details/computer-vision/)
- [阿里云 OCR 按量付费](https://help.aliyun.com/zh/ocr/product-overview/pay-as-you-go)
- [腾讯云 OCR 计费](https://cloud.tencent.com/document/product/866/17619)

### 部署平台
- [Railway Pricing](https://docs.railway.com/pricing/plans)
- [Fly.io Pricing](https://fly.io/pricing/)
- [Render Pricing](https://render.com/pricing)
- [Vercel Pricing](https://vercel.com/pricing)

### 质量 benchmark
- [CodeSOTA OCR Leaderboard 2026](https://www.codesota.com/ocr)
- [Mistral OCR 官方 benchmark](https://mistral.ai/news/mistral-ocr)

### 中国访问
- [Vercel KB: China Access](https://vercel.com/kb/guide/accessing-vercel-hosted-sites-from-mainland-china)
- [vercel/community DNS 污染 GitHub Discussion](https://github.com/vercel/community/discussions/803)
- [21CloudBox: Google Cloud China](https://www.21cloudbox.com/support/google-cloud-china.html)
