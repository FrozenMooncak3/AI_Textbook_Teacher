# Journal Index

## open（需要关注）
- [milestone:plan-ready-queued] **Session-Init Token 优化**（基础设施，**brainstorm + spec + plan 全部完成 2026-04-15**，**排队等云部署完成再启动施工**；6 决策、24 tasks、3 周路线、目标开机 token 20-30%→≤10%）`[session-init, token-optimization, infrastructure, brainstorm, M-next]` → [spec](../superpowers/specs/2026-04-15-session-init-token-optimization-design.md) + [plan](../superpowers/plans/2026-04-15-session-init-token-optimization.md) + [WIP 决策追溯](../superpowers/specs/2026-04-15-session-init-token-optimization-brainstorm-state.md)
- [milestone:brainstorm-ready-for-spec] **云部署**（基础设施里程碑，**10 决策全拍完 2026-04-15**：Google Vision + Vercel Hobby + Cloud Run + R2 + 生产/preview/Neon branch + Cloud Run CD UI + 平台 env vars + .com/Cloudflare Registrar + Sentry/Vercel Analytics + 3 阶段拆分；下一步转正式 design spec + writing-plans 阶段 1）`[cloud-deployment, Vercel, Cloud-Run, R2, infrastructure]` → [specs/2026-04-12-cloud-deployment-brainstorm-state.md](../superpowers/specs/2026-04-12-cloud-deployment-brainstorm-state.md) + 7 份调研（[ocr](../research/2026-04-14-cloud-ocr-options.md)/[deploy](../research/2026-04-14-cloud-deployment-platform-options.md)/[python](../research/2026-04-14-cloud-python-server-options.md)/[storage](../research/2026-04-14-cloud-object-storage-options.md)/[cicd](../research/2026-04-14-cloud-cicd-options.md)/[secrets](../research/2026-04-15-cloud-secrets-options.md)/[domain](../research/2026-04-15-cloud-domain-https-options.md)）
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
- [milestone:resolved] **教学系统 brainstorm**：10 决策全部拍板（2026-04-14），顶层 design spec 已生成 `[teaching-system, brainstorm, design-spec, M4, M5]` → [specs/2026-04-12-teaching-system-design.md](../superpowers/specs/2026-04-12-teaching-system-design.md)（WIP 历史：[specs/2026-04-12-teaching-system-brainstorm-state.md](../superpowers/specs/2026-04-12-teaching-system-brainstorm-state.md)）。M4/M5 启动时另开详细 brainstorm
- [skill:resolved] brainstorming skill 加入 WIP 防 compact 机制：新增 WIP State File Protocol + checklist 扩展 + session-init 检测（2026-04-14）`[brainstorming-skill, WIP-protocol, compact-protection, session-init]` → [2026-04-14-brainstorming-skill-wip-mechanism.md](./2026-04-14-brainstorming-skill-wip-mechanism.md)
- [audit:resolved] Scanned PDF 里程碑审计：architecture.md 补齐 OCR_PROVIDER 等环境变量 + 4 端点清单 + 上云约束 ⚠️（2026-04-12）`[scanned-PDF, milestone-audit, OCR, architecture.md]` → [2026-04-12-scanned-pdf-milestone-audit.md](./2026-04-12-scanned-pdf-milestone-audit.md)
- [audit:resolved] Page 1 Refinement 审计：shadow 违规修复（+2 tokens），architecture.md 同步（2026-04-10）`[page1-refinement, audit, shadow-tokens, architecture.md]` → [2026-04-10-page1-refinement-audit.md](./2026-04-10-page1-refinement-audit.md)
- [ux:resolved] 全局缺导航 `[navigation, AppSidebar, Breadcrumb, M5.5]` → M5.5 AppSidebar + Component Library Breadcrumb 解决（6+ 页面已有导航）
- [ux:resolved] PDF 阅读器太弱 `[PDF-viewer, react-pdf-viewer, M6, zoom-search]` → M6 react-pdf-viewer 替换（缩放/搜索/书签全具备）
- [infra:resolved] 大 PDF 分块提取 `[text-chunker, kp-merger, PDF-processing, M6]` → M6 text-chunker + kp-merger 解决（35K 字符分块 + bigram 去重）
- [audit:resolved] Component Library milestone-audit 通过：33 组件 + 全页面重写 + 旧组件清理，architecture.md 全量验证一致（2026-04-09）`[component-library, milestone-audit, architecture.md, page-rewrite]` → [2026-04-09-component-library-milestone-audit.md](./2026-04-09-component-library-milestone-audit.md)
- [brainstorm-chain:resolved] UX 重设计 chain 全 4 次完成（scope + tokens + 后端分析 + 前端映射），spec + plan 已出（2026-04-08）`[UX-redesign, brainstorm-chain, spec, frontend-mapping]` → chain 文件 `docs/superpowers/specs/2026-04-07-ux-redesign-chain.md`
- [audit:resolved] M6-hotfix 完成：OCR 管道迁移 + initDb 启动初始化 + 端口统一 + SESSION_SECRET 清理（2026-04-07）`[M6-hotfix, OCR-migration, initDb, port-unification]` → [2026-04-07-m6-milestone-audit-redo.md](./2026-04-07-m6-milestone-audit-redo.md)
- [decision:resolved] MVP 方向确定 + M6 spec/plan 完成 → M6 全部 11 任务已完成（2026-04-06）`[MVP-direction, M6, spec, plan-completion]` → [2026-04-06-mvp-direction-brainstorming.md](./2026-04-06-mvp-direction-brainstorming.md)
- [infra:resolved] task-execution skill 已实现——统一执行引擎（dispatch→review→retry→close 全自动），替代手动串联 dispatch/review chain（2026-04-04）`[task-execution, skill, dispatch-engine, CCB-automation]` → [2026-04-04-execution-skill.md](./2026-04-04-execution-skill.md)
- [audit] M5.5 milestone-audit 通过：App Shell + ProcessingPoller + 错误边界全量验证，architecture.md 与代码一致（2026-04-04）`[M5.5, milestone-audit, AppShell, ProcessingPoller]` → [2026-04-04-m5.5-milestone-audit.md](./2026-04-04-m5.5-milestone-audit.md)
- [audit] M5 milestone-audit 通过：architecture.md 与代码一致，3 条新契约已文档化，⚠️ test/submit error_type 未变（2026-04-03）`[M5, milestone-audit, architecture.md, API-contracts]` → [2026-04-03-m5-milestone-audit.md](./2026-04-03-m5-milestone-audit.md)
- [M5完成] 评分后显示正确答案：T4/T7 实现（review/respond + test/submit 返回 correct_answer/explanation，前端展示）（2026-04-03）`[M5, correct-answer, review-respond, test-submit]`
- [M5完成] 错题本功能：T5/T8 实现（书级 mistakes API + 多维筛选前端页面）（2026-04-03）`[M5, mistakes-book, filtering, API]`
- [M5完成] 测试 Dashboard：T5/T8 实现（dashboard API + 四宫格仪表盘页面）（2026-04-03）`[M5, test-dashboard, dashboard-API, four-panel]`
- [audit] M4 milestone-audit 通过：1 处缺漏已补（error_type 约束），architecture.md 与代码一致（2026-04-03）`[M4, milestone-audit, error_type, architecture.md]` → [2026-04-03-m4-milestone-audit.md](./2026-04-03-m4-milestone-audit.md)
- [infra:resolved] milestone-audit skill 已实现——architecture.md 守护体系（两道关卡闭环）（2026-04-03）`[milestone-audit, skill, architecture-guard, two-gate]` → [2026-04-03-milestone-audit-skill.md](./2026-04-03-milestone-audit-skill.md)
- [bug:resolved] M4 集成测试 2 bug 已修复（commit f54baf0）：验证放宽 + token 预算提升（2026-04-03）`[M4, integration-test, bug-fix, token-budget]` → [2026-04-03-m4-integration-test.md](./2026-04-03-m4-integration-test.md)
- [audit] M3→M4 代码审计：6 个问题全部分流，3 个修复于 M3.5，剩余 3 个归入 M4（2026-04-02）`[M3, M4, code-audit, issue-triage]` → [2026-04-02-m3-to-m4-code-audit.md](./2026-04-02-m3-to-m4-code-audit.md)
- [infra] CCB 文件消息系统：替代 ask 命令，双向通信验证通过（2026-04-02）`[CCB, file-messaging, bidirectional-comms, infrastructure]` → [2026-04-02-ccb-file-messaging.md](./2026-04-02-ccb-file-messaging.md)
- [infra] CCB 迁移到 Claude Code Bridge v5.2.9：验证通过，ask/ping 双向通信正常（2026-04-02）`[CCB, migration, v5.2.9, ask-ping]` → [2026-04-01-ccb-migration.md](./2026-04-01-ccb-migration.md)
- [blocked→resolved] M3 集成测试：4 层修复（代理+流式+token+JSON 解析），commit deb82c5（2026-04-01）`[M3, integration-test, streaming, JSON-parsing]` → [2026-04-01-m3-integration-test.md](./2026-04-01-m3-integration-test.md)
- [idea] UI/UX Pro Max Skill → 已安装给 Gemini，适配 Next.js+Tailwind（2026-03-30）`[UX-skill, Gemini, Next.js, Tailwind]` → [2026-03-21-mvp-redesign.md](./2026-03-21-mvp-redesign.md)
- [idea] Wezterm 双向发送问题 → 已修复：内容用 paste 模式，提交用键盘模式（2026-03-30）`[Wezterm, paste-mode, keyboard-mode, CCB-tooling]` → [2026-03-29-wezterm-report-submit.md](./2026-03-29-wezterm-report-submit.md)
- [idea] Session Init 全局报告 → 升级为 CEO 仪表盘 + skill 治理（2026-03-29）`[session-init, CEO-dashboard, skill-governance, reporting]` → [2026-03-29-session-init-report.md](./2026-03-29-session-init-report.md)
- [decision] 第三次 brainstorming：session-init + retrospective + chain declarations 已实施（2026-03-28）`[brainstorming, session-init, retrospective, skill-chain]` → [2026-03-28-skill-automation.md](./2026-03-28-skill-automation.md)
- [decision] 第二次 brainstorming：Claude hook 自动化（H1-H7）→ 已实施，commit 09aaaef `[brainstorming, hooks, automation, H1-H7]` → [2026-03-28-skill-automation.md](./2026-03-28-skill-automation.md)
- [issue] Codex/Gemini skill list 可见性 → 已确认可见（2026-03-28）`[CCB, skill-visibility, Codex, Gemini]` → [2026-03-28-skill-automation.md](./2026-03-28-skill-automation.md)
- [idea] 优化 AI 协作的任务记忆文档体系 → 已通过 journal 系统解决（2026-03-21）`[journal, memory-system, AI-collaboration, documentation]`
- [验证] M0 最终验证通过（8/8），发现截图 AI 5 项改进 → 已归入 M5 `[M0, verification, screenshot-AI, M5-backlog]` → [2026-03-22-m0-verification.md](./2026-03-22-m0-verification.md)
