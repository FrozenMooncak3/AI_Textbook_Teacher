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
