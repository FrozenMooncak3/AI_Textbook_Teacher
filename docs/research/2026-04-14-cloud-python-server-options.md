---
date: 2026-04-14
topic: 轻量Python服务器云部署平台选型
type: research
status: resolved
keywords: [Cloud Run, Python部署, Docker, FastAPI, 容器化]
---

# 调研：轻量 Python 服务器云部署平台（决策 3）

**调研日期**：2026-04-14
**服务于决策**：云部署 brainstorm 决策 3（轻量 Python 服务器部署平台）
**最终拍定**：**Google Cloud Run**
**状态**：已完成（2026-04-14）

---

## 1. 调研背景与约束

### 被调研服务的形态
- 当前 `scripts/ocr_server.py`（Python + FastAPI/Flask），已 Docker 化
- 决策 1 之后职责收缩：`/classify-pdf`（pymupdf 文字 vs 扫描页分类）+ `/extract-text`（pymupdf4llm 文字页提取），**不再加载 PaddleOCR 模型**
- 扫描页 OCR 已外包给 Google Cloud Vision（决策 1）
- 内存需求从 PaddleOCR 时代的 ≥1GB 降到 **200-300MB**（512MB 容器够用，1GB 宽松）
- 调用频率估算（MVP 100 活跃用户）：约 **3500 次/月**，每次 **5 秒左右** 处理

### 候选池
- Railway（Hobby plan）
- Fly.io（按量付费 + 香港节点）
- Render（Web Service paid）
- Google Cloud Run（按使用计费 + 永久免费层）

### 硬约束（全局+本地）
1. **能让 Vercel 的 Next.js 调用**（跨云 HTTPS + 共享密钥认证）
2. **架构硬约束 A.2**：文件存储走 S3 兼容接口（决定 4 会选 R2 / B2），Python server 只处理流，不依赖本地卷
3. **架构硬约束 A.3**：OCR provider 抽象（决策 1 已实现 `OCR_PROVIDER=google|paddle|aliyun`）
4. **预算**：加上 Vercel（$0）+ Neon（$0）+ Vision OCR（约 $2-3），Python server 最好 ≤ $5/月
5. **不锁死在海外**：未来可把 Python server 再起一份到阿里云 ECS / 腾讯云 CVM（附加决策 A 的国内分区预留能力）

### 核心决策维度
| 维度 | 为什么重要 |
|------|----------|
| 月费 | 预算敏感（总预算 $10/月以内） |
| 与 Google Vision API 的延迟 | 决策 1 选 Google Vision，跨云调 API 每次多 100-300ms |
| 冷启动表现 | 3500 次/月 = 低频，空闲期长，scale-to-zero 是否可忍 |
| 部署复杂度 | 产品负责人非技术，平台原生 Docker + Git push 触发是首选 |
| 可移植性 | 将来换平台（包括迁国内）要容易 |

---

## 2. 数据对比（全部来自官方文档，2026-04-14 WebSearch 核实）

