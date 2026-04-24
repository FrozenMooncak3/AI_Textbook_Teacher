# 项目状态

> 当前项目状态的权威快照。SessionStart hook 自动注入。
> 里程碑切换 / 关键决策 / architecture 变动 / 新 spec 产生 / 阻塞变化时必须同步更新。

---

## 1. 当前里程碑

**方向**：MVP 扩展三线——扫描 PDF（✅）→ 教学系统（M4 ✅）→ 留存机制，串行执行

**进行中**：M4.6 OCR 管线修复 — 待真机复验后收官
- **T1-T4 完成**（2026-04-22）：IdTokenClient audience 缓存（`f98b548`）+ classify/extract-text fetch 30s timeout + retry×1（`7c54934`）+ stuck books cleanup SQL（`8a879f8`）+ docs 骨架
- **T15 hotfix 完成**（2026-04-23）：live test book 13（14.9MB 369 页）暴露 Cloud Run 容器 OOM 崩溃（`e0bb0c5`）。Python-side：`scripts/ocr_server.py` Vision client 模块级 singleton + 每 50 页 `gc.collect()` + progress log；Infra-side：用户 Console 手动 Cloud Run memory 512 MiB → 4 GiB
- **T16 hotfix 完成**（2026-04-23）：T15 push 后 Cloud Run 仍跑旧 revision 暴露 `cloudbuild.ocr.yaml` 只 build+push 不 deploy（`f097994`）。追加第 3 步 `gcloud run deploy` 固化 `--memory=4Gi`，未来 push `scripts/**` / `Dockerfile.ocr` 会自动 build → push → deploy 一条龙。IAM 前置（Cloud Build SA 需 `roles/run.admin` + `roles/iam.serviceAccountUser`）已标注 commit body
- **T17 hotfix 完成**（2026-04-24）：T15/T16 landing 后 book 16/17 仍卡 `parse_status=processing` 暴露真正主凶 — `src/app/api/books/confirm/route.ts:134` 裸 fire-and-forget 在 Vercel isolate 过早终止（classify-pdf 同步 25s，响应回来 Vercel 已死）（`d33a79f`）。用 `import { after } from 'next/server'` 包裹 runClassifyAndExtract，Vercel 内部走 `waitUntil` 延长 isolate 寿命。1 文件 +7 -2。`ocr-pdf` 同样 fire-and-forget 没暴露因为 1s 内 return 202（short fetch 赶在 isolate 死前完成）—— long-fetch vs short-fetch 对 isolate 寿命敏感度不同
- **原 waitUntil 假设部分正确**：T15 Cloud Run 日志证明 OOM 是真 bug，但 waitUntil 缺失也是真 bug（T17 证明）。两个独立 bug 被 T15 遮住。04-22 journal 推翻段需要再次回修
- **诊断能力升级**：用户给 SA `vercel-ocr-invoker@` 加 `roles/logging.privateLogViewer`，`.ccb/gcp-logs.js` 可自动抓 Cloud Run logs（Clash 7897 代理 + undici ProxyAgent + retry×5）
- **待**：用户部署 `d33a79f` 到 Vercel（master push 自动部署）+ 删除 stuck book 16/17 DB 行 + 再传一本新书验证全链路（classify → extract → ocr-pdf → callback → KP 提取 → `parse_status=done`），通过即 M4.6 收官
- → [spec](superpowers/specs/2026-04-22-m4.6-ocr-pipeline-design.md) · [plan](superpowers/plans/2026-04-22-m4.6-ocr-pipeline-fix.md) · [T15 诊断](journal/2026-04-22-m4.6-incomplete-fix-diagnosis.md)

