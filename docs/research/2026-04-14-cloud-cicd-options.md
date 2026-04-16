---
date: 2026-04-14
topic: CI/CD自动化方案选型
type: research
status: resolved
keywords: [CI/CD, Cloud Run, GitHub, 自动部署, Docker]
---

# 调研：CI/CD 方案（决策 6）

**调研日期**：2026-04-14
**服务于决策**：云部署 brainstorm 决策 6（CI/CD 自动化方案）
**最终拍定**：**Cloud Run Continuous Deployment（UI 绑定 GitHub）**
**状态**：已完成（2026-04-14）

---

## 1. 调研背景与约束

### 为什么要讨论 CI/CD
- 决策 2 选了 Vercel → Next.js 端 push 即部署已是原生行为，**不需要配置**
- 决策 3 选了 Cloud Run → Python server 每次改代码需要"build Docker 镜像 → 推 Registry → 更新 Cloud Run service"三步
- 若不自动化，每次改 `scripts/ocr_server.py` 都要手跑 `gcloud run deploy --source .`（易忘 + 无部署历史）

**决策 6 本质上只决定 Python server 的自动部署方式**，Next.js 端已由决策 2 自动解决。

### 候选池
- **A. 平台原生 only**（Vercel 自动 + Cloud Run 手动 `gcloud run deploy --source .`）
- **B. GitHub Actions 统一**（两端都走同一份 `.github/workflows/deploy.yml`）
- **C. Cloud Run Continuous Deployment**（UI 绑 GitHub repo，底层用 Cloud Build trigger）

### 硬约束
1. 不引入高学习成本的新工具（产品负责人非技术）
2. 预算 $0/月（MVP 阶段）
3. 和已拍的 Cloud Run（决策 3）同生态最优
4. 避免"改前端也触发后端重建"的空跑浪费
5. 可升级路径要清晰（MVP 后加 lint/test 时不要重来）

### MVP 用量估算
- Python server 改动频率：**1-5 次 push/天**
- 每次 Docker build 时长：**3-5 分钟**（pymupdf + pymupdf4llm + google-cloud-vision 依赖较小，无 PaddleOCR 重模型）
- 每天总构建时长：**15-25 分钟**

### 决策维度
| 维度 | 为什么重要 |
|------|----------|
| 学习成本 | 产品负责人能否看懂配置界面 |
| 月费 | 预算敏感（总预算 $10/月以内） |
| 过滤精度 | 无关 commit 要不要空跑（影响 Cloud Build 消耗） |
| 审计可追溯 | 部署历史能否查 |
| 可升级路径 | 将来要加 lint/test 怎么办 |

---

## 2. 数据对比（全部 2026-04-14 WebSearch 核实）

| 项 | A. 平台原生 only | B. GitHub Actions | C. Cloud Run CD |
|---|---|---|---|
| **首次配置时间** | 0 | 30-60 分钟（WIF + secrets 配置） | 10-15 分钟（UI 点选） |
| **每次改动的手工成本** | 手敲 gcloud 命令 | 0（push 即触发） | 0（push 即触发） |
| **YAML 文件** | 无 | 必须写 `deploy.yml` | 无（UI 配置） |
| **文件路径过滤** | 不适用 | 需手写 `paths` 条件 | UI 勾选 + 填 glob |
| **部署历史** | 无（本地 shell 记录） | GitHub Actions 页面 | Cloud Build 控制台 |
| **认证方式** | gcloud 本地登录 | Workload Identity Federation (WIF) | Cloud Build SA 自动 |
| **免费层月费** | **$0** | **$0** | **$0** |
| **超额定价** | 不触发 | 公共 repo GitHub Actions 免费；私有 2000 min/月 | Cloud Build $0.006/min |

### 关键数字来源

