# T1 Cloud Build Trigger 配置实施 Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `task-execution` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 落地 Cloud Build GitHub trigger 让 OCR server 改动自动部署到 Cloud Run（修 1 年的 CI/CD 缺口），首次 smoke 验证整条链路 + 失败邮件通知。

**Architecture:** 5 phase 分工：
- Phase 0（Codex / 1 commit）：cloudbuild.ocr.yaml image tag 改造 + 2 处文档错误描述修正
- Phase 1-2（用户 / GCP Console UI）：IAM 加 3 role + Notifications 配邮件 + Trigger 创建
- Phase 3（用户 / smoke）：push 测试 commit → 看 build → 看 Cloud Run rev → curl /health
- Phase 4（用户 / 失败通知验证）：故意失败 commit → 看邮件
- Phase 5（Claude / 文档收尾）：changelog/project_status/journal/spec 状态同步 + 删 WIP

**Tech Stack:** GCP Cloud Build + Cloud Run + Artifact Registry + IAM；本地仅改 `cloudbuild.ocr.yaml` + 4 个 doc。

**关联**：[spec](../specs/2026-05-01-cloud-build-trigger-design.md) · [WIP](../specs/2026-05-01-cloud-build-trigger-brainstorm-state.md) · [research](../../research/2026-04-14-cloud-cicd-options.md)

---

## File Structure

**会修改**：
- `cloudbuild.ocr.yaml` — image tag `:first` → `:$SHORT_SHA`（4 行）
- `docs/architecture.md` — 修正 line 533 错误的 includedFiles 描述
- `docs/changelog.md` — 修正 line 568（M4.6 T14 entry）+ 文件末尾加 2026-05-?? 实施 entry
- `docs/project_status.md` — T1 关闭，trigger 进入运行状态
- `docs/journal/INDEX.md` — T1 cloud-build-trigger 从 in_progress 移到 resolved
- `docs/superpowers/specs/2026-05-01-cloud-build-trigger-design.md` — 状态从"进行中"改为"已实施"
- `docs/superpowers/INDEX.md` — spec/plan 状态从 in_progress 移到 resolved
- `docs/memory-audit-log.md` — 加 audit log

**会删除**：
- `docs/superpowers/specs/2026-05-01-cloud-build-trigger-brainstorm-state.md` — WIP 文件
- `C:\Users\Administrator\.claude\projects\d------Users-Sean-ai-textbook-teacher\memory\project_cloud-build-trigger-brainstorm-wip.md` — memory pointer
- `MEMORY.md` 索引行

**用户 GCP Console UI 操作**（不写代码）：
- IAM & Admin → IAM：Cloud Build SA 加 3 role
- Cloud Build → Settings → Notifications：配邮件
- Cloud Build → Triggers：创建 trigger
- Smoke：push 测试 commit + 看 console + curl

---

## Phase 0: 代码/配置改动（Codex 派发，1 commit）

### Task 0.1: 改 cloudbuild.ocr.yaml image tag `:first` → `:$SHORT_SHA`

**Why**：当前 yaml 4 行硬编码 `:first`，trigger 自动驱动后每次 push 都覆盖同 tag，镜像层无法按 commit 追溯。改成 `:$SHORT_SHA`（Cloud Build trigger 自带 substitution 变量）让每次 build 出唯一 tag。

**Files:**
- Modify: `cloudbuild.ocr.yaml` (4 处)

- [ ] **Step 1: 改 line 3 build 命令的 image tag**

把 line 3 的：
```yaml
    args: ['build', '-f', 'Dockerfile.ocr', '-t', 'us-central1-docker.pkg.dev/awesome-nucleus-403711/ai-textbook-teacher/ai-textbook-ocr:first', '.']
```
改成：
```yaml
    args: ['build', '-f', 'Dockerfile.ocr', '-t', 'us-central1-docker.pkg.dev/awesome-nucleus-403711/ai-textbook-teacher/ai-textbook-ocr:$SHORT_SHA', '.']
```

- [ ] **Step 2: 改 line 5 push 命令的 image tag**

把 line 5 的：
```yaml
    args: ['push', 'us-central1-docker.pkg.dev/awesome-nucleus-403711/ai-textbook-teacher/ai-textbook-ocr:first']
```
改成：
```yaml
    args: ['push', 'us-central1-docker.pkg.dev/awesome-nucleus-403711/ai-textbook-teacher/ai-textbook-ocr:$SHORT_SHA']
```

- [ ] **Step 3: 改 line 11 deploy 命令的 image flag**

