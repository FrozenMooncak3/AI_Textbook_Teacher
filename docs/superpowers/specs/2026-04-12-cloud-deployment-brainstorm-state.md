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
- **待云化部分**：Next.js app + OCR server
- **预算**：接受每月付费，上限预期 $10/月（OCR server 免费层内存不够）
- **测试路径**：push 到 master → 平台自动部署 → 浏览器打开测（可选 preview 环境）

## 已识别的上云约束（从 milestone-audit 搬运）

`docs/architecture.md` 部署架构 section 已写入 ⚠️ 标记：

1. OCR server 内存需求 ≥ 1GB（PaddleOCR 模型加载）；首次启动需下载模型，冷启动慢
2. `uploads` volume 共享依赖：若 app 与 ocr 跨主机部署，PDF 文件传递方式需重设计（URL / 对象存储 / 流式上传）
3. OCR server 当前无认证，Docker 内网可用；暴露到公网必须加 auth 或放 VPC 内
4. `DATABASE_URL` 被 app 和 ocr 两侧直连，Neon pooler 连接数限制要考虑

---

## 待 brainstorm 的关键决策（按依赖顺序）

### 决策 1：OCR 处理方式【最大分叉 — 下一个】

这个决策决定要不要部署 OCR server，**90% 的其他决策依赖于此**。

候选：
- **A. 自托管 PaddleOCR 上云**：延续现状，云上常驻 OCR server（持续付费跑容器）
- **B. 切云 OCR API**：Google Cloud Vision / Mistral OCR / Aliyun OCR 按次付费，删除 OCR server
- **C. 混合**：截图问 AI（高频低量）用云 API，PDF 大批处理（低频大量）继续自托管

### 决策 2：Next.js 部署平台

- Vercel（原生 Next.js 支持，免费层够 MVP）
- Railway（全栈都能放）
- Fly.io（更灵活但配置多）

### 决策 3：OCR server 部署平台（仅决策 1 = A 或 C 时需要）

- Railway / Fly.io / Render / 自建 VPS

### 决策 4：PDF 文件存储

- 服务器本地 `uploads/`（要求 app 和 OCR 同机或共享卷）
- 对象存储（S3 兼容：Cloudflare R2 / Backblaze B2）
- Vercel Blob（和 Vercel 深度集成）

### 决策 5：环境分离

- 单一生产环境（最简单）
- 生产 + preview（push 分支自动起临时 URL，Vercel 原生支持）
- 生产 + dev（分开的 Neon DB branch）

### 决策 6：CI/CD

- 平台原生（push master 自动部署，零配置）
- GitHub Actions（显式 pipeline）

### 决策 7：Secrets 管理

- 平台 env vars（各自配，最简单）
- 统一 secret manager

### 决策 8：域名与 HTTPS

- 平台子域先用（`xxx.vercel.app`）
- 自购域名 + DNS 配置

### 决策 9：监控与错误追踪

- Vercel 自带 / Sentry / 不做（MVP 阶段）

### 决策 10：分阶段实施

- 一次到位 vs 拆成几个小里程碑

---

## 当前进度

- ✅ 基础方向已拍（只保留云环境）
- ✅ 上云约束已识别（4 条 ⚠️）
- 🔄 下一步：决策 1（OCR 处理方式）
- 每完成一个决策更新本文件的"已拍"和"待 brainstorm"区

---

## 恢复指南（下次 session）

1. 读本文件
2. 读 `docs/architecture.md` 末尾「部署架构」section 的 ⚠️ 4 条约束
3. 从决策 1（OCR 处理方式）开始 brainstorm
4. 按 CLAUDE.md "与项目负责人沟通协议" 的 5 问格式给选项
5. 每拍定一个决策，更新本文件的"已拍"区

## 最终产出

brainstorm 全部完成后：
1. 本文件转为 `docs/superpowers/specs/2026-04-12-cloud-deployment-design.md`（正式 design spec）
2. 进 writing-plans 写 `docs/superpowers/plans/2026-04-??-cloud-deployment-plan.md`
3. 进 task-execution 派发给 Codex（后端 / 部署配置） 和 Gemini（如果前端需要调整）
