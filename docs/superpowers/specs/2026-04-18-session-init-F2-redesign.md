# Session-Init F.3 重设计 Spec

**Status**: Draft
**Date**: 2026-04-18
**Supersedes**: [2026-04-15-session-init-token-optimization-design.md](./2026-04-15-session-init-token-optimization-design.md)（P1-P7 方案实施后 token 不降反升，从 28% 涨到 32%）
**Diagnosis**: [2026-04-18-session-init-bloat-diagnosis.md](../../journal/2026-04-18-session-init-bloat-diagnosis.md)
**Versions**: F.2 = hook 注入 project_status + skill 瘦身；F.3 = F.2 + L0-L3 分层框架 + PreCompact save hook

---

## 1. 为什么推倒原 spec

原 spec §3.1 的 P1-P7（多层 INDEX、frontmatter 规范、skill 化 session-init 等）实际效果：
- 优化前（Opus 4.6）非 MCP 14% ≈ 28k tokens
- 优化后（Opus 4.7 xhigh）非 MCP 32% ≈ 65k tokens

涨的主因不是优化方案本身，而是：
1. 三个 INDEX 文件合计反而比原单体 journal 更贵（~6k 固定成本）
2. skill 化 session-init 的教学文字 ≈ 3k，每次调用都进 context
3. parked 深度扫描每次 eager 触发，多文件 Read
4. Opus 4.7 新 tokenizer 对中文约 1.35x，放大了所有膨胀

