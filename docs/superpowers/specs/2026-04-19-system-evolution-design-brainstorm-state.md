# 系统进化机制系统设计 Brainstorm 进行中状态（WIP）

**创建日期**: 2026-04-19
**用途**: compact 防御——记录 brainstorm 进度，避免 session 断档丢失状态
**最终产出**: `docs/superpowers/specs/2026-04-19-system-evolution-design.md`
**上游**: `docs/research/2026-04-19-system-evolution-survey.md`（57KB，三重 gate 通过）
**前情**: `docs/superpowers/specs/2026-04-19-system-evolution-design-handoff.md`（冷启动指令）

> ⚠️ compact 后恢复时**先读这个文件**，不要从 summary 重建——summary 会丢决策推理链。

---

## 基础设定（不会变）

### 研究对象
Claude + CCB（Claude-Codex-Bridge）+ skills + memory 协作系统本身的**元层进化机制**——不是产品功能，不是教学系统。

### 本 brainstorm 的输入
- survey 结论 5 条（A 方向对但短板手动 / B 方向对但短板无 TDD / C 最大红利区 hook 2 用 24 / D review 终止主观 retry 无 cap / E 完全空白）
- survey 3 档候选路径：低成本 1-2 天 / 中成本 1-2 周 / **高成本 1 月+ 明确不推荐**
- survey 从"可抄/必避"中汇总出 ~15+ 候选机制

### 硬约束（不能违反，来自 handoff）
1. **MVP 烧钱敏感**：多 agent 并行烧 15× token；机制要权衡 ROI
2. **产品不变量不变**：5 条（必读原文 / Q&A 不可改 / 测试禁笔记 / 80% 过关 / 一次一题）
3. **文件边界不变**：Claude 只写 `docs/**` + `.claude/skills/**` + `CLAUDE.md` + `AGENTS.md` + `GEMINI.md`；src/ / scripts/ 仍走 CCB
4. **survey 硬警告**：
   - 不让 Claude 自评派发效果（ECE 77%）
   - 不抄 Hermes GEPA 自动生成 skill（现阶段）
   - retry 必须硬 cap（$47k 案例）
   - max_iteration 必须真 check（OpenHands #6857）

### 当前系统基线（进化起点）
- A 记忆：auto-memory MEMORY.md + 分类 .md 40+ 条；手动 memory-cleanup skill
- B 技能：23 个手写 skill；无 TDD；F.3 刚做过 session-init 瘦身（127→60 行）
- C 事件捕获：settings.json 接 5 种事件（PreToolUse / PostToolUse / Stop / PreCompact / SessionStart）——但用的是"质检 guard"语义，不是"进化 capture"语义；survey 批评的"只用 2/24"指后者
- D 工作流：CCB 3-step dispatch；task-execution 统筹；同问题 ≥2 次触发 systematic-debugging（但规则不量化）
- E 自我诊断：无自动机制；靠用户 / Claude 主观发起

### 用户画像（出自 memory + CLAUDE.md 沟通协议）
- 非技术 CEO：类比 + 5 问表格 + 不堆术语
- 喜欢自主执行：判断清楚就直接推进，不每步问
- 讨厌变中间人：批准后不要反复确认
- 烧钱敏感：中/高成本必须给 ROI + 回滚路径
- Skill 记不住：新机制必须能自动触发或者少到能背下来

---

## 调研

- [`docs/research/2026-04-19-system-evolution-survey.md`](../../research/2026-04-19-system-evolution-survey.md) — 5 维 SOTA 横扫，S:42 / A:11 / B:4，三重 gate 过。**本次 brainstorm 的唯一真相源**。
- [`docs/research/2026-04-15-obra-superpowers-repo-analysis.md`](../../research/2026-04-15-obra-superpowers-repo-analysis.md) — 上游 skill 框架零件级分析
- [`docs/research/2026-04-15-everything-claude-code-repo-analysis.md`](../../research/2026-04-15-everything-claude-code-repo-analysis.md) — Claude Code 生态零件库
- [`docs/research/2026-04-15-claude-mem-repo-analysis.md`](../../research/2026-04-15-claude-mem-repo-analysis.md) — 记忆系统零件
- [`docs/research/2026-04-15-session-init-optimization-synthesis.md`](../../research/2026-04-15-session-init-optimization-synthesis.md) — 上下文管理综合