把 line 11 的：
```yaml
      - '--image=us-central1-docker.pkg.dev/awesome-nucleus-403711/ai-textbook-teacher/ai-textbook-ocr:first'
```
改成：
```yaml
      - '--image=us-central1-docker.pkg.dev/awesome-nucleus-403711/ai-textbook-teacher/ai-textbook-ocr:$SHORT_SHA'
```

- [ ] **Step 4: 改 line 17 images 段**

把 line 17 的：
```yaml
  - 'us-central1-docker.pkg.dev/awesome-nucleus-403711/ai-textbook-teacher/ai-textbook-ocr:first'
```
改成：
```yaml
  - 'us-central1-docker.pkg.dev/awesome-nucleus-403711/ai-textbook-teacher/ai-textbook-ocr:$SHORT_SHA'
```

- [ ] **Step 5: 验证改动**

Run: `grep -n ':first' cloudbuild.ocr.yaml`
Expected: 0 matches（无 `:first` 残留）
Run: `grep -c ':\$SHORT_SHA' cloudbuild.ocr.yaml`
Expected: 4

---

### Task 0.2: 修正 architecture.md:533 错误 includedFiles 描述

**Why**：当前 line 533 写 `includedFiles=scripts/**,Dockerfile.ocr,requirements.txt`，三重错误：(a) trigger 实际还没建，(b) requirements.txt 不存在（Dockerfile.ocr 用内联 pip install），(c) 真实白名单是 4 文件不是 `scripts/**`。

**Files:**
- Modify: `docs/architecture.md:533`

- [ ] **Step 1: 用 Edit 替换错误描述**

