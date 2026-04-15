# 调研：PDF 对象存储平台（决策 4）

**调研日期**：2026-04-14
**服务于决策**：云部署 brainstorm 决策 4（PDF 文件存储）
**最终拍定**：**Cloudflare R2**
**状态**：已完成（2026-04-14）

---

## 1. 调研背景与约束

### 为什么要用对象存储
- 决策 3 选了 Google Cloud Run（stateless，容器重启就清空）→ PDF **绝对不能存本地盘**
- 主站（Vercel）和 OCR server（Cloud Run）跨云跨机房，必须有"共享文件池"
- 附加决策 A.2（架构预留国内版分区）要求走 S3 兼容接口，未来可切阿里云 OSS / 腾讯云 COS

### 候选池（已预筛）
- Cloudflare R2（S3 兼容，egress 免费是卖点）
- Backblaze B2（S3 兼容，存储最便宜）
- Vercel Blob：**架构预筛阶段直接剔除**（非 S3 API，破坏模块化）

### MVP 用量预估
- 100 活跃用户 × 平均 2 本书 × 5MB 每本 = **1GB 存储**
- PUT（上传）：约 200 次/月
- GET（阅读取出）：约 10,000 次/月（PDF 阅读器反复翻页会 HTTP range 重复取）
- Egress（出口流量）：理论 50GB/月（10K × 5MB），实际 10-20GB（range 请求只取片段）

### 决策维度
1. 存储 $/GB/月
2. 出口流量费（决定性 — 阅读器反复取场景）
3. 操作费（PUT/GET 次数）
4. S3 API 兼容度（影响未来切国内 OSS 的代价）
5. 与 Vercel + Cloud Run 的集成易用性

---

## 2. 数据对比（全部来自官方定价页，2026-04-14 WebSearch 核实）

| 项 | Cloudflare R2 | Backblaze B2 | MVP 影响 |
|---|---|---|---|
| **存储** | $0.015/GB/月 | $0.006/GB/月 | 1GB 内免费层覆盖，无差异 |
| **Egress（出口）** | **$0 永久免费** | 3× 存储量免费，超出 $0.01/GB | 扩展到 1000 用户时 R2 完胜 |
| **Class A 操作（PUT/List）** | $4.50/百万（前 1M/月免费）| $0.004/万（日 2500 免费）| MVP 远不到上限 |
| **Class B 操作（GET/HEAD）** | $0.36/百万（前 10M/月免费）| 同 Class A | MVP 约 10K/月，免费层内 |
| **S3 API 兼容** | ✅ `region='auto'` + endpoint | ✅ `region='us-west-004'` 等 + endpoint | 代码结构几乎一样 |
| **免费层总额度** | **10GB 存储 + 1M PUT + 10M GET** | 10GB 存储（egress 受 3× 限制）| R2 更宽 |
| **SDK 支持** | `@aws-sdk/client-s3` 官方文档齐全 | `@aws-sdk/client-s3` 官方文档齐全 | 两家都直接用 AWS SDK |
| **MVP 实际月费** | **$0** | **$0** | 都够用 |