---

## 候选机制清单（survey 汇总后的决策空间）

本清单是 brainstorm 决策 2 的输入。brainstorm 进行中，此处仅列候选；采纳与否见"已拍死的决策"。

| # | 机制 | 主维度 | 成本档 | 来源 |
|---|---|---|---|---|
| M1 | CLAUDE.md / session-rules 加 "1% 强触发语" | B | 低 | Superpowers |
| M2 | PostToolUseFailure hook → 自动记 Bash/Edit 失败到 journal | C | 低 | Claude Code hooks |
| M3 | UserPromptSubmit hook → 捕 "不对/重来/错了" 关键词计数 | C/E | 低 | OpenHands UserRejectObservation 类比 |
| M4 | 同问题 ≥2 次硬 cap 计数器（量化版 session-rules 规则 3） | D/E | 低 | Anthropic best-practices 硬阈值 |
| M5 | Hermes `fallback_for_toolsets` YAML 元数据 | B | 低 | hermes-agent |
| M6 | git-tracked memory audit log 强化（MEMORY.md 改动每次 commit） | A | 低 | 现有优势形式化 |
| M7 | Letta sleep-time agent 等价物（auto memory-cleanup cron/skill） | A | 中 | Letta |
| M8 | OpenHands condenser 等价物（旧 journal 压缩而非删除） | A | 中 | OpenHands |
| M9 | skill-audit 周期 job（sub-agent critic 评估 23 skill 漂移） | E | 中 | Anthropic Skills 2.0 eval |
| M10 | Review loop 终止外化到 CI/build/test 结果 | D | 中 | Cognition autofix |
| M11 | task-execution max retries 硬编码 + 真 check | D | 低 | LangChain $47k 案例反面 |
| M12 | Aider 模式 lint/test 失败自动回灌下一 dispatch | C/D | 中 | Aider |
| M13 | TDD-for-skills（subagent 压力测试 → 写 skill → 回归） | B | 中 | Superpowers |
| M14 | Codex/Gemini fresh session per task（不续接旧 context） | D | 低-中 | obra |
| M15 | 离线批量挖矿（每里程碑收尾 dispatch "扫 journal 提议新 skill"） | B/E | 中 | obra 2249 对话挖矿 |
| M16 | Hermes GEPA auto-generate skill | B | 高 | **survey 明确不推荐** |
| M17 | 向量记忆 backend（SQLite FTS5 或向量库） | A | 高 | Letta/Hermes 前沿 |

---

## 已拍死的决策（不再讨论）

### 决策 1：Scope 档位 = b 档优化版 (2026-04-19 拍板)

**选择**：低成本 8 机制（M1-M6, M11, M14）+ 中成本 3 机制合并为 2（retrospective 2.0 吞 M7+M9+M15 / M10 review 外化）= **共 10 项实施单元**，覆盖 survey 5 维全部短板。

**关键收敛**：brainstorm 中暴露 retrospective skill 已覆盖 M7/M9/M15 的 ~70% 功能，应**升级 retrospective 到 2.0** 而非新写 3 个 skill——避免 skill 爆炸（用户 memory feedback：skill 记不住），尊重现有投资（YAGNI）。

**被否决**：
- **a 档（只低成本）**：只补 B/C/D 三维，survey 最痛两条（A 手动 + E 完全空白）不动
- **c 档（低 + 中全量 14 机制）**：MVP 阶段挤压云部署/M4 主业，互相作用难调
- **M16 Hermes GEPA / M17 向量记忆**：survey 明确不推荐现阶段，明确砍到 T3（MVP 后）

**重开讨论触发条件**：若 MVP 后进入留存机制阶段且用户量级 >1k，则重评 M17 向量记忆。

### 决策 2：T1/T2/T3 拆分 (2026-04-19 拍板)