old_string（精确匹配 line 533 的 includedFiles 字符串部分）：
```
Cloud Build GitHub trigger `includedFiles=scripts/**,Dockerfile.ocr,requirements.txt` 自动 CD
```

new_string：
```
Cloud Build GitHub trigger `includedFiles=scripts/ocr_server.py,scripts/pptx_parser.py,Dockerfile.ocr,cloudbuild.ocr.yaml` 自动 CD（M5 前期 T1 落地，2026-05-01 spec）
```

- [ ] **Step 2: 验证替换生效**

Run: `grep -n 'requirements.txt' docs/architecture.md`
Expected: requirements.txt 在该行已消失（其他行可能还有保留，无所谓）
Run: `grep -n 'pptx_parser.py,Dockerfile.ocr,cloudbuild.ocr.yaml' docs/architecture.md`
Expected: 1 line found

---

### Task 0.3: 修正 changelog.md:568（M4.6 T14 entry）错误描述

**Why**：同 0.2，T14 历史记录留谎言会误导未来 retrospective。

**Files:**
- Modify: `docs/changelog.md:568`

- [ ] **Step 1: 用 Edit 替换错误描述**

old_string（精确匹配 line 568 整行）：
```
- Cloud Build GitHub trigger：`includedFiles = scripts/**, Dockerfile.ocr, requirements.txt`，push master 自动重建（T14）
```

new_string：
```
- Cloud Build GitHub trigger：T14 当时**仅设计未配置**（含 includedFiles 误写为 `scripts/**, Dockerfile.ocr, requirements.txt`，但 trigger 实际未建直至 M5 前期 T1 才落地——见 `docs/superpowers/specs/2026-05-01-cloud-build-trigger-design.md`）
```

- [ ] **Step 2: 验证**

Run: `grep -n 'T14' docs/changelog.md`
Expected: line 568 出现新文案（含"实际未建"字眼），其他 T14 提及保持

---

### Task 0.4: Phase 0 commit

- [ ] **Step 1: stage + commit**

```bash
git add cloudbuild.ocr.yaml docs/architecture.md docs/changelog.md
git commit -m "chore(cloudbuild): yaml image tag :first → :\$SHORT_SHA + 修两处过期 includedFiles 描述

- cloudbuild.ocr.yaml line 3/5/11/17 改用 \$SHORT_SHA substitution
  让每次 build 产出独立 tag 镜像（trigger 驱动后必需，否则覆盖追溯丢）
- architecture.md:533 + changelog.md:568 includedFiles 文字订正
  原本写 scripts/** + requirements.txt 是 T14 设计未实施的描述，
  实际 trigger 直至 2026-05-01 T1 才会真正建（见 spec design.md）
"
```

- [ ] **Step 2: 验证 commit 落地**

Run: `git log -1 --oneline`
Expected: 新 commit 包含 "yaml image tag" 字样

---

## Phase 1: GCP IAM 配置（用户操作，5 分钟）

### Task 1.1: 给 Cloud Build SA 加 3 个 role

**Why**：`run.admin` 让 Cloud Build 能 deploy + setIamPolicy；`iam.serviceAccountUser` 让 Cloud Build 能扮演 Cloud Run runtime SA；`artifactregistry.writer` 让 Cloud Build 能 push 镜像。

**操作位置**：GCP Console（浏览器）

- [ ] **Step 1: 打开 GCP IAM 页面**

浏览器访问：https://console.cloud.google.com/iam-admin/iam?project=awesome-nucleus-403711

- [ ] **Step 2: 在 principal 列表里找 "Cloud Build Service Account"**

页面上 principal 列表中有一行 Name = `Cloud Build Service Account`，Principal 字段类似 `<num>@cloudbuild.gserviceaccount.com`。**不需要手填编号**——直接找这行。

- [ ] **Step 3: 点该行最右边的铅笔（Edit）图标**

弹出 "Edit access" 面板，左侧显示当前已有的 role 列表。

- [ ] **Step 4: 点 "ADD ANOTHER ROLE"，搜并选 Cloud Run Admin**

搜索框输入 `Cloud Run Admin` → 选中（标识符 `roles/run.admin`）。

- [ ] **Step 5: 再点 "ADD ANOTHER ROLE"，搜并选 Service Account User**

搜索 `Service Account User` → 选中（标识符 `roles/iam.serviceAccountUser`）。

- [ ] **Step 6: 再点 "ADD ANOTHER ROLE"，搜并选 Artifact Registry Writer**

搜索 `Artifact Registry Writer` → 选中（标识符 `roles/artifactregistry.writer`）。

- [ ] **Step 7: 点 SAVE**

界面回到 IAM 列表，"Cloud Build Service Account" 行的 Role 列应该新增上面 3 个 role 名。

- [ ] **Step 8: 验证**

刷新页面，确认 "Cloud Build Service Account" 行 Role 列至少包含：`Cloud Build Service Account` + `Cloud Run Admin` + `Service Account User` + `Artifact Registry Writer`（默认已有的 + 新加的 3 个）。

---

## Phase 2: Cloud Build 配置（用户操作，10 分钟）

### Task 2.1: 配 Cloud Build Notifications 邮件

**Why**：build 失败必须通知，否则就是 T1 缺口克隆病——M4.7 PPTX 那次就是没人知道部署链断了。

- [ ] **Step 1: 打开 Cloud Build Settings**

浏览器访问：https://console.cloud.google.com/cloud-build/settings/notifications?project=awesome-nucleus-403711

（如果路径不对，从 Cloud Build → Settings → 选 Notifications tab）

- [ ] **Step 2: 点 "ADD NOTIFICATION"**

类型选 `Email`（如果 GCP 提供选项）。

或者：如果 GCP 当前 UI 是 "Email notifications via Pub/Sub"，按 Cloud Build docs 流程：[Configuring email notifications](https://cloud.google.com/build/docs/configuring-notifications/configure-smtp-notifications) — 用最简模式（直接接 Gmail SMTP）或最简的 default Pub/Sub topic + Cloud Functions 投递。

**MVP 接受方式**：如果 GCP UI 没有"一键邮件"，可以暂时跳过本任务标 deferred，继续 Task 2.2/Phase 3 跑通主链路；失败通知降级为"用户手动隔几天看一眼 Cloud Build console"，并把"补失败通知"列入停车场 T2。

- [ ] **Step 3: 设置接收邮箱 = `zs2911@nyu.edu`**

填写接收人邮箱。

- [ ] **Step 4: 触发条件 = build 失败**

确保只在 build status = FAILURE 时通知（不要每次成功都发邮件，否则一周 1-2 封噪音）。

- [ ] **Step 5: 保存**

- [ ] **Step 6: 验证**

Notifications 列表里出现新规则。**真正的端到端验证留到 Phase 4**（故意失败 commit 触发邮件）。

---

### Task 2.2: 创建 Cloud Build Trigger

**Why**：本 plan 的核心动作——这个 trigger 1 年没建，今天补上。

- [ ] **Step 1: 打开 Cloud Build Triggers**

浏览器访问：https://console.cloud.google.com/cloud-build/triggers?project=awesome-nucleus-403711

- [ ] **Step 2: 点 "CREATE TRIGGER"**

- [ ] **Step 3: 填 Name = `ai-textbook-ocr-master-deploy`**

- [ ] **Step 4: Region 选 `us-central1`（和 Cloud Run service 同 region）**

- [ ] **Step 5: Description 填**：

```
Auto-deploy OCR server (ai-textbook-ocr) on master push when scripts/ocr_server.py / scripts/pptx_parser.py / Dockerfile.ocr / cloudbuild.ocr.yaml changes. Created 2026-05-01 per docs/superpowers/specs/2026-05-01-cloud-build-trigger-design.md.
```

- [ ] **Step 6: Event = "Push to a branch"**

- [ ] **Step 7: Source — 连 GitHub repo**

- 如果 GitHub App 还没装：会提示 "Connect a new repository" → OAuth 授权 Google Cloud Build GitHub App → 选 repo `FrozenMooncak3/ai-textbook-teacher`
- 如果已连过：直接选 `FrozenMooncak3/ai-textbook-teacher`

- [ ] **Step 8: Branch 填 `^master$`（regex 精确匹配 master）**

- [ ] **Step 9: 展开 Advanced 段，填 "Included files filter (glob)"**

填以下 4 行（一行一个 glob，不能合并）：
```
scripts/ocr_server.py
scripts/pptx_parser.py
Dockerfile.ocr
cloudbuild.ocr.yaml
```

**不填** "Ignored files filter"（保持空）。

- [ ] **Step 10: Configuration → Type = "Cloud Build configuration file (yaml or json)"**

- [ ] **Step 11: Location = "Repository"，文件路径 = `cloudbuild.ocr.yaml`**

- [ ] **Step 12: Service account 选 "default Cloud Build SA"**

下拉显示的是 `<num>@cloudbuild.gserviceaccount.com`。这是 Phase 1 加 role 的那个 SA。

- [ ] **Step 13: 点 CREATE**

- [ ] **Step 14: 验证**

Triggers 列表里出现 `ai-textbook-ocr-master-deploy`，状态 = Enabled。

---

## Phase 3: 首次 smoke 测试（用户操作，10 分钟）

### Task 3.1: 记录 smoke 前的 baseline

- [ ] **Step 1: 打开 Cloud Run service ai-textbook-ocr Revisions tab**

浏览器：https://console.cloud.google.com/run/detail/us-central1/ai-textbook-ocr/revisions?project=awesome-nucleus-403711

- [ ] **Step 2: 记录当前 latest revision 编号 N**

第一行 revision name 类似 `ai-textbook-ocr-00009-g9d`——记下编号 `00009-g9d`（或当前数字，可能更新）。后续 smoke 期望出现 `00010-xxx`（编号严格大于 N）。

写到本地草稿纸 / 备忘录："smoke 前 N = 00009-g9d"（或实际数字）。

---

### Task 3.2: push smoke 测试 commit

- [ ] **Step 1: 在 scripts/ocr_server.py 加一行注释**

打开 `scripts/ocr_server.py` 任意位置（推荐文件头），加一行：
```python
# trigger smoke 2026-05-01
```

- [ ] **Step 2: commit + push**

```bash
git add scripts/ocr_server.py
git commit -m "test: cloud build trigger smoke (2026-05-01)"
git push origin master
```

---

### Task 3.3: 验证 Cloud Build job 触发

- [ ] **Step 1: 打开 Cloud Build History**

浏览器：https://console.cloud.google.com/cloud-build/builds?project=awesome-nucleus-403711

- [ ] **Step 2: 30 秒—1 分钟内看到新 build job**

第一行应该是新 build，trigger source = `ai-textbook-ocr-master-deploy`，commit = 上一步 push 的 short sha，状态 = `Working` 或 `Queued`。

如果 30 秒后没出现：检查 trigger 是否 Enabled、includedFiles 是否拼对、push 的 commit 是否真改了 4 文件之一。

- [ ] **Step 3: 等 build 完成（3-5 分钟）**

刷新页面，状态应该变 `Success`（绿色）。

如果 `Failed`（红色）：点 build ID 看日志。常见失败原因：
- "Permission denied: artifactregistry.repositories.uploadArtifacts" → Phase 1 IAM `artifactregistry.writer` 没加上
- "Permission denied: setIamPolicy" → Phase 1 IAM `run.admin` 没加上（或加成 `run.developer` 了）
- "Build timeout" → Dockerfile.ocr pip install 慢，可能要等更久

---

### Task 3.4: 验证 Cloud Run 出现新 revision = N+1

- [ ] **Step 1: 回到 Cloud Run Revisions tab**

刷新 Task 3.1 那个页面。

- [ ] **Step 2: 看 latest revision**

应该出现新 revision，编号严格大于 Task 3.1 记录的 N（例如 N=00009，新的应该是 00010 或更大）。

如果 latest 还是 N：build 跑成功但 deploy 步骤可能失败——回 Cloud Build 看 yaml 第 3 步 `gcloud run deploy` 日志。

---

### Task 3.5: 验证 Artifact Registry 出现 commit-sha 镜像

**Why**：验证 §3.2 image tag 改造（`:$SHORT_SHA`）真生效。

- [ ] **Step 1: 打开 Artifact Registry**

浏览器：https://console.cloud.google.com/artifacts/docker/awesome-nucleus-403711/us-central1/ai-textbook-teacher/ai-textbook-ocr?project=awesome-nucleus-403711

- [ ] **Step 2: 找 tag = smoke 那个 commit 的 short sha**

镜像列表里应该出现一个新 tag = 7 位 commit hash（比如 `a3b5c7d`）——对应 Task 3.2 的 push commit。

如果只看到 `:first` 还是 `latest` 没有 sha：Phase 0 的 yaml 改造没真生效，回 Phase 0 复查。

---

### Task 3.6: curl /health 验证服务起来

- [ ] **Step 1: 跑 curl**

```bash
curl -i https://ai-textbook-ocr-408273773864.us-central1.run.app/health
```

- [ ] **Step 2: 看返回**

期望：HTTP 401（如果 IAM-only 仍然要 Bearer token）或 HTTP 200（如果 /health 是 public）。

**注意**：架构约束 OCR 是 IAM-only，所以 curl 直接打可能 401——这不算失败，只要返回**有 HTTP 头**说明服务起来了。如果是 timeout / 503：容器启动失败，看 Cloud Run logs `python ocr_server.py` 启动错误。

如果想真正测穿透，可以从 Vercel 的实际链路触发（推一个空 commit 或随便测一下 OCR 流程）——但本 smoke 主要验证部署链，不验证业务逻辑。

---

### Task 3.7: revert smoke 测试 commit

- [ ] **Step 1: 删那行注释**

```bash
git revert HEAD --no-edit
git push origin master
```

或者手动删那行注释 + commit + push。

- [ ] **Step 2: 验证**

revert push 也会触发 trigger（4 文件之一被改了），等 5 分钟看 Cloud Run 又出现一个新 revision = N+2。这是预期行为，证明 trigger 在持续工作。

---

## Phase 4: 失败通知验证（用户操作，10 分钟）

### Task 4.1: push 一个会失败的 commit

**Why**：Phase 2.1 配了邮件通知，但只有跑过一次 FAILURE 才能确认邮件真的发到 Inbox（而不是垃圾箱或邮箱过滤掉）。

**Cloud Build 配额提醒**：失败 build 也算 Cloud Build 免费配额（120 min/天，约 3600 min/月）。本次故意失败 build 在 pip install 阶段挂掉（约 2-3 min），消耗合理；OCR server 月正常 push 1-2 次 × 5 min = 月用量 ~50 min，远低于免费层。

- [ ] **Step 1: 在 Dockerfile.ocr 故意写错一行**

打开 `Dockerfile.ocr`，在 line 6 的 pip install 末尾加一个不存在的包：
```
RUN pip install flask PyMuPDF pymupdf4llm Pillow numpy boto3 google-cloud-vision sentry-sdk requests python-pptx==0.6.23 nonexistent-package-2026
```

- [ ] **Step 2: commit + push**

```bash
git add Dockerfile.ocr
git commit -m "test: trigger build failure to verify email notification"
git push origin master
```

---

### Task 4.2: 验证邮件到达

- [ ] **Step 1: 等 build 失败**

Cloud Build console 等 2-3 分钟看到 status = `Failed`。

- [ ] **Step 2: 查邮箱 zs2911@nyu.edu Inbox + Spam**

应该收到来自 GCP 的失败通知邮件，主题类似 "Cloud Build failed for ai-textbook-teacher / ai-textbook-ocr-master-deploy"。

如果 Inbox 没看到：查 Spam 文件夹。如果在 Spam：把 GCP notification 发件域加 Gmail 白名单（Settings → Filters → Create filter → from `*@google.com` 或具体发件域 → Never send to Spam）。

- [ ] **Step 3: 邮件内容应包含**

- Build ID
- Failed step name（应该是 "build" 或 "0"，因为 pip install 阶段失败）
- Cloud Build 日志页 URL

---

### Task 4.3: revert 失败 commit

- [ ] **Step 1: revert**

```bash
git revert HEAD --no-edit
git push origin master
```

- [ ] **Step 2: 等 build 成功**

revert 后 push 会再触发 trigger，build 应该 Success（因为 Dockerfile 恢复了）。Cloud Run 出现新 revision = N+3。

---

## Phase 5: 文档收尾（Claude 写）

### Task 5.1: changelog 加 2026-05-?? 实施 entry

**Files:**
- Modify: `docs/changelog.md`（文件末尾加一段）

- [ ] **Step 1: 读 changelog 末尾确定追加位置**

Run: `tail -20 docs/changelog.md`
确认追加格式与已有 entry 一致（日期标题 + 段落）。

- [ ] **Step 2: 在文件末尾追加新 entry**

格式：
```markdown
## 2026-05-?? — T1 Cloud Build trigger 落地（实际 push 日期填回）

**修复 1 年的 CI/CD 缺口**：cloudbuild.ocr.yaml 早写好但 GitHub trigger 一直没建，OCR server 改动需要手动 `gcloud builds submit`。M4.7 T5.4 PPTX smoke 失败暴露 stale 问题。

- IAM：Cloud Build SA 加 3 role（run.admin + iam.serviceAccountUser + artifactregistry.writer）
- Trigger：`ai-textbook-ocr-master-deploy` on master push，监听 4 文件白名单（ocr_server.py / pptx_parser.py / Dockerfile.ocr / cloudbuild.ocr.yaml）
- Notifications：失败邮件到 zs2911@nyu.edu
- Image tag：`:first` → `:$SHORT_SHA`（commit-sha 追溯）
- Smoke：4 phase 全绿（trigger 触发 + build success + new revision = N+1 + curl /health）
- 失败通知：故意失败 commit 验证邮件到达 + 白名单设置完成

**Spec**：`docs/superpowers/specs/2026-05-01-cloud-build-trigger-design.md`
**Plan**：`docs/superpowers/plans/2026-05-01-cloud-build-trigger.md`
**Layer 2 推迟**：finishing-a-development-branch SKILL 加 staging 硬 check 推到 M5 收尾时（停车场 T2）
```

- [ ] **Step 3: 替换实际日期**

把 `2026-05-??` 改成 Phase 4 完成那天的日期（如 `2026-05-02`）。

---

### Task 5.2: project_status.md 同步——T1 关闭

**Files:**
- Modify: `docs/project_status.md`（实际 line 112 + line 51 两处需要改）

- [ ] **Step 1: 先 grep 确认实际行号**

Run: `grep -n 'Cloud Build' docs/project_status.md`
预期输出 line 51 + line 112 + 其他历史描述（line 15 / 29 等是历史，不动）。

- [ ] **Step 2: 改 line 112 主条目（"Cloud Build 自动 trigger（停车场 T1，P1）"）**

注意 reviewer 指出 hooks 注入的 truncated 文本和实际文件不一致——以下 old_string 是 line 112 实际文本：

old_string：
```
- **Cloud Build 自动 trigger（停车场 T1，P1）**：M4.7 收尾发现 cloudbuild.ocr.yaml 已含 deploy step 但 GitHub push trigger 未配置，每次 OCR server 改动需手动 `gcloud builds submit` 或 Claude REST API 自助。M5 开始前先修。`journal/2026-04-29-cloud-build-trigger-gap.md` 列了候选方案 A/B/C
```

new_string（实施日期填回）：
```
- ✅ **2026-05-?? T1 Cloud Build 自动 trigger 落地**：trigger `ai-textbook-ocr-master-deploy` on master push 监听 4 文件白名单（ocr_server.py / pptx_parser.py / Dockerfile.ocr / cloudbuild.ocr.yaml）+ IAM 3 role（run.admin + iam.serviceAccountUser + artifactregistry.writer）+ 失败邮件通知 + smoke 全绿。Layer 2（finishing skill 硬 check）推迟到 M5 收尾时（停车场 T2）。Spec：`docs/superpowers/specs/2026-05-01-cloud-build-trigger-design.md`
```

- [ ] **Step 3: 改 line 51 "下一步"段的 P1 引用**

old_string：
```
4. **停车场 P1 修 Cloud Build GitHub trigger**：M5 开始前先做（journal `2026-04-29-cloud-build-trigger-gap.md` 候选方案 A/B/C）
```

new_string（删除该行——已落地不再是"下一步"）：
（直接删除整行 + 它前后留一个空行避免列表断裂，编号其他条目同步顺位）

- [ ] **Step 4: 验证两处都改了**

Run: `grep -n '停车场.*Cloud Build\|P1.*修 Cloud Build' docs/project_status.md`
Expected: 0 matches（两处旧描述都消失）

Run: `grep -n 'T1 Cloud Build 自动 trigger 落地' docs/project_status.md`
Expected: 1 match in line 112 area

---

### Task 5.3: journal/INDEX.md——T1 移到 resolved

**Files:**
- Modify: `docs/journal/INDEX.md`

- [ ] **Step 1: 把 in_progress 段的 cloud-build-trigger 条目删除**

old_string（精确匹配该行）：
```
- [infra:cloud-build-trigger] **T1 Cloud Build trigger brainstorm 进行中**（2026-05-01 启动）：scope = 落地填坑（不重选方案），trigger 配生产，staging 推迟到 MVP 上线前。已锁 2 决策，剩 5 决策（路径精度 / 失败通知 / 首次回归 / IAM 权限 / staging skill 集成） `[Cloud-Build, trigger, GitHub, Cloud-Run-CD, brainstorm, T1]` → [WIP](../superpowers/specs/2026-05-01-cloud-build-trigger-brainstorm-state.md) · [spec skeleton](../superpowers/specs/2026-05-01-cloud-build-trigger-design.md)
```

new_string：（删除该行，留空）

- [ ] **Step 2: 把停车场基础设施段的 T1 cloud-build-trigger 缺失条目改为 resolved**

old_string：
```
- **T1** 🚨 Cloud Build trigger 缺失——已进 brainstorm（2026-05-01）；条目移到 in_progress 段
```

new_string：（删除该行）

- [ ] **Step 3: 把 resolved 段加新条目**

按 INDEX.md 当前 resolved 段格式追加（找到 `## resolved（已解决）` 段顶部）：

```markdown
- [milestone:resolved] **T1 Cloud Build trigger 落地**（2026-05-??）：1 年 CI/CD 缺口修复，trigger `ai-textbook-ocr-master-deploy` + 4 文件白名单 + IAM 3 role + 失败邮件 + smoke 全绿 `[Cloud-Build, trigger, T1, M5-pre, CI/CD]` → [spec](../superpowers/specs/2026-05-01-cloud-build-trigger-design.md) · [plan](../superpowers/plans/2026-05-01-cloud-build-trigger.md)
```

---

### Task 5.4: spec / superpowers/INDEX 状态切换

**Files:**
- Modify: `docs/superpowers/specs/2026-05-01-cloud-build-trigger-design.md`
- Modify: `docs/superpowers/INDEX.md`

- [ ] **Step 1: spec 文件状态切换**

old_string：
```
**状态**：进行中（brainstorm WIP → spec → review → 实施）
```

new_string：
```
**状态**：已实施（2026-05-??；plan 见 ../plans/2026-05-01-cloud-build-trigger.md）
```

- [ ] **Step 2: superpowers/INDEX.md spec 段从 in_progress 移到 resolved**

把这一行：
```
- [2026-05-01] Cloud Build Trigger 配置（OCR 部署链补全）`[...]` → [spec](specs/2026-05-01-cloud-build-trigger-design.md) · [WIP](specs/2026-05-01-cloud-build-trigger-brainstorm-state.md)
```

从 `### 进行中（in_progress）` 段移到 `### 已完成（resolved）` 段，**移动时删 WIP 链接**（避免 Task 5.5 删 WIP 文件后留死链），最终格式：
```
- [2026-05-01] Cloud Build Trigger 配置（OCR 部署链补全）`[...]` → [spec](specs/2026-05-01-cloud-build-trigger-design.md)
```

- [ ] **Step 3: superpowers/INDEX.md plans 段从 in_progress 移到 resolved**

writing-plans skill 落盘时已自动加 plan 条目到 in_progress 段（line 63）：
```
- [2026-05-01] T1 Cloud Build Trigger 落地实施 `[Cloud-Build, trigger, IAM, smoke, T1, M5-pre, ai-textbook-ocr]` → [plan](plans/2026-05-01-cloud-build-trigger.md)
```

实施完成后把它从 `### 进行中（in_progress）` 移到 `### 已完成（resolved）` 段（**不要新增**——条目已存在）。

---

### Task 5.5: 删 WIP + memory pointer + 加 audit log

**Files:**
- Delete: `docs/superpowers/specs/2026-05-01-cloud-build-trigger-brainstorm-state.md`
- Delete: `C:\Users\Administrator\.claude\projects\d------Users-Sean-ai-textbook-teacher\memory\project_cloud-build-trigger-brainstorm-wip.md`
- Modify: `C:\Users\Administrator\.claude\projects\d------Users-Sean-ai-textbook-teacher\memory\MEMORY.md` (删 WIP 索引行)
- Modify: `docs/memory-audit-log.md` (加 audit)

- [ ] **Step 1: 删 WIP spec 文件**

```bash
git rm docs/superpowers/specs/2026-05-01-cloud-build-trigger-brainstorm-state.md
```

- [ ] **Step 2: 删 memory pointer 文件**

```bash
rm "C:\Users\Administrator\.claude\projects\d------Users-Sean-ai-textbook-teacher\memory\project_cloud-build-trigger-brainstorm-wip.md"
```

- [ ] **Step 3: 改 MEMORY.md 删 WIP 索引行**

old_string：
```
- [Cloud Build Trigger Brainstorm WIP](project_cloud-build-trigger-brainstorm-wip.md) — T1 落地填坑 brainstorm 进行中; staging 推迟到 MVP 上线前; WIP 完成后删此行
```

new_string：（删除该行）

- [ ] **Step 4: 在 docs/memory-audit-log.md 加 audit log**

文件末尾追加：
```markdown
2026-05-?? HH:MM | op:delete | file:project_cloud-build-trigger-brainstorm-wip.md | reason:T1 brainstorm + plan 全部落地完成，WIP memory pointer 不再需要
2026-05-?? HH:MM | op:edit | file:MEMORY.md | reason:Project 段删 Cloud Build Trigger Brainstorm WIP 索引行
```

---

### Task 5.6: Phase 5 commit

- [ ] **Step 1: stage + commit**

```bash
git add docs/changelog.md docs/project_status.md docs/journal/INDEX.md docs/superpowers/specs/2026-05-01-cloud-build-trigger-design.md docs/superpowers/INDEX.md docs/memory-audit-log.md
git rm docs/superpowers/specs/2026-05-01-cloud-build-trigger-brainstorm-state.md
git commit -m "docs(t1): T1 Cloud Build trigger 落地完成——文档全链同步

- changelog 加 2026-05-?? 实施 entry
- project_status 把 P1 Cloud Build trigger 遗留改为已落地
- journal/INDEX 把 T1 cloud-build-trigger 移到 resolved
- spec 状态进行中 → 已实施
- superpowers/INDEX spec + plan 段更新
- 删 WIP brainstorm-state.md（决策 trail 已留 spec design 文件）
- memory pointer 文件删 + MEMORY.md 索引行删 + audit log 同步

Layer 2 (finishing skill 硬 check) 推迟到 M5 收尾时实施（停车场 T2）。
"
```

- [ ] **Step 2: 验证**

Run: `git log -2 --oneline`
Expected: 看到 Phase 0 commit + Phase 5 commit 两条；中间没有别的 commit（Phase 1-4 都是 GCP UI 操作不动 git，除了 smoke 测试 commit 和 revert）。

实际上 git history 会有：
- Phase 0 yaml + doc 修正 commit
- Phase 3.2 smoke 测试 commit
- Phase 3.7 smoke revert commit
- Phase 4.1 故意失败 commit
- Phase 4.3 故意失败 revert commit
- Phase 5.6 文档收尾 commit

共 6 个 commit。这是预期。

---

## 验收标准（来自 spec §7）

实施后必须全部满足：

- [ ] **§7.1 IAM**：Cloud Build SA 拥有 `run.admin` + `iam.serviceAccountUser` + `artifactregistry.writer`
- [ ] **§7.2 Trigger 配置**：`ai-textbook-ocr-master-deploy` 存在 + branch `^master$` + 4 文件白名单 + Enabled
- [ ] **§7.3 失败通知**：Notifications 配置存在 + 邮件接收人 `zs2911@nyu.edu` + 触发条件 = FAILURE
- [ ] **§7.4 首次 smoke 通过**：Phase 3 step 0-7 走完 + Cloud Build SUCCESS + Cloud Run new revision N+1 + Artifact Registry 新镜像 short-sha tag + curl /health 有 HTTP 头
- [ ] **§7.5 Skill 集成（修订仅 Layer 1）**：journal/INDEX 停车场 T1 staging 条目 ✅ + T2 finishing skill 硬 check 条目 ✅ + plan **不动** finishing-a-development-branch SKILL.md
- [ ] **§7.6 文档同步**：architecture.md:533 + changelog.md:568 修正 ✅ + changelog 新 entry ✅ + project_status T1 关闭 ✅ + spec 状态切换 ✅

---

## Rollback Plan

如果 Phase 1-2 配置后 Phase 3 smoke 卡住无法跑通：

- **trigger 没触发**：去 Cloud Build → Triggers → 暂停或删除 trigger，回到 1 年来"手动 gcloud builds submit"状态。Phase 0 的 yaml `:$SHORT_SHA` 改造**不需要回滚**，手动 submit 也能用 substitution。
- **build 失败 IAM 问题**：去 IAM 把 Phase 1 加的 3 role 删掉，trigger 也删，恢复到原状态。
- **deploy 后 Cloud Run 起不来**：Cloud Run console → Revisions → 选 N（旧 revision） → Manage Traffic → 100% → 5 秒回滚。

后续重新尝试时按 plan 跑一遍即可。

---

## 后续工作（不在本 plan 内）

- M5 收尾时：停车场 T2「给 finishing-a-development-branch SKILL 加 staging 硬 check」
- M5 收尾时：staging 环境建设独立 spec / plan（新 R2 bucket + Neon branch + Cloud Run service `ai-textbook-ocr-staging` + OCR token）
- 若 Phase 2.1 邮件配置 GCP UI 不友好降级了：停车场 T2 加「补 Cloud Build 失败邮件通知」
