# Journal Index

## open（需要关注）
- [milestone:phase-2-done] **云部署**：阶段 1+2 已上线（R2+Vercel+Neon+Cloud Run Vision OCR），E2E smoke 通过（2026-04-19），阶段 3（域名+监控+secrets）未启动 `[cloud-deployment, Vercel, Cloud-Run, R2, Phase2-done]` → [spec](../superpowers/specs/2026-04-12-cloud-deployment-design.md) · [audit](./2026-04-19-cloud-deployment-phase2-audit.md)
- [testing] M6 用户测试：多个问题待收集（Date.slice 已修复，其他问题待 brainstorm）`[M6, user-testing, bug-triage, Date.slice]` → [2026-04-07-m6-user-testing.md](./2026-04-07-m6-user-testing.md)
- [idea:m5-intake] QA/复习时旁边可看原文（M5 启动时拉入 scope）`[QA, review, side-by-side, PDF-viewer, M5]` → [2026-04-03-review-ux-ideas.md](./2026-04-03-review-ux-ideas.md)
- [bug] M5.5 验收：test_ch1_2 显示 PDF 处理失败 + 读财报模块地图白屏 `[M5.5, PDF-processing, white-screen, user-testing]` → [2026-04-04-m5.5-user-testing.md](./2026-04-04-m5.5-user-testing.md)

## in_progress（解决中）

## parked（停车场）

> Tier 说明：T1 = M5.5 必做 | T2 = 独立里程碑评估 | T3 = MVP 后再议

### AI / Prompt
- **T2** 复习出题 KP 覆盖率——cluster 内 KP 轮换或改为 KP 粒度出题 `[review, KP-coverage, prompt, question-generation]` → [2026-04-03-review-kp-coverage.md](./2026-04-03-review-kp-coverage.md)

### 功能
- **T2** 🎯 用户留存与学习动机——MVP 前需确定核心留存机制（streak / 复习提醒 / 成就等）`[retention, motivation, MVP, user-engagement]` → [2026-04-10-retention-motivation.md](./2026-04-10-retention-motivation.md)
- **T2** MVP 范围扩展：多书种类支持（至少教案课件型）——与教学模式 spec 呼应 `[MVP-scope, book-types, courseware]` → [2026-04-10-mvp-scope-expansion.md](./2026-04-10-mvp-scope-expansion.md)
- **T2** Dashboard 日历视图——学习/复习时间表 `[dashboard, calendar, study-schedule, UX]` → [2026-04-03-dashboard-calendar.md](./2026-04-03-dashboard-calendar.md)
- **T2** 笔记+QA 联动：阅读写笔记 → AI 结构化 → QA 侧边栏弹要点 `[notes, QA-integration, AI-structuring, sidebar]` → [2026-03-29-notes-qa-integration.md](./2026-03-29-notes-qa-integration.md)
- **T3** OCR 后生成思维导图 `[OCR, mind-map, visualization]` → [2026-03-31-walking-ideas.md](./2026-03-31-walking-ideas.md)
- **T3** 渐进 Hint 系统（浅提示→跳原文→解析，subscription 分级）`[hint-system, subscription, progressive-help, UX]` → [2026-04-03-review-ux-ideas.md](./2026-04-03-review-ux-ideas.md)

### 交互 / UX
- **T2** 模块阅读选文字问AI（选中文字→提问→AI回答，复用screenshot-ask第二步）`[text-selection, AI-QA, module-reading, interactive]` → [2026-04-03-module-text-ask-ai.md](./2026-04-03-module-text-ask-ai.md)
- **T2** 笔记跳转原文 `[notes, source-linking, navigation]` → [2026-03-31-walking-ideas.md](./2026-03-31-walking-ideas.md)
- **T2** 右键选中多功能：做笔记、高亮等 `[context-menu, highlight, notes, text-selection]` → [2026-03-31-walking-ideas.md](./2026-03-31-walking-ideas.md)
- **T2** 学习计划定制（百词斩模式）：AI 预估时长+用户自定节奏 `[study-plan, pacing, AI-estimation, personalization]` → [2026-03-31-m3-brainstorming.md](./2026-03-31-m3-brainstorming.md)

