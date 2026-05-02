# Cloud Build Trigger 配置 Brainstorm 进行中状态（WIP）

**创建日期**: 2026-05-01
**用途**: compact 防御——记录 brainstorm 进度，避免 session 断档丢失状态
**最终产出**: `docs/superpowers/specs/2026-05-01-cloud-build-trigger-design.md`

> ⚠️ compact 后恢复时**先读这个文件**，不要从 summary 重建。

---

## 基础设定（不会变）

- **背景**：M4.7 T5.4 PPTX smoke 暴露 OCR server 改动后 Cloud Run 部署链断裂——`cloudbuild.ocr.yaml` 1 年前已写好但 GitHub trigger 没建，每次改 `scripts/ocr_server.py` 都要手动 `gcloud builds submit`。
- **方案选定**：2026-04-14 调研早已拍定 **Cloud Run Continuous Deployment**（UI 绑 GitHub，底层 Cloud Build trigger）。本次 brainstorm 是落地填坑，不重选方案。
- **GCP 项目**：awesome-nucleus-403711
- **Cloud Run 服务**：`ai-textbook-ocr`（us-central1，rev 当前 `00009-g9d`）
- **现有 yaml**：`cloudbuild.ocr.yaml`（build → push → deploy 三步，已有）

---

## 调研

- [docs/research/2026-04-14-cloud-cicd-options.md](../../research/2026-04-14-cloud-cicd-options.md) — 方案 C 拍定 + 首次配置步骤 10-15 min + 月费 $0 + Cloud Build 免费层 120 min/天
- [docs/journal/2026-04-29-cloud-build-trigger-gap.md](../../journal/2026-04-29-cloud-build-trigger-gap.md) — 缺口诊断 + 候选 A/B/C（A 与 04-14 调研拍定的 C 是同一方案不同名字）

---

## 已拍死的决策（不再讨论）

### 决策 1：Brainstorm scope = 落地填坑（2026-05-01 拍板）

不重新评估方案 C vs B vs A。

**理由**：方案 C 调研覆盖 5 维度（学习成本/月费/过滤精度/审计/可升级路径）结论稳定；约束条件（产品负责人非技术、月费 $0、和 Cloud Run 同生态最优）均未变。

**拒绝替代**：方案 B（GitHub Actions）— 需 30-60 min WIF（Workload Identity Federation）配置 + `.github/workflows/deploy.yml` 维护门槛高，MVP 阶段无收益；`C → B` 升级路径在调研中已说明，未来加 lint/test 时再切。

---

### 决策 7：Staging skill 集成 = 仅 Layer 1，Layer 2 推迟到 M5 收尾时（2026-05-01 拍板，spec review 后修订）

**Layer 1（本次落地）**：journal/INDEX.md 停车场段 T1 「MVP 上线前必建 staging」条目。session-init skill 每 session 开场扫停车场命中"触发条件到期"自动 surface。

**Layer 2 推迟**（review 修订）：原计划本次改 `.claude/skills/finishing-a-development-branch/SKILL.md` 加硬 check，review 暴露：
- spec 没定怎么机械检测当前里程碑（project_status.md 无 frontmatter milestone 字段）
- finishing skill 内没"closeout chain 放行前"明确插入点
- 估时 10 分钟不现实——需先定 milestone schema / 标记位文件 / SKILL 插入步 / M5 之前默认放行逻辑
- 不修会卡死 M4.7 / M4.8 任何 M5 之前 closeout

**修订决定**：本次仅 Layer 1；Layer 2 移到停车场 T2「M5 收尾时给 finishing skill 加 staging 硬 check」，配合 staging 环境建设一并落地。逻辑最精确（离 staging 真要建的时间点最近）。

**实施位置**（修订）：本次 plan **不**包含 SKILL 改动；只新增停车场 T2 条目即可。

---

### 决策 6：Cloud Build SA IAM = 不查现状直接加齐 3 个 role（2026-05-01 拍板，spec review 后修订 developer→admin）

跳过"先查 IAM 现状再补缺"流程（用户机器无 gcloud CLI，access token 路走不通；查现状本身只是为了"少加 role"，但加多无害 role 没成本）。

