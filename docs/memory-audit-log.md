# Memory Audit Log

> append-only 审计日志。每次 Claude 对 auto-memory（`C:\Users\Administrator\.claude\projects\D------Users-Sean-ai-textbook-teacher\memory\*`）增/改/删必须在此追加一行。
> 格式：`YYYY-MM-DD HH:MM | op:<add|edit|delete> | file:<name>.md | reason:<短描述>`
>
> 背景：memory 路径在用户主目录跨 repo，无法 git 托管。降级方案是在项目内维护 append-only 审计日志，配合 retrospective 2.0 对比 `git log` memory 目录改动次数 vs 本日志行数差，发现漏记。
>
> 来源：spec `2026-04-19-system-evolution-design` §2.4（M6）。

---

## 2026-04-19

2026-04-19 16:45 | op:init | file:- | reason:M6 memory audit log 初始化（spec 2026-04-19-system-evolution-design §2.4）
2026-04-19 18:20 | op:delete | file:project_system-evolution-research-wip.md | reason:Retrospective 2.0 stale memory cleanup（10 机制已全量落地，research WIP 指针过时）

## 2026-04-20

2026-04-20 11:45 | op:edit | file:feedback_guard-gemini-doc-overwrites.md | reason:M4 T13+T14 Gemini 连 3 次违反 docs/changelog 硬约束（T13 garble / T14 原 commit / T14 retry），固化 self-remediate 不重试的处理 pattern
2026-04-20 14:20 | op:delete | file:project_local-testing-state.md | reason:10 天前 ephemeral WIP 快照（Page 1 refinement），10 天来云部署 Phase 1+2 / Component Library / Scanned PDF / M4 全部完成，内容完全失效且误导（session-init 和 brainstorming 两次把"本地测试"当默认选项）。违反 memory "不存 ephemeral task details" 规则。同步删 MEMORY.md 索引条目。

## 2026-04-21

2026-04-21 | op:add | file:project_m4-5-brainstorm-wip.md | reason:M4.5 brainstorm 开启，按 brainstorming skill WIP Protocol 要求添加 compact 防御 pointer（指向 docs/superpowers/specs/2026-04-21-pdf-upload-refactor-brainstorm-state.md），brainstorm 完成后删除
2026-04-21 | op:add | file:feedback_ux-user-signal.md | reason:用户复盘指出 Opus 4.6 多次否决其进度条请求（"你终于肯弄进度条了"），固化"用户 UX 反馈 = 产品信号，默认实现"规则，禁止再用 MVP minimum 回绝 UX 诉求
2026-04-21 | op:edit | file:feedback_ux-user-signal.md | reason:用户补充"不用全信我，我就随便说说"——修正过于绝对的"100% 必须实现"表述，改成"认真评估 + 拿证据辩论"，避免矫枉过正变 yes-man