### 基础设施
- **T2** 🚨 PDF 上传 presigned URL 直传 R2——M4.5 T1-T8 代码 ✅ 上线（2026-04-21，commits `aafc735…8c96c72`），T9 R2 CORS + Vercel Fluid 需用户 Dashboard 手动配，T10 14.2MB 真书压测待用户执行；milestone-audit 收尾后下架该条 `[PDF-upload, presigned-URL, R2, Vercel-function-limit]` → [2026-04-19-pdf-upload-size-limit.md](./2026-04-19-pdf-upload-size-limit.md)
- **T2** 预生成系统——后台预生成下一步内容，消灭等待 `[pregeneration, background-tasks, latency, infrastructure]` → [2026-04-04-pregeneration-system.md](./2026-04-04-pregeneration-system.md)
- **T3** 语言模式系统——自动切换 prompt 语言，多国语言版本 `[i18n, prompt-language, localization]` → [2026-03-22-m0-verification.md](./2026-03-22-m0-verification.md)

### 商业
- **T2** Subscription 分级（hint access levels 等付费功能区分）`[subscription, paywall, monetization, hint-access]` → [2026-04-03-review-ux-ideas.md](./2026-04-03-review-ux-ideas.md)

### 工程流程
- **T1** 🚨 里程碑开发必须先切隔离分支/版本——M4.5 session 闪退暴露 master=prod 半成品直达生产（T7 已上线但 T8 未建→生产 404），M5 开始前必须决策规则 4 升级为"里程碑级强制 worktree" `[dev-branch, worktree, milestone-isolation, master-prod-risk]` → [2026-04-21-dev-branch-isolation.md](./2026-04-21-dev-branch-isolation.md)
- **T2** Agent 违规事件追溯系统——T8 Gemini 一轮 3 类硬约束违规（file boundary / any / AC 文案自创），现有追溯只到 session-local ledger + 模式级 memory，缺跨 session 可查事件日志。推荐 `.ccb/agent-violations.log` + 扩展 feedback memory 组合，M4.5 闭环后或下次 retrospective 再评估 `[agent-reliability, observability, violation-tracking, retrospective]` → [2026-04-21-agent-violation-tracking.md](./2026-04-21-agent-violation-tracking.md)

## resolved（已解决）

> 只保留里程碑级 resolved（milestone / audit / brainstorm-chain）。其他归档在 [INDEX-resolved.md](./INDEX-resolved.md)。

