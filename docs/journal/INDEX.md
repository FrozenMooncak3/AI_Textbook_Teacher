# Journal Index

## open（需要关注）
- [milestone:in_progress] **Session-Init Token 优化**：Week 1-3 完成，软优化 A-D 执行中 `[session-init, token-optimization, M-next]` → [spec](../superpowers/specs/2026-04-15-session-init-token-optimization-design.md) · [plan](../superpowers/plans/2026-04-15-session-init-token-optimization.md)
- [milestone:phase-1-done] **云部署**：阶段 1 已上线（R2+Vercel+Neon），阶段 2（Cloud Run OCR）/阶段 3（域名+监控+secrets）未启动。10 决策详情见 project_status.md；调研见 research/INDEX.md 云部署节 `[cloud-deployment, Vercel, Cloud-Run, R2]` → [spec](../superpowers/specs/2026-04-12-cloud-deployment-design.md)
- [idea] 两种学习模式：课件→教学模式（只教不考），教材→完整模式（教+考+复习），解决课件 vs 教材产品难题 `[learning-modes, teaching, courseware, product-design]` → [2026-04-11-two-learning-modes.md](./2026-04-11-two-learning-modes.md)
- [idea] 用户留存与学习动机：需要核心留存机制，MVP 前确定方案 `[retention, motivation, MVP, user-engagement]` → [2026-04-10-retention-motivation.md](./2026-04-10-retention-motivation.md)
- [decision] MVP 必做：AI 再教一遍环节（阅读→**教学**→QA），参考月饼投资项目调研 `[teaching-phase, AI-teaching, MVP, learning-flow]` → [2026-04-10-teaching-phase.md](./2026-04-10-teaching-phase.md)
- [decision] MVP 范围扩展：扫描版 PDF（主功能）+ 多书种类（至少教案课件型）必须上线前具备 `[MVP-scope, scanned-PDF, OCR, book-types]` → [2026-04-10-mvp-scope-expansion.md](./2026-04-10-mvp-scope-expansion.md)
- [testing] M6 用户测试：多个问题待收集（Date.slice 已修复，其他问题待 brainstorm）`[M6, user-testing, bug-triage, Date.slice]` → [2026-04-07-m6-user-testing.md](./2026-04-07-m6-user-testing.md)
- [bug] M5.5 验收：test_ch1_2 显示 PDF 处理失败 + 读财报模块地图白屏 `[M5.5, PDF-processing, white-screen, user-testing]` → [2026-04-04-m5.5-user-testing.md](./2026-04-04-m5.5-user-testing.md)

## in_progress（解决中）

## parked（停车场）

> Tier 说明：T1 = M5.5 必做 | T2 = 独立里程碑评估 | T3 = MVP 后再议

### AI / Prompt
- **T2** 复习出题 KP 覆盖率——cluster 内 KP 轮换或改为 KP 粒度出题 `[review, KP-coverage, prompt, question-generation]` → [2026-04-03-review-kp-coverage.md](./2026-04-03-review-kp-coverage.md)

### 功能
- **T2** Dashboard 日历视图——学习/复习时间表 `[dashboard, calendar, study-schedule, UX]` → [2026-04-03-dashboard-calendar.md](./2026-04-03-dashboard-calendar.md)
- **T2** 笔记+QA 联动：阅读写笔记 → AI 结构化 → QA 侧边栏弹要点 `[notes, QA-integration, AI-structuring, sidebar]` → [2026-03-29-notes-qa-integration.md](./2026-03-29-notes-qa-integration.md)
- **T3** OCR 后生成思维导图 `[OCR, mind-map, visualization]` → [2026-03-31-walking-ideas.md](./2026-03-31-walking-ideas.md)
- **T3** 渐进 Hint 系统（浅提示→跳原文→解析，subscription 分级）`[hint-system, subscription, progressive-help, UX]` → [2026-04-03-review-ux-ideas.md](./2026-04-03-review-ux-ideas.md)

### 交互 / UX
- **T1** QA/复习时旁边可以看原文 `[QA, review, side-by-side, PDF-viewer]` → [2026-04-03-review-ux-ideas.md](./2026-04-03-review-ux-ideas.md)
- **T2** 模块阅读选文字问AI（选中文字→提问→AI回答，复用screenshot-ask第二步）`[text-selection, AI-QA, module-reading, interactive]` → [2026-04-03-module-text-ask-ai.md](./2026-04-03-module-text-ask-ai.md)
- **T2** 笔记跳转原文 `[notes, source-linking, navigation]` → [2026-03-31-walking-ideas.md](./2026-03-31-walking-ideas.md)
- **T2** 右键选中多功能：做笔记、高亮等 `[context-menu, highlight, notes, text-selection]` → [2026-03-31-walking-ideas.md](./2026-03-31-walking-ideas.md)
- **T2** 学习计划定制（百词斩模式）：AI 预估时长+用户自定节奏 `[study-plan, pacing, AI-estimation, personalization]` → [2026-03-31-m3-brainstorming.md](./2026-03-31-m3-brainstorming.md)

### 基础设施
- **T2** 预生成系统——后台预生成下一步内容，消灭等待 `[pregeneration, background-tasks, latency, infrastructure]` → [2026-04-04-pregeneration-system.md](./2026-04-04-pregeneration-system.md)
- **T3** 语言模式系统——自动切换 prompt 语言，多国语言版本 `[i18n, prompt-language, localization]` → [2026-03-22-m0-verification.md](./2026-03-22-m0-verification.md)

### 商业
- **T2** Subscription 分级（hint access levels 等付费功能区分）`[subscription, paywall, monetization, hint-access]` → [2026-04-03-review-ux-ideas.md](./2026-04-03-review-ux-ideas.md)

### 工程流程
- **T2** 记忆清除 skill——将已关闭的记忆文件合并压缩为摘要文档，减少每次 session 读文件的 token 消耗 `[memory-management, token-optimization, skill, session-init]` → 用户提出 2026-04-09
- **T2** 深度调研派发 agent skill——来源分级+质量标准+格式模板产品化 `[research-skill, agent-dispatch, source-grading, CCB]` → [2026-04-12-research-dispatch-skill.md](./2026-04-12-research-dispatch-skill.md)

### 已决策归档
- [decision] 第三次 brainstorming 砍掉的项 H6/H8/H12/H13 `[brainstorming, scope-cut, skill-automation, archive]` → [2026-03-28-skill-automation.md](./2026-03-28-skill-automation.md)

## resolved（已解决）

> 只保留里程碑级 resolved（milestone / audit / brainstorm-chain）。其他归档在 [INDEX-resolved.md](./INDEX-resolved.md)。

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