**已完成**：
- **M4.5 PDF 上传重构 + 准备页 UX** ✅ 完成（2026-04-21 主体 + 2026-04-22 hotfix 链 + 收尾）：T1-T8 8 commit autonomous 落地 + T9-T10 用户手动配置 + T11 docs。M4.5 让 14MB+ 扫描 PDF 第一次能跑通完整管线，连环暴露 3 pre-existing bug，三个 hotfix 收掉：
  - **T12** `c061a1c`：confirm route BIGINT 类型 bug（pg driver 把 BIGINT 解码成 string，原代码 `===` 比较 string vs number 永远不等 → 14MB PDF 卡 confirm 400 UPLOAD_INCOMPLETE）。`BookRow.file_size` 类型改 string + Number() coerce
  - **T13** `f400bb8`：OCR callback 缺 trigger KP 提取（`triggerReadyModulesExtraction` 只在 classify 时调用，OCR 完成后没人重 trigger → kp_extraction_status 永卡 pending）。callback `module_id===0` + `module_id!==0` 两 success 路径 fire-and-forget 调 trigger
  - **T14** `c0f69de`：callback `module_id=0` UPDATE WHERE filter 排除 pending（OCR 服务跳过 'processing' 中间态直接发 book-level callback → UPDATE 永远 match 0 行 → module 卡 pending → trigger SQL 找不到 ready module）。WHERE 子句加 `IN ('pending','processing')`，一行 SQL + 1 回归测
  - 三 hotfix 都走 task-execution Full Review（subagent + Claude 双 pass + build/lint/test 三绿硬 check）
  - **遗留**：(a) live E2E 重跑因 Vercel→Cloud Run 出站 fetch hang 失败两次（OCR 服务本身 4.5s 返 200 正常，根因待 M4.6 诊断）— T13/T14 仅经单元测试 + 部署 READY 验证；(b) book 10/11/12 stuck artifacts 待 M4.6 cleanup
  - → [spec](superpowers/specs/2026-04-21-pdf-upload-refactor-design.md) · [plan](superpowers/plans/2026-04-21-m4.5-pdf-upload-refactor.md) · [research](research/2026-04-20-pdf-upload-speed-options.md)
- **云部署**（阶段 1 ✅ 2026-04-16；阶段 2 ✅ 2026-04-19；阶段 3 ⬜ 未开始：域名 + 监控 + Secrets）
- **M4 教学系统** ✅ 完成（2026-04-20 本 session 收尾）：19 tasks 全 PASS。L1 引擎：KP 类型迁移 + zod + schema（teaching_sessions + user_subscriptions + prompt_templates.model）+ retry/teaching-types/entitlement/teacher-model + teacher-prompts（Zod refine）+ seed 5 teacher 模板 + teaching-sessions API（create + messages retry + 409 struggling）+ L2 Tier A 6 后端端点（switch-mode / reset-and-start / clusters / module / start-qa / status 扩展）+ book-meta-analyzer。L2 Tier B 前端：Modal + BookTOC（基础 + 引导态）+ ObjectivesList + ModeSwitchDialog + /books 页改造 + /activate 激活页 + /teach 教学对话页（retry ×1）+ /teaching-complete 完成中页。Moat 硬约束：4 字段全 grep 0 hits。技术债登记：start-qa API stale redirectUrl（前端已 workaround）。→ [spec](superpowers/specs/2026-04-15-m4-teaching-mode-design.md) · [plan](superpowers/plans/2026-04-15-m4-teaching-mode.md)

**排队中**：M5 留存机制（未启动 — 待决策）

**下一步**：用户部署 T17（`d33a79f`，master push 自动 Vercel 部署）+ cleanup stuck book 16/17 + 重传真机验证全链路（期望第一次跑通 classify → OCR → KP → `parse_status=done`），成功即关 M4.6 → 起 M5

**平行 · 元系统进化**：✅ 完成（2026-04-19 本 session 端到端落地）。Survey → Spec → Plan → 10 commits（c423c63 / 7eb1313 / 3227a3d / 36b5303 / 0684391 / ed50bbf / d783baf / 96b25fd / cfe8456 / 024de5e），T1 8 低成本 + T2 Retrospective 2.0 + M10 review 外化全部上线。Kill switch：`AI_SYSTEM_EVOLUTION_DISABLE=1` 一键禁用所有 hook 机制。Spec: `superpowers/specs/2026-04-19-system-evolution-design.md`；Plan: `superpowers/plans/2026-04-19-system-evolution.md`。

---

## 2. 最近关键决策