**目标**：principal "Cloud Build Service Account"（GCP IAM UI 直接显示这个名字）加 3 个 role：

| Role | 作用 |
|------|------|
| Cloud Run Admin (`roles/run.admin`) | deploy 到 Cloud Run service ai-textbook-ocr + 调 setIamPolicy |
| Service Account User (`roles/iam.serviceAccountUser`) | impersonate runtime SA |
| Artifact Registry Writer (`roles/artifactregistry.writer`) | push 镜像到 `*.pkg.dev` |

**为什么 admin 不是 developer**（review 修订）：
- M4.6 T16 commit body 历史用的就是 `roles/run.admin`
- developer 在 `gcloud run deploy --quiet` 触发的 setIamPolicy 步骤可能 permission denied
- "加多无害 role 没成本"逻辑同样适用于 admin vs developer 的选择

GCP 项目默认已有 `cloudbuild.builds.editor` + `storage.admin`，不重加。

**操作方式**：纯 GCP Console UI 点选，不需要 CLI / token。Plan 会列详细步骤。

**拒绝替代**：
- a（Claude REST API 自助查 + 补）：用户机器无 gcloud CLI，token 路不通；查现状的价值不抵改用门槛
- 让用户在 Cloud Shell 浏览器拿 token：可行但操作链长，不如直接 IAM UI 加完

---

### 决策 5：首次回归 smoke = 人工 curl 探测（2026-05-01 拍板）

trigger 配置完成后，**一次性手工回归**确认整条链路工作：

1. 在 `scripts/ocr_server.py` 加一行无害注释（比如 `# trigger smoke 2026-05-01`）
2. `git commit -m "test: cloud build trigger smoke"` + `git push origin master`
3. 等 30s—1min 看 Cloud Build console 是否出现新 build job（确认 trigger 触发）
4. 等 build 完成（约 3-5 分钟），看 status = SUCCESS
5. 到 Cloud Run console 看 service `ai-textbook-ocr` 是否生成新 revision（应该是 `00010-xxx`，当前 `00009-g9d`）
6. curl `<cloud-run-url>/health` 验证服务健康（应返回 200）
7. 把测试注释 commit revert 掉再 push 一次（避免污染历史）

**理由**：
- 首次回归是"配完一次就做"的事，10 分钟搞定不需要自动化
- 验证整条链路：trigger 触发 + build 成功 + deploy 成功 + service 起来

**拒绝替代**：
- b（yaml 加自动 smoke step）：过度设计；首次回归这一次反而要人工看 build 结果，自动 smoke 更适合"长期保险"——记到停车场未来增强
- c（啥都不做）：T1 现状的复刻，配错了 trigger 不知道

**停车场新增**：T2「Cloud Build yaml 加自动 smoke step」未来增强——配完 trigger 后用了几次稳了再加。

---

### 决策 4：Build 失败通知 = GCP 自带邮件（2026-05-01 拍板）

Cloud Build 控制台原生 "Notifications" 功能，目标邮箱 = 用户已用 GCP 账号邮箱（zs2911@nyu.edu）。

**理由**：
- 必须通知，否则就是 T1 缺口的克隆病——M4.7 T5.4 PPTX 卡 stale revision 就是没通知
- 邮件够用：OCR build 失败一周最多 1 次，不需要 Slack 实时性
- 配置最简单：GCP console 5 分钟，零工程量
- 月费 $0

**首次配置后注意事项**：
- 检查邮件是否进 Gmail 垃圾箱，必要时把 GCP notification 发件域加白名单
- 邮件内容包含 build ID + 失败步骤 + 日志链接

**拒绝替代**：
- a（不通知）：T1 缺口的复刻
- c（Slack/Discord webhook）：用户目前不用 Slack/Discord，单为此开群没必要；Cloud Build notifier YAML 配置 + Cloud Functions 中转工程量约 20 分钟，超出"5 分钟搞定"目标

---

### 决策 3：Trigger 监听文件路径精度 = 精确白名单 4 文件（2026-05-01 拍板）

