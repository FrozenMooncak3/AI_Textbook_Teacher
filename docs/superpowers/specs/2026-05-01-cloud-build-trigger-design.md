# Cloud Build Trigger 配置设计

**日期**：2026-05-01
**状态**：进行中（brainstorm WIP → spec → review → 实施）
**关联**：[brainstorm WIP](2026-05-01-cloud-build-trigger-brainstorm-state.md) · [research 04-14](../../research/2026-04-14-cloud-cicd-options.md) · [journal 04-29](../../journal/2026-04-29-cloud-build-trigger-gap.md)

---

## 1. 背景与范围

（决策 1 锁定）本次 brainstorm 是 **落地填坑**，不重新选方案：

- 方案 C（Cloud Run Continuous Deployment / Cloud Build GitHub trigger）2026-04-14 调研已拍定，理由依然有效
- M4.6 T16 commit `f097994` 只补了 yaml 的 deploy 步骤，没建 trigger
- 1 年来 OCR server 改动靠手动 `gcloud builds submit`，触发了 M4.7 T5.4 PPTX smoke 失败

不重新讨论方案 C vs B（GitHub Actions）vs A（手动）。

---

## 2. 部署目标

（决策 2 锁定）trigger 配 **生产环境** Cloud Run service `ai-textbook-ocr`，**不**同时建 staging：

- master 分支 push → 自动 build + push 镜像 + deploy 到生产 `ai-textbook-ocr`（us-central1）
- staging 环境推迟到 **MVP 上线前**（M5 收尾、抖音/小红书引流前那一天）独立工程实现

---

## 3. Trigger 配置

### 3.1 监听条件（决策 3 锁定）

`includedFiles` glob 精确白名单 4 文件：

```
scripts/ocr_server.py
scripts/pptx_parser.py
Dockerfile.ocr
cloudbuild.ocr.yaml
```

**对齐原则**：白名单 = `Dockerfile.ocr` 实际 COPY 的内容 + 构建配置文件。Dockerfile 加新 COPY 时同步更新白名单。

**风险兜底**：未配 staging 环境，自动部署直达生产。Cloud Run 默认保留旧 revision，出问题在 console "Manage Traffic" → 旧版 100% → 5 秒级回滚。

### 3.2 关联 yaml + image tag 改造

**复用现有 `cloudbuild.ocr.yaml`** 三步流水线（build → push → deploy），但 **image tag 必须从硬编码 `:first` 改为 `:$SHORT_SHA`**（commit hash 模式）。

**为什么改**：
- 当前 yaml line 3/5/11/17 把 image tag 写死 `:first`，每次手动 `gcloud builds submit` 都覆盖同一个 tag
- trigger 自动驱动后每次 push 都覆盖 → 镜像层无法按 commit 追溯，Artifact Registry 永远只有一个 tag、N 个 untagged 旧 layer，月度清理时分不清哪条是当前
- Cloud Build trigger 自带 `$SHORT_SHA` / `$COMMIT_SHA` / `$BUILD_ID` substitution 变量，业界惯例使用

**改动范围**（plan 阶段执行，本次 brainstorm 标定方向）：
- yaml line 3 / 5 / 11 / 17 把 `:first` 全改 `:$SHORT_SHA`
- yaml `images:` 段同步改
- 首次 trigger smoke 时验证 Artifact Registry 出现 commit-sha 命名的新镜像
- Cloud Run revision 的 image digest 自动指向新 sha

**回滚保护**：Cloud Run revision 锁的是 image digest（不是 tag），即使新 push 覆盖 tag，旧 revision 仍能切回去。tag 化只影响"看镜像层"的人体感，不影响 traffic 切换。

### 3.3 Build 失败通知（决策 4 锁定）

**方式**：Cloud Build 控制台原生 Notifications 功能，发邮件到用户 GCP 账号邮箱（`zs2911@nyu.edu`）

**配置入口**：GCP Console → Cloud Build → Settings → Notifications → 配置邮件接收人

**邮件内容**：build ID + 失败步骤名 + Cloud Build 日志页链接

**首次部署后验证**：
1. 故意推一个会失败的 commit（比如 `Dockerfile.ocr` 写错一行）触发 build
2. 检查 GCP 邮件是否到达；若进垃圾箱则把 GCP 通知发件域加 Gmail 白名单
3. 验证完后回滚那次故意失败的 commit

**拒绝**：Slack/Discord webhook（用户当前不用 Slack/Discord，单为此开群无必要）。

---

## 4. IAM 权限（决策 6 锁定）

**Principal**：Cloud Build 默认 SA `<project-num>@cloudbuild.gserviceaccount.com`（GCP UI 显示 "Cloud Build Service Account"）

**新增 3 个 role**：