- **Cloud Build 免费层**：120 build-minutes/天（e2-standard-2，**always-free 永久**）；每账单账户每月合计约 3600 分钟
  - 来源：[Google Cloud Build Pricing](https://cloud.google.com/build/pricing)
- **Cloud Build 超额**：$0.006/分钟（e2-standard-2，2025-11-01 起新定价）
  - 来源：[Google Cloud Build Pricing Update](https://cloud.google.com/build/pricing-update)
- **Artifact Registry 免费层**：0.5 GB 永久存储免费（按 billing account 汇总，不是 per-project）
  - 来源：[Google Artifact Registry Pricing](https://cloud.google.com/artifact-registry/pricing)
- **Cloud Run CD 底层实现**：Google 在后台自动帮你建一个 Cloud Build trigger，UI 等价于 Cloud Build YAML 的简化版
  - 来源：[Cloud Run Continuous Deployment](https://docs.cloud.google.com/run/docs/continuous-deployment)
- **文件路径过滤语法**：Cloud Build trigger 的 `includedFiles` / `ignoredFiles`，支持 `**` glob
  - 来源：[Cloud Build Automating Builds](https://cloud.google.com/build/docs/automating-builds/create-manage-triggers)
- **Dockerfile vs buildpacks**：Cloud Run 源码部署时，有 Dockerfile 就用 Dockerfile；没有则用 Google Buildpacks 自动识别语言
  - 来源：[Deploy services from source code](https://docs.cloud.google.com/run/docs/deploying-source-code)
- **GitHub Actions GCP 认证**：Google 官方 2023 起废弃 Service Account Key JSON 方案，推荐 **Workload Identity Federation (WIF)** —— 无密钥、短期 token、GitHub OIDC 交换
  - 来源：[Enabling Keyless Authentication from GitHub Actions](https://cloud.google.com/blog/products/identity-security/enabling-keyless-authentication-from-github-actions)

### MVP 月费拆解

| 资源 | MVP 消耗 | 免费层 | 超额费 |
|------|---------|--------|--------|
| Cloud Build 时长 | 450-750 min/月（15-25 min/天 × 30） | 3600 min/月 | $0 |
| Artifact Registry 存储 | 1-2 GB（镜像 400-800MB × 2-3 版本） | 0.5 GB | 若不清理：约 $0.10-0.15/月 |
| Cloud Build → Cloud Run egress | 同 GCP 内网 | 免费 | 不适用 |

**结论**：MVP 月费 **$0**（需要定期清理 Artifact Registry 旧镜像维持 0.5GB 免费层；若懒得清理，付 $0.10-0.15/月也不影响总预算）

---

## 3. 各方案分析

### A. 平台原生 only（未选）

**它是什么**（给产品负责人）：Next.js 在 Vercel 保持 push 即部署（原本就是如此）；Python server 改代码后由开发者手敲一行 `gcloud run deploy --source .`，Google 帮你 build + deploy。

**优点**：
1. **0 配置**，MVP 阶段马上能用
2. 无需学任何 CI/CD 概念
3. 小改动快速验证

**缺点**：
1. **每次改 Python 都要手动**：易忘（尤其跨天/下班后补改）
2. **无部署历史**：什么时候改的什么版本只能靠 git log 反推
3. 长期迭代的代价会随项目成长而放大

**为什么不选**：产品目标是长期迭代，手动部署的代价会随每次改动累积。A 只适合"一次性部署就不再改"的场景。

### B. GitHub Actions 统一（未选）

**它是什么**（给产品负责人）：在仓库根目录加一份 `.github/workflows/deploy.yml`，写好步骤。push 触发后 GitHub 服务器：
1. 用 WIF 免密登录 GCP
2. 用 `google-github-actions/deploy-cloudrun` 部署
3. Vercel 端仍用 Vercel 自己的 push 监听

**优点**：
1. 一份配置控制两端
2. PR 可触发自定义检查（lint / test / build check）
3. 未来加测试阶段非常方便
4. 配置文件跟着代码走版本控制

**缺点**：
1. **首次 WIF 配置 30-60 分钟**：GCP IAM Workload Identity Pool + Provider + Service Account + GitHub secrets 四步配置
2. **YAML 对非技术产品负责人不友好**：配置文件维护门槛高
3. MVP 还没有 lint/test 流程，核心优势发挥不出来

**为什么不选**：B 的核心优势（跨平台统一 + PR 流水线）对 1 人 MVP 没价值；多出来的 30-60 分钟配置换不到相应回报。**后期若要加自动测试阶段，C→B 迁移成本极低**（UI 解绑后配 WIF + 写 YAML）。

### C. Cloud Run Continuous Deployment（选定）

**它是什么**（给产品负责人）：Cloud Run 控制台里点几下绑 GitHub repo，以后 push 到 master，Google 自动帮你 build + deploy Python server。Vercel 部分保持 Vercel 自己的自动部署，互不影响。

**优点**：
1. **同家同面板**：和决策 3 的 Cloud Run 共用控制台，学一次就够
2. **0 YAML**：全 UI 配置，对非技术用户最友好
3. **文件路径过滤 UI 原生支持**：`includedFiles: scripts/**,Dockerfile*` 避免前端改动空跑
4. **部署历史自动留存**：Cloud Build 控制台自动记录每次 build + 结果 + 日志
5. MVP 月费 **$0**

**缺点**：
1. UI 配置不能放入版本控制（相比 YAML 略失"配置即代码"）
2. 未来要加单元测试/Lint 需切 `cloudbuild.yaml` 或 GitHub Actions（但这是后话）

**选错代价**：极低。UI 解绑 5 分钟，切 B 方案只需配 WIF + 写 YAML，无代码改动。

---

## 4. 拍定 C 的决策链

1. **决策 3 已锁 Cloud Run** → 在 Cloud Run 面板里增加一个"自动部署"选项是"同家自家功能"，零引入新生态
2. **产品负责人非技术** → UI 点配置 > YAML 写配置 > shell 手敲
3. **MVP 场景单一**（改一个 Python server 文件就触发部署） → B 的"流水线灵活性"优势发挥不出来
4. **未来升级路径清晰**：C → B 平滑（解绑 UI 后配 WIF + 写 YAML，无代码变动）
5. **月费 $0**（Cloud Build 120 min/天 + Artifact Registry 0.5GB 均在免费层内）

---

## 5. 代码/运维影响

### 首次配置步骤（约 10-15 分钟，一次性）

1. GCP Console → Cloud Run → 选 Python server service → **Set up continuous deployment**
2. 授权 Google Cloud Build GitHub App（类似 Vercel 连 GitHub 的 OAuth 流程）
3. 选仓库 + 分支（master）
4. Build Type 选 **Dockerfile**（指定路径，如 `scripts/Dockerfile`）
5. Advanced 填 **Included files filter**：`scripts/**,Dockerfile*`
6. 保存 → Google 自动在后台创建 Cloud Build trigger + 服务账号 + IAM 绑定

### 新写的代码/配置
- `scripts/Dockerfile`（决策 3 已规划，确保 COPY 的路径只包含 Python server 需要的文件，不带 `node_modules` / `src/` 的前端代码）
- `.gcloudignore`（可选，进一步缩减 build context 体积）

### 环境变量
Cloud Run service 的 env vars（需在 GCP Console 的 service 配置页填，**不是**在 Cloud Build 里填）：
```
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET=ai-textbook-pdfs
OCR_PROVIDER=google
GOOGLE_APPLICATION_CREDENTIALS=/secrets/vision-sa.json   # 决策 7 要细化
OCR_SERVER_TOKEN=<shared secret with Vercel>
```

Cloud Build 构建时不读这些，它们是运行时 env。

### 日常运维
| 操作 | 频率 | 耗时 |
|------|------|------|
| 改 Python 代码 → git push | 日常 | 自动部署 3-5 分钟 |
| 改前端/docs/其他 | 日常 | Cloud Build **不触发**（被 includedFiles 过滤） |
| 登 Artifact Registry 删旧镜像（保持 < 0.5GB） | 月度 | 约 2 分钟 |

### 回滚
Cloud Run 原生支持 revision 回滚，Console 一键切换流量到旧版 revision，或用 `gcloud run services update-traffic --to-revisions=<old>=100`。

### 将来迁移国内的路径
- **切阿里云容器服务 ACK / 腾讯云 TKE**：都有类似的"仓库自动部署"UI 功能（阿里云云效、腾讯云 CODING）
- **切 GitHub Actions（方案 B）**：新写 YAML + 配 WIF，一次性 30-60 分钟

---

## 6. 源 URL 清单

- [Cloud Run Continuous Deployment](https://docs.cloud.google.com/run/docs/continuous-deployment) — UI 设置 + 底层 Cloud Build trigger
- [Cloud Run Quickstart: Deploy from Git repository](https://docs.cloud.google.com/run/docs/quickstarts/deploy-continuously) — 首次配置步骤详解
- [Cloud Run Deploy from Source](https://docs.cloud.google.com/run/docs/deploying-source-code) — Dockerfile vs buildpacks 规则
- [Cloud Build Pricing](https://cloud.google.com/build/pricing) — 120 min/天免费 + $0.006/min 超额
- [Cloud Build Pricing Update Nov 2025](https://cloud.google.com/build/pricing-update) — 新定价生效说明
- [Artifact Registry Pricing](https://cloud.google.com/artifact-registry/pricing) — 0.5GB 永久免费 + $0.10/GB 超额
- [Cloud Build Trigger includedFiles/ignoredFiles](https://cloud.google.com/build/docs/automating-builds/create-manage-triggers) — 文件路径过滤语法（`**` glob）
- [Deploy to Cloud Run with GitHub Actions](https://cloud.google.com/blog/products/devops-sre/deploy-to-cloud-run-with-github-actions) — 方案 B 参考
- [Enabling Keyless Authentication from GitHub Actions](https://cloud.google.com/blog/products/identity-security/enabling-keyless-authentication-from-github-actions) — WIF vs JSON Key 官方建议
- [google-github-actions/deploy-cloudrun](https://github.com/google-github-actions/deploy-cloudrun) — 官方 Action（方案 B 用）
- [google-github-actions/auth](https://github.com/google-github-actions/auth) — WIF Action（方案 B 用）

---

## 7. 本次调研未覆盖（留给后续）

- **Cloud Build 自定义构建步骤**（e.g. 在 build 阶段跑 pytest）—— MVP 用不到，未来切 B 方案时再补
- **多环境部署策略**（preview 环境 Python server 是否也走独立 CD 流水线）—— 决策 5 的方案 B2 仅涉及数据库 branch；Python server 保留单一生产 service，preview 环境复用（Python server 无状态、读取 R2 相同，共用不会串数据）
- **镜像清理自动化**（Artifact Registry lifecycle policy 自动删旧 revision）—— 初期手动清理，规模扩大后引入
- **部署回滚自动化策略**（Cloud Run traffic splitting / canary）—— 决策 9/10 涉及，暂不展开
- **build 缓存优化**（加快 3-5 分钟的 build 时间）—— MVP 频次低不值得优化
