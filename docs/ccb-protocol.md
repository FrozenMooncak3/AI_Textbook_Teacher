# CCB 操作规范

> Claude 在与 Codex / Gemini 协作时必须遵守的操作规则。
> 每次会话开始时必读。

---

## 0. 通信基础设施

项目使用**文件消息系统**管理多 AI 协作。所有通信走"写文件 + 短通知"，不使用 `ask` 命令。

### 目录结构

```
.ccb/inbox/
  claude/     ← Codex、Gemini 写给 Claude 的消息
  codex/      ← Claude 写给 Codex 的消息
  gemini/     ← Claude 写给 Gemini 的消息
```

### 消息文件格式

文件命名：`<NNN>-<type>.md`，序号三位递增，type 为消息类型（dispatch / report / question / notify）。

```markdown
---
from: claude | codex | gemini
type: dispatch | report | question | notify
ts: 2026-04-02T01:00
---

（正文内容，markdown 格式，长度不限）
```

### 发送流程（所有 agent 通用）

1. `mkdir -p .ccb/inbox/<target>` — 确保目标 inbox 存在
2. 写消息文件到 `.ccb/inbox/<target>/<NNN>-<type>.md`
3. 发送短通知（一条命令，嵌入回车）：
   - **Bash**（Claude 使用）：`echo "Read .ccb/inbox/<target>/<NNN>-<type>.md and execute" | wezterm cli send-text --pane-id <target_pane> --no-paste && printf '\r' | wezterm cli send-text --pane-id <target_pane> --no-paste`
   - **PowerShell**（Codex/Gemini 使用）：`wezterm cli send-text --pane-id <target_pane> --no-paste "Read .ccb/inbox/<target>/<NNN>-<type>.md and execute``r"`

### Pane 映射

| Agent | Pane ID |
|-------|---------|
| Claude | 0 |
| Codex | 1 |
| Gemini | 2 |

由 `.wezterm.lua` 三栏布局决定。若布局变化，同步更新指令文件。

### 序号管理

发送方写入前，扫描目标 inbox 目录中已有文件的最大序号，+1 作为新序号。目录为空时从 `001` 开始。

### 生命周期

消息在 inbox 中持续积累，里程碑结束时统一清理。清理操作由 Claude 在里程碑收尾流程中执行。

---

## 1. 语言规则

- 派发指令给 Codex / Gemini 时一律使用**英文**
- 与用户沟通用**中文**
- Claude 负责翻译

## 2. 任务派发流程

- **派发前必须给用户看中文翻译**，用户批准后再写英文指令到 inbox
- Claude 写入 `.ccb/inbox/<target>/<NNN>-dispatch.md`，然后发短通知
- **不在 Codex / Gemini 执行任务时往他们的 session 发消息**——会打断正在执行的任务
- 要查进度只通过 `git diff` / `git log` / 读文件，不碰他们的 session
- 等用户主动告知完成后再介入 review

## 3. 模型调度规则

根据任务复杂度分 3 档，Claude 派发指令时必须标注推荐档位 `[轻/标准/重]`，由用户切换模型：

| 档位 | Codex 配置 | Gemini 配置 | 适用场景 |
|------|-----------|-------------|---------|
| **轻档** | gpt-5.4-mini, medium | gemini-2.5-flash | 计划里代码写好了照抄、简单重命名、模板生成、格式调整 |
| **标准档** | gpt-5.4-mini, high | gemini-2.5-pro | 有明确需求的常规开发、小范围重构、已知 pattern 的 API 实现 |
| **重档** | gpt-5.4, high | gemini-2.5-pro | Bug 诊断（原因未知）、新 API 设计、跨模块重构、需要独立判断的架构决策 |

原则：默认用轻档，只在需要时升档。不用 xhigh——边际收益低，额度消耗高。

## 4. Git 规则

- **提交后必须 push**：commit 后必须 `git push origin master`，不得等用户提醒
- **GitHub**：`https://github.com/FrozenMooncak3/AI_Textbook_Teacher.git`，分支 `master`，git 身份 `zs2911@nyu.edu` / `FrozenMooncak3`

## 5. Review 规则

- Codex / Gemini 完成任务后，Claude 必须**真正读文件内容**做 review，不能只跑一个验证命令就说通过
- Review 通过后 push，然后更新 `docs/project_status.md` 和 `docs/changelog.md`
