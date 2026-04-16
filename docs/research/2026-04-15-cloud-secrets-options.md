---
date: 2026-04-15
topic: Secrets管理方案选型
type: research
status: resolved
keywords: [Secrets管理, 环境变量, Vercel, Cloud Run, 凭据轮换]
---

# 调研：Secrets 管理方案（决策 7）

**调研日期**：2026-04-15
**服务于决策**：云部署 brainstorm 决策 7（Secrets 管理）
**最终拍定**：**方案 A — 平台 env vars（Vercel + Cloud Run 各自配）**
**状态**：已完成（2026-04-15）

---

## 1. 调研背景与约束

### 为什么要讨论 secrets 管理
- 决策 2 选了 Vercel（Next.js 端）+ 决策 3 选了 Cloud Run（Python server 端）→ 两个独立平台
- 两端都要读 Cloudflare R2 凭据 + OCR 共享密钥 → 存在 shared secrets
- 若不规划就直接平台各配，轮换时容易只改一边造成不一致
- 若过早引入 Secret Manager，会增加代码复杂度和第三方依赖

### 关键预先发现（让 secrets 清单大幅缩小）

#### 发现 1：Google Vision 凭据根本不需要管
Cloud Run 运行时挂一个服务账号（Service Account, SA）。**授 SA "Cloud Vision AI User" 角色**后：
- Python `google-cloud-vision` 客户端自动用 **ADC（Application Default Credentials）**
- 无需 JSON key 文件、无需 API key、无需 env var
- 来源：[Authenticate to Vision](https://cloud.google.com/vision/docs/authentication)、[Using GCP SA Without JSON Key File](https://medium.com/product-monday/using-google-cloud-service-accounts-without-a-json-key-file-68e49870a4b6)

#### 发现 2：DATABASE_URL 已由决策 5 自动管理
Neon Vercel Integration 自动为每个环境（生产 / 每个 preview）注入 `DATABASE_URL`。
- 来源：决策 5 的 Neon integration 部分

#### 发现 3：净剩"shared secrets"只有 5 个
- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET`
- `OCR_SERVER_TOKEN`（Vercel↔Cloud Run 共享密钥）

**Only-Vercel secrets**（无需双端同步）：`ANTHROPIC_API_KEY` / `AI_MODEL` / session secret / 邀请码校验
**Only-Cloud Run secrets**：`OCR_PROVIDER=google`（非机密值）

### 候选池
- **A. 平台 env vars only**（Vercel + Cloud Run 各自配）
- **B. Google Secret Manager（GSM）统一**（Cloud Run 原生挂载 + Vercel 侧写代码拉取）
- **C. 第三方统一**（Doppler / Infisical，两端都有 integration）

### 硬约束
1. 不引入非必要的第三方依赖
2. 预算 $0/月（MVP）
3. 保护敏感值不被 UI/API 直接读取
4. 升级路径清晰（后期 secrets 增多可平滑升级）

---

## 2. 数据对比（2026-04-15 WebSearch 核实）

| 项 | A. 平台 env vars | B. Google Secret Manager | C. Doppler / Infisical |
|---|---|---|---|
| **首次配置** | 5 分钟（两边手动粘） | Cloud Run 侧 10 分钟 + Vercel 侧 30-60 分钟（WIF + SDK 代码） | 10-15 分钟（装 Vercel integration）+ GCP 侧额外脚本 |
| **轮换成本** | 两边手动同步改 | 改 GSM 一处即可 | 改 Doppler 一处即可 |
| **存储加密** | Vercel 默认加密 + "Sensitive" 标 / Cloud Run IAM 边界 | GSM 原生加密 | Doppler / Infisical 服务端加密 |
| **Vercel 原生集成** | 直接就是 Vercel 原生 | **无官方集成**（需自写 SDK + WIF） | Doppler 有 native integration |
| **GCP 原生集成** | Cloud Run env vars 直接就是原生 | **原生挂载**（无代码） | 无原生集成（需脚本） |
| **第三方依赖** | 无 | Google Cloud（反正已用） | Doppler 或 Infisical（新引入） |
| **免费层** | $0（64KB/deployment） | 6 active versions + 10K access/月 | Doppler 3 用户 / Infisical 5 用户 |
| **MVP 月费** | **$0** | **$0** | **$0** |

### 关键数字来源

- **Vercel env var 限额**：64 KB/deployment，单个 var 最大 64 KB；Edge runtime 限 5 KB/var。所有 env vars 默认加密存储；"Sensitive" 标记防 UI/API 读取
  - 来源：[Vercel Environment Variables](https://vercel.com/docs/environment-variables)、[Vercel Sensitive Environment Variables](https://vercel.com/docs/environment-variables/sensitive-environment-variables)
- **Google Secret Manager 免费层**：每月 6 active versions + 10K access operations + 3 rotation notifications，超额 $0.03/10K access
  - 来源：[Google Secret Manager Pricing](https://cloud.google.com/secret-manager/pricing)
- **GSM Cloud Run 原生挂载**：Cloud Run service 可把 GSM secret 挂成 env var 或文件，无代码改动，受 IAM 控制
  - 来源：[Secret Manager overview](https://docs.cloud.google.com/secret-manager/docs/overview)
- **GSM Vercel 侧无原生集成**：需写 SDK 代码（@google-cloud/secret-manager）+ 配 Workload Identity Federation（GCP 侧）
  - 来源：[Next.js GSM Discussion #60367](https://github.com/vercel/next.js/discussions/60367)、[GCP Secret Manager Vercel Edge Functions](https://hoop.dev/blog/how-to-configure-gcp-secret-manager-vercel-edge-functions-for-secure-repeatable-access/)
- **Doppler 免费层**：3 用户（对 1 人 MVP 够用），有 Vercel native integration，改 Doppler 自动 push 到 Vercel env vars
  - 来源：[Doppler Vercel Integration](https://www.doppler.com/integrations/vercel)、[Infisical vs Doppler](https://www.doppler.com/blog/infisical-doppler-secrets-management-comparison-2025)
- **Infisical 免费层**：5 用户，开源 + SaaS 都可，Vercel integration 存在
  - 来源：[Infisical Pricing](https://infisical.com/pricing)
- **Cloud Run SA + Vision API 免 key**：授 "Cloud Vision AI User" 后 ADC 自动生效
  - 来源：[Cloud Vision Authentication](https://cloud.google.com/vision/docs/authentication)

---

## 3. 各方案分析

### A. 平台 env vars only（选定）

**它是什么**：Vercel dashboard 加 5 个 shared + 3 个 only-Vercel env vars；Cloud Run 控制台加 5 个 shared + 1 个 only-Cloud Run env vars。各存各的。

**优点**：
1. **0 学习成本**：Vercel 和 Cloud Run 的 env vars UI 本来就是平台默认交互
2. **0 第三方依赖**：不引入任何新账号
3. **Vercel Sensitive 标记**：防 UI / API 读取
4. **Cloud Run env vars 在 Google 安全边界内**：物理上和 GSM 同数据中心、同 IAM 体系，实际安全性差距很小
5. **月费 $0**

**缺点**：
1. **手动同步 5 个 shared vars**：首次配完就稳定，轮换时两边都要改
2. **无审计日志**：谁改的什么值无记录（但 MVP 阶段单人团队无所谓）
3. **无自动版本化**：改了旧值就没了

**选错代价**：极低。未来可从 A 随时升级到 B（Cloud Run 原生挂 GSM + Vercel 侧要不要加 SDK 各自决定）或 C。代码基本零改动。

### B. Google Secret Manager 统一（未选）

**它是什么**：所有 shared secrets 存在 GSM（Google 家的密码箱）。Cloud Run 原生挂载（UI 配置，无代码）；Vercel 侧写 SDK + 配 Workload Identity Federation 拉取。

**优点**：
1. 单一 source of truth
2. 自动版本化（改错能回滚）
3. 有完整审计日志
4. Cloud Run 原生挂载非常干净（10 分钟配置，无代码）
5. MVP 用量下免费

**为什么不选**：
1. **Vercel 侧无官方原生集成**：需手写 SDK 代码 + 配 Workload Identity Federation，合计 30-60 分钟
2. **净收益小**：换来的是"省 5 个字段手动同步"；MVP 阶段 secrets 近乎不轮换
3. **Vercel 侧的 SDK 代码增加了 build/runtime 开销**（运行时首次拉取有延迟）

**未来可能升级时**：Cloud Run 侧可以**独立**先切到 GSM 挂载（无 Vercel 侧代价），Vercel 侧继续用 env vars。这是"半升级"路径，弹性最大。

### C. Doppler / Infisical 统一（未选）

**它是什么**：用 Doppler（或 Infisical）做中心密码箱，Vercel 装 native integration，改 Doppler 自动 push 到 Vercel env vars。GCP 侧需要额外脚本或手动同步。

**优点**：
1. **Vercel 端自动同步**（比 B 方便）
2. 统一 UI 管所有 secrets
3. 支持一键轮换 + 审计日志
4. 免费层够用

**为什么不选**：
1. **额外第三方账号依赖**：Doppler / Infisical 挂掉 / 涨价 / 数据泄露，都是额外攻击面
2. **GCP 侧无一等集成**：需自写脚本同步或手动双写
3. **对 1 人团队是增量复杂度，不是增量价值**
4. **供应链风险**：Doppler / Infisical 本身被攻破，所有 secrets 暴露

**未来可能升级时**：secrets > 15 个或团队 > 3 人时再评估。

---

## 4. 拍定 A 的决策链

1. **Google Vision 凭据消失** + **DATABASE_URL 由 Neon 集成自动管理** → 净剩 shared secrets 只有 5 个，同步痛点很小
2. **Vercel Sensitive 标记 + 默认加密**：Vercel 侧的安全基线已足够
3. **Cloud Run env vars 在 IAM 边界内**：Google 侧的安全基线已足够
4. **方案 B 的核心阻碍在 Vercel 侧**：GSM 没 Vercel 原生集成，要写代码 + 配 WIF，为 5 个字段不值得
5. **方案 C 引入第三方依赖**：1 人 MVP 的边际收益小于边际风险
6. **升级路径开放**：Cloud Run 侧可以未来单独切 GSM（10 分钟），不锁死在 A

---

## 5. 代码/运维影响

### 需要做的配置

#### Vercel env vars（在 Vercel project settings 页配）
| Key | 作用域 | 敏感度 |
|---|---|---|
| `R2_ACCOUNT_ID` | Production + Preview | 普通 |
| `R2_ACCESS_KEY_ID` | Production + Preview | **Sensitive** |
| `R2_SECRET_ACCESS_KEY` | Production + Preview | **Sensitive** |
| `R2_BUCKET` | Production + Preview | 普通 |
| `OCR_SERVER_URL` | Production + Preview | 普通（URL 非敏感） |
| `OCR_SERVER_TOKEN` | Production + Preview | **Sensitive** |
| `ANTHROPIC_API_KEY` | Production + Preview | **Sensitive** |
| `AI_MODEL` | Production + Preview | 普通 |
| session secret | Production + Preview | **Sensitive** |
| `DATABASE_URL` | **Neon integration 自动注入** | 由 Neon 管 |

#### Cloud Run env vars（在 Cloud Run service settings 页配）
| Key | 敏感度 |
|---|---|
| `R2_ACCOUNT_ID` | 普通 |
| `R2_ACCESS_KEY_ID` | 敏感（Cloud Run 无 Sensitive 标记但受 IAM 控制） |
| `R2_SECRET_ACCESS_KEY` | 敏感 |
| `R2_BUCKET` | 普通 |
| `OCR_SERVER_TOKEN` | 敏感 |
| `OCR_PROVIDER` | 普通（固定值 `google`） |
| Google Vision 凭据 | **不需要**（ADC via SA IAM） |

### 安全红线（免费但必做）
1. **Vercel 敏感 secrets 勾 "Sensitive"**：`R2_SECRET_ACCESS_KEY` / `R2_ACCESS_KEY_ID` / `OCR_SERVER_TOKEN` / `ANTHROPIC_API_KEY` / session secret
2. **Cloud Run SA 最小权限**：只给 "Cloud Vision AI User" + "Artifact Registry Reader"（决策 6 需要）；**不要**给 "Editor" / "Owner"
3. **R2 API Token 最小权限**：只授 "Object Read & Write" 对 `ai-textbook-pdfs` 这一个 bucket，不给 Account 级权限
4. **全量 secrets 清单保留到密码管理器**（1Password / Bitwarden）做 off-platform 备份；若 Vercel / GCP 账户丢失，不至于所有 secrets 同时丢
5. **真实用户上线前轮换一次**：MVP 开发期的 secrets 被 CCB / 开发者手工输入过多次，正式上线前建议全部轮换

### 无需改代码
- `src/lib/s3.ts`（决策 4 计划新写的）：直接读 `process.env.R2_*`
- `src/lib/ocr-client.ts`：直接读 `process.env.OCR_SERVER_URL` / `OCR_SERVER_TOKEN`
- Python OCR server：直接读 `os.environ['R2_*']` 和 `os.environ['OCR_SERVER_TOKEN']`；Vision 客户端自动 ADC，无需任何 env 配置

### 将来升级到 B 的路径
- Cloud Run 侧（无代码改动）：
  1. GSM 里建 5 个 secret
  2. Cloud Run service config 把 env var 从"plain value"改成"Secret Manager reference"
  3. IAM 授 Cloud Run SA "Secret Manager Secret Accessor"
  4. 重启 service
- Vercel 侧（可选升级）：保持 env vars 不变，或引入 SDK + WIF（30-60 分钟）

### 将来迁移国内的路径
- 阿里云 / 腾讯云容器服务都支持服务账号 IAM 调 OCR API 类似 ADC 机制
- R2 凭据改成阿里云 OSS 凭据，存法仍是 env vars，代码零改动（S3 SDK 自动兼容）

---

## 6. 源 URL 清单

- [Vercel Environment Variables](https://vercel.com/docs/environment-variables) — 限额 + 默认加密
- [Vercel Sensitive Environment Variables](https://vercel.com/docs/environment-variables/sensitive-environment-variables) — Sensitive 标记防 UI/API 读取
- [Vercel Rotating Secrets](https://vercel.com/docs/environment-variables/rotating-secrets) — 轮换最佳实践
- [Google Secret Manager Pricing](https://cloud.google.com/secret-manager/pricing) — 免费层 6 versions + 10K access/月
- [Google Secret Manager Overview](https://docs.cloud.google.com/secret-manager/docs/overview) — Cloud Run 原生挂载
- [Cloud Vision Authentication](https://cloud.google.com/vision/docs/authentication) — ADC via SA，免 key
- [Using GCP SA Without JSON Key File](https://medium.com/product-monday/using-google-cloud-service-accounts-without-a-json-key-file-68e49870a4b6) — Cloud Run 原生 IAM
- [Next.js + @google-cloud/secret-manager Discussion](https://github.com/vercel/next.js/discussions/60367) — Vercel 侧 GSM SDK 方案
- [GCP Secret Manager + Vercel Edge Functions Guide](https://hoop.dev/blog/how-to-configure-gcp-secret-manager-vercel-edge-functions-for-secure-repeatable-access/) — Vercel 侧 WIF 方案
- [Doppler + Vercel Integration](https://www.doppler.com/integrations/vercel) — 方案 C 参考
- [Infisical Pricing](https://infisical.com/pricing) — 方案 C 参考
- [Infisical vs Doppler Comparison 2025](https://www.doppler.com/blog/infisical-doppler-secrets-management-comparison-2025) — 第三方对比

---

## 7. 本次调研未覆盖（留给后续）

- **自动轮换策略**：GSM 支持 rotation notifications；MVP 阶段手动轮换即可，规模扩大后引入
- **preview 环境的 secrets 策略**：当前计划 preview 和 production 共享 R2 credentials（Neon branch 隔离数据库 ok，R2 隔离不是 MVP 必须）。升级路径：为 preview 单独配一个 R2 bucket + 一套凭据
- **邀请码校验 secret 的存放**：归为"only-Vercel secret"，后续 M-Auth 相关决策再细化
- **密钥泄露应急流程**：Runbook 类文档，等真正有用户时再写
- **CI/CD 里的 secrets**：Cloud Build 自动继承 Cloud Run service 的 env vars，无需额外配置（决策 6 已覆盖）
