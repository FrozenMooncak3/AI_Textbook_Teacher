# Cloud Build trigger 缺失——OCR 改动 + Cloud Run 部署链断裂

**日期**：2026-04-29
**触发**：M4.7 T5.4 Path 4 PPTX smoke 失败定位
**Tier**：T1（基础设施 / MVP 上线前修复）

---

## 现象

M4.7 T5.4 4-Path API smoke 验证 PPTX 路径返回 500 SYSTEM_ERROR。Cloud Run 日志查到 OCR server 在 `/parse-pptx` 上返回 404，但 `scripts/ocr_server.py` 源码第 510 行 `@app.post("/parse-pptx")` 路由确实存在（commit `8b425ee` Apr 26 加的）。

定位到 Cloud Run 服务 `ai-textbook-ocr` 当前 latest revision = `00008-5jg`（Apr 24 部署），落后于 master HEAD 三个 OCR 改动 commit。

---

## 根因

`cloudbuild.ocr.yaml` 三步 pipeline 配置正确（docker build → push → `gcloud run deploy --memory=4Gi`），但**没有 Cloud Build trigger 在 git push 时触发它**。意味着：

- `scripts/ocr_server.py` / `cloudbuild.ocr.yaml` 改动后，需要手动运行 `gcloud builds submit --config=cloudbuild.ocr.yaml --project=awesome-nucleus-403711` 才会重建 + 部署
- 没人手动跑 → Cloud Run 永远停留在旧 revision
- 没有任何监控告警这个延迟

M4.6 T16 commit `f097994` 当时只补全了 yaml 的 deploy 步骤（之前是 build-only），但**没有同时配 trigger**，导致这个长期裸奔。

---

## 即时影响

- M4.7 T5.4 PPTX 路径无法验证，挂在用户手动 gcloud 部署上
- 任何后续 OCR server bug fix / 新端点都会同样 silent stale
- Phase 2 上线声明里"Cloud Run Vision OCR"实际是手工 ops，不是 CI/CD

---

## 修复方案（候选，T1 必做）

**方案 A · GitHub trigger（推荐）**：
- Cloud Build console → 创建 trigger
- 触发条件：push to master
- 路径过滤：`scripts/ocr_server.py` / `cloudbuild.ocr.yaml` / `Dockerfile.ocr`（如果有）
- 配置：`cloudbuild.ocr.yaml`
- 服务账号需要 `cloudbuild.builds.editor` + `run.developer`

**方案 B · gcloud CLI 自动 trigger**：
```bash
gcloud builds triggers create github \
  --repo-name=ai-textbook-teacher \
  --repo-owner=FrozenMooncak3 \
  --branch-pattern=^master$ \
  --build-config=cloudbuild.ocr.yaml \
  --included-files="scripts/ocr_server.py,cloudbuild.ocr.yaml" \
  --project=awesome-nucleus-403711
```

**方案 C · GitHub Actions 替代**：
- 现有 GCP workload identity federation 没配，要新增
- 比 Cloud Build trigger 复杂
- 不推荐

---

## 当前 workaround（用户手动部署）

每次改 `scripts/ocr_server.py` 后：
```bash
gcloud builds submit --config=cloudbuild.ocr.yaml --project=awesome-nucleus-403711
```

需要 user 自己的 gcloud 账号（vercel-ocr-invoker SA 是 invoke-only，没 cloudbuild/run/storage 部署权限）。

---

## 跟进

- M4.7 closeout 期间记录此项为 P1，不阻塞 M4.7 关闭
- 下一里程碑（M5 或单独的"上线前 ops 加固"）里补 trigger 配置
- 配完后回归测试：改一行注释 → push → 验证 Cloud Build 自动触发 → Cloud Run 出现新 revision

---

## 关联

- M4.6 T16 commit `f097994`（deploy step 加进 yaml，但没配 trigger）
- M4.7 T5.4 commit `8b425ee`（/parse-pptx 加进 source，但没自动部署）
- Cloud Run 服务 `ai-textbook-ocr` revision 00008-5jg（Apr 24 起 stale）

---

## 真相 retrospective（2026-05-02 T1 落地时发现）

本 journal 上面写的"trigger 没建"是**表面诊断错误**。实际真相：

### trigger `ocr-cd` 早就存在

- 4/19/2026 commit `efb2e28` 时已建（在 us-central1 region）
- 4/19 - 4/22 期间 yaml 是 build-only 2 步（无 deploy step）→ build 跑了但 Cloud Run 不变（设计上 OK，因为当时本来就靠人工部署）
- 4/22 M4.6 T16 commit `f097994` 加 deploy step 进 yaml后，trigger 配置**没同步更新 SA**

### 真因：SA 错配（13 天 5 次连续 fail）

`ocr-cd` trigger 配的 service account = **`ocr-cloudrun-sa@awesome-nucleus-403711.iam.gserviceaccount.com`**——这是 Cloud Run **runtime SA**（service 跑起来用的身份），**不是 build SA**。

`ocr-cloudrun-sa` 的 IAM role：
- ✅ `Artifact Registry Writer`（所以 step 1 build + step 2 push 镜像都成功）
- ✅ `Storage Admin` / `Logs Viewer` / `Service Usage Consumer`
- ❌ **缺 `roles/run.developer` / `roles/run.admin`**

每次 build → step 3 `gcr.io/cloud-builders/gcloud run deploy ai-textbook-ocr` → permission denied → exit 1。

### 5 次连续 fail 时间线

| Date | Commit | Trigger | Result |
|------|--------|---------|--------|
| 4/26 09:12 | `8b425ee` | ocr-cd | step 3 deploy fail |
| 4/28 12:35 | `6a1840e` | ocr-cd | 同上 |
| 4/28 13:32 | `2ef4763` | ocr-cd | 同上 |
| 4/29 03:01 | `765d41e` | ocr-cd | 同上 |
| 5/2 03:38 | `fbd2017` | ocr-cd | 同上（与新 trigger race） |

每次 build + push 成功（镜像悄悄进 Artifact Registry），但 Cloud Run 一直停在 `00009-g9d`（4/30 用户 access token bridge 手工部署的）→ 4/24 起的 `00008-5jg` 一直跑到 4/30。

### M4.7 T5.4 PPTX smoke 失败的真相

之前以为是"trigger 没建 → 手动部署没人做 → Cloud Run stale"。实际是"trigger 在跑但 deploy 一直 fail → Cloud Run stale"。**结果一样（stale），原因不同**。

### 修复（2026-05-02）

- 新 trigger `ai-textbook-ocr-master-deploy` 用 **Compute Default SA**（已是 Editor，权限齐全）→ smoke 通过
- 旧 trigger `ocr-cd` 已 **disabled**（保留作 audit；停车场 T2 决定是否删除）
- 4 文件白名单 + `:$SHORT_SHA` image tag + smoke 4 维度全绿

### 教训

1. Cloud Build 失败如果不主动看 console / 配 notification，可以无人察觉好几周（这次 13 天 5 次 fail 0 通知）
2. trigger config 里 service account 字段易混淆（runtime SA vs build SA）；未来配 trigger 时必须明确这两者职责
3. Phase 2.1 失败邮件告警 deferred 直接成为这次 retrospective 的重要遗留——MVP 上线前必须补，否则下个 fail 还是 silent
