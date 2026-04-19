# 系统进化机制设计 Spec

**创建日期**: 2026-04-19
**状态**: Design 完成，待 spec review + writing-plans
**上游调研**: `docs/research/2026-04-19-system-evolution-survey.md`（57KB，三重 gate 过）
**上游 brainstorm WIP**: `docs/superpowers/specs/2026-04-19-system-evolution-design-brainstorm-state.md`
**目的**: 把 survey 暴露的 5 维 × 17 候选机制挑出、排优先级，产出可落地设计

---

## 0. 摘要

**一句话**：采纳 **10 项实施单元**（8 低成本 + 2 中成本合并）覆盖 survey 5 维短板；**不立新里程碑**、本 session 内推到底；每机制 `git revert` 分钟级回滚；明确砍 M16 GEPA / M17 向量记忆到 T3（MVP 后）。

**机制分布**：A 记忆 2 / B 技能 3 / C 事件捕获 2 / D 工作流 3 / E 自我诊断 2（部分机制跨维）。

**验收节点**：本 session 内 → spec review subagent 过 → writing-plans 产 plan → 实施 T1（8 机制 ~1-2 天）→ 实施 T2（2 机制 ~1 周）→ 全部完成更新 `project_status.md`。

---

## 1. 采纳机制清单（优先级 + 里程碑挂靠）

### 1.1 范围定义

本 spec 覆盖 **10 项实施单元**：8 低成本 T1 + 2 中成本 T2。**明确砍 M16 Hermes GEPA / M17 向量记忆到 T3**（survey 明确不推荐现阶段）。

### 1.2 T1 机制表（~1-2 天，Claude 直接写 + 用户授权）

| # | 机制 | 维度 | 改动位置 | 改动大小 |
|---|---|---|---|---|
| M1 | CLAUDE.md / session-rules 加 "1% 强触发语" | B 技能触发 | `CLAUDE.md` §Skill 使用 + `.claude/skills/session-rules/SKILL.md` | 改措辞 <20 行 |
| M2 | PostToolUse Bash 失败捕获 hook | C 事件捕获 | 新 `scripts/hooks/post-tool-failure-capture.sh` + `.claude/settings.json` | 新 ~60 行 bash |
| M3 | UserPromptSubmit 纠错词计数 | C/E 事件+诊断 | 新 `scripts/hooks/user-correction-counter.sh` + `.claude/settings.json` | 新 ~40 行 bash |
| M4 | 同问题 ≥2 次硬 cap 量化 | D/E 工作流+诊断 | 与 M3 合用计数器 + `session-rules/SKILL.md` 规则 3 升级 | 改 ~10 行 |
| M5 | YAML `fallback_for_toolsets` | B 失效处理 | 3-5 个相关 skill 的 frontmatter | 每 skill <5 行 |
| M6 | memory audit log 契约化 | A 记忆控制面 | `CLAUDE.md` 契约条款 + 可选 post-commit helper | 写规范 |
| M11 | task-execution max retries=3 | D 失败恢复 | `.claude/skills/task-execution/SKILL.md` | 改 ~15 行 |
| M14 | Codex/Gemini fresh session per task | D 工作流拓扑 | `.claude/skills/structured-dispatch/SKILL.md` + `docs/ccb-protocol.md` | 改 ~10 行 |

### 1.3 T2 机制表（~1 周，接 T1 尾巴或云部署阶段 2 稳定后）

| # | 机制 | 维度 | 改动位置 |
|---|---|---|---|
| **Retrospective 2.0** | 合 M7 sleep-time + M9 skill-audit + M15 挖矿 | A 记忆 + B 技能 + E 诊断 | 升级 `.claude/skills/retrospective/SKILL.md`：① 加自动触发路径（里程碑 hook / 每 N commit 提醒）② 原 3 段保留（memory/skill/journal） ③ 新段：sub-agent critic 评估 skill 漂移（M9，避 ECE 77% 陷阱） ④ 新段：扫 journal 提议新 skill（M15） ⑤ 执行仍需用户批准 |
| **M10** | Review loop 终止外化 | D 工作流终止 | `.claude/skills/task-execution/SKILL.md` review phase：从 Claude 主观 → "build 过 + test 过 + lint clean" 硬编码 check |

### 1.4 T3 明确砍（MVP 后评估）

| # | 机制 | 砍的理由 | 重开触发 |
|---|---|---|---|
| M16 | Hermes GEPA auto-generate skill | survey 明确：现阶段过度工程化，成本 $2-10/轮 × 10 迭代，风险污染 skill 系统 | MVP 后 + skill 数量 >50 + 已建立 sub-agent eval harness |
| M17 | 向量记忆 backend（向量库/SQLite FTS5） | 40 条记忆纯文本够用，survey A 维 Claim 3.2："过 200 条必上向量" | 记忆条目 >150 条 或 用户量级 >1k |

### 1.5 对现有工具的影响声明

- **retrospective**：**不被替代，被升级**（/retrospective 手动入口保留，加自动触发路径 + 5 段报告）
- **memory-cleanup**：**保留，不重合**（管"搬旧文件到 archive"，与 retrospective 2.0 串行：先出建议 → 用户批准 → 后续某次 cleanup 搬老文件）
- **journal**：**保留**，作为 retrospective/挖矿的数据源；M2/M3 hook 会自动灌事件（Codex 失败 / 用户纠错）
- **session-init**：**基本不变**，增加一条"扫 `.ccb/counters/*` 未处理事件提醒"（~5 行）
- **F.3 SessionStart/PreCompact hooks**：**完全不碰**，新 hook 与旧共存