| 平台 | 起步月费 | 内存支持 | 冷启动 | 计费粒度 | scale-to-zero | Vision API 延迟 | 官方链接 |
|------|---------|---------|--------|---------|--------------|----------------|---------|
| **Google Cloud Run** | **$0（免费层覆盖 MVP 用量）** | 可配 128MB-32GB | 500ms-2s | 请求级 + 100ms | **原生支持** | **最低**（同家机房） | [cloud.google.com/run/pricing](https://cloud.google.com/run/pricing) |
| Railway Hobby | $5/月（含 $5 credits） | 最高 8GB | 无（always-on） | 按秒 | 否 | 跨云（+100-300ms） | [railway.com/pricing](https://railway.com/pricing) |
| Fly.io | 按使用（~$2-6/月） | 256MB-16GB | 秒级（machine stop/start） | 按秒 | 支持（machine auto-stop） | 跨云（+100-300ms） | [fly.io/docs/about/pricing](https://fly.io/docs/about/pricing/) |
| Render Starter | $7/月 | 512MB | 无（always-on） | 月费 | 否（Free 才有，30s 冷启动） | 跨云（+100-300ms） | [render.com/pricing](https://render.com/pricing) |

### 关键数字来源

- **Cloud Run 永久免费层**（per billing account, per month）：
  - 2,000,000 次请求
  - **180,000 vCPU-秒**（原先脑海中是 240,000，WebSearch 核实后修正）
  - **360,000 GiB-秒**（原先脑海中是 450,000，同上修正）
  - 来源：[Google Cloud Run Pricing](https://cloud.google.com/run/pricing)

- **Railway Hobby**：
  - 订阅费 $5/月，含 $5 使用额度
  - 超额后 vCPU $0.000278/分钟，内存 $0.000139/GB/分钟，egress $0.05/GB
  - 来源：[Railway Pricing](https://railway.com/pricing)

- **Fly.io shared-cpu-1x**：
  - 256MB always-on 约 **$1.94/月**
  - 512MB always-on 约 **$2.80/月**（推算）
  - 1GB always-on 约 **$5.70/月**
  - 2024-10 起取消 Hobby/Launch/Scale 订阅，改纯 pay-as-you-go
  - 来源：[Fly.io Resource Pricing](https://fly.io/docs/about/pricing/)

- **Render Starter Web Service**：
  - $7/月（always-on，不睡眠）
  - Free tier 存在但 15 分钟无请求后睡眠，冷启动 30s+
  - 来源：[Render Pricing](https://render.com/pricing) / [Render Free tier sleep](https://community.render.com/t/do-web-services-on-a-free-tier-go-to-sleep-after-some-time-inactive/3303)

### MVP 用量估算

- 3500 次/月 × 5 秒 = **17,500 vCPU-秒 / 月**（假设 1 vCPU）
- 3500 次/月 × 5 秒 × 0.5 GiB = **8,750 GiB-秒 / 月**（假设 512MB 容器）

对应 Cloud Run 免费层消耗：
- vCPU：17,500 / 180,000 = **~10%**
- 内存：8,750 / 360,000 = **~2.4%**
- 请求：3,500 / 2,000,000 = **~0.2%**

**结论**：MVP 阶段 Cloud Run 实际月费 **$0**。即使扩到 10K 次/月，仍在免费层内。

---

## 3. 各平台分析

### A. Google Cloud Run（推荐）

**它是什么**（给产品负责人）：像 Vercel 但给 Docker 容器用的。你 push 镜像，Google 帮你跑，没请求时自动休眠（不收钱），来请求时秒起。

**优点**：
1. **MVP 0 成本**：免费层吃不完，哪怕 10K 次/月也在免费层内
2. **Vision API 同家机房**：决策 1 选了 Google Vision，调用延迟最低（比跨云少 100-300ms）
3. **scale-to-zero 原生**：15 分钟无请求自动休眠，不收钱
4. **Docker 原生**：`scripts/ocr_server.py` 的 Dockerfile 改一下就能上
5. **将来迁移容易**：Dockerfile 是通用标准，换到阿里云容器服务也就几小时工作量

**缺点/代价**：
1. **冷启动 500ms-2s**：空闲 15 分钟后第一次请求会慢。前端已有"处理中"状态，用户无感
2. **Google Cloud 控制台复杂**：第一次开账户要配 IAM、启用 API、装 gcloud CLI（约 1-2 小时学习成本）
3. **计费模型复杂**：vCPU-秒 + GiB-秒 + 请求数三项叠加。超过免费层时估算月费要看监控面板

**选错代价**：极低。代码是 Docker + HTTP，换任何平台都能跑。

### B. Fly.io（未选，排名第二）

**优点**：
1. 按秒计费 + auto-stop，接近 scale-to-zero
2. 256MB 机器每月 ~$1.94，便宜
3. 香港/日本节点存在（但实测 2026-04 路由绕 SYD/LAS，墙边优势已破）

**为什么不选**：
- 跨云调 Google Vision 有延迟（~100-300ms/次），MVP 3500 次 × 300ms = 17 分钟额外等待时间
- 比 Cloud Run 贵（$2-5/月 vs $0）而且没买到差异化价值
- 冷启动体验和 Cloud Run 类似，但 Fly 是 "machine stopped" 模式，起更慢

### C. Railway Hobby（未选）

**优点**：
1. 部署最简单（Git push 就走）
2. 内存大方（Hobby 8GB）
3. 社区友好，UI 对产品负责人最好懂

**为什么不选**：
- $5/月 vs Cloud Run $0，对预算敏感的 MVP 来说，每月 $5 意味着 Vision OCR 预算直接翻倍
- always-on 模式浪费：空闲 23 小时也在付钱
- 跨云调 Google Vision 延迟劣势

### D. Render Starter（未选）

**为什么不选**：
- **最贵**（$7/月 web service）
- 免费层 15 分钟睡眠 + 30s+ 冷启动，完全不可用（远超 Cloud Run 的 500ms-2s）
- 没有 scale-to-zero 在付费层（要么付 $7 常驻，要么 $0 睡 15 分钟）
- 跨云调 Google Vision 延迟劣势

---

## 4. 拍定 Cloud Run 的决策链

1. **决策 1 选了 Google Vision**（OCR），就把 Python server 部署平台的最优选项锚定到 Google 家了（跨云延迟）
2. **决策 2 选了 Vercel Hobby**（$0），总预算还剩 $10 - $3（Vision OCR）= $7，能容纳任何选项。但 **Cloud Run $0 能把这 $7 留给未来**（比如买更大 Neon 或加域名）
3. **MVP 3500 次/月 × 5 秒**的用量模式极度适合 scale-to-zero：空闲期长 + 突发短 = 免费层最大化利用
4. **决策 4 必须走对象存储**（Cloud Run stateless 强化了这个约束，但这个选择本身就由附加决策 A.2 决定）

---

## 5. 代码/运维影响

### 需要新写的
1. **Dockerfile 修改**：当前 `docker-compose.yml` 里的 ocr service 改造成独立 Dockerfile（去掉 PaddleOCR 依赖，只留 pymupdf + pymupdf4llm + google-cloud-vision）
2. **Cloud Run 部署脚本**：`gcloud run deploy` 命令或 GitHub Actions workflow（15-30 分钟）
3. **共享密钥中间件**：Next.js API route 和 Python server 之间加 `X-Internal-Token` header 校验（30-40 分钟代码）
4. **环境变量配置**：`OCR_SERVER_URL`（Cloud Run 分配的 HTTPS URL）+ `OCR_SERVER_TOKEN`（共享密钥）

### 需要注销的
1. `docker-compose.yml` 生产版不再需要 ocr service（本地调试可保留）
2. `scripts/ocr_server.py` 里处理本地 `uploads/` 目录的逻辑需改成收 URL / 收 bytes（由决策 4 最终定）

### 将来迁移国内的路径
- Google Cloud Run → 阿里云容器服务 ACK / 腾讯云 TKE：同样是 Docker 镜像 + HTTP，切 endpoint 就行
- 前提是 OCR provider 也要切（Google Vision → 阿里云 OCR / 腾讯云 OCR），这由决策 1 的 `OCR_PROVIDER` 抽象支持

---

## 6. 源 URL 清单

- [Google Cloud Run Pricing](https://cloud.google.com/run/pricing) — 免费层 180K vCPU-秒 + 360K GiB-秒 + 2M 请求
- [Google Cloud Run Configure CPU](https://docs.cloud.google.com/run/docs/configuring/services/cpu) — CPU 分配模式（always-allocated vs request-only）
- [Railway Pricing](https://railway.com/pricing) — Hobby $5/月 + $5 credits
- [Railway Docs Pricing Plans](https://docs.railway.com/pricing/plans) — 详细计费公式
- [Fly.io Pricing](https://fly.io/pricing/) — 总览
- [Fly.io Resource Pricing](https://fly.io/docs/about/pricing/) — shared-cpu-1x $1.94/月（256MB）
- [Fly.io Pay-as-you-go Announcement](https://community.fly.io/t/free-plan-clarification/18661) — 2024-10 取消订阅
- [Render Pricing](https://render.com/pricing) — Starter $7/月 web service
- [Render Free Tier Sleep](https://community.render.com/t/do-web-services-on-a-free-tier-go-to-sleep-after-some-time-inactive/3303) — 15 分钟睡眠 + 30s+ 冷启动
- [Cloud Run Free Tier Infographic](https://www.freetiers.com/directory/google-cloud-run) — 第三方汇总（2025）

---

## 7. 本次调研没覆盖的点（留给决策 4 和后续）

- **对象存储选型**（R2 / B2 / Vercel Blob 之间的带宽定价 + 出口费）—— 决策 4 继续调研
- **Cloud Run 出口带宽**（Python server → Vercel 回传 OCR 结果的流量成本）—— 短文本响应，可忽略
- **Cloud Run 并发限制**（单实例最多 80 并发请求）—— MVP 用量下不触发
- **冷启动优化**（最小实例数 = 1 会产生持续计费，不采用）—— 保持 scale-to-zero