- 2026-04-24 M4.6 T17 hotfix — Vercel isolate 过早终止修复（本 session 执行）：T15 + T16 landing 后 book 16/17 仍卡 processing 零进度，Cloud Run 日志显示 `classify-pdf` 11:49:05Z 收到请求，11:49:31Z 返回 200（耗时 25.5 秒），但 Vercel 侧 DB 未更新零后续日志。**T17 根因**：`src/app/api/books/confirm/route.ts:134` 的 `void runClassifyAndExtract(bookId, objectKey).catch(...)` 是裸 fire-and-forget，Vercel serverless isolate 在 `return Response` 后 ~10-15s 被终止；`classify-pdf` 内层 fetch 要 25s，响应到达时 isolate 已死 → `runClassifyAndExtract` 无法继续触发 extract-text / ocr-pdf → DB 永远停 processing。`ocr-pdf` 同样 fire-and-forget 没中枪因为 1s 内 return 202（short fetch 赶在 isolate 死之前）—— long-fetch vs short-fetch 对 isolate 寿命敏感度不同。**修**：`import { after } from 'next/server'` + `after(async () => { try { await runClassifyAndExtract(...) } catch(err) { logAction(...) } })` 包裹。Next 15+ 稳定 API，Vercel 内部走 `waitUntil` 延长 isolate 寿命。1 文件 +7 -2，commit `d33a79f`。Spot Check 级 review，diff 字节级匹配 + build/lint 三绿硬 check。**约束边界**：Vercel Hobby plan 单函数最长 30s / Pro 300s，`classify-pdf` 现在 25s 够用；若将来用户传 500+ 页超大书 classify 冲破 30s 需改异步 callback 模式（像 ocr-pdf 那样）。**教训**：跨服务异步链路诊断必须**验证两端生命周期**，不能只看"请求送到了"——还要看"响应回来时发起方还活着没"；long-fetch vs short-fetch 在 serverless 下行为差异巨大；T15 OOM 是真 bug，T17 waitUntil 缺失也是真 bug，两个独立 bug 被 T15 遮住，04-22 "推翻 waitUntil 假设" 段部分错误需回修。→ [changelog](changelog.md#2026-04-24) · [诊断](journal/2026-04-22-m4.6-incomplete-fix-diagnosis.md)
- 2026-04-23 M4.6 T15+T16 双 hotfix — Cloud Run OOM 修复 + Cloud Build 部署自动化（本 session 执行）：book 13 14.9MB 369 页 live test 暴露 OCR 跑 14 分钟后内核 SIGKILL 容器。原诊断 waitUntil 假设被 Cloud Run log 推翻（`Out-of-memory event detected` + `Container terminated on signal 9`）。**T15** 根因：`scripts/ocr_server.py` `google_ocr()` 每页新建 `vision.ImageAnnotatorClient()`，369 个 gRPC channel + PIL image 残骸累积撞破 512 MiB。修复 Python-side 模块级 singleton + `gc.collect()` 每 50 页 + progress log（`e0bb0c5`）；Infra-side 用户 Console 手动 Cloud Run memory 512→4096 MiB。**T16** 连锁发现：T15 push 后 Cloud Run 仍跑旧 revision `00006-8hx`，根因 `cloudbuild.ocr.yaml` 只 build + push 不 deploy，必须手动 Console 触发才上线。追加第 3 步 `gcloud run deploy` 固化 `--memory=4Gi`（`f097994`），未来 OCR server 改动只需 `git push` 一次动作即自动完整部署。IAM 前置已在 commit body 标注（Cloud Build SA 需 `roles/run.admin` + `roles/iam.serviceAccountUser`，首次触发若失败用户补权限即可）。同日给 SA `vercel-ocr-invoker@` 加 `roles/logging.privateLogViewer` 后 `.ccb/gcp-logs.js` 自动抓 Cloud Run logs 能力上线。诊断教训：跨服务链路"一端无日志"≠"请求没送达"，Python 被 SIGKILL 时来不及写错误，必须**两端日志都查清**；以及"build 成功 ≠ 部署成功"——CI/CD 必须有显式 deploy step 否则镜像白造。book 14 已重置 error，等用户重传 book 15 真机复验。→ [changelog](changelog.md#2026-04-23) · [诊断](journal/2026-04-22-m4.6-incomplete-fix-diagnosis.md)
- 2026-04-22 M4.5 hotfix 链 + 收尾（本 session 执行）：T10 14.2MB 真书生产压测连环暴露 3 pre-existing bug，三 hotfix 收掉后关 M4.5。**T12** confirm BIGINT 类型（pg driver string vs `BookRow.file_size: number` `===` 永不等）`c061a1c` · **T13** OCR callback 缺 KP trigger（`triggerReadyModulesExtraction` 只在 classify 调，OCR 完成后没人重 trigger）`f400bb8` · **T14** callback `module_id=0` UPDATE WHERE 排除 pending（OCR 跳过 'processing' 中间态，UPDATE 永远 match 0 行）`c0f69de`。三 hotfix 都走 task-execution Full Review（subagent + Claude 双 pass + build/lint/test 三绿硬 check）。Live E2E 重跑 book 11/12 因 Vercel→Cloud Run 出站 fetch hang 4-6 分钟失败两次，OCR 服务直接探测 4.5s 返 200 正常 — 根因在 Vercel 出站 fetch 或 google-auth-library，需 M4.6 诊断。M4.5 收尾基于单元测试 + 代码 review + 部署 READY 三重证据，live E2E 转 M4.6。→ [changelog](changelog.md#2026-04-22)
- 2026-04-21 M4.5 代码落地（autonomous，本 session 执行）：T1-T8 8 commit 全 PASS。后端（Codex T1-T6）：books schema upload_status+file_size / `buildPresignedPutUrl` / `POST /api/uploads/presign` / `POST /api/books/confirm` + `upload-flow.ts` fire-and-forget / 删 `POST /api/books` 的 PDF 分支 / `GET /api/books/[id]/status` 扩 14 字段。前端（Gemini T7-T8）：`/upload` 6 态状态机 + XHR 进度 + PDF/TXT 分支 + 50MB client 校验 · `/books/[id]/preparing` 2s polling + firstModuleReady CTA。T8 Gemini 一次越界建 `/api/books/[id]/route.ts` + `any[]` 两违规，retry 1 修回；其余任务零 Blocking。R2 CORS 程序化写入失败（bucket-scoped key 无 PutBucketCors 权限）→ T9 surfaced 给用户 Dashboard 手动配。Kill switch 与 moat grep 校验保持生效。→ [plan](superpowers/plans/2026-04-21-m4.5-pdf-upload-refactor.md) · [spec](superpowers/specs/2026-04-21-pdf-upload-refactor-design.md)
- 2026-04-21 M4.5 PDF 上传重构 brainstorm 完成：解停车场 T2 🚨 4.5MB 上限。8 决策全拍板——(1) Presigned URL 直传 R2 + (2) books 加 upload_status/file_size 2 列 + (3) /confirm fire-and-forget 启动 classify + (4) upload 页 XHR onprogress 6 态状态机 + (5) /preparing 页 2s polling + 第一模块就绪解锁按钮 + (6) R2 CORS 用户手动配 + (7) 7 类错误中文文案 + Sentry + (8) 14.2MB 真书端到端压测。调研 `2026-04-20-pdf-upload-speed-options.md` 29S+11A+2B 源。拒绝替代：不换 OCR / 不拆函数 / 不升 Pro / 不走 SSE。Round-2 subagent review 捉出 3 Critical + 4 Important 修完：file_path 列未用 → 改走 buildObjectKey 约定 / objectKey 格式统一 / 过滤仅列表端点 / confirm 幂等区分成功失败态 / kp_extraction_status 枚举修正 / confirm 改 fire-and-forget 避 UI 等 300s / status route 已存在标"调整"保旧字段。→ [spec](superpowers/specs/2026-04-21-pdf-upload-refactor-design.md) · [WIP](superpowers/specs/2026-04-21-pdf-upload-refactor-brainstorm-state.md)
- 2026-04-20 M4 教学系统完整上线（本 session 收尾）：19 tasks 全 PASS。后端（L1 T1-T11）Codex：KP 枚举 / zod / schema / retry / 类型 / entitlement / prompt-templates model / teacher Zod / seed / teaching-sessions API；（L2 T12）6 backend endpoints + book-meta-analyzer。前端（L2 T13-T19）Gemini：4 组件（Modal + BookTOC + ObjectivesList + ModeSwitchDialog）+ /books 页改造 + /activate + /teach（retry ×1 用 skeleton-driven 派发）+ /teaching-complete。Review 硬规则：每 dispatch post-completion grep 校验 4 moat 字段 0 hits + Step 3.2.5 tsc/build exit 0 强制 gate。关键事件：Gemini 对"严禁修改 docs"硬约束 3 次违规 → self-remediate 模式（Claude 直接 Edit 不再 retry 教 Gemini）；T18 30% 完成度 retry ×1 验证 skeleton-driven dispatch（附完整代码骨架）有效；技术债：start-qa API stale `redirectUrl` 前端 workaround，后续 hotfix。→ [spec](superpowers/specs/2026-04-15-m4-teaching-mode-design.md) · [plan](superpowers/plans/2026-04-15-m4-teaching-mode.md)
- 2026-04-19 云部署 Phase 2 完整上线：15 tasks 全 PASS（T1-T11 Codex 代码 + T12-T15 产品负责人 + Claude console）。核心迁移：scripts/ocr_server.py Paddle→Google Vision + 删 DB 能力 + 回调架构；Next.js 新增 /api/ocr/callback 路由 + env 迁 HOST/PORT→URL+Bearer；Cloud Run + Cloud Build CD + Artifact Registry 全链路就绪。E2E smoke 发现 4 个 hotfix：Tailwind Turbopack auto-source 崩溃（96c9eb1）· R2 CORS 缺失（用户控制台应用）· middleware 拦截 callback 401（6d918d0）· Vision API 未启用（用户控制台）。归停车场：Vercel 4.5MB body 限制 → T2 基础设施独立评估。→ [spec §4.2](superpowers/specs/2026-04-12-cloud-deployment-design.md) · [plan](superpowers/plans/2026-04-18-cloud-deployment-phase2.md)
- 2026-04-19 元系统进化 10 机制全量落地（本 session 端到端）：10 commits 独立提交，每机制分钟级 git revert 回滚 + `AI_SYSTEM_EVOLUTION_DISABLE=1` 一键总开关。落地清单：M1 1% 强触发语（CLAUDE.md）· M2 PostToolUse Bash 失败捕获 hook（.ccb/counters/tool-failures.log + whitelist 升 journal）· M3/M4 UserPromptSubmit 纠错词计数 hook（≥2 ⚠️ / ≥3 🛑 inject）· M5 fallback_for_toolsets frontmatter（4 skill + session-rules 规则 6）· M6 memory audit log（docs/memory-audit-log.md append-only + CLAUDE.md 契约）· M11 task-execution 硬 cap 3 + 持久化 counter · M14 fresh session per task（structured-dispatch + ccb-protocol）· kill switch 文档化 + session-init 扫计数器 · Retrospective 2.0（段 d skill-audit M9 + 段 e 挖矿 M15 + 自动触发提示）· M10 review 终止硬 check（build/test/lint 硬过 exit 0）。→ [spec](superpowers/specs/2026-04-19-system-evolution-design.md) · [plan](superpowers/plans/2026-04-19-system-evolution.md)
- 2026-04-19 元系统进化调研完成：5 sub-agent 并行扫 8 源（Anthropic / Letta / hermes / obra / OpenHands / Aider / Cognition / Cline-Continue），42 个 S 级源，三重 gate 通过。survey 结论：A 记忆方向对、B 技能方向对、C 事件捕获最大红利（24 hook 只用 2）、D 工作流 review/retry 终止太主观、E 自我诊断完全空白 → [survey](research/2026-04-19-system-evolution-survey.md) · [handoff](superpowers/specs/2026-04-19-system-evolution-design-handoff.md)
- 2026-04-18 session-init F.3 盖棺（commits cd8c3fe + f54e7b2 + fe950e4）：SessionStart hook 注入 project_status + PreCompact block 强制刷新 + SKILL 瘦身（127→60 行）+ parked 分流 14→11 + CLAUDE.md session-start 流程 / 部署现状 / research 协调文件三处同步。实测 Skills 从 ~15k 降到 2.5k，非 MCP 29.3k / 21%，PreCompact block 验证通过。Retrospective 补 2 条 memory（small-bash-direct-write / precompact-handshake）→ [spec](superpowers/specs/2026-04-18-session-init-F2-redesign.md) · [bloat-diagnosis](journal/2026-04-18-session-init-bloat-diagnosis.md) · [plan](superpowers/plans/2026-04-18-session-init-F3-redesign.md)
- 2026-04-15 调研能力建设：research-before-decision skill + brainstorming Research Trigger Check，解决 OCR 决策捏造定价事件 → [spec](superpowers/specs/2026-04-14-research-capability-design.md)
- 2026-04-14~15 云部署 10 决策拍板：Vision OCR / Vercel Hobby / Cloud Run / R2 / Neon branch preview / CD UI / 平台 env vars / .com + Cloudflare Registrar / Sentry + Vercel Analytics / 3 阶段拆分 → [spec](superpowers/specs/2026-04-12-cloud-deployment-design.md)
- 2026-04-14 教学系统 10 决策全部拍板 → [spec](superpowers/specs/2026-04-15-m4-teaching-mode-design.md)
- 2026-04-12 扫描 PDF 里程碑完成，9 tasks 闭环，architecture.md 补 OCR_PROVIDER 等 4 条约束
- 2026-04-09 Component Library 完成：33 组件 + 全页面重写

完整决策历史见 `docs/decisions.md`（早期）和各 spec 文件（2026-04 之后）。

---

## 3. 文件地图（Navigation）

**代码结构**：`docs/architecture.md §0 摘要卡`（只读摘要卡，不读 §1-N）

**当前 WIP / 排队中里程碑**：
- **M4.6 OCR 管线诊断 + 性能优化**（待 brainstorm）：触发自 M4.5 收尾 live E2E 失败暴露 Vercel→Cloud Run hang 问题
- **M4.5 PDF 上传重构** ✅ 完成：`docs/superpowers/specs/2026-04-21-pdf-upload-refactor-design.md` · `plans/2026-04-21-m4.5-pdf-upload-refactor.md`
- 云部署：`docs/superpowers/specs/2026-04-12-cloud-deployment-design.md`
- M4 教学系统：`docs/superpowers/specs/2026-04-15-m4-teaching-mode-design.md` + `plans/2026-04-15-m4-teaching-mode.md`

**历史里程碑完整任务表**：`docs/milestones/`

**想法 / 停车场**：`docs/journal/INDEX.md`（11 条 parked，分类 T1/T2/T3）· 归档见 `INDEX-resolved.md`

**调研知识库**：`docs/research/INDEX.md`（云部署 / PDF 处理 / 学习科学 / 竞品 / 护城河）

**Specs 索引**：`docs/superpowers/INDEX.md`

**CCB 协议**：`docs/ccb-protocol.md`（派发 / 语言 / Review 规范）

**已关闭决策**：`docs/decisions.md`（早期产品决策，不重新讨论）

---

## 4. 未决问题

- **🚨 M4.6 T15 真机复验待做**：T15 commit `e0bb0c5` + Cloud Run 4 GiB deploy（用户 Console）完成后，重传 book 13（或任意 300+ 页真书）验证 OCR 跑完不 OOM、callback 触发、`parse_status=done`。通过即 M4.6 收官
- **M4.5 收尾"Vercel→Cloud Run hang"问题已由 T15 解**：原假设是 Vercel 出站 fetch 问题（waitUntil/TLS/网络），实际是 Cloud Run 容器 OOM SIGKILL。T1-T2 (`f98b548` + `7c54934`) classify/extract-text 的 fetch 稳定性修复仍有价值（缓存 IdTokenClient + timeout + retry），但根因在 T15。stuck books cleanup 已在 T3-T4 做过
- **Advisory 累计**：Phase 2 新增 6 条（T2:2 / T3:2 / T5:1 / T8:1）+ M4.5 hotfix 累 2 条（T13 idempotency / T14 inline stub TS 注解），累积 M4.6 milestone-audit 时批量评估
- **Phase 3 阶段收尾**：域名、监控、Secrets 三件事打包（低优先，Phase 2 稳定后再做）
- **停车场 🚨 T1**（工程流程）：里程碑开发必须先切隔离分支（`journal/2026-04-21-dev-branch-isolation.md`）— M4.5 session 闪退暴露 master=prod 的半成品直达生产风险，M5 开始前必须决策是否升级规则 4 为"里程碑级强制 worktree"