### 1.6 新增 vs 改动清单概览

| 类型 | 数量 | 详情 |
|---|---|---|
| 新 bash 脚本 | 2-3 个 | post-tool-failure / user-correction-counter（可兼 repeat-problem） |
| 新目录 | 1 个 | `.ccb/counters/`（加入 `.gitignore`） |
| skill 改动 | 5 个文件 | retrospective / task-execution / structured-dispatch / session-rules / 3-5 个加 fallback frontmatter |
| .md 改动 | 2 个 | `CLAUDE.md` / `docs/ccb-protocol.md` |
| settings.json | 1 个 | 注册 3 个新 hook |
| **不新增** | — | 任何新 skill 文件（避 skill 爆炸） |

---

## 2. 机制详细设计

### 2.1 Hooks 改动（`.claude/settings.json` + `scripts/hooks/*.sh`）

#### 2.1.1 M2 PostToolUse Bash 失败捕获 hook — 工具失败自动回灌

**目的**：Bash 命令（尤其 Codex/Gemini 派发、npm/git 等）失败时，把失败信号写入 journal + 通过 `additionalContext` 注入 Claude，免人工复制 stderr。

**触发事件**：`PostToolUse`（matcher `Bash`）— **首选方案**。Claude Code 无独立 `PostToolUseFailure` 事件；所有工具执行后均触发 `PostToolUse`，脚本内判是否失败。matcher 限制 `Bash` 避免 Edit/Write/Read 噪音。

**Stdin schema**（Claude Code 官方，2025+）：
```json
{
  "session_id": "...",
  "transcript_path": "...",
  "tool_name": "Bash",
  "tool_input": { "command": "...", "description": "..." },
  "tool_response": { "exit_code": N, "stdout": "...", "stderr": "..." }
}
```

**脚本**：`scripts/hooks/post-tool-failure-capture.sh` 逻辑：
1. 读 stdin JSON，用 `jq` 解析 `.tool_response.exit_code`
2. `exit_code == 0` → exit 0（正常结果不记）
3. `exit_code != 0`：
   a. 追加 `.ccb/counters/tool-failures.log`（JSON lines：`{ts, tool:Bash, exit_code, cmd_head:first100, stderr_head:first200}`）
   b. **命令白名单** — 命令前缀匹配 `codex:|gemini:|npm |pnpm |yarn |git |node |bash scripts/|docker ` 才进 journal；否则仅计日志（避免探索性 `ls nonexistent` 被当正式失败）
   c. 命中白名单 → 追加 `docs/journal/<YYYY-MM-DD>-auto-tool-failures.md`（type `issue`, status `open`）
   d. stdout 返回 `{"hookSpecificOutput": {"hookEventName": "PostToolUse", "additionalContext": "Bash failed (exit <code>): <stderr_head>. Consider diagnosing before retrying."}}`
4. 异常：`set -euo pipefail` + `trap 'echo "[hook-error] $0 $(date -Iseconds)" >> .ccb/counters/hook-errors.log; exit 0' ERR`

**输出字段**：Claude Code PostToolUse hook 的 additionalContext 注入走 `hookSpecificOutput.additionalContext`（非顶层 additionalContext）。

**幂等性**：追加模式，重复调用产生多条记录（符合"事件流"语义，不去重）

**Kill switch**：`AI_SYSTEM_EVOLUTION_DISABLE=1` 环境变量 → 脚本 line 1 检查，exit 0（文档化位置见 §4.3）

#### 2.1.2 M3 UserPromptSubmit 纠错词计数 hook

**目的**：检测用户连续纠错关键词，session 内 ≥3 次注入提醒 Claude "上下文被失败尝试污染，建议 /clear"。Anthropic best-practices 2 次阈值的量化版。

**触发事件**：`UserPromptSubmit`（matcher `.*`）

**Stdin schema**（Claude Code 官方）：
```json
{ "session_id": "...", "transcript_path": "...", "prompt": "..." }
```

**脚本**：`scripts/hooks/user-correction-counter.sh` 逻辑：
1. 读 stdin，用 `jq` 提取 `.session_id` 和 `.prompt`
   - session_id fallback 链（若 stdin 缺失）：`$CLAUDE_SESSION_ID` → `.ccb/session-marker` 内记录的 id → `hash(pwd+ppid)` 作为最后兜底
2. **关键词收窄**（移除 "不是/别/停" 假阳高词，保留强纠错信号）：
   - 中文：`不对|重来|错了|重新|不行|搞错|弄错`
   - 英文（词边界 \b）：`\bwrong\b|\bredo\b|\bno that'?s\b|\bthat'?s wrong\b|\bstop\b`
