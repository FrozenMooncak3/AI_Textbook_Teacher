---
name: session-rules
description: Session-wide 运行规则（自动派发 / 想法分流 / skill 自动触发表 / git 管理 / chain routing）。通过 CLAUDE.md @import 始终加载，无需手动调用。
---

# Session-Wide 运行规则

> 本 skill 通过 CLAUDE.md `@import` 自动加载，规则全程生效，不需要用户提醒。

## 规则 1: 自动派发

当检测到需要给 Codex/Gemini 派任务时，自动按 structured-dispatch 模板执行：
1. 填写完整模板
2. 根据任务类型从 Step 6 的 Agent 参考 skill 表中选择推荐 skill
3. 标注推荐档位（轻/标准/重，依据 ccb-protocol Section 3）
4. 给用户看中文翻译
5. 用户批准后发英文指令

## 规则 2: 想法分流

用户提出新想法时，立刻判断去向并告知用户（不问"你觉得该放哪"）：
- **纳入具体里程碑**（M3/M5/新里程碑）— 核心流程需要的、产品不完整没它不行的
- **停车场** — 好想法，但不是当前阶段，存着等合适的时候
- **丢掉** — 评估后觉得不值得做，说明理由

判断后一句话告知结论和理由。

**停车场入库流程**（用户说"停车场"时自动执行）：
1. **评估**：想法是否正确？当前做还是以后做？
2. **分类**：归入以下类别之一：AI/Prompt | 功能 | 交互/UX | 基础设施 | 商业 | 工程流程
3. **定级**：T1（当前里程碑必做）| T2（下个里程碑或独立评估）| T3（MVP 后）
4. **写入**：创建/追加 journal 文件，更新 INDEX.md 对应分类下正确的 tier 位置
5. **确认**：一句话告知"已停车：[分类] T[级别] — [想法名]"

## 规则 3: Skill 自动触发

| 触发条件 | 自动执行的 skill |
|----------|-----------------|
| 用户想做新功能/探索想法 | brainstorming → writing-plans |
| 执行计划中的任务 | task-execution（统筹 dispatch + review + retry） |
| brainstorming 或重要讨论结束 | journal |
| 声称完成/准备 commit | verification-before-completion → claudemd-check |
| 用户告知 agent 完成任务 | task-execution（进入 review phase） |
| 里程碑开始 | using-git-worktrees（创建隔离分支） |
| 里程碑结束 | milestone-audit → finishing-a-development-branch |
| 同一问题修复失败 ≥2 次 | systematic-debugging（**绝对必须**走诊断流程，禁止继续猜） |
| 用户说"停车场" | 规则 2 停车场入库流程（分类→定级→写入→确认） |

**规则 3 量化升级**（2026-04-19，spec `2026-04-19-system-evolution-design` §2.1.2-2.1.3）：
同一问题计数由 `.ccb/counters/user-corrections-<session_id>.count` 硬计数（UserPromptSubmit hook 自动维护）。计数 ≥2 时 hook 已 inject `additionalContext` 提示，Claude **必须响应**不得忽略；≥3 时必须 `/clear` 或明确重启诊断流程。即使当前尝试看起来"只差一点"，1% 可能需要根因诊断 = 100% 必须走诊断流程。

## 规则 4: Git 管理

- 当前阶段直接在 master 上开发（单人 + CCB 串行派发，出问题 git revert 即可）
- Worktree/分支隔离为**可选**，不强制。适用场景：多条开发线并行、高风险重构
- 每次 dispatch 后 Codex/Gemini commit + push，保持 master 可回退

## 规则 5: Chain Routing

用户给出指令后，匹配以下 chain：

**Design Chain** — 探索想法、做新功能：
1. brainstorming → 2. writing-plans → 3. task-execution

**Execution Chain** — 执行计划（dispatch 给 Codex/Gemini）：
1. task-execution（内部管 dispatch + review + retry 全流程）→ 2. verification-before-completion → 3. claudemd-check

**Closeout Chain** — 收尾：
1. milestone-audit → 2. claudemd-check → 3. finishing-a-development-branch

不匹配任何 chain 时正常处理，chain 是指引不是约束。

## 规则 6: Fallback for Toolsets

加载任何 skill 时，若 SKILL.md frontmatter 含 `fallback_for_toolsets` 字段且当前 session 中 `preferred` 列表任一工具不可用 → 必须优先读并执行 `fallback` 文本，禁止因单个工具缺失直接放弃 skill。

字段格式：
```yaml
fallback_for_toolsets:
  - preferred: ["Bash"]
    fallback: "If Bash is unavailable, ..."
```

来源：spec `2026-04-19-system-evolution-design` §2.1.4（M5，借鉴 Hermes skill runtime fallback 模式）。

---

## 行为契约

- **主动执行**运行规则，不等用户提醒
- **主动判断**想法分流，不问用户"该放哪"
- **不替代用户做产品决策** — 需要决策的事列在仪表盘"需要你决策"板块，等用户拍板
- **不在 Codex/Gemini 工作时打断它们** — 查进度只通过 git/文件，不碰它们的 session
