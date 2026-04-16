---
date: 2026-04-02
topic: CCB文件消息系统设计
type: spec
status: resolved
keywords: [CCB, file-messaging, inbox, coordination]
---

# CCB 文件消息系统设计

> 替代 `ask` 命令，用"写文件 + 短通知"实现 Claude / Codex / Gemini 三方可靠通信。

**日期**：2026-04-02
**状态**：待实施
**可逆性**：容易反悔——文件和协议都是纯文本，回退只需恢复旧版指令文件

---

## 1. 问题

CCB `ask` 命令和 `wezterm cli send-text` 对长消息都不可靠：

| 方法 | 短消息 | 长消息 |
|------|--------|--------|
| `ask` (CCB async) | 偶尔成功 | 异步进程静默死亡，日志空 |
| `wezterm cli send-text` | 稳定 | Enter 不生效、内容截断等历史问题 |
| 人手动粘贴 | 永远成功 | 永远成功 |

核心矛盾：程序化发送长消息不可靠，但短消息稳定。

## 2. 方案

**不通过终端发长消息。** 所有通信内容写入文件，只通过终端发一句短通知告诉收件人去读文件。

完全替代 `ask` 命令，不保留双轨制，避免"这次该用哪种"的判断负担。

## 3. 目录结构

```
.ccb/inbox/
  claude/     ← Codex、Gemini 写给 Claude 的消息
  codex/      ← Claude 写给 Codex 的消息
  gemini/     ← Claude 写给 Gemini 的消息
```

- **实施时需将 `.ccb/inbox/` 加入 `.gitignore`**（当前 `.gitignore` 只忽略 `.ccb/.*-session`，不覆盖 inbox 目录）
- 发送方写入前先 `mkdir -p` 确保目录存在

## 4. 消息文件格式

文件命名：`<NNN>-<type>.md`，序号三位递增，type 为消息类型。

```markdown
---
from: claude | codex | gemini
type: dispatch | report | question | notify
ts: 2026-04-02T01:00
---

（正文内容，markdown 格式，长度不限）
```

### 消息类型

| type | 用途 | 典型发送方 |
|------|------|-----------|
| `dispatch` | 派发任务 | Claude → Codex/Gemini |
| `report` | 完成报告 | Codex/Gemini → Claude |
| `question` | 遇到问题需要协助 | 任意方向 |
| `notify` | 简单通知（不需要行动） | 任意方向 |

## 5. 发送流程

所有 agent 通用，三步：

```bash
# 步骤 0: 确保目标 inbox 存在
mkdir -p .ccb/inbox/codex

# 步骤 1: 写消息文件（先写临时文件再 rename，保证原子性）
# （各 agent 用自己的文件写入方式，写完后确认文件完整再进入步骤 2）

# 步骤 2: 发送短通知（内容即指令）
echo "Read .ccb/inbox/codex/001-dispatch.md and execute the task inside" | wezterm cli send-text --pane-id 1 --no-paste

# 步骤 3: 发送 Enter
printf '\r' | wezterm cli send-text --pane-id 1 --no-paste
```

**原子性说明**：本地 SSD 上写小文件几乎瞬间完成，且步骤 2 的 wezterm 命令执行有网络延迟，实际竞态风险极低。若未来出现截断读取问题，升级为"写临时文件 + rename"方案。

通知文本就是一句自然语言指令，收件方直接当用户输入处理，不需要理解任何新协议。

## 6. Pane 映射

硬编码在每个 agent 的指令文件中：

| Agent | Pane ID |
|-------|---------|
| Claude | 0 |
| Codex | 1 |
| Gemini | 2 |

此映射由 `.wezterm.lua` 三栏布局决定。若布局变化，同步更新指令文件。

## 7. 序号管理

发送方写入前，扫描目标 inbox 目录中已有文件的最大序号，+1 作为新序号。

- 目录为空时从 `001` 开始
- 并发冲突风险极低（同一时间只有一个 agent 向同一个 inbox 写入）

## 8. 生命周期

- 消息在 inbox 中持续积累
- 里程碑结束时统一清理所有 inbox
- 清理操作由 Claude 在里程碑收尾流程中执行

## 9. 需要更新的文件

### 必须更新（通信机制变更）

| 文件 | 改动内容 |
|------|---------|
| `AGENTS.md` | "完成报告"章节 → 新的文件消息协议 + pane 映射 + 发送脚本示例 |
| `GEMINI.md` | 同上 |
| `docs/ccb-protocol.md` | Section 0 通信基础设施 → 文件消息系统；Section 2 派发流程更新；删除 `ask`/`pend`/`ccb-ping` 命令表 |
| `.claude/skills/structured-dispatch/SKILL.md` | 发送方式从 `ask codex/gemini` 改为写文件 + 短通知 |
| `.claude/skills/session-init/SKILL.md` | 更新 Wezterm 引用和 dispatch 规则描述 |
| `.claude/skills/api-contract/SKILL.md` | `/ask gemini`、`/ask codex` → 文件消息方式 |
| `.codex/skills/api-contract/SKILL.md` | 同上（与 Claude 版内容相同，含 `/ask` 引用） |

### 无需更新

| 文件 | 原因 |
|------|------|
| `.claude/skills/brainstorming/SKILL.md` | "dispatch" 指概念流程，不涉及具体通信命令 |
| `.claude/skills/writing-plans/SKILL.md` | 同上 |
| `.claude/skills/executing-plans/SKILL.md` | 同上 |
| `.claude/skills/requesting-code-review/SKILL.md` | 只引用 structured-dispatch 名称 |
| `.codex/skills/**`（api-contract 除外）、`.gemini/skills/**` | 不含 CCB 通信代码 |
| 历史设计文档（`docs/superpowers/specs/`、`docs/superpowers/plans/`） | 保留原始 `ask` 引用作为时点记录，不回溯修改 |

## 10. Claude 端发送流程（structured-dispatch 集成）

Claude 派发任务时的完整步骤：

1. 按 structured-dispatch 模板填写任务内容
2. 给用户看中文翻译，用户批准
3. 确定目标 inbox 和序号
4. 写入 `.ccb/inbox/<target>/<NNN>-dispatch.md`
5. 执行 `wezterm cli send-text` 发短通知 + Enter
6. 向用户确认"已发送"

## 11. Codex/Gemini 端报告流程

完成任务后：

1. 写入 `.ccb/inbox/claude/<NNN>-report.md`，frontmatter `type: report`
2. 正文包含：Status (DONE/BLOCKED)、Completed items、Commits、Build result、Blocker (if any)
3. 执行 `wezterm cli send-text --pane-id 0` 发短通知 + Enter
4. 若 wezterm 短通知失败：重试 2 次（间隔 2 秒）；仍失败则将报告同时写到项目根目录 `.codex-report.md`（或 `.gemini-report.md`），Claude 的 session-init 会扫描这些 fallback 文件

## 12. 不做的事

- 不做消息队列或 daemon
- 不做文件监听（watcher）
- 不做消息加密或签名
- 不保留 `ask` 命令作为备选——一条路走到底
- 不把 `.ccb/inbox/` 提交到 git