3. grep 命中 → `.ccb/counters/user-corrections-<session_id>.count` 数字 +1
4. 达 2 → stdout 返回 `{"hookSpecificOutput": {"hookEventName": "UserPromptSubmit", "additionalContext": "⚠️ 本 session 已检测到用户 2 次纠错。触发 session-rules 规则 3：若同一问题再次失败，必须走 systematic-debugging，不得继续尝试修复。"}}`
5. 达 3 → stdout 返回 `{"hookSpecificOutput": {"hookEventName": "UserPromptSubmit", "additionalContext": "🛑 本 session 已检测到用户 3 次纠错。按 Anthropic best-practices 建议 /clear 或明确回到 Phase 1 根因诊断。"}}`
6. 异常：同 M2（set -euo pipefail + trap）

**假阳控制**：关键词收窄后移除的词（"不是/别/停"）会使"不是今天做/别忘了/停车场"这类高频非纠错语句不再计数。保留词"重新/不对/错了/不行/wrong/redo"语义明确为否定当前尝试。

**幂等性**：计数器天然幂等（仅增），session 结束后文件可留存（retrospective 2.0 会扫来统计）

**Kill switch**：同 M2

#### 2.1.3 M4 同问题 ≥2 次硬 cap（复用 M3 计数器）

**目的**：session-rules 规则 3 "同一问题修复失败 ≥2 次"**量化落地**。

**实现**：
- 复用 M3 的 `user-corrections-<session_id>.count`
- session-rules/SKILL.md 规则 3 加一句："计数器 ≥2 时，hook 已注入提示；Claude 必须响应该 additionalContext，不得忽略"
- 加"≥ 2 次停下走 systematic-debugging"的硬契约

**为什么不独立脚本**：避免两 hook 对同一 session 重复计数 + 避免文件竞争条件。

#### 2.1.4 `.claude/settings.json` 注册示意（伪）

```json
{
  "hooks": {
    "PostToolUse": [
      { "matcher": "Edit|Write", "hooks": [{ "type": "command", "command": "bash scripts/hooks/post-edit-check.sh" }] },
      { "matcher": "Bash",       "hooks": [{ "type": "command", "command": "bash scripts/hooks/post-tool-failure-capture.sh" }] }
    ],
    "UserPromptSubmit": [
      { "matcher": ".*", "hooks": [{ "type": "command", "command": "bash scripts/hooks/user-correction-counter.sh" }] }
    ]
    // SessionStart / PreCompact / Stop / PreToolUse 保持 F.3 状态不改
    // PostToolUse 的 Edit|Write matcher 是 F.3 已有，Bash matcher 是本 spec 新增，二者并列不互扰
  }
}
```

### 2.2 Skills 改动（`.claude/skills/**/SKILL.md`）

#### 2.2.1 M1 `.claude/skills/session-rules/SKILL.md` + `CLAUDE.md` — 1% 强触发语

**现状**：session-rules 使用"应该 / 自动执行"等建议语气
**改动**：关键 skill 触发条款替换为强触发语："即使只有 1% 可能需要 <skill>，也必须调用 <skill> 的触发流程"
- 适用：brainstorming / verification-before-completion / claudemd-check / systematic-debugging / research-before-decision
- 非适用：journal / memory-cleanup 等用户触发型

**改法示例**（session-rules 规则 3 升级后）：
> 规则 3 升级：同一问题修复失败 ≥2 次（由 `.ccb/counters/user-corrections-<session>.count` 硬计数）→ **绝对必须**进 systematic-debugging，禁止继续尝试修复。即使当前尝试看起来"只差一点"，1% 可能需要根因诊断 = 100% 必须走诊断流程。

#### 2.2.2 M5 YAML `fallback_for_toolsets`

**现状**：skill 只有 `name` + `description` + `allowed-tools`
**改动**：在可能遇到 tool 不可用的 skill 加 `fallback_for_toolsets`

**示例**（`debug-ocr/SKILL.md`）：
```yaml
---
name: debug-ocr
description: ...
fallback_for_toolsets:
  - preferred: ["Read", "Bash"]
    fallback: "If Bash is unavailable, read last 100 lines of ocr_server.log via Read only."
---
```

**候选 skill**：debug-ocr / database-migrations / using-git-worktrees / research-before-decision（sub-agent 不可用时 fallback WebFetch）

**行为约定**：Claude 加载 skill 时若 preferred tools 某项不可用，**优先执行 fallback 文本**而非放弃 skill。

**落地保证**：`fallback_for_toolsets` 非 Claude Code 原生 schema，纯文档字段。为保证 Claude 实际使用，必须在 **`session-rules/SKILL.md` 规则区**增加一条约束：
> 规则 6（新）：加载任何 skill 时，若发现 SKILL.md frontmatter 含 `fallback_for_toolsets` 字段且当前 session 中 preferred 列表任一工具不可用 → 必须优先读并执行 fallback 文本，禁止因单个工具缺失直接放弃 skill。


#### 2.2.3 M11 `.claude/skills/task-execution/SKILL.md` — max retries=3 硬 cap

**现状**：task-execution 统筹 dispatch + review + retry，retry 次数无硬 cap
**改动**：
- 持久化 retry 状态到 `.ccb/counters/task-retries-<task_uuid>.count`（每 dispatch 一个 task_uuid，避免并发 dispatch 串扰）
- `task_uuid` 生成规则：`$(date +%s)-$(head -c 4 /dev/urandom | xxd -p)` 或 skill 内 state scratchpad 给出的既有 id
- 每次 retry 前 task-execution skill 自行读文件 +1，`if retry_count >= 3 then surface_to_user "Retry cap hit, manual diagnosis required"`
- 硬规则不接受"只差一点再试一次"说辞——survey $47k 案例警告
- 生命周期：task 完成/放弃后计数器文件保留 24h（供 retrospective 2.0 扫），过期由 memory-cleanup 或手动清理