| Role（UI 显示） | 标识符 | 作用 |
|-----------------|---------|------|
| Cloud Run Admin | `roles/run.admin` | deploy 到 Cloud Run service `ai-textbook-ocr` + 调 setIamPolicy |
| Service Account User | `roles/iam.serviceAccountUser` | impersonate Cloud Run runtime SA |
| Artifact Registry Writer | `roles/artifactregistry.writer` | push 镜像到 `us-central1-docker.pkg.dev` |

**为什么 admin 不是 developer**：M4.6 T16 commit body 历史用的是 `roles/run.admin`；deploy 步骤 `gcloud run deploy --quiet` 在某些情况会调 `setIamPolicy`（把 invoker 加到 service），developer 权限不够会报 "Permission denied: cannot setIamPolicy"。决策 6 的"加多无害 role 没成本"逻辑同样适用——admin 一刀切免后续踩坑。

**默认已有**（不重加）：`cloudbuild.builds.editor` + `storage.admin`

**Principal 怎么找**（非技术 user 必读）：
GCP Console 的 IAM 列表里 principal 显示名直接是 `Cloud Build Service Account`，**无需手填编号**。点该行的 ✏️ Edit 按钮 → 在 "Add another role" 里搜上面 3 个 role name 加进去 → Save。

**操作**：纯 GCP Console UI（IAM & Admin → IAM → 找 principal → Edit → Add Another Role），不需要 gcloud CLI / access token。

**Plan 阶段**：和 trigger 配置合并到一个步骤，按顺序：先 IAM 加 role → 后 trigger 配置 → smoke。详细操作清单在 plan 里给。

---

## 5. 首次回归测试（决策 5 锁定）

trigger 配置完成后，**一次性手工 smoke**确认整条链路。预计耗时 10 分钟。

### 5.1 步骤清单

**Smoke 前先记录**：打开 Cloud Run console → service `ai-textbook-ocr` → 记下当前 latest revision 编号（如 `00009-g9d`）；smoke 期望出现一个新 revision，编号 = 当前 +1（如 `00010-xxx`）。这样不管 smoke 之前有没有手工部署污染过 revision 序号都能正确判断。

| # | 操作 | 预期结果 |
|---|------|---------|
| 0 | （前置）记录 service `ai-textbook-ocr` 当前 latest revision 编号 N | 记下 N（如 `00009-g9d`） |
| 1 | 在 `scripts/ocr_server.py` 加一行注释 `# trigger smoke 2026-05-01` | 文件改动 |
| 2 | `git commit -m "test: cloud build trigger smoke"` + `git push origin master` | push 成功 |
| 3 | 30s—1min 内打开 Cloud Build console | 出现新 build job in PENDING/RUNNING |
| 4 | 等 3-5 分钟看 build 完成 | status = SUCCESS |
| 5 | 打开 Cloud Run console → service `ai-textbook-ocr` → Revisions tab | latest revision 编号 = N+1（编号严格大于第 0 步记录） |
| 6 | curl `<cloud-run-url>/health` | 返回 HTTP 401 或 200（IAM-only 服务无 Bearer token 时 401 是预期；只要**有 HTTP 头**即证明容器已起来），timeout / 503 = 容器启动失败需查 logs |
| 7 | revert 测试注释 commit + 再 push 一次 | master 干净 |

### 5.2 失败排查

- step 3 没出现 build job → trigger 没正确监听（决策 3 路径过滤错了，或 trigger 没启用）
- step 4 status FAILURE → 看 Cloud Build 日志，常见原因：依赖装不上、Docker 推 Artifact Registry 权限不够（→ 决策 6）
- step 5 没新 revision → Cloud Build 跑成功但 deploy 步骤失败，看 yaml 第 3 步 gcloud run deploy 日志
- step 6 503 / timeout → 容器启动失败，Cloud Run logs 看 `python ocr_server.py` 启动错误

---

## 6. Staging 推迟与 Skill 集成

### 6.1 触发条件

MVP 上线前（M5 收尾后、抖音/小红书引流前那一天）必建 staging。

### 6.2 Skill 集成（决策 7 修订 2026-05-01）— 仅 Layer 1，Layer 2 推迟

**Layer 1：数据驱动（本次落地）**

`docs/journal/INDEX.md` 停车场段 T1「MVP 上线前必建 staging 环境」条目。session-init skill 每 session 开场扫停车场，命中"触发条件到期"自动 surface 到 CEO 仪表盘。

**Layer 2：硬 check（推迟到 M5 收尾时实施）**

review 暴露 Layer 2 实施细节没定 + 会卡死 M4.7 closeout：
- spec 原写"M5 之后所有里程碑触发"——但没定怎么**机械检测当前是 M5 还是 M4.7**（project_status.md 里没 frontmatter milestone 字段；finishing-a-development-branch SKILL 里没"closeout chain 放行前"明确插入点）
- 估时"10 分钟"实际不现实——需要先决定：milestone 标记 schema、staging-built 标记位文件、SKILL 插入步、M5 之前默认放行逻辑