**T1（本轮立刻做，~1-2 天）**：8 个低成本机制
- M1 CLAUDE.md / session-rules 加 1% 强触发语
- M2 PostToolUseFailure hook（失败自动记 journal）
- M3 UserPromptSubmit hook（纠错关键词计数）
- M4 同问题 ≥2 次硬 cap（量化计数器）
- M5 skill frontmatter 加 `fallback_for_toolsets`
- M6 git-tracked memory audit log 契约化
- M11 task-execution max retries=3 硬编码 + 真 check
- M14 Codex/Gemini fresh session per task 约定

**T2（云部署阶段 2 稳定后，~1 周）**：2 个中成本机制
- Retrospective 2.0（合并 M7+M9+M15，升级现有 skill 加 5 段 + 自动触发）
- M10 Review loop 终止外化到 build/test/lint clean

**T3（MVP 后）**：M16 GEPA / M17 向量记忆（survey 明确不推荐）

**理由**：
- T1 全是文件改动 + hook 注册，Claude 能直接写（<100 行 bash + .md/.json），不挤压云部署/M4 主业
- T2 涉及 retrospective / task-execution 这类"高流量 skill"，放云部署阶段 2 稳定后（更稳定的测试窗口）
- T3 high-risk / survey 明确警告，MVP 前不碰

**被否决**：全部 T1（2 天做 10 项）——中成本 2 机制需要更稳测试窗口，不适合当前并行云部署阶段 2 plan review 的高变更环境。

---

### 决策 3：里程碑挂靠 = 不立里程碑（c 档） (2026-04-19 拍板)

**选择**：**c 档** — 不立新里程碑，本 session 内推到底（design → spec review → plan → 实施）。用户原话："直接 c，这个 session 全部一次性搞定"。

**理由**：
- T1 8 机制全是文件/hook 改动，<100 行 bash + .md 文件，Claude 文件边界内 + 用户显式授权，单 session 可落地
- T2 2 机制（retrospective 2.0 + review 外化）也是 skill/md 改动，单 session 可落地（但不能充分测试）
- 用户节奏偏好：autonomous 执行，不想多阶段拖时间
- project_status.md 可在 spec / plan / 实施完成后做一次性更新（保持鲜度契约）

**被否决**：
- **a 独立里程碑**：分阶段拖时间，用户明确反对
- **b 分散塞进云部署**：容易 drift

**节奏声明**：本 session 走 autonomous 流程——决策 4/5/6 是工程细节，Claude 一次性锁定并呈现；用户只在以下节点介入：① 出现产品决策 ② scope 变化 ③ 全部完成 final approval。

### 决策 4：成功度量 / 观测信号 (2026-04-19 拍板, autonomous)

每个采纳机制的可观测信号（避 E 维 survey 警告"改了不知道有没有用"）：

**T1（定性为主，工程层）**：
| 机制 | 信号 |
|---|---|
| M1 1% 强触发语 | 接下来 2 周定性观察 brainstorming / verification-before-completion / claudemd-check 等关键 skill 在相关场景是否主动触发；用户不再需手动提醒 |
| M2 PostToolUseFailure hook | `.ccb/counters/tool-failures.log` 每次 Bash/Edit 失败追加一条；journal 自动出现 `[hook:tool-failure]` 条目 |
| M3 UserPromptSubmit 纠错词 | `.ccb/counters/user-corrections-<session_id>.count` 有数字；session 内 ≥3 次时 hook 注入 additionalContext 提示 Claude |
| M4 同问题 ≥2 次硬 cap | 与 M3 共用计数器；达 2 次时 hook 注入 systematic-debugging 触发提示 |
| M5 fallback_for_toolsets | 手动扫 3-5 个目标 skill frontmatter 字段存在；条件：当某 skill 的前置 tool 不可用时，fallback 条目出现在 Claude 上下文 |
| M6 memory audit 契约 | `git log --oneline -- "C:\Users\Administrator\.claude\projects\D------Users-Sean-ai-textbook-teacher\memory\**"` 可查（依赖 CLAUDE.md 契约人工遵守） |
| M11 max retries=3 | `.claude/skills/task-execution/SKILL.md` 中有 retries 计数 + 硬 check 代码 / 伪代码；第 3 次失败时 surface to user |
| M14 fresh session | `docs/ccb-protocol.md` 明文条款；每次 dispatch 模板有"新开 session"指示 |