#### 2.2.4 M14 `.claude/skills/structured-dispatch/SKILL.md` + `docs/ccb-protocol.md` — fresh session per task

**现状**：Codex/Gemini session 可续接多个任务
**改动**：
- structured-dispatch 模板加 "⚠️ 每次派发必须使用 **fresh session**（新开 Codex/Gemini 实例），不续接旧 context" 条款
- `docs/ccb-protocol.md` CCB 规则对应段落明确
- 理由：obra "fresh subagent per task" + Cognition "context 污染影响 review 判断"

**例外**：同一任务的 retry（非新任务）允许续接同 session；但 3 次 cap（M11）触发后必须换 session。

#### 2.2.5 Retrospective 2.0（T2 机制，`.claude/skills/retrospective/SKILL.md`）

**升级策略**：完全保留 1.0 的手动触发 + 3 段报告，**增量扩展**。

**新增段 4 — Skill Audit（M9）**：
- 派发 general-purpose sub-agent（独立 critic，避免自评 ECE 77%）
- 输入（分两阶段演进）：
  - **阶段 1（首次启用到有数据前）**：仅 23 个 skill 的 SKILL.md 全文 + `git log -- .claude/skills/` 近 30 天变更 → 纯静态审计（"SKILL.md 描述是否自洽、触发条件是否清晰、与 session-rules Chain Routing 是否对齐"）
  - **阶段 2（数据积累 30 天后）**：加入 `.ccb/counters/tool-failures.log`、`.ccb/counters/user-corrections-*.count`、`.ccb/counters/task-retries-*.count`、`docs/journal/` 近期自动条目 → 间接信号挖掘（哪些 skill 在 failure/correction 高发场景被调用或未被调用）
  - **阶段 3（可选）**：若需要直接 skill-invocation 日志，后续新增 `PreToolUse matcher "Task"` hook 记录 sub-agent 调用 + skill load 事件（本 spec 不包含，记为 T3）
- 任务：找"描述和实际行为不一致 / 触发不生效 / 漂移到原初设计外"的 skill
- 产出：每 skill 一个 verdict（healthy / drifting / unused / needs-data）+ 建议改动

**新增段 5 — Skill 挖矿（M15）**：
- 派 sub-agent 扫 `docs/journal/` 近 30 天条目
- 任务：找重复出现 ≥3 次的 pattern，提议是否值得写新 skill
- 产出：候选 skill 名字 + 1 段说明 + 3 条 journal 证据
- **仅提议**，不自动生成（survey 明确警告 Hermes 自动生成 skill）

**新增自动触发路径**：
- 选项 A（倾向）：里程碑结束时（project_status.md 里某里程碑状态变 resolved）hook 触发提醒"建议跑 /retrospective"——不强制，inject 提示而已
- 选项 B：每 N commit（例如 30 commits 未跑过 retrospective）同理提醒
- 实施时二选一或并存（取决于 hook 实现复杂度）

**执行仍需用户批准**：5 段报告产出后，每条建议仍是 y/n 逐条批准（继承 1.0 契约）

#### 2.2.6 M10 task-execution review loop 终止外化（T2 机制）

**现状**：task-execution review phase 终止依赖 Claude 主观"review passed"
**改动**：review phase 增加**必须通过**的硬 check 清单：

```yaml
review_termination_criteria:
  required_pass:
    - command: "npm run build"  # 或项目定义的 build 命令
      expect_exit: 0
    - command: "npm test"       # 或项目定义的测试命令
      expect_exit: 0
    - command: "npm run lint"   # 可选（若项目有）
      expect_exit: 0
  optional_signals:
    - "manual_visual_check"     # UI 改动时用户目测
    - "smoke_test_passed"       # 关键路径跑一遍
```

- Claude 必须调用这些命令并报告 exit code
- 任一 required_pass 未达 → review phase **不能声明 passed**
- Claude 主观判断作为**补充信号**（指出 build 过但逻辑错），不能**替代**硬 check

**冲突处理**：若项目无 `npm run build` / `npm test`（比如纯文档改动），spec 允许 reviewer 在 review 开始时**明文声明"本任务无构建/测试硬 check，仅走人工 review"**——例外必须可见，不能隐式降级。

#### 2.2.7 session-init 增补扫描

**现状**：session-init Step 3 扫 parked
**改动**：Step 2 "收集状态" 并行增加 `ls .ccb/counters/` + 若 `tool-failures.log` 有未归档条目或 `user-corrections-*` 残留 ≥3 的计数，在仪表盘加 `⚠️ 未处理事件: N` 行

### 2.3 CLAUDE.md 改动（M1 + M6）

**M1 加强 skill 使用章节**：
- 原文"每次会话首次启动时调用 session-init skill"
- 增补："所有 session-rules Chain Routing 条件触发的 skill：即使只有 1% 可能需要调用，也必须走对应 skill 的触发流程。违规是优先级高于'保持简洁'的硬错误。"

