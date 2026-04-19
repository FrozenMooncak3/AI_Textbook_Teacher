# CCB Protocol Quick Reference

> 完整版见 `docs/ccb-protocol.md`。本文件是 dispatch 时高频查的精华版。
> 原为 `.claude/skills/ccb-protocol-reference/SKILL.md`，2026-04-19 Retrospective 2.0 降级为 docs（踩 2026-04-18 bloat §5 "文档 skill 化"陷阱）。

## 角色分工

| 角色 | 身份 | 文件边界 |
|------|------|----------|
| **Claude** | PM + 架构师（不写业务代码） | `docs/**`, `CLAUDE.md`, `AGENTS.md`, `GEMINI.md` |
| **Codex** | 后端工程师 | `src/app/api/**`, `src/lib/**`, `scripts/**` |
| **Gemini** | 前端工程师 | `src/app/**`（非 api）, `src/components/**` |

## 通信基础设施

```
.ccb/inbox/
  claude/     ← Codex、Gemini 写给 Claude 的消息
  codex/      ← Claude 写给 Codex 的消息
  gemini/     ← Claude 写给 Gemini 的消息
```

**Pane 映射**：Claude=0, Codex=1, Gemini=2

**发送**：写文件 `.ccb/inbox/<target>/<NNN>-dispatch.md` → 短通知：
```bash
echo "Read .ccb/inbox/<target>/<NNN>-dispatch.md and execute" | wezterm cli send-text --pane-id <pane> --no-paste
printf '\r' | wezterm cli send-text --pane-id <pane> --no-paste
```

**序号**：扫描目标 inbox 最大 NNN + 1，空目录从 001 开始。

## 派发档位判断

| 档位 | Codex | Gemini | 适用场景 |
|------|-------|--------|---------|
| **轻** | gpt-5.4-mini medium | gemini-2.5-flash | 照抄代码、重命名、模板、格式 |
| **标准** | gpt-5.4-mini high | gemini-2.5-pro | 常规开发、小重构、已知 pattern |
| **重** | gpt-5.4 high | gemini-2.5-pro | Bug 诊断、新 API 设计、跨模块重构 |

默认轻档，只在需要时升档。不用 xhigh。

## 3-Step 派发协议

1. **确认档位**：Claude 判断轻/标准/重
2. **用户审批**：给用户看中文翻译，用户批准后才写 inbox
3. **写英文指令**：写入 `.ccb/inbox/<target>/<NNN>-dispatch.md` + 发短通知

## 派发模板

```markdown
---
from: claude
type: dispatch
ts: [timestamp]
---

**[DISPATCH TO: Codex / Gemini]**

## Context
[Why this task exists. Link to plan. Prior completed tasks if any.]

## Task
[Clear, imperative instructions. One task per dispatch.]

## Files
- **Create**: [exact paths]
- **Modify**: [exact paths with line ranges]
- **Reference**: [files to read, do NOT modify]

## Acceptance Criteria
- [ ] [Testable criterion 1]
- [ ] [Testable criterion 2]

## Suggested Skills
[coding-standards, test-driven-development, etc.]

## Post-Completion
After completing this task:
1. Commit and push to master
2. Write a completion report to .ccb/inbox/claude/<NNN>-report.md
```

## 关键约束

- 派发指令 → **英文**；与用户沟通 → **中文**
- **不在 agent 执行时发消息**（会打断正在执行的任务）
- 查进度只通过 git/文件
- Review 必须**真正读文件内容**，不能只跑验证命令
- Gemini doc 防护：dispatch 必须说 "edit only relevant section"
- **Fresh session per task**（M14）：每次新任务前向对应 pane 发 `/clear` 或 `/new`，retry 除外