原 spec §3.1 P1-P7 未深入研究 [obra/superpowers](https://github.com/obra/superpowers) 和 [affaan-m/everything-claude-code](https://github.com/affaan-m/everything-claude-code) 的实际 hook 机制，误判为"skill 化即可解决"。实看两 repo 源码后，正确思路是：**管理，不是压缩**——给 Claude 一张"去哪找什么"的地图，而不是把所有内容 eager 塞进来。

---

## 2. 核心理念

**Hook = 静态地图（永久 baseline，克制投入）**
**Skill = 活的判断（git status / 仪表盘 / 停车场扫描）**

| 机制 | 能做 | 不能做 |
|------|------|--------|
| SessionStart hook additionalContext | 注入预写好的静态文件 | 语义推理、响应用户意图、实时判断 |
| PreCompact hook decision=block | 拦住 Claude，让它执行特定动作（如更新 project_status） | 替 Claude 写内容 |
| session-init skill | 跑 git、渲染仪表盘、扫停车场、按用户意图分支 | 改变 context baseline |

三者分工不互替。

## 2.1 L0-L3 分层框架（借鉴 MemPalace layers.py）

记忆/上下文按加载成本分 4 层，明确哪些 eager、哪些 lazy：

| 层 | 内容 | 大小 | 加载时机 |
|----|------|------|---------|
| **L0 Identity**（永久 baseline） | CLAUDE.md + MEMORY.md + session-rules @import | ~7k | 每次必带，不可压缩 |
| **L1 Essential**（开机注入） | `docs/project_status.md`（项目地图 + 最近决策 + 文件地图） | ~2k | SessionStart hook 注入 additionalContext |
| **L2 On-Demand**（按需 Read） | architecture.md §0 / decisions.md / journal/INDEX / research/INDEX / superpowers/INDEX | 0 baseline | 任务需要时 Read，不默认 eager |
| **L3 Deep**（深挖查询） | 具体 journal / spec 全文 / src 代码 / Grep 搜索 | 0 baseline | 明确调用时 |

设计约束：
- **L1 目标 ≤4k**（实测上限）。理想 2k，但当前 `project_status.md` 已 10.9KB ≈ 3.5-4k tokens，2k 需专门裁剪验证（见 §6 步骤 0）。超 4k 必须强制压缩（决策段 10→5 条 → 地图段保持 → 未决问题简化）
- **L2 不进 baseline**。L1 的"文件地图"告诉 Claude 哪里找什么，不把 L2 内容 eager 塞进来
- **停车场扫描是受控的 L2 读取**。默认开启（保留当前能力），Read `journal/INDEX.md` 一次是可接受的 L2 触发；用户指令直奔任务时跳过。这不违反"L1 不 eager 读 INDEX"——扫描发生在 skill 运行时，不是 hook 注入阶段

---

## 3. 设计

### 3.1 `docs/project_status.md` 升格为"项目地图 + 当前真相"

结构固定，4 段：

```markdown
# Project Status

## 当前里程碑
<M-name>: <状态>
下一步: <一句话>
阻塞: <无 / 列出>

## 最近关键决策（最多 10 条，一句话 + 链接）
- YYYY-MM-DD <决策摘要> → [spec/journal 链接]
- ...

## 文件地图（要找 X 去 Y）
| 要找 | 去哪 |
|------|------|
| 数据契约 / 端点 / 表结构 | architecture.md §0 |
| 历史已关决策 | decisions.md |
| 停车场想法 | journal/INDEX.md |
| 调研知识库 | research/INDEX.md |
| 里程碑 spec/plan | superpowers/INDEX.md |
| 未提交 / 未推送状态 | 跑 git status |
| 上次干到哪 | git log -10 --oneline |

## 未决问题
- <无 / 列出>
```

**鲜度义务**：以下事件必须同步更新 project_status.md，否则视为任务未完：
- 里程碑切换
- 关键决策拍板（写进 decisions.md 的同时在这里加一行摘要）
- architecture.md 修改
- 新 spec/plan 产生
- 阻塞发生或解除

放进 CLAUDE.md "禁止事项" 清单。

目标体量：**理想 1.5-2k tokens，可接受上限 4k**。超 4k 强制压缩决策列表（留 5 条最近），必要时删去文件地图的解释性文字。

**实测前置步骤**：当前 `project_status.md` ≈ 3.5-4k tokens（10.9KB × 中文 1.35x tokenizer）。实施前必须先做一次裁剪试写 + tokenizer 实测（见 §6 步骤 0），确认新模板体量。

### 3.2 SessionStart hook 脚本

路径：`scripts/hooks/session-start-inject.sh`

**功能**：
1. 读 `docs/project_status.md`
2. **长度防护**：若文件 `wc -c` 超 8KB，截断到前 8KB 并追加 `[... truncated, see full file at docs/project_status.md]`。防止用户忘裁把整份膨胀注入 baseline
3. 构造注入包装（见下）+ 文件内容（或截断版）
4. 按 Claude Code hook 协议吐 JSON：
   ```json
   {
     "hookSpecificOutput": {
       "hookEventName": "SessionStart",
       "additionalContext": "<wrapper + project_status 内容>"
     }
   }
   ```
5. 失败静默（文件不存在、读失败、JSON 构造失败）时吐空 `{}`，不阻塞启动。禁 `set -e`

**注入包装**：additionalContext 前加一行上下文提示：
```
<!-- Injected by SessionStart hook from docs/project_status.md. This is the authoritative snapshot of current project state. Use the file map to decide where to read for deeper context; do NOT eager-read INDEX files. -->
```

**JSON 转义**：project_status 内容含换行、引号、反斜杠，必须正确转义为 JSON 字符串。**主路径是 sed**（git bash 默认不装 jq，项目也不强制装）：sed 做 `\` → `\\`、`"` → `\"`、换行 → `\n`、回车 → `\r`、tab → `\t`。若环境有 jq，优先用 `jq -Rs .`（更健壮）。**禁止用 `printf '%s'` 裸拼 JSON**（会因控制字符炸 parser）。

**自检**：构造 JSON 后若有 jq 可用，`jq . >/dev/null` 验证合法性，失败退回 `{}`；无 jq 时接受 sed 路径的已知正确性（依赖 project_status 字符集约束——禁用原始 `\` `"` 和 U+0000-U+001F 控制字符）。

**Windows 兼容**：bash 脚本通过 git bash 执行。不依赖 python（见 §3.8 Windows python stub 风险）。sed 为主，jq 可选。

**不注入 last-session 摘要**（用户需求：不要旧记忆，要当前全貌；git log 已覆盖"上次干了啥"）。

### 3.3 `.claude/settings.json` 改动

SessionStart hook 新增命令，保留原 marker 清理；PreCompact hook 新增 save 脚本（详见 §3.8）：

```json
"SessionStart": [
  {
    "matcher": "startup|clear",
    "hooks": [
      { "type": "command", "command": "bash -c 'rm -f .ccb/session-marker .ccb/precompact-saved-*'" },
      { "type": "command", "command": "bash scripts/hooks/session-start-inject.sh" }
    ]
  }
],
"PreCompact": [{
  "matcher": "",
  "hooks": [
    { "type": "command", "command": "bash scripts/hooks/pre-compact-check.sh" },
    { "type": "command", "command": "bash scripts/hooks/pre-compact-save.sh" }
  ]
}]
```

**matcher 决策**：
- `startup|clear`：清幂等标志 + 注入 L1（唯一注入点）
- `resume`：**不挂 hook**。resume 恢复原 session 的完整对话记忆，原 additionalContext 还在 message history 里，重注入会产生第二份 project_status（可能和 PreCompact 更新过的新版本并存导致污染）。若 resume 后用户想看最新 status，手动 Read 或调 session-init skill 走 L2 路径
- `compact`（若 Claude Code 支持此 matcher 值）：不挂 hook。compact 后同一 session 延续，重注入同样会产生双份污染
- 本 spec 只注入唯一时机：`startup|clear`。其他路径一律 Claude 按需 Read

rm glob 使用注意：git bash 下 `rm -f .ccb/precompact-saved-*` 无匹配时仍安全（`-f` 忽略不存在），无需 `shopt -s nullglob`。

Stop hook **不新增**（不需要 session 总结写盘；F.3 不借鉴 MemPalace 的每 N 次交互强制保存，避免扰乱工作流）。

### 3.4 `.claude/skills/session-init/SKILL.md` 瘦身

从 119 行 / ~3k tokens 降到 ~30 行 / ~500 tokens。新全文：

```markdown
---
name: session-init
description: 输出 CEO 仪表盘。SessionStart hook 已注入 project_status，本 skill 做实时判断（git status、停车场扫描、仪表盘渲染）。
---

<SUBAGENT-STOP>
If dispatched as a subagent, skip this skill.
</SUBAGENT-STOP>

# Session Init

## 背景
SessionStart hook 已把 `docs/project_status.md`（当前里程碑 + 最近决策 + 文件地图）注入你的 context。
你**不需要** Read 任何 INDEX 文件；文件地图告诉你真需要时去哪查。

## 步骤

1. **resume 场景检测**：若 `.ccb/session-marker` 存在（说明本次启动不是 startup/clear 而是 resume），SessionStart hook 没重新注入 project_status——你手上可能是过期版本。**Read `docs/project_status.md` 取最新版**再继续。startup/clear 场景跳过此步（hook 已注入最新版）
2. **跑 `git status`**，看未提交/未推送
3. **判断是否扫停车场**：
   - 默认：Read `docs/journal/INDEX.md`，对每个 parked 项做三维度判断（触发条件到期 / 基础设施影响 / 功能关联）
   - 跳过条件：用户指令明确要直奔任务（"直接开 XX"、"开始做 YY"、"别扫停车场"），仪表盘此段显示"（本次跳过）"
4. **渲染仪表盘**（模板见下）
5. `mkdir -p .ccb && touch .ccb/session-marker`
6. 问"要做什么？"

## 仪表盘模板

```
═══ 项目仪表盘 ═══

📊 项目进度（从 project_status 取）
  当前：<里程碑> — <状态>
  下一步：<一句话>

⚡ 需要你决策（从 project_status 未决问题 + 本次 git status 推断）
  - <描述> — 推荐：<X>，理由：<一句话>
  （无则"无"）

🅿️ 停车场扫描
  <若跳过>（本次跳过，用户直奔任务）
  <若执行>
    🚨 需要立即处理：<列出，或"无">
    📋 与当前里程碑相关：<列出，或"无">
    其他停着的：N 条

⚠️ 风险/阻塞（从 project_status 阻塞段 + git status 推断）
  - <描述>（无则"无"）

✅ 近期 git 活动（git log -5 --oneline）
  - ...

═══════════════════
```

## 行为契约

- 不 Read INDEX 文件（除非第 2 步判断要扫停车场才 Read journal/INDEX）
- 不 Read architecture.md / decisions.md / research INDEX / superpowers INDEX（按需，任务需要时再读）
- 不替代用户做产品决策
- 不打断 Codex/Gemini
```

删掉的内容：
- Step 0 marker detection（compact/resume 时 hook 没注入新内容，skill 直接走步骤 2 的"跳过扫描"分支也没成本）
- Step 1 的 5 文件并行 Read 清单（已被 hook 注入替代）
- parked 三维度判断表（移到调用时现场判断，SKILL.md 不长期驻留这段教学文字）
- "详略分级"（默认路径 = 扫，跳过路径 = 不扫，二元即可）

### 3.5 CLAUDE.md 改动

**"Skill 使用"段改写**（约 3 行）：

> 每次 session 启动时 SessionStart hook 自动注入 `docs/project_status.md`（项目全貌 + 文件地图）到 context。用户指令后或需要仪表盘时调 `session-init` skill 做实时判断（git 状态、停车场、风险）。运行规则通过 `@import` 自动加载（`session-rules` skill）。详见 `.claude/skills/session-init/SKILL.md`。

**"禁止事项"段新增**：
> - 禁止 project_status.md 鲜度失守（里程碑切换 / 关键决策 / architecture 变动 / 新 spec 产生 / 阻塞变化时必须同步更新）

### 3.6 CCB 派发边界

| 改动 | 负责人 |
|------|-------|
| 写 `scripts/hooks/session-start-inject.sh` | Codex（scripts/ 边界） |
| 写 `scripts/hooks/pre-compact-save.sh` | Codex（scripts/ 边界） |
| 改 `.claude/settings.json` | Codex 或用户（settings 非 src） |
| 写 `.claude/skills/session-init/SKILL.md` | Claude 自己 |
| 改 `docs/project_status.md`（重写为新模板） | Claude 自己 |
| 改 `CLAUDE.md` | Claude 自己 |

---

### 3.7 L0-L3 分层落实（见 §2.1 框架）

三处落实点：
1. **`docs/project_status.md`** 是 L1 唯一内容，目标 ≤2k，可接受上限 ≤4k（见 §3.1）。超 4k 按优先级裁：决策段 10→5 条 → 文件地图保持 → 未决问题简化
2. **SKILL.md 的"行为契约"段**新增一句：
   > 你看到的 `project_status.md` 是 L1。其他文件（architecture / decisions / INDEX 三件套）是 L2，默认不读，任务需要时再 Read。journal/spec 全文 / 源码是 L3，深挖才查。
3. **停车场扫描作为受控的 L2 触发** 保持当前行为：默认 Read `journal/INDEX.md` 做深度扫描；用户指令直奔任务则跳过。这是 skill 运行时按用户意图决定的 L2 读取，不违反"hook 阶段不 eager 读 INDEX"的约束

### 3.8 PreCompact save hook

**来源**：独立设计，参考 Claude Code PreCompact hook 协议。MemPalace 的 `mempal_precompact_hook.sh` 虽有"emergency save"注释，但实际代码路径最终 `echo '{}'` 不 block（见其脚本末尾），我们**选择真用 block** 是独立决定，不是抄 MemPalace 实现。

**目标**：在 compact 触发前，强制 Claude 把本次 session 的新决策、阻塞、下一步写进 `project_status.md`。

**受益者辨析**（重要）：
- **不是**当前 session（compact 后同一 session 继续，additionalContext 已被清洗且不会重新注入，更新后的 status 只能靠 Claude 自己 Read 才能看到）
- **是下次真正新启动的 session**（`startup` matcher 会重跑 SessionStart hook，注入最新的 project_status 作为 L1）
- 也是**人类用户**（status 长期反映最新状态，自己查看时不会看到过期信息）

**脚本**：`scripts/hooks/pre-compact-save.sh`

**协议**：Claude Code PreCompact hook 吐 JSON `{"decision": "block", "reason": "<instruction>"}` 会拦住 compact，把 reason 作为系统消息传给 Claude。Claude 执行完动作后 compact 在下次 stop 时才真正触发。

**脚本逻辑**：
```bash
#!/bin/bash
# pre-compact-save.sh — 在 compact 前拦住 Claude，让它更新 project_status.md
# 设计原则：
# 1. 所有失败路径必须 echo '{}' && exit 0（禁 set -e）
# 2. 不依赖 python（Windows git bash 下 `python` 可能命中 WindowsApps stub 导致挂起）
# 3. JSON 构造走 jq（若有）或 sed 转义，不用 printf 裸拼

INPUT=$(cat 2>/dev/null || echo '{}')

# 解析 session_id：纯 bash sed（项目 Windows-only，sed 一路够用）
SESSION_ID=$(echo "$INPUT" | sed -n 's/.*"session_id"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')

# 安全：限制字符集 + 长度（防路径注入），空则 unknown
SESSION_ID=$(echo "$SESSION_ID" | tr -cd 'a-zA-Z0-9_-' | cut -c1-64)
[ -z "$SESSION_ID" ] && SESSION_ID="unknown"

FLAG_FILE=".ccb/precompact-saved-${SESSION_ID}"

# 幂等：本 session 已存过，放行
if [ -f "$FLAG_FILE" ]; then
  echo '{}'
  exit 0
fi

mkdir -p .ccb 2>/dev/null || { echo '{}'; exit 0; }
touch "$FLAG_FILE" 2>/dev/null || { echo '{}'; exit 0; }

# REASON 内容用真实换行（不用字面 \n），让 JSON 转义阶段统一处理
REASON='PreCompact checkpoint: 在 compact 发生前，检查并更新 docs/project_status.md。

步骤：
1. 回顾本次 session 的新决策、新阻塞、新下一步
2. 如果 project_status.md 已经反映最新状态，回复「已是最新」即可
3. 否则用 Edit 工具更新以下段落：
   - 「当前里程碑」的「下一步」和「阻塞」
   - 「最近关键决策」追加新条目（一句话 + 链接）
   - 「未决问题」
4. 确保总量 ≤4k tokens，决策段超过 10 条时删最旧的
5. 更新完毕后继续对话，compact 会在下次 stop 时正常触发

注意：本次更新的受益者是下次新启动的 session（和你自己），不是 compact 后的当前 session。'

# 构造 JSON：sed 为主路径（git bash 默认无 jq），若有 jq 优先用
if command -v jq >/dev/null 2>&1; then
  REASON_JSON=$(printf '%s' "$REASON" | jq -Rs .)
  OUTPUT=$(printf '{"decision":"block","reason":%s}\n' "$REASON_JSON")
else
  # 纯 sed 转义：\ → \\，" → \"，换行 → \n（顺序重要，\ 必须先处理）
  REASON_ESC=$(printf '%s' "$REASON" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g' | awk 'BEGIN{ORS=""} NR>1{print "\\n"} {print}')
  OUTPUT=$(printf '{"decision":"block","reason":"%s"}\n' "$REASON_ESC")
fi

# 自检：若输出不是合法 JSON，回退空对象（绝不能让 compact 拿到破 JSON）
if command -v jq >/dev/null 2>&1; then
  if ! printf '%s' "$OUTPUT" | jq . >/dev/null 2>&1; then
    echo '{}'
    exit 0
  fi
fi
# 若无 jq，用 python/node 做 JSON 语法检查（都没有则跳过自检，相信 sed 转义）
# 此处按 §3.8 原则"不依赖 python"，故无 jq 时不做自检，而是接受 sed 的已知正确性
# （sed 路径已经过测试，REASON 字符集受 §3.8 字符集约束限制）

printf '%s' "$OUTPUT"
exit 0
```

**REASON 字符集约束**：REASON 只许用 ASCII + 常用 CJK 字符，**禁用**原始 `\`、`"`、U+0000-U+001F 控制字符（换行由脚本自动转）和其他可能产生 `0x5c`/`0x22` 字节的多字节字符。修改 REASON 时必须跑 `bash pre-compact-save.sh < test-input.json | jq .` 验证输出是合法 JSON；CI 里加此测试。

**JSON 转义注意**：脚本处理反斜杠、引号、换行。若 REASON 未来要加制表符或其他控制字符，必须同步扩展 sed 规则或强制要求 jq。实施时 Codex 应加单元测试验证输出是合法 JSON（`| jq .` 能解析）。

**幂等保护**：`.ccb/precompact-saved-<session_id>` 标志文件防止同一 session 内 PreCompact 多次触发重复拦截。SessionStart hook（`startup|clear` matcher）清理该目录下过期标志（见 §3.3 的 `rm -f` 命令）。

**失败模式**：
- hook 脚本任何异常路径（stdin 解析失败、python/python3 都没有、touch 失败、磁盘满）必须 `echo '{}' && exit 0`，绝不让 exit≠0 冒泡。非零退出码会让 compact 丢警告但继续执行，等价于 F.2 风险水平
- 如果 Claude 拒绝执行或跑偏：`project_status.md` 未更新，也是 F.2 风险水平

**用户可感知行为**：compact 前会看到 Claude 突然开始"检查 project_status"，这是预期行为，不是 bug。

**resume 后 session_id 假设**：本脚本假设 Claude Code 在 `/resume` 后 session_id 保持不变。若未来版本 resume 改变 session_id，flag 会变孤儿（同一实际 session 内 PreCompact 可能被拦两次）。实施后首次手动 /resume 测试时应 log 一次 session_id 验证。

---

## 4. Token 预算

基线测量（现状）：
- Opus 4.7 xhigh 非 MCP ≈ 28.8k

预估新基线：

| 路径 | System prompt 变化 | Messages 变化 | 预估非 MCP |
|------|------------------|--------------|-----------|
| 默认（扫停车场） | +2~4k（注入 project_status，取决于步骤 0 裁剪） | -6k（砍 INDEX eager）-2.5k（SKILL 瘦身） | ~15-18k |
| 跳过（直奔任务） | +2~4k | -6k（砍 INDEX eager）-2.5k（SKILL 瘦身）-3k（砍 parked 扫描） | ~12-15k |

**目标**：默认路径降到 ≤18k（35%+ 减幅），跳过路径降到 ≤15k（48%+ 减幅）。

**注入量敏感度**：若步骤 0 裁剪后 project_status 接近上限 4k，默认路径会踩 18k 上限边缘。实施后若 /context 实测不达标，优先压缩决策段到 5 条（可再省 ~1k），保留文件地图和未决问题不动。

实测计划：实施后跑 `/context` 对比，结果写进 [journal](../../journal/2026-04-18-session-init-bloat-diagnosis.md) 的 §10 新章节。

---

## 5. 风险与代价

| 风险 | 影响 | 缓解 |
|------|------|-----|
| hook 脚本 Windows 兼容性 | Claude 拿不到注入 context，退化到现状 | 用 bash（项目已用），加失败静默 |
| project_status 过期 | 仪表盘显示错误状态 | 写进 CLAUDE.md 禁止事项，纳入 milestone-audit 检查项 |
| hook additionalContext 是永久 baseline | 塞多了比 Read 还贵 | 严格限 project_status ≤2k，只放地图+决策摘要，不放细节 |
| 跳过扫描的触发语判断错误 | 用户要扫却没扫 | 仪表盘明示"（本次跳过）"，用户可立刻纠正 |
| 停车场扫描仍需多文件 Read | 默认路径 token 下限有底 | 接受；跳过路径就是为此准备 |
| PreCompact hook 拦截失败或 Claude 跑偏 | project_status 未更新，compact 后状态陈旧 | 回退到 F.2 风险水平，不比现状差；后续可加 SessionStart 提示"距上次 project_status 更新 X 天"供用户警觉 |
| 幂等标志文件堆积 | `.ccb/` 下越来越多 precompact-saved-* 文件 | SessionStart hook 在 `startup|clear` 时 `rm -f .ccb/precompact-saved-*` 清理 |
| PreCompact 救不了当前 compact 后的 session | 用户误以为 compact 后 Claude 立即拿到新 status | spec §3.8 明确"受益者是下次新启动 session"，hook reason 里也明说 |
| L1 实际超预算（>4k） | token 目标不达 | §6 步骤 0 先做裁剪试写 + /context 实测；必要时迭代到 5 条决策 |
| hook 脚本 exit≠0 让 compact 丢警告 | 用户感知 compact 异常 | §3.8 强制所有失败路径 `echo '{}' && exit 0`，禁用 set -e |

---

## 6. 实施顺序

0. **停车场清理**（前置步骤）：逐条过 `journal/INDEX.md` 的 parked 段，按主线相关性做三路分流（纳入里程碑 / 继续停 / 删除）。**操作规程**：
   - Claude 先把分流结果列成清单（每条：条目名 + 建议动作 + 一句话理由）在 chat 里给用户批准
   - 用户批准后再改 `journal/INDEX.md`；**不得擅自删 parked 想法**
   - 分流参照现有的 T1/T2/T3 tier（T1 = 当前里程碑必做 → 考虑纳入；T2 = 独立评估 → 继续停或归类；T3 = MVP 后 → 继续停或删）
   - 若用户判断本 spec 紧急高于 full triage，可降级为"轻清理"：只处理触发条件到期的明显过期项。此降级决定在步骤 0 开始时由用户拍板
   - 理由：project_status 的"最近关键决策"段依赖 journal 干净；脏数据会让 L1 里决策摘要本身混乱
1. **L1 裁剪试写 + tokenizer 实测**：按新模板裁剪 `docs/project_status.md`，目标 ≤2k，硬上限 ≤4k。用 `python -c "import tiktoken; ..."` 或 Claude Code /context 实测验证体量，不达标就再裁
2. **Claude 先做**：改 SKILL.md → 改 CLAUDE.md（Skill 使用段 + 禁止事项段）
3. **Codex 派发**：写 `scripts/hooks/session-start-inject.sh` + `scripts/hooks/pre-compact-save.sh` + 改 `.claude/settings.json`
4. **用户验证**：开新 session 跑 `/context`，对比非 MCP 占比；手动触发一次 compact 验证 PreCompact hook 能拦住 Claude
5. **迭代**：若超预算，优先压缩 project_status 决策列表（保 5 条而非 10 条）；若 PreCompact hook 不触发，检查 `.claude/settings.json` matcher 和脚本权限

**回滚路径**（若实测不降反升或行为异常）：所有改动均 git-tracked，按 commit 粒度 `git revert` 即可。无数据迁移、无向量库、无 SQLite schema——回退零代价。具体：revert hook 脚本 → revert settings.json → revert SKILL.md → revert project_status.md → revert CLAUDE.md，任一层 revert 都能独立生效。

---

## 7. 后续关联

**停车场清理现在是 §6 步骤 0 的一部分**（本 spec 前置依赖），不再是纯 follow-up。理由：project_status 的"最近关键决策"段质量依赖 journal/INDEX 干净，混了过期/重复想法会让 L1 本身脏。

步骤 0 做的是"full triage"（逐条过 parked 段做三路分流：纳入里程碑 / 继续停 / 删除）。若用户判断本 spec 紧急优先级高于 full triage，可降级为"轻清理"——只处理触发条件到期的明显过期项，完整 triage 作为独立 follow-up 延后。此降级选择由用户在步骤 0 开始时决定。

---

## 8. 已拒绝的选项（记录推理）

| 选项 | 为什么拒绝 |
|------|-----------|
| **E. 降低 session-init effort 到 medium** | A/B 测试显示 medium 漏扫 parked 过期信号（质量回归），用户明确"不降 effort" |
| **ECC 风格 last-session.md** | 用户需求不是"接续上次对话"，git log 已覆盖；且多 session 同项目并发有覆盖冲突 |
| **SQLite 持久化 session 状态** | 违反 git revert 原则；ECC 的 SQLite 只存 aliases/leases，session 本身也是 markdown |
| **eager-load 全部 INDEX + project_status** | 就是当前做法，已验证膨胀 |
| **完全 lazy（superpowers 风格，不注入任何东西）** | 用户明确要"全貌 + 建议 + 导航"，不接受每次对话都靠 Claude 现跑命令重建 |
| **MemPalace 每 N=15 次交互 Stop hook 强制 save** | 会扰乱工作流，对我们来说过度工程；PreCompact 单点保存已足够覆盖"状态过期"风险 |
| **MemPalace 的 ChromaDB + 本地嵌入** | 太重；我们 token 问题不是"找不到历史"而是"读太多"；且违反 local-first git-tracked 原则 |