**M6 新增 memory audit 条款**（禁止事项段后）：
- 标题："## memory audit 契约"
- 内容：
  - 所有对 `C:\Users\Administrator\.claude\projects\D------Users-Sean-ai-textbook-teacher\memory\**` 的改动**必须经 git 托管**（该目录在用户主目录，但建立 git-tracked symlink 或每次改动后执行归档 commit）
  - **降级方案**：若 memory 路径不在项目 repo 内（实际情况），则维护 `docs/memory-audit-log.md`——每次 Claude 对 memory 的增/改/删在此文件追加一行 `YYYY-MM-DD HH:MM | op:add/edit/delete | file:<name>.md | reason:<短描述>`
  - **实施选降级**（memory 路径跨 repo 不易 git 托管；降级方案成本更低）

### 2.4 Memory layer 改动

**M6 落地**：
- 新增 `docs/memory-audit-log.md` 作为 append-only 审计日志
- CLAUDE.md 契约要求 Claude 每次改 memory 前后都追加一条（由 Claude 自觉写，无 hook 强制；依赖 CLAUDE.md 契约 + retrospective 2.0 审计）
- **本 spec 不引入** `.ccb/counters/memory-audit-pending.log`（删除该占位，避免"写了但谁都不生成"的 ghost 字段）；改为 retrospective 2.0 段 4 审计时，sub-agent **直接对比** `git log` memory 目录改动次数 vs `memory-audit-log.md` 行数差，就能发现漏记

**不做**：衰减 / 向量索引 / 分层（survey 明确 40 条纯文本够用）

### 2.5 Session / 工作流改动

汇总 M11 + M14 + M10 + session-init 增补，已在 §2.2 逐项列出。此处仅做 cross-ref：

| 触发点 | 改动 |
|---|---|
| 每次 dispatch 前 | M14 约定 fresh session（structured-dispatch） |
| Dispatch 失败后 | M11 retry_count +1，达 3 强制 surface |
| Review phase 开始 | M10 声明硬 check 清单 |
| Review phase 结束 | M10 校验硬 check 全过才 passed |
| Session 开始 | session-init 扫 `.ccb/counters/` |
| 用户提交 prompt | M3 hook 计数 |
| 工具失败 | M2 hook 记日志 + 注入 additionalContext |
| Skill 加载 | M5 fallback 文本触发 |

---

## 3. 成功度量 / 观测信号

### 3.1 基线记录（实施前）

实施前记录 `git rev-parse HEAD` 到本 §：
- **基线 commit**：`<待实施时填>`
- **基线 skill 数**：23（.claude/skills/ 子目录计数）
- **基线 hook 数**：5 种事件（PreToolUse / PostToolUse / Stop / PreCompact / SessionStart）
- **基线 memory 条目**：~40 条（MEMORY.md 索引计数）

### 3.2 每机制可观测信号

**T1**：

| 机制 | 信号 | 验收方式 |
|---|---|---|
| M1 1% 强触发语 | 2 周定性观察：相关 skill 触发频次 vs 基线 | 用户主观 + retrospective 统计 |
| M2 PostToolUse Bash | `.ccb/counters/tool-failures.log` 行数增长；journal 自动条目出现（仅白名单命令） | 人工 grep 验证 |
| M3 UserPromptSubmit 纠错词 | `.ccb/counters/user-corrections-*.count` 文件存在；触发阈值时 additionalContext 注入 | 跑一次 mock session 触发 2 次"不对" |
| M4 同问题 ≥2 次硬 cap | 共享 M3 计数器；session-rules 规则 3 文字升级 | 代码层 diff 检查 + mock session |
| M5 fallback_for_toolsets | 3-5 skill frontmatter 存在新字段 | grep 检查 |
| M6 memory audit | `docs/memory-audit-log.md` 存在且有 append | 每次改 memory 后 tail 检查 |
| M11 max retries=3 | task-execution SKILL.md 有 retry_count 硬 check 文字；第 3 次 surface | 代码层 diff 检查 |
| M14 fresh session | ccb-protocol.md 明文条款；dispatch 模板含"新开 session" | grep 检查 |

**T2**：

| 机制 | 信号 | 验收方式 |
|---|---|---|
| Retrospective 2.0 | /retrospective 跑一次：5 段报告产出，至少 3 条 skill-audit 建议 + 至少 1 条挖矿建议 | mock 执行 |
| M10 review 外化 | task-execution SKILL.md review phase 有硬 check；跑 mock review 声明 passed 前必须返回 exit code | 代码层 diff 检查 + mock review |

### 3.3 反向指标（避免误报）

- **user-corrections 假阳**：已通过关键词收窄缓解（§2.1.2 移除 "不是/别/停"）。剩余假阳：计数器仅注入提示，不强制动作（Claude 自行判断是否跟进）
- **tool-failures 假阳**：已通过命令前缀白名单缓解（§2.1.1）。探索性失败（如 `ls nonexistent`）仅计日志，不进 journal；只有 `codex:/gemini:/npm/git/node/bash scripts/` 等"真工作流命令"失败才升格 journal issue
- **max retries 假阴**：不同任务 retry 语义不一样，3 次对小任务可能够；实施时按 task 类型允许配置 override，但 override 必须显式声明

---

## 4. 回滚策略 / Kill Switches