- [milestone:resolved] **元系统进化 10 机制**：T1 8 条低成本 hook/counter + T2 Retrospective 2.0（skill audit / 挖矿 / m6 交叉检查）+ M10 review 硬 check（2026-04-19）`[meta-evolution, retrospective, skill-audit, hooks]` → [research](../research/2026-04-19-system-evolution-survey.md) · [spec](../superpowers/specs/2026-04-18-system-evolution-research-design.md)
- [decision:resolved] 两种学习模式（教学模式 / 完整模式）— 被 M4 教学系统 spec 吸收（2026-04-11）`[learning-modes, teaching, M4]` → [2026-04-11-two-learning-modes.md](./2026-04-11-two-learning-modes.md)
- [decision:resolved] AI 教学环节纳入 MVP — 已由 M4 教学系统 spec + plan 完整设计（2026-04-10）`[AI-teaching, MVP, M4]` → [2026-04-10-teaching-phase.md](./2026-04-10-teaching-phase.md)
- [audit:resolved] **M4 Teaching Mode 里程碑审计**：19 tasks 全 PASS，architecture.md 同步 6 维度（commits e627202 / 604b5eb）+ moat grep 4 字段 0 hits + 2 条新技术债登记（start-qa redirectUrl / reading→taught transition），verdict PASS（2026-04-20）`[M4, teaching-mode, milestone-audit, architecture-sync, moat-verification]` → [audit](./2026-04-20-m4-milestone-audit.md)
- [milestone:resolved] **Session-Init F.3 重设计**：SessionStart hook 注入 + PreCompact block + SKILL 瘦身，Skills 15k→2.5k，非 MCP 29.3k（2026-04-18，commit cd8c3fe）`[session-init, token-optimization, hook-injection]` → [bloat-diagnosis](./2026-04-18-session-init-bloat-diagnosis.md) · [spec](../superpowers/specs/2026-04-18-session-init-F2-redesign.md)
- [milestone:resolved] **教学系统 brainstorm**：10 决策全部拍板（2026-04-14），顶层 design spec 已生成 `[teaching-system, brainstorm, design-spec, M4, M5]` → [spec](../superpowers/specs/2026-04-12-teaching-system-design.md)
- [audit:resolved] Scanned PDF 里程碑审计：architecture.md 补齐 OCR_PROVIDER + 4 端点清单 + 上云约束 ⚠️（2026-04-12）`[scanned-PDF, milestone-audit, OCR]` → [2026-04-12-scanned-pdf-milestone-audit.md](./2026-04-12-scanned-pdf-milestone-audit.md)
- [audit:resolved] Page 1 Refinement 审计：shadow 违规修复 + architecture.md 同步（2026-04-10）`[page1-refinement, audit, shadow-tokens]` → [2026-04-10-page1-refinement-audit.md](./2026-04-10-page1-refinement-audit.md)
- [audit:resolved] Component Library milestone-audit：33 组件 + 全页面重写 + 旧组件清理（2026-04-09）`[component-library, milestone-audit, page-rewrite]` → [2026-04-09-component-library-milestone-audit.md](./2026-04-09-component-library-milestone-audit.md)
- [brainstorm-chain:resolved] UX 重设计 chain 全 4 次完成，spec + plan 已出（2026-04-08）`[UX-redesign, brainstorm-chain, spec]` → [chain](../superpowers/specs/2026-04-07-ux-redesign-chain.md)
- [audit:resolved] M6-hotfix 完成：OCR 管道迁移 + initDb + 端口统一 + SESSION_SECRET 清理（2026-04-07）`[M6-hotfix, OCR-migration, initDb]` → [2026-04-07-m6-milestone-audit-redo.md](./2026-04-07-m6-milestone-audit-redo.md)
- [decision:resolved] MVP 方向确定 + M6 11 任务全部完成（2026-04-06）`[MVP-direction, M6, spec, plan-completion]` → [2026-04-06-mvp-direction-brainstorming.md](./2026-04-06-mvp-direction-brainstorming.md)
- [audit] M5.5 milestone-audit：App Shell + ProcessingPoller + 错误边界（2026-04-04）`[M5.5, milestone-audit, AppShell]` → [2026-04-04-m5.5-milestone-audit.md](./2026-04-04-m5.5-milestone-audit.md)
- [audit] M5 milestone-audit：3 条新契约已文档化，⚠️ test/submit error_type 未变（2026-04-03）`[M5, milestone-audit, API-contracts]` → [2026-04-03-m5-milestone-audit.md](./2026-04-03-m5-milestone-audit.md)
- [brainstorm:resolved] UX 全面重设计 brainstorm（2026-04-07）`[UX重设计, Action Hub, 书首页]` → [2026-04-07-ux-redesign-brainstorm.md](./2026-04-07-ux-redesign-brainstorm.md)
- [audit] M4 milestone-audit：error_type 约束已补（2026-04-03）`[M4, milestone-audit, error_type]` → [2026-04-03-m4-milestone-audit.md](./2026-04-03-m4-milestone-audit.md)
