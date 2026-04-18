# Journal Resolved Archive

> 非里程碑级别的 resolved 条目归档。brainstorming / research-before-decision skill 在主 INDEX 关键字未命中时做二轮扫描这里。
> 主 INDEX 只保留里程碑级 resolved（milestone / audit / brainstorm-chain）。

## M5/M6 任务级完成
- [M5完成] 评分后显示正确答案：T4/T7 实现（review/respond + test/submit 返回 correct_answer/explanation，前端展示）（2026-04-03）`[M5, correct-answer, review-respond, test-submit]`
- [M5完成] 错题本功能：T5/T8 实现（书级 mistakes API + 多维筛选前端页面）（2026-04-03）`[M5, mistakes-book, filtering, API]`
- [M5完成] 测试 Dashboard：T5/T8 实现（dashboard API + 四宫格仪表盘页面）（2026-04-03）`[M5, test-dashboard, dashboard-API, four-panel]`

## UX/基础设施（被里程碑吸收）
- [ux:resolved] 全局缺导航 `[navigation, AppSidebar, Breadcrumb, M5.5]` → M5.5 AppSidebar + Component Library Breadcrumb 解决
- [ux:resolved] PDF 阅读器太弱 `[PDF-viewer, react-pdf-viewer, M6, zoom-search]` → M6 react-pdf-viewer 替换
- [infra:resolved] 大 PDF 分块提取 `[text-chunker, kp-merger, PDF-processing, M6]` → M6 text-chunker + kp-merger 解决
- [testing:resolved] M5 测试发现全局缺导航 UX 问题（2026-04-03）`[UX, 导航, M5测试, 返回键, 全局布局]` → [2026-04-03-m5-testing-ux.md](./2026-04-03-m5-testing-ux.md)

## Skill / 工具链
- [skill:resolved] memory-cleanup skill 已实现——归档而非删除的 y/n gating 流程（2026-04-17，commit 55ed20a）`[memory-management, token-optimization, skill]`
- [skill:resolved] research-before-decision skill 已实现——权威加权源质量 + 并行派发（2026-04-12）`[research-skill, agent-dispatch, source-grading, CCB]` → [2026-04-12-research-dispatch-skill.md](./2026-04-12-research-dispatch-skill.md)
- [decision:resolved] 第三次 brainstorming 砍掉 H6/H8/H12/H13（归档）`[brainstorming, scope-cut, skill-automation, archive]` → [2026-03-28-skill-automation.md](./2026-03-28-skill-automation.md)
- [skill:resolved] brainstorming skill 加入 WIP 防 compact 机制：WIP State File Protocol + checklist + session-init 检测（2026-04-14）`[brainstorming-skill, WIP-protocol, compact-protection, session-init]` → [2026-04-14-brainstorming-skill-wip-mechanism.md](./2026-04-14-brainstorming-skill-wip-mechanism.md)
- [infra:resolved] task-execution skill 已实现——统一执行引擎（dispatch→review→retry→close 全自动）（2026-04-04）`[task-execution, skill, dispatch-engine, CCB-automation]` → [2026-04-04-execution-skill.md](./2026-04-04-execution-skill.md)
- [infra:resolved] milestone-audit skill 已实现——architecture.md 守护体系（两道关卡闭环）（2026-04-03）`[milestone-audit, skill, architecture-guard, two-gate]` → [2026-04-03-milestone-audit-skill.md](./2026-04-03-milestone-audit-skill.md)
- [idea] UI/UX Pro Max Skill → 已安装给 Gemini（2026-03-30）`[UX-skill, Gemini, Next.js, Tailwind]` → [2026-03-21-mvp-redesign.md](./2026-03-21-mvp-redesign.md)
- [idea] Wezterm 双向发送问题 → 已修复（2026-03-30）`[Wezterm, paste-mode, keyboard-mode, CCB-tooling]` → [2026-03-29-wezterm-report-submit.md](./2026-03-29-wezterm-report-submit.md)
- [idea] Session Init 全局报告 → 升级为 CEO 仪表盘 + skill 治理（2026-03-29）`[session-init, CEO-dashboard, skill-governance, reporting]` → [2026-03-29-session-init-report.md](./2026-03-29-session-init-report.md)
- [decision] 第三次 brainstorming：session-init + retrospective + chain declarations 已实施（2026-03-28）`[brainstorming, session-init, retrospective, skill-chain]` → [2026-03-28-skill-automation.md](./2026-03-28-skill-automation.md)
- [decision] 第二次 brainstorming：Claude hook 自动化（H1-H7）→ 已实施，commit 09aaaef `[brainstorming, hooks, automation, H1-H7]` → [2026-03-28-skill-automation.md](./2026-03-28-skill-automation.md)
- [issue] Codex/Gemini skill list 可见性 → 已确认可见（2026-03-28）`[CCB, skill-visibility, Codex, Gemini]` → [2026-03-28-skill-automation.md](./2026-03-28-skill-automation.md)
- [idea] 优化 AI 协作的任务记忆文档体系 → 已通过 journal 系统解决（2026-03-21）`[journal, memory-system, AI-collaboration, documentation]`

## CCB 基础设施
- [infra] CCB 文件消息系统：替代 ask 命令，双向通信验证通过（2026-04-02）`[CCB, file-messaging, bidirectional-comms, infrastructure]` → [2026-04-02-ccb-file-messaging.md](./2026-04-02-ccb-file-messaging.md)
- [infra] CCB 迁移到 Claude Code Bridge v5.2.9：验证通过，ask/ping 双向通信正常（2026-04-02）`[CCB, migration, v5.2.9, ask-ping]` → [2026-04-01-ccb-migration.md](./2026-04-01-ccb-migration.md)

## 集成测试 / Bug 修复
- [bug:resolved] M4 集成测试 2 bug 已修复（commit f54baf0）：验证放宽 + token 预算提升（2026-04-03）`[M4, integration-test, bug-fix, token-budget]` → [2026-04-03-m4-integration-test.md](./2026-04-03-m4-integration-test.md)
- [audit] M3→M4 代码审计：6 个问题全部分流，3 个修复于 M3.5，剩余 3 个归入 M4（2026-04-02）`[M3, M4, code-audit, issue-triage]` → [2026-04-02-m3-to-m4-code-audit.md](./2026-04-02-m3-to-m4-code-audit.md)
- [blocked→resolved] M3 集成测试：4 层修复（代理+流式+token+JSON 解析），commit deb82c5（2026-04-01）`[M3, integration-test, streaming, JSON-parsing]` → [2026-04-01-m3-integration-test.md](./2026-04-01-m3-integration-test.md)
- [验证] M0 最终验证通过（8/8），发现截图 AI 5 项改进 → 已归入 M5 `[M0, verification, screenshot-AI, M5-backlog]` → [2026-03-22-m0-verification.md](./2026-03-22-m0-verification.md)