### 4.1 统一原则

**每机制单 commit 落地**，commit message 末附 `[revert-path: git revert <hash>]`。发现误伤，分钟级恢复。

### 4.2 分机制关闭路径

| 机制 | 关闭方式 | 副作用 |
|---|---|---|
| M2 PostToolUse Bash hook | `.claude/settings.json` 删除 `PostToolUse` 下 matcher `Bash` 的那条 hook（保留 F.3 的 `Edit\|Write` matcher） → 下次 session 不生效 | 失败信号不再自动记；脚本文件保留方便重开 |
| M3 UserPromptSubmit hook | 同上（注释 `UserPromptSubmit` 段） | 纠错词不再计数 |
| M4 共享计数器 | 随 M3 关闭 + session-rules 规则 3 文字 revert | 回到 F.3 前的"主观判断" |
| M1 1% 强触发语 | `git revert` session-rules + CLAUDE.md 对应 commit | 回到建议语气 |
| M5 fallback_for_toolsets | `git revert` frontmatter 改动 | skill 失去 fallback 说明 |
| M6 memory audit | `git revert` + 可选删除 `docs/memory-audit-log.md`（保留也无害） | 审计日志停更 |
| M11 max retries | `git revert` task-execution | 回到无硬 cap |
| M14 fresh session | `git revert` structured-dispatch + ccb-protocol | 回到 session 可续接 |
| Retrospective 2.0 | `git revert` retrospective/SKILL.md | 回到 1.0 手动 3 段 |
| M10 review 外化 | `git revert` task-execution review phase | 回到 Claude 主观判断 |
| 自动触发路径（retrospective） | 注释 hook / 删除 post-commit helper | 自动提醒消失 |

### 4.3 Hook 防爆安全条款

- **所有新 bash hook**：`set -euo pipefail` + `trap 'echo "[hook-error] $0" >> .ccb/counters/hook-errors.log; exit 0' ERR`
- **Kill switch 环境变量**：`AI_SYSTEM_EVOLUTION_DISABLE=1` → 所有新 hook line 1 检查，exit 0
- **hook 超时保护**：脚本逻辑超过 500ms 必须在后台（`nohup ... &`），不阻塞主 agent

### 4.4 Kill switch 文档化位置

**必须同步文档**：实施 M2/M3 时，`CLAUDE.md` "技术红线" 段末追加一条：
> **系统进化 hook 总开关**：若新 hook（post-tool-failure-capture / user-correction-counter / 任何 `scripts/hooks/*` 带 `AI_SYSTEM_EVOLUTION_DISABLE` 检查的）出现异常（误报 / 失败阻塞），通过设置环境变量 `AI_SYSTEM_EVOLUTION_DISABLE=1` 一键禁用所有新机制。Windows 当前 shell：`export AI_SYSTEM_EVOLUTION_DISABLE=1`；永久：写入 `~/.bashrc` 或 `.env`。Kill switch 生效条件：下一次 hook 触发时脚本 line 1 检查立即 exit 0。

另 `.claude/skills/session-rules/SKILL.md` 规则区块末尾增加一行 meta："hook 机制总开关见 CLAUDE.md kill switch 条款。"

### 4.4 数据安全

- `.ccb/counters/` 加 `.gitignore`——不污染 repo，不会意外 commit
- `docs/journal/<YYYY-MM-DD>-auto-tool-failures.md` **是**普通 journal 文件，走 journal skill 常规生命周期（git 跟踪）
- `docs/memory-audit-log.md` append-only，不删除

---

## 5. 与 F.3 架构的兼容性

F.3（2026-04-18 落盘）资产清单 + 新机制冲突评估：

| F.3 资产 | 新机制冲突风险 | 解法 |
|---|---|---|
| `SessionStart` hook `session-start-inject.sh` | ✅ 无——新 hook 接其他事件 | 新 hook 挂 PostToolUse(Bash) / UserPromptSubmit，不碰 SessionStart |
| `.ccb/session-marker` 幂等（Resume 短路） | ✅ 无 | 新 hook 不依赖 session-marker 状态 |
| `PreCompact` hook `pre-compact-save.sh` + `pre-compact-check.sh` | ✅ 无 | 新机制不挂 PreCompact |
| `Stop` hook `stop-counter.sh` | ⚠️ 低 | M3/M4 用 UserPromptSubmit 不用 Stop，避免重叠；session-init 读两种计数器区分 |
| `PreToolUse` hook（`file-boundary-guard.sh` / `dispatch-guard.sh`） | ✅ 无 | 新 hook 不加 PreToolUse |
| `PostToolUse` hook（`post-edit-check.sh`，matcher `Edit|Write`） | ⚠️ 低 | M2 同 PostToolUse 事件但用 `Bash` matcher，与 F.3 的 `Edit\|Write` matcher 并列注册不互扰（Claude Code 按 matcher 选中对应 hook 列表执行）。settings.json 示例见 §2.1.4 |
| CLAUDE.md `@import` 自动加载 session-rules | ✅ 无 | M1/M4 改 session-rules **内容**，不碰 @import 语法 |
| 文件边界（Claude 不写 src/ / scripts/） | ⚠️ 中 | 用户显式授权"一次性搞定" = small-bash-direct-write 条款生效；Claude 直接写 <100 行 bash；重复/复杂脚本仍派 Codex |
| Retrospective 1.0 手动触发契约 | ✅ 无 | 2.0 保留 `/retrospective` 入口 + 原 3 段；加自动触发路径和 2 新段，增量不覆盖 |
| memory-cleanup skill | ✅ 无 | 两 skill 串行用，职责分离 |
| session-init Step 2-4 | ⚠️ 低 | 新增 "扫 `.ccb/counters/*`" 仅在 Step 2 并行增补 ~5 行，不改其他步骤 |