### 关键数字来源
- **Cloudflare R2 免费层**：10GB 存储 / 1M Class A / 10M Class B / **egress 永久 0 费用**
  - 来源：[Cloudflare R2 Pricing](https://developers.cloudflare.com/r2/pricing/)
- **Backblaze B2 免费层**：10GB 存储 / 2500 Class B/日 / egress 为 3× 月平均存储量
  - 来源：[Backblaze B2 Pricing](https://www.backblaze.com/cloud-storage/pricing) / [B2 Transaction Pricing](https://www.backblaze.com/cloud-storage/transaction-pricing)
- **R2 S3 兼容**：AWS SDK v3 (`@aws-sdk/client-s3`) + `region: 'auto'` + `endpoint: https://<ACCOUNT_ID>.r2.cloudflarestorage.com`
  - 来源：[R2 AWS SDK JS v3 guide](https://developers.cloudflare.com/r2/examples/aws/aws-sdk-js-v3/)
- **B2 S3 兼容**：AWS SDK v3 + `region: 'us-west-004'`（示例） + `endpoint: https://s3.<region>.backblazeb2.com`
  - 来源：[B2 AWS SDK JS V3 guide](https://www.backblaze.com/docs/cloud-storage-use-the-aws-sdk-for-javascript-v3-with-backblaze-b2)

---

## 3. 各平台分析

### A. Cloudflare R2（推荐）

**优点**：
1. **Egress 永久 0 费用**：这是 R2 的核心差异点。PDF 阅读器反复取同一个文件（HTTP range 请求），在任何"egress 收费"的平台都会是成本黑洞
2. **免费层最宽**：10GB + 1M PUT + 10M GET，MVP 用量内基本不可能超
3. **文档齐全**：Cloudflare 官方给的 `@aws-sdk/client-s3` 示例直接跑得起来
4. **和 Cloudflare 生态联动**：未来如果加 CDN 缓存、Workers 代理，天然融合

**缺点/代价**：
1. 存储单价比 B2 贵 2.5 倍（$0.015 vs $0.006/GB）——但 MVP 到不了存储吃紧的规模
2. Class A 操作单价比 B2 贵——但前 1M/月免费，MVP 也到不了

**选错代价**：极低。`@aws-sdk/client-s3` 标准 API，切 B2 或阿里云 OSS 只要换 endpoint + region + credentials。

### B. Backblaze B2（未选，排名第二）

**优点**：
1. 存储最便宜（$0.006/GB vs R2 $0.015）
2. 定价透明，没有复杂的操作分类
3. S3 兼容度好

**为什么不选**：
- **egress 3× 上限容易爆**：1GB 存储只给 3GB egress 免费。按阅读器的反复取 pattern，MVP 50GB egress 超额 47GB = $0.47/月；1000 用户场景 500GB egress = $5/月
- 存储便宜只有到 100GB+ 规模才值得（MVP 根本到不了），届时随时可迁
- Class B 按日 2500 免费限制，当一个用户集中阅读时容易触发

### C. Vercel Blob（已被架构预筛）

**为什么预筛阶段就被剔除**：
- **非 S3 API**：读写 PDF 的代码全部是 Vercel 专有格式，将来切国内要重写（违反附加决策 A.2）
- 定价还贵：存储 $0.15/GB/月（R2 的 10 倍），下载带宽 $0.05/GB
- 唯一优势是"和 Vercel 无缝集成"——但 R2 也可以用几行代码配好

---

## 4. 拍定 R2 的决策链

1. **"egress 0 免费"是 1000 用户时唯一不暴雷的选项**
2. **MVP 用量下 R2 和 B2 都 $0**，但 R2 在未来扩展曲线更平缓
3. **决策 4 的硬约束是 S3 兼容**（附加决策 A.2），R2/B2 都满足，Vercel Blob 不满足
4. **10GB + 1M PUT + 10M GET 的免费层**比 B2 的日 2500 限制更稳妥

---

## 5. 代码/运维影响

### 新写的代码
1. `src/lib/storage.ts`（新文件）：封装 `@aws-sdk/client-s3` 的 PutObject / GetObject / 预签名 URL
2. `src/lib/uploads.ts`（改写）：当前写本地目录 → 改成调 `storage.ts` 的 putObject
3. Python OCR server（改写）：当前从本地磁盘读 PDF → 改成从 HTTP URL 下载（Next.js 发来的预签名 URL）
4. 前端 PDF 阅读器：当前 `<iframe src="/api/pdf/{id}">` → 改成 `<iframe src="{R2 预签名 URL}">`（绕开 Next.js 服务器，省带宽）

### 环境变量
```
R2_ACCOUNT_ID=<Cloudflare Account ID>
R2_ACCESS_KEY_ID=<API Token 创建时给的>
R2_SECRET_ACCESS_KEY=<API Token 创建时给的>
R2_BUCKET=ai-textbook-pdfs
```

配置地：Vercel 项目的 Environment Variables + Cloud Run 服务的 env vars。

### 代码改造估算
- `@aws-sdk/client-s3` 封装：**1 小时**
- `uploads.ts` / 其他调用点改写：**1 小时**
- Python OCR server 适配：**30-40 分钟**
- 预签名 URL 机制接入前端：**30 分钟**
- 本地联调 + 生产验证：**1-1.5 小时**
- **合计：3-4 小时实际工作**

### 将来迁国内的路径
- 阿里云 OSS、腾讯云 COS 都提供 S3 兼容 endpoint
- 改 3 个环境变量 + 一次 rclone 数据迁移
- 主代码：**零改动**

---

## 6. 源 URL 清单

- [Cloudflare R2 Pricing](https://developers.cloudflare.com/r2/pricing/) — 存储 + 操作 + egress 0 定价
- [Cloudflare R2 AWS SDK JS v3](https://developers.cloudflare.com/r2/examples/aws/aws-sdk-js-v3/) — 代码接入示例
- [Cloudflare R2 S3 API Compatibility](https://developers.cloudflare.com/r2/api/s3/api/) — 支持的 S3 操作清单
- [Backblaze B2 Pricing](https://www.backblaze.com/cloud-storage/pricing) — 存储 / egress / 3× 规则
- [Backblaze B2 Transaction Pricing](https://www.backblaze.com/cloud-storage/transaction-pricing) — Class A/B 详解
- [Backblaze B2 AWS SDK JS V3](https://www.backblaze.com/docs/cloud-storage-use-the-aws-sdk-for-javascript-v3-with-backblaze-b2) — 代码接入
- [Backblaze B2 S3 Compatible API](https://www.backblaze.com/apidocs/introduction-to-the-s3-compatible-api) — 兼容性说明

---

## 7. 本次调研未覆盖（留给后续）

- R2 的 CDN 加速（Cloudflare 自家 CDN 白嫖）—— 决策 10 或 Launch 后考虑
- R2 的生命周期规则（自动删旧 PDF 节省存储费）—— 规模扩大后启用
- 预签名 URL 的过期时间策略 —— 实施时按安全审查定（推荐 15 分钟-1 小时）
- 多 Region 部署（R2 的 "Auto Location Hint"）—— MVP 单 region 足够
