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
2026-04-24 | op:add | file:project_vercel-fire-and-forget-after.md | reason:M4.6 T17 landing 新规则——Vercel API route 长 fire-and-forget 必须 after() 包裹；长 fetch vs short fetch 对 isolate 寿命敏感度不同
2026-04-24 | op:edit | file:MEMORY.md | reason:Project 段加 Vercel Fire-and-Forget 索引行
2026-04-25 | op:add | file:project_ocr-cost-shock.md | reason:用户因 book 18 KP 阶段 Google credits depleted 喊停，要求 brainstorm 重设 OCR + KP 成本架构，next session 入口已写
2026-04-25 | op:edit | file:MEMORY.md | reason:Project 段加 OCR Cost Shock 索引行
2026-04-25 | op:add | file:project_ocr-cost-brainstorm-wip.md | reason:OCR + KP 成本架构 brainstorm 开启，按 brainstorming skill WIP Protocol 添加 compact 防御 pointer（指向 docs/superpowers/specs/2026-04-25-ocr-cost-brainstorm-state.md），brainstorm 完成后删除
2026-04-25 | op:edit | file:MEMORY.md | reason:Project 段加 OCR Cost Brainstorm WIP 索引行（与 cost-shock 区分：cost-shock 是事件/状态，brainstorm-wip 是流程指针）

## 2026-04-26

2026-04-26 | op:delete | file:project_ocr-cost-brainstorm-wip.md | reason:M4.7 brainstorm + writing-plans 链路完整收尾（spec round 1+2 review + plan reviewer 通过 + 3 真实 blocker 修完），按 brainstorming skill WIP Protocol "Remove the MEMORY.md pointer created for this brainstorm" 移除流程指针；WIP 文件 docs/superpowers/specs/2026-04-25-ocr-cost-brainstorm-state.md 保留作 decision trail 不删
2026-04-26 | op:edit | file:MEMORY.md | reason:Project 段移除 OCR Cost Brainstorm WIP 索引行（M4.7 brainstorm 完成，cost-shock 索引保留作战略事件记录）

## 2026-04-28

2026-04-28 21:35 | op:delete | file:project_m4-6-brainstorm-wip.md | reason:M4.6 brainstorm 状态记忆已严重过期（M4.6 已 2026-04-24 closed with T17 hotfix landing），WIP 指针误导后续 session
2026-04-28 21:35 | op:delete | file:project_ocr-cost-shock.md | reason:M4.7 OCR + KP 成本架构代码完成（30 commits 落地 + 部署 READY），cost shock 已成为已解决的历史事件，"不要启动新 milestone" 等 how-to-apply 段全部失效；战略上下文已迁移到 docs/changelog.md 2026-04-25/04-26/04-28 entry + project_status.md M4.7 段
2026-04-28 21:35 | op:edit | file:MEMORY.md | reason:Project 段移除 2 行（M4.6 Brainstorm WIP + OCR Cost Shock），与上方 2 条 delete 同步
2026-04-28 22:05 | op:add | file:feedback_persist-secrets-immediately.md | reason:本 session compact 丢失用户 paste 的 DEEPSEEK_API_KEY，用户重发后强提示——固化"用户 paste 密钥/secret 后必须立即 echo 写入 .env.local"规则，避免再次 compact 丢失
2026-04-28 22:05 | op:edit | file:MEMORY.md | reason:Process 段加 Persist Secrets Immediately 索引行
2026-04-29 11:59 | op:add | file:project_deepseek-json-history-format.md | reason:T5.3 根因诊断 — DeepSeek json_object + 多轮 + 纯文本 assistant 历史 = 返回纯空格

## 2026-04-30

2026-04-30 21:00 | op:edit | file:project_vercel-fire-and-forget-after.md | reason:retrospective 2.0 草稿 a1 — 扩展为 4-variant family（outer naked / inner-of-after() naked / OCR callback book-level / OCR callback module-level）+ grep gate 命令 + 4 处未修候选清单（M4.7 收尾）
2026-04-30 21:00 | op:add | file:feedback_smoke-must-traverse-auth-gate.md | reason:retrospective 2.0 草稿 a2 — 派 src/app/api/** fix 任务 acceptance 必须三件齐全（cookie + --data-binary + DB 终态查询），M4.7 实证两次假阳性（598bf33 401 / 4ee1325 silent 400）
2026-04-30 21:00 | op:edit | file:MEMORY.md | reason:Milestones & Review 段加 Smoke Must Traverse Auth Gate 索引行（与 auth-gate-verification 相邻）；Project 段更新 Vercel Fire-and-Forget 描述（4-variant family）

## 2026-05-01

2026-05-01 12:00 | op:add | file:project_cloud-build-trigger-brainstorm-wip.md | reason:T1 Cloud Build trigger 配置 brainstorm 启动，按 brainstorming skill WIP 协议加 memory pointer 防 compact 丢失；WIP 完成 + 转 spec/plan 后删除
2026-05-01 12:00 | op:edit | file:MEMORY.md | reason:Project 段加 Cloud Build Trigger Brainstorm WIP 索引行

2026-05-01 14:00 | op:edit | file:project_cloud-build-trigger-brainstorm-wip.md | reason:spec review 后 7 决策修订（决策 6 admin 不是 developer / 决策 7 仅 Layer 1，Layer 2 推迟到 M5 收尾），WIP 文件状态同步

## 2026-05-02

2026-05-02 12:30 | op:delete | file:project_cloud-build-trigger-brainstorm-wip.md | reason:T1 Cloud Build trigger plan 全部落地完成（commit 3520024 + 新 trigger smoke fbd2017→00010-6dw 全绿 + Phase 5 文档收尾），WIP memory pointer 不再需要——决策 trail 留在 spec design.md
2026-05-02 12:30 | op:edit | file:MEMORY.md | reason:Project 段删 Cloud Build Trigger Brainstorm WIP 索引行
2026-05-02 14:35 | op:add | file:project_role-admin-staging-brainstorm.md | reason:开 brainstorm WIP（角色系统+admin+staging），MEMORY.md 加索引指针
2026-05-02 14:50 | op:add | file:feedback_translate-each-decision.md | reason:用户纠正"翻译"含义为每决策必翻译，写成 feedback memory
2026-05-02 15:10 | op:edit | file:project_role-admin-staging-brainstorm.md | reason:brainstorm 暂停于决策 5，更新状态描述（已锁 0-4）+ resume 触发条件
2026-05-02 15:25 | op:edit | file:project_role-admin-staging-brainstorm.md | reason:校准状态——决策 1+2 立刻落地，决策 5-7 paused，原全暂停标记是误解
2026-05-03 00:55 | op:edit | file:project_role-admin-staging-brainstorm.md | reason:决策 1+2 落地完成，状态收敛——5 commits（5a8d5da/ee76b54/3fe14a8/5a457b0/a4e15e7）+ 15 单元测试覆盖；5-7 paused 状态保留