**PreCompact block 契约保留**：每 session 首次 /compact 仍强制更新 project_status.md（F.3 已定）。本次实施完后会在 project_status.md "最近关键决策" 段追加本 spec 链接。

---

## 6. 里程碑 / 路线图

### 6.1 挂靠决策

**不立新里程碑**。实施作为"系统进化能力升级"直接落盘，不进 project_status.md 的"进行中里程碑"列，但在"最近关键决策"段追加条目指向本 spec + 对应 commits。

### 6.2 时间线

**本 session 内**：
1. Spec 7c 完整性检查 → spec-document-reviewer subagent review → 用户 approve
2. 调 writing-plans skill 产出 `docs/superpowers/plans/2026-04-19-system-evolution.md`
3. 按 plan 开始实施 T1（8 机制 ~1-2 天；<100 行 bash + skill/.md 编辑 Claude 直接写）

**T1 完成后**：
4. 每机制单 commit，runner 自测（mock hook 触发）
5. 更新 project_status.md + superpowers/INDEX.md
6. 用户最终 approve T1

**T2**（可本 session 或下 session）：
7. Retrospective 2.0 + M10（脑力活 + 代码改动，规模 ~200 行改动）
8. 跑一次 /retrospective 验证 5 段报告

**T1+T2 全部完成**：
9. project_status.md "最近关键决策" 段追加 "2026-04-19 系统进化 10 机制落地"
10. 若用户决定搬 `docs/journal/INDEX.md` resolved 段加一条 milestone resolve

### 6.3 并行关系

- 本 session 实施不依赖云部署阶段 2（云部署阶段 2 还在 plan review 阶段）
- 云部署阶段 2 启动后可与 T2 部分并行（T2 涉及 skill 层不涉及 src/）
- M4 教学系统仍排队中，不受本 spec 影响

---

## 7. 被否决机制清单 + 否决理由

| 机制 | 否决理由 | 重开触发 |
|---|---|---|
| **M7 单独新 skill（Letta sleep-time auto memory-cleanup）** | 与 retrospective (a) 段功能重合 70%；合并到 Retrospective 2.0 | retrospective 2.0 跑 3 个月后发现 memory 整理仍有 gap → 再独立 |
| **M8 OpenHands condenser（旧 journal 压缩）** | 40 条规模远未到压缩必要；journal 超 200 条再上 | journal 超 150 条 |
| **M9 单独新 skill（skill-audit 周期 job）** | 同 M7，合并到 Retrospective 2.0 新段 4 | 同 M7 |
| **M12 Aider lint/test 自动回灌** | M10 已外化 review 终止到 build/test/lint，功能覆盖；Aider 风格的"自动改下一 dispatch"需要 CCB 大改，现阶段不划算 | CCB 升级到支持双向对话 |
| **M13 TDD-for-skills（Superpowers 压力测试）** | 成本高（每 skill 前置写压测）；Retrospective 2.0 skill-audit 段已能事后抓漂移 | skill 数量 >40 或 Anthropic Skills 2.0 退化率 >20% |
| **M15 单独新 skill（每里程碑挖矿）** | 合并到 Retrospective 2.0 新段 5 | 同 M7 |
| **M16 Hermes GEPA auto-generate skill** | survey 明确：现阶段过度工程化，污染 skill 系统 | MVP 后 + skill 数量 >50 + 已有 sub-agent eval harness |
| **M17 向量记忆 backend** | 40 条纯文本够用；survey 阈值 200 条 | 记忆条目 >150 条 或 用户量级 >1k |
| **新建"系统进化 M0"里程碑** | 用户节奏偏好 autonomous + 本 session 推到底 | 若 T2 延期 >1 个月未完成，追补立里程碑补验收 |
| **分散塞进云部署阶段 2** | 易被主线 drift 掉；不独立追踪 | — |

---

## 8. Change List（文件改动清单）

> 为 writing-plans skill 提供实施输入。按改动类型分组。

### 8.1 新文件

| 路径 | 类型 | 内容 | 预计行数 |
|---|---|---|---|
| `scripts/hooks/post-tool-failure-capture.sh` | 新建 | M2 hook 脚本 | ~50 |
| `scripts/hooks/user-correction-counter.sh` | 新建 | M3/M4 hook 脚本 | ~40 |
| `docs/memory-audit-log.md` | 新建 | M6 append-only 审计日志（初始空） | ~5 |
| `.ccb/counters/.gitignore` | 新建 | 忽略 counter 文件 | 3 |

### 8.2 修改文件

