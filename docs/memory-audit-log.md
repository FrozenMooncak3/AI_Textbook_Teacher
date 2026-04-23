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
2026-04-21 23:55 | op:edit | file:reference_vercel-deployment.md | reason:T9 持久化 Vercel 30-day token（用户 2026-04-21 显式授权跨 session 保留）
2026-04-22 00:03 | op:edit | file:reference_vercel-deployment.md | reason:T9 持久化 Cloudflare API token + CF native R2 CORS endpoint 形状（用户 2026-04-22 显式授权）
2026-04-22 | op:add | file:project_m4-6-brainstorm-wip.md | reason:M4.6 brainstorm 开启，按 brainstorming skill WIP Protocol 添加 compact 防御 pointer（指向 docs/superpowers/specs/2026-04-22-m4.6-ocr-pipeline-brainstorm-state.md），brainstorm 完成后删除
2026-04-22 | op:delete | file:project_m4-5-brainstorm-wip.md | reason:M4.5 brainstorm 已完成（hotfix 链 + 收尾完整闭环），按 brainstorming skill 协议移除 WIP pointer
2026-04-22 | op:edit | file:MEMORY.md | reason:替换 M4.5 brainstorm WIP 索引行为 M4.6（M4.5 已 closed，M4.6 启动）
2026-04-22 | op:edit | file:feedback_explain-research.md | reason:用户 2026-04-22 反馈"以后能不能每次解释完专业术语后都用这种方式给我讲一遍啊，我现在是高管是 CEO"——把规则范围从 research findings 扩展到所有技术解释，加入"两段式（专业版+大白话版）"具体格式 + anti-patterns 清单
2026-04-22 | op:edit | file:feedback_autonomous-execution.md | reason:M4.6 T1 dispatch 后用户反馈"你自己定时检查"——把 self-polling pattern（Bash run_in_background until-loop 20s 轮询 git log 或 inbox 报告）固化进规则，避免下次 task-execution Phase 2 再 end turn 等用户
2026-04-22 | op:edit | file:feedback_autonomous-execution.md | reason:M4.6 T2 dispatch 后用户二次强化"你一直自己自动检查直到完成"——固化 run-to-completion 规则：task-execution 一旦启动就跑完整个 plan，只在 (1) 全部完成 (2) 需要 escalate 的 critical issue (3) 用户手动动作边界（如 live test）才停。ccb-dispatch-protocol 的 3-step approval 仅在启动新 plan 时生效，plan 内任务间不生效。