**T2（定量 + 人工验收）**：
| 机制 | 信号 |
|---|---|
| Retrospective 2.0 | 升级后**跑一次 /retrospective** → 产出 5 段报告 → 至少 3 条 skill-audit 建议 + 至少 1 条 skill 挖矿建议 + 原 3 段不丢；自动触发路径有至少一种（git post-commit 阈值 / 里程碑 hook / N 次 stop hook 提醒均可） |
| M10 review 外化 | `.claude/skills/task-execution/SKILL.md` review phase 有"执行 build + test + lint → 返回码 check"逻辑；Claude 不能仅凭主观判断声称"review passed" |

**基线记录**：实施前 `git rev-parse HEAD` 记到 spec §3，作对比基点。

### 决策 5：回滚策略 / Kill Switches (2026-04-19 拍板, autonomous)

**每机制统一回滚原则**：**`git revert <实施 commit hash>`**，分钟级恢复。

**分机制关闭路径**：
| 机制类型 | 关闭方式 |
|---|---|
| Hook 类（M2/M3/M4） | `.claude/settings.json` 注释掉对应 hook 条目 → 下次 session 不生效；脚本文件不删，方便重开 |
| Skill 改动（M1/M5/M11/M14/retrospective 2.0/M10） | `git revert` 对应 commit；或保留老版本 .bak 备份 |
| .md 契约（M6） | `git revert` |
| 计数器状态 | `rm -rf .ccb/counters/` 清空（不影响 logic）|

**Commit message 约定**：实施时每机制单 commit，message 末附 `[revert-path: git revert <hash>]` 提示。

**Hook 防爆安全条款**：
- 所有新 bash hook `set -euo pipefail`
- 错误捕获写 `.ccb/counters/hook-errors.log`（不阻塞主 agent）
- 每个 hook 脚本开头加 `KILL_SWITCH_ENV` 检查：若 `AI_SYSTEM_EVOLUTION_DISABLE=1` 则直接 exit 0

**.ccb/counters/ 清理**：加入 `.gitignore`，不污染 repo；定期由 retrospective 2.0 清理 >30 天条目。

### 决策 6：与 F.3 架构兼容性 (2026-04-19 拍板, autonomous)