| 路径 | 改动类型 | 对应机制 | 预计改动行数 |
|---|---|---|---|
| `.claude/settings.json` | 增加 2 个 hook 段 | M2 + M3/M4 | +15 |
| `CLAUDE.md` | 增加 "1% 强触发语" 条款 + memory audit 契约 + kill switch 条款（§4.4） | M1 + M6 + M2/M3 kill switch | +35 |
| `.claude/skills/session-rules/SKILL.md` | 规则 3 量化升级 + 规则 6 新增（M5 fallback）+ meta kill switch 引用 | M4 + M5 | +20 / -3 |
| `.claude/skills/task-execution/SKILL.md` | max retries + review 硬 check | M11 + M10 | +40 |
| `.claude/skills/structured-dispatch/SKILL.md` | fresh session 条款 | M14 | +10 |
| `.claude/skills/retrospective/SKILL.md` | 升级 2.0：5 段 + 自动触发 | Retrospective 2.0 | +150 / -20 |
| `docs/ccb-protocol.md` | fresh session 对应条款 | M14 | +10 |
| `.claude/skills/debug-ocr/SKILL.md` 等 3-5 个 | frontmatter 加 fallback_for_toolsets | M5 | 每个 +5 |
| `.claude/skills/session-init/SKILL.md` | Step 2 加扫 `.ccb/counters/` | session-init 增补 | +8 |

### 8.3 元文件（实施收尾）

| 路径 | 改动 |
|---|---|
| `docs/project_status.md` | "最近关键决策" 段追加条目 |
| `docs/superpowers/INDEX.md` | 本 spec 从 in_progress → resolved |
| `docs/changelog.md` | 追加机制落地变更条目 |

---

## 附录 A：候选机制原始清单

来自 WIP 文件"候选机制清单"——保留作决策轨迹。具体采纳见 §1，否决见 §7。

| # | 机制 | 维度 | 成本档 | 结局 | 归属单元 |
|---|---|---|---|---|---|
| M1 | CLAUDE.md / session-rules 加 "1% 强触发语" | B | 低 | ✅ T1 | T1-1 |
| M2 | PostToolUse Bash 失败捕获 hook | C | 低 | ✅ T1 | T1-2 |
| M3 | UserPromptSubmit 纠错词计数 | C/E | 低 | ✅ T1 | T1-3 |
| M4 | 同问题 ≥2 次硬 cap 计数器 | D/E | 低 | ✅ T1 | T1-4 |
| M5 | Hermes `fallback_for_toolsets` | B | 低 | ✅ T1 | T1-5 |
| M6 | git-tracked memory audit log | A | 低 | ✅ T1（降级为 docs/memory-audit-log.md） | T1-6 |
| M7 | Letta sleep-time agent | A | 中 | ✅ T2 | Retrospective 2.0 子项 |
| M8 | OpenHands condenser | A | 中 | ❌ 否决（40 条规模不需要） | — |
| M9 | skill-audit 周期 job | E | 中 | ✅ T2 | Retrospective 2.0 子项（段 4） |
| M10 | Review loop 终止外化 | D | 中 | ✅ T2 | T2-2 |
| M11 | task-execution max retries | D | 低 | ✅ T1 | T1-7 |
| M12 | Aider lint/test 自动回灌 | C/D | 中 | ❌ 否决（M10 覆盖） | — |
| M13 | TDD-for-skills | B | 中 | ❌ 否决（成本高；retrospective 2.0 事后抓漂移够用） | — |
| M14 | Codex/Gemini fresh session per task | D | 低-中 | ✅ T1 | T1-8 |
| M15 | 离线批量挖矿 | B/E | 中 | ✅ T2 | Retrospective 2.0 子项（段 5） |
| M16 | Hermes GEPA | B | 高 | ❌ T3 砍 | — |
| M17 | 向量记忆 backend | A | 高 | ❌ T3 砍 | — |

**计数口径**（消除 10/11 混淆）：
- 按"**实施单元**"计：T1-1 到 T1-8（8 项）+ T2-1 Retrospective 2.0（含 M7/M9/M15 三子项，算 1 单元）+ T2-2 M10 = **10 单元**
- 按"**机制编号**"计：T1 的 8 机制 + T2 的 M7+M9+M10+M15 = **12 机制**，其中 M7/M9/M15 合并为 1 单元交付

---

## 附录 B：关键 survey 引用（供审阅者对齐）

- § Q5 选错后果：Claude 自评 ECE 77%（arXiv 2508.06225） → 驱动 Retrospective 2.0 必须派 sub-agent 作 critic 而非自评
- § D Finding 3.4：$47k 无限循环案例 → 驱动 M11 max retries=3 硬 cap
- § C Finding 1.1：Claude Code 24 类 hook 只用 2 种 → 驱动 M2/M3/M4 新 hook
- § E Finding 2.4：Anthropic 2 次硬阈值 → 驱动 M3/M4 量化
- § D Finding 1.4：obra "fresh subagent per task" → 驱动 M14
- § D Finding 3.3：Cognition autofix 终止外化 → 驱动 M10
- § B Finding 2.3：Superpowers 1% 强触发 → 驱动 M1
- § A Finding 2.3：Letta sleep-time agent → 驱动 Retrospective 2.0 自动触发
- § B Finding 5.2：Hermes fallback_for_toolsets → 驱动 M5
- § E Finding 3.4：Anthropic Skills 2.0 eval 5/6 skill 退化 → 驱动 Retrospective 2.0 段 4 skill-audit