`includedFiles` glob：
- `scripts/ocr_server.py`
- `scripts/pptx_parser.py`
- `Dockerfile.ocr`
- `cloudbuild.ocr.yaml`

**理由**：
- Dockerfile.ocr 实际只 COPY 了 2 个 .py（ocr_server + pptx_parser），白名单和容器内容 1:1 对齐
- `scripts/` 下 40 个文件中 38 个是测试 / 一次性脚本（test-m6-* / test-scanned-pdf-* / seed-* / init-* 等），跟 OCR server 无关
- 风险兜底：Cloud Run 默认保留旧 revision，console 一键切回去 5 秒级回滚——比 staging-style 隔离更轻

**未来扩展**：若 Dockerfile.ocr 加新 COPY（比如 `scripts/ocr_image.py` 接进容器），同步把白名单加进 trigger。

**拒绝替代**：
- b（宽路径 `scripts/**`）：会把 38 个无关测试脚本误触发 OCR rebuild
- c（`scripts/*.py`）：scripts 下还有 test-scanned-pdf-*.py 测试 .py 会误触发

---

### 决策 2：staging 环境推迟到 MVP 上线前（2026-05-01 拍板）

本次 trigger 直接配到生产：`master push` → 自动部署到生产 Cloud Run service `ai-textbook-ocr`。**不**在本次同时建 staging 环境。

**理由**：
- 当前用户 = 你自己 + 极少量内测，bug 影响有限
- staging 工程量 1-2 天（新 R2 bucket / 新 Neon branch / 新 OCR token / 新 Cloud Run service）
- M5（留存机制）收尾、抖音/小红书引流前那一天再建，比现在硬塞节奏更稳

**触发条件**：MVP 上线前必建（已与 user 确认）

**Skill 集成需求**（用户明确要求"加入到各个该有的 skill 里"）：
- 停车场 INDEX 加 T1「MVP 上线前建 staging 环境」基础设施条目
- 探索把 staging 检查加进 `finishing-a-development-branch` / `milestone-audit`（决策 7 时定夺方式）

**拒绝替代**：思路 B（现在就建 staging）— 工程量打断 T1 速攻填坑节奏，与"trigger 配生产 5 分钟搞定"目标冲突。

---

## 待 brainstorm 的决策（按依赖顺序）

✅ 全部决策已拍板。等待 step 7c 完整性检查 + step 9 spec review + step 10 user review + step 11 writing-plans。

🟡 调研项——查 GCP REST API 当前 Cloud Build SA `<project-num>@cloudbuild.gserviceaccount.com` 的 role 现状：
- `run.developer` / `run.admin`（部署 Cloud Run）
- `iam.serviceAccountUser`（impersonate runtime SA）
- `artifactregistry.writer`（push 镜像）

确认缺哪些再补。

---

### 决策 7：Staging skill 集成方式

把"MVP 上线前建 staging"的提醒加到哪些 skill：
- 选项 a：仅停车场 INDEX.md 数据驱动 + session-init 自动扫描（最轻）
- 选项 b：a + 改 `finishing-a-development-branch` 加硬 check
- 选项 c：a + b + 改 `milestone-audit` 加 staging 检查段（最重）

---

## 当前进度

- ✅ 决策 1（scope = 落地填坑）
- ✅ 决策 2（staging 推迟到 MVP 上线前）
- ✅ 决策 3（trigger 监听 4 文件白名单）
- ✅ 决策 4（build 失败 GCP 自带邮件通知）
- ✅ 决策 5（首次回归 = 人工 curl smoke）
- ✅ 决策 6（IAM = 不查现状直接加齐 3 role）
- ✅ 决策 7（staging skill 集成 = 数据驱动 + finishing skill 硬 check）
- 🔄 下一步：spec 完整性检查 + spec review + 用户 review + writing-plans

---

## 最终产出

落盘 spec：`docs/superpowers/specs/2026-05-01-cloud-build-trigger-design.md`（spec skeleton 已 init）。spec review 通过后转 writing-plans。WIP 文件 spec 完整后保留作决策 trail（不删）。