F.3 已有 hook/机制（2026-04-18 落盘）：
| F.3 资产 | 新机制冲突风险 | 解法 |
|---|---|---|
| `SessionStart` hook `session-start-inject.sh`（注入 project_status.md）| 无——新 hook 接其他事件 | 新 hook 都挂 PostToolUseFailure / UserPromptSubmit，不碰 SessionStart |
| `.ccb/session-marker` 幂等（Resume 短路） | 无 | 新 hook 不依赖 session-marker 状态 |
| `PreCompact` hook `pre-compact-save.sh` + `pre-compact-check.sh`（强制更新 project_status.md） | 无 | 新机制不挂 PreCompact |
| `Stop` hook `stop-counter.sh` | **低** — M3/M4 用 UserPromptSubmit 不用 Stop，避免重叠 | 确认 stop-counter 仍负责单一职责 |
| `PreToolUse` hook（`file-boundary-guard.sh` / `dispatch-guard.sh`） | 无 | 新 hook 不加 PreToolUse |
| `PostToolUse` hook（`post-edit-check.sh`，matcher `Edit|Write`） | **低** — M2 接 `PostToolUseFailure`（不同事件）| 确认 Claude Code 支持 `PostToolUseFailure` matcher；若不支持，降级方案：在 `PostToolUse` matcher 加 `"Bash"` 并检测 exit code |
| CLAUDE.md `@import` 自动加载 session-rules | 无 | M1/M4 改 session-rules 内容，不碰 @import 语法 |
| 文件边界（Claude: docs/** + .claude/skills/** + CLAUDE.md；scripts/ 归 Codex） | **中** — 新 hook 脚本在 scripts/hooks/ 是 Codex 文件边界 | 用户已显式授权"一次性搞定" = small-bash-direct-write 条款生效；Claude 直接写 <100 行 bash |
| Retrospective 1.0 手动触发契约 | 无 | 2.0 保留 `/retrospective` 入口 + 原 3 段；加自动触发路径和 2 新段，增量不覆盖 |
| memory-cleanup skill | 无 | 两 skill 串行用，职责分离（retrospective 出建议 / cleanup 搬文件）|

**降级决策**：若 Claude Code 的 `PostToolUseFailure` matcher 语法实际不支持（文档内容和实现可能分离），则在实施阶段降级为"PostToolUse matcher Bash + 脚本内部判断 stderr 非空 / exit code 非 0"。不影响 M2 功能。

---

## 待 brainstorm 的决策（按依赖顺序）

_（全部 6 决策已锁定 2026-04-19）_
T1 机制：
- 候选 a：新开 "系统进化 M0" 里程碑（独立轴，和云部署阶段 2 并行）
- 候选 b：分散塞进云部署阶段 2 / M4 教学系统的预备工作
- 候选 c：不立里程碑，作为"每个 session 背景工作"持续改

### 决策 4：成功度量 / 观测信号
每个采纳机制要有可观测信号——避免 survey E 维警告的"改了但不知道有没有用"。
候选信号：hook 触发次数 / journal entry 增速 / skill 调用频次 / user 重复纠正次数 / compact 次数 / parking 积压 / milestone 完成率。

### 决策 5：回滚策略 / kill switches
每个新机制的关闭路径：
- hook 改动 → settings.json 注释掉 / 环境变量
- skill 改动 → git revert 文件
- CLAUDE.md 改动 → git revert
- 记忆机制 → 清空 MEMORY.md 分类

### 决策 6：与 F.3 架构兼容性
- SessionStart hook 注 project_status 机制还在——新机制不能重复注入
- PreCompact block 机制还在——新机制不能让 compact 链不幂等
- session-marker 幂等机制还在——新机制不能破坏 Resume 短路

---

## 当前进度

- ✅ 调研完成（survey 2026-04-19）
- ✅ Handoff 写好（2026-04-19）
- ✅ 决策 1：Scope = b 档优化版（2026-04-19）
- ✅ 决策 2：T1/T2/T3 拆分（2026-04-19）
- ✅ 决策 3：不立里程碑，本 session 推到底（2026-04-19）
- ✅ 决策 4：成功度量 / 观测信号（2026-04-19, autonomous）
- ✅ 决策 5：回滚策略 / kill switches（2026-04-19, autonomous）
- ✅ 决策 6：F.3 兼容性（2026-04-19, autonomous）
- ✅ Spec 完整写成 554 行（2026-04-19）
- ✅ Spec review 1 轮（subagent 发现 5 critical/major），全部修复：
  - PostToolUseFailure → PostToolUse + Bash matcher（Claude Code 无独立失败事件）
  - stdin schema 重写为官方 `{session_id, transcript_path, tool_name, tool_input, tool_response}`
  - M3 关键词收窄（移除 `不是/别/停` 假阳高词）
  - Retrospective 2.0 段 4 数据源分 3 阶段演进（静态审计 → 间接信号 → 新 hook）
  - kill switch 文档化位置明确（§4.4 + CLAUDE.md 技术红线）
  - M2 加命令前缀白名单避免探索性失败噪音
  - M11 retry_count 持久化路径定义（`.ccb/counters/task-retries-<task_uuid>.count`）
  - M5 fallback_for_toolsets 落地保证（session-rules 规则 6）
  - 附录 A 加归属单元列，消除 10/11 计数歧义
- 🎯 **本 brainstorm 生命周期结束**。下游：writing-plans → T1 实施 → T2 实施

---

## 最终产出

1. `docs/superpowers/specs/2026-04-19-system-evolution-design.md`（design spec）
2. `docs/superpowers/INDEX.md` Specs 段追加
3. 如产生新里程碑 → `docs/project_status.md` 更新当前里程碑 / 排队中
4. 本 WIP 文件 brainstorm 完成后保留为决策轨迹（用户偏好保留不删）
5. 下游：writing-plans → task-execution