**修订决定**：本次 T1 仅做 Layer 1；Layer 2 推迟到 M5 收尾时统一做。

**理由**：
- 硬 check 是预防性机制，离 staging 真要建的时间点（M5 收尾后）最近时实施，逻辑最精确
- 现在做容易卡 M4.7 / M4.8 closeout（任何 M5 前的 closeout 都会被错误拦截）
- 推迟不丢逻辑——停车场 T2 条目会带这个任务到 M5 收尾时

### 6.3 停车场新增 T2 条目（替代原 6.3 plan 任务）

写入 `docs/journal/INDEX.md` 停车场「工程流程」段：

> **T2** 给 `.claude/skills/finishing-a-development-branch/SKILL.md` 加 staging 硬 check 段——M5 收尾时实施，配合 staging 环境建设一并落地。需要一并定：milestone 标记 schema、staging-built 标记位、SKILL 插入步、放行逻辑。

本次 plan **不**包含 SKILL 改动任务。

---

## 7. 验收标准

plan 落地后必须满足以下全部条目：

### 7.1 IAM
- [ ] Cloud Build 默认 SA（GCP UI 显示 `Cloud Build Service Account`）拥有 `roles/run.admin` + `roles/iam.serviceAccountUser` + `roles/artifactregistry.writer`
- [ ] 验证方式：GCP Console → IAM 页面，3 role 出现在该 principal 行

### 7.2 Trigger 配置
- [ ] Cloud Build → Triggers 列表存在新 trigger，name 建议 `ai-textbook-ocr-master-deploy`
- [ ] Source = ai-textbook-teacher repo / branch = `^master$`
- [ ] Build config = `cloudbuild.ocr.yaml`
- [ ] Included files filter = `scripts/ocr_server.py`, `scripts/pptx_parser.py`, `Dockerfile.ocr`, `cloudbuild.ocr.yaml`（4 行）
- [ ] Trigger 状态 = Enabled

### 7.3 失败通知
- [ ] Cloud Build → Settings → Notifications 配置存在
- [ ] 邮件接收人 = `zs2911@nyu.edu`
- [ ] 触发条件 = build 失败时

### 7.4 首次 smoke 通过
- [ ] §5.1 步骤 0-7 全部走完（含 step 0 前置记录当前 rev）
- [ ] Cloud Build job status = SUCCESS
- [ ] Cloud Run service `ai-textbook-ocr` 出现新 revision，编号严格大于 step 0 记录的 N
- [ ] Artifact Registry 出现新镜像，tag 为 commit short-sha（验证 §3.2 image tag 改造生效）
- [ ] `curl <cloud-run-url>/health` 返回 HTTP 401 或 200（IAM-only 服务无 Bearer 时 401 即正常；timeout/503 = 容器启动失败）
- [ ] 测试 commit revert 后 master 干净

### 7.5 Skill 集成（修订：仅 Layer 1）
- [ ] `docs/journal/INDEX.md` 停车场 T1「MVP 上线前必建 staging 环境」条目存在 ✅（brainstorm 阶段已落地）
- [ ] `docs/journal/INDEX.md` 停车场新增 T2「M5 收尾时给 finishing skill 加 staging 硬 check」条目（plan 实施阶段写入）
- [ ] **本 plan 不动** `.claude/skills/finishing-a-development-branch/SKILL.md`（Layer 2 推迟到 M5 收尾时）

### 7.6 文档同步
- [ ] `docs/architecture.md` 部署段更新（Cloud Run OCR 部署链 = 自动 trigger，4 文件白名单）
- [ ] **修正 `docs/architecture.md:533`** 既有错误描述——当前写 `includedFiles=scripts/**,Dockerfile.ocr,requirements.txt 自动 CD` 是错的（trigger 实际未建 + requirements.txt 不存在 + 路径不是 4 文件白名单）→ 改为本 spec §3.1 的实际 4 文件白名单
- [ ] **修正 `docs/changelog.md:568`**（M4.6 T14 entry）同样错误的 includedFiles 描述——加 correction note 或就地改写
- [ ] `docs/changelog.md` 加一条 2026-05-?? 实施完成
- [ ] `docs/project_status.md` 更新（T1 关闭，Cloud Build trigger 进入运行）
- [ ] 本 spec 文件状态从"进行中"改为"已实施"

---

## 8. 后续工作（M5 / MVP 上线相关）

- staging 环境建设（独立 spec / brainstorm）
- 监控告警（独立项）
- secrets 轮换（云部署阶段 3 已有研究）
