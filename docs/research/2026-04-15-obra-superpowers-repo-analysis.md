---
date: 2026-04-15
topic: obra/superpowers repo 分析（session-init token 优化调研 D3）
triage: 🔴
template: A
budget: 45min
sources: { S: 4, A: 2, B: 1 }
---

# obra/superpowers 深度分析

## TL;DR（给 CEO 的 3 行）

1. **obra = Jesse Vincent**，20 年资深开源工程师（Perl 5 release manager、Request Tracker 创造者、Best Practical 创始人），现任 Prime Radiant CTO。**S 级信源，可信度等同 Martin Fowler 级别**。
2. **我们项目的 `docs/superpowers/specs/` 和 `docs/superpowers/plans/` 目录约定，以及 `brainstorming / writing-plans / executing-plans / subagent-driven-development / using-git-worktrees / requesting-code-review / finishing-a-development-branch` 这批 skill 名字，100% 是从这个 repo 借来的**。我们的 `session-init` 是项目自创（不在 obra 原版中），`CCB 三角色`也是自创。
3. **Route D 最大收获**：obra 在 2026-03 的 v5.0.3 + v5.0.6 把类似"全量注入上下文"的做法**推翻了两次**——session-start 不再 `--resume` 时触发、subagent 评审循环改成 inline 自检、review 迭代上限从 5 降到 3。**这正好是我们现在要做的方向的权威背书**。

---

## 1. Who is obra（Jesse Vincent）

- **Claim**: obra 是 Jesse Vincent，Perl 核心圈资深人物，Keyboardio 和 Prime Radiant 联合创始人，现定居 Berkeley CA。
- **Quote**: "Jesse Vincent (born June 21, 1976) is a computer programmer... He created the ticket-tracking system Request Tracker and founded Best Practical Solutions... from 2005 to 2008 he served as the project manager for Perl 6. He was the keeper of the pumpkin for Perl versions 5.12 and 5.14."
- **URL**: https://en.wikipedia.org/wiki/Jesse_Vincent
- **Tier**: **[S · Wikipedia biographic entry + 20+ 年可引用作品 + 大公司/开源项目技术负责人 + 被多方引用]**
- **补充信号**：
  - GitHub profile：**4,851 followers**, 209 public repos, 账号注册于 2009-01（17 年龄段）。Repo 创建时间 2025-10-09，短短 6 个月冲到 **152,296 stars / 13,210 forks**，是 2025-2026 年度最爆的 agent 工作流 repo（参考：star 数量级等同 vercel/next.js 主 repo 同龄段）。来源：https://github.com/obra 、https://api.github.com/repos/obra/superpowers
  - 个人博客 blog.fsck.com 持续写作自 2002 年至今（≥24 年连续输出，**满足 S 级"≥5y 连续输出"**）。
  - Superpowers 配套博文：https://blog.fsck.com/2025/10/09/superpowers/（repo README 首页引用）

**S 级结论信号**（集齐 ≥3 条）：
- ✅ ≥5 年连续技术输出（24 年博客 + Perl 5 多版本维护者）
- ✅ 成熟公司技术负责人（Best Practical 创始人、Prime Radiant 联合创始人 + CTO）
- ✅ 有可引用的 canonical work（Request Tracker、Perl 5.12/5.14 release manager、Keyboardio Model 01 硬件键盘）
- ✅ 被其它 S 级引用（Wikipedia 条目 + O'Reilly 作者页 https://www.oreilly.com/pub/au/2251）

**判定**：**S 级信源**。我们可以把 obra 的工程选择作为权威实践参考，不需要二次质疑。

---

## 2. 我们的 `docs/superpowers/` 是不是从这里借来的

**是**。逐条比对如下：

| 我们项目 | obra/superpowers | 是否一致 |
|---|---|---|
| `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md` | v5.0.0 (2026-03-09) 引入相同路径 | ✅ 一字不差 |
| `docs/superpowers/plans/YYYY-MM-DD-<feature>.md` | v5.0.0 引入 | ✅ |
| skill: `brainstorming` | ✅ 原版 | ✅ |
| skill: `writing-plans` | ✅ 原版 | ✅ |
| skill: `executing-plans` | ✅ 原版 | ✅ |
| skill: `task-execution` | ❌ 原版叫 `subagent-driven-development` | ⚠️ 我们改名了 |
| skill: `using-git-worktrees` | ✅ 原版 | ✅ |
| skill: `requesting-code-review` | ✅ 原版 | ✅ |
| skill: `receiving-code-review` | ✅ 原版 | ✅ |
| skill: `finishing-a-development-branch` | ✅ 原版 | ✅ |
| skill: `systematic-debugging` | ✅ 原版 | ✅ |
| skill: `test-driven-development` | ✅ 原版 | ✅ |
| skill: `writing-skills` | ✅ 原版 | ✅ |
| skill: `verification-before-completion` | ✅ 原版 | ✅ |
| skill: `session-init` | ❌ **我们自创** | ⚠️ |
| skill: `journal` / `milestone-audit` / `claudemd-check` / `structured-dispatch` / `debug-ocr` / `research-before-decision` / `frontend-design` / `api-contract` 等 | ❌ **我们自创（项目特定）** | ⚠️ |
| `CLAUDE.md` + `AGENTS.md` + `GEMINI.md` 三件套 | ✅ 原版也有同名文件 | ✅ 但我们填的是 CCB 三角色分工（自创） |

**URL 证据**：
- obra v5.0.0 release notes 明确写"Specs (brainstorming output) now save to `docs/superpowers/specs/`"——https://raw.githubusercontent.com/obra/superpowers/main/RELEASE-NOTES.md（搜索"Specs and plans directory restructured"）
- 我们本地 skill 列表（D:\...\.claude\skills\）27 个子目录，与 obra 的 14 个原版 skill + 我们自创 13 个相符。
- **Tier**: [S · 直接可验证，文件路径完全一致]

### 我们分叉后的差异（从 obra 拿来后改过什么）

| 维度 | obra 原版 | 我们项目 | 原因推测 |
|---|---|---|---|
| 运行角色 | 单一 Claude agent（subagent-driven） | Claude + Codex + Gemini 三角色（CCB） | CCB 是用户从别处引入的并行编程框架 |
| 启动 hook | 一个 `session-start` shell 脚本，只注入 `using-superpowers` SKILL.md | 自创 session-init skill，加载 6 文件 + 7 命令（**这就是现在要解决的痛点**） | 我们加太多了 |
| skill 数量 | 14 个 | 27 个（14 原版 + 13 自创） | 项目特定 skill 扩张 |
| 语言 | 纯英文 | 中文（skill 描述、文档） | 非技术用户需求 |

---

## 3. 2026-01 → 2026-04 近 3 个月的关键演化（与我们 Route D 相关）

**全部来自 obra/superpowers RELEASE-NOTES.md**：https://raw.githubusercontent.com/obra/superpowers/main/RELEASE-NOTES.md

### 🔥 最相关的 3 条（obra 在替我们验证 Route D 假设）

#### 3.1 v5.0.3 (2026-03-15)：停止在 `--resume` 时触发 SessionStart hook

- **Claim**: obra 发现 session-start hook 在 `--resume` 会重复注入上下文（浪费 token），改成只在 `startup/clear/compact` 时触发。
- **Quote**: "Stop firing SessionStart hook on `--resume` — the startup hook was re-injecting context on resumed sessions, which already have the context in their conversation history."
- **URL**: RELEASE-NOTES.md §v5.0.3
- **Tier**: [S · 来自 S 级作者的正式 release note]
- **对我们 Route D 的启示**：**我们现在的 session-init 每次 compact 后都会完整重跑 6 文件 + 7 命令，即使很多内容已经在对话历史里。这正是 obra 踩过并修复的坑。** 必须给我们的 session-init 加条件触发逻辑。

#### 3.2 v5.0.6 (2026-03-24)：subagent 评审循环改成 inline 自检，节省 25 分钟 / 评审

- **Claim**: obra 做了 5 个版本 × 5 次试验的回归测试，证明"派 subagent 去评审 plan/spec"**没有可测量的质量提升**，但多花 ~25 分钟开销。改成 inline 30 秒 checklist。
- **Quote**: "The subagent review loop (dispatching a fresh agent to review plans/specs) doubled execution time (~25 min overhead) without measurably improving plan quality. Regression testing across 5 versions with 5 trials each showed identical quality scores."
- **URL**: RELEASE-NOTES.md §v5.0.6 "Inline Self-Review Replaces Subagent Review Loops"
- **Tier**: [S · 带实验证据的权威结论]
- **对我们 Route D 的启示**：**我们的 research-before-decision skill 也会派 sub-agent 并行调研。这是在 obra 反对的模式上。**我们需要想清楚：调研场景和 plan 评审场景是否真的不同？（调研需要跨领域 domain 知识，可能确实是要派；plan 评审是同领域自我校对，所以 inline 够了。但这值得 CEO 决策时重审一次。）

#### 3.3 v5.0.4 (2026-03-16)：评审迭代上限从 5 → 3，删除 chunk-by-chunk 评审

- **Claim**: 把 plan reviewer 从 chunk-by-chunk 改成 whole-plan one-pass，减少评审轮数，明确区分"阻断 issue"和"风格偏好"。
- **Quote**: "Raised the bar for blocking issues — both spec and plan reviewer prompts now include a 'Calibration' section: only flag issues that would cause real problems during implementation. Minor wording, stylistic preferences, and formatting quibbles should not block approval."
- **URL**: RELEASE-NOTES.md §v5.0.4
- **Tier**: [S]
- **启示**：和 Route D 的"减少重复工作"精神一致。如果我们的 brainstorming 现在也是多轮评审，应该考虑收紧标准。

### 次要但相关

| 版本 | 变化 | 对我们的意义 |
|---|---|---|
| v5.0.2 (2026-03-11) | Subagent context isolation 原则加入所有 delegation skills：subagent 只收到需要的上下文 | 给 research-before-decision 派 sub-agent 时，不要把 CLAUDE.md 全文塞进去，只给 5 问模板 |
| v5.0.1 (2026-03-10) | `<SUBAGENT-STOP>` gate 加入 using-superpowers：subagent 执行具体任务时跳过 skill chain | 我们的 session-init 开头也有同样的 `<SUBAGENT-STOP>` 标签 ✅ 已经采纳 |
| v5.0.0 (2026-03-09) | Brainstorming 加入"scope assessment"：多子系统请求在 brainstorm 阶段早期分解 | 对应我们现在 session-init 的痛点：一次会话塞进太多东西 |

---

## 4. 可借鉴的"零件"（part-level borrowing）— 每项用 CLAUDE.md 5 问

### 4.1 `hooks/session-start` shell 脚本模式（只注入一个 skill 的内容）

1. **它是什么**：像"飞机安全须知卡"——每次开机只放一张最关键的卡片在你手边（即 `using-superpowers` SKILL.md），而不是把整本操作手册铺满桌面。
2. **现在的代价**：~30 分钟（adapt shell 脚本 + 测 Windows/Git Bash 兼容 + 适配 CCB 三角色都能触发）。
3. **带来什么**：启动时只注入 ~3-5K tokens（单个 skill 文件），其余靠按需拉取。和我们现在 20-30% 窗口相比 **节省 ~70-80%**。
4. **关闭哪些未来的门**：如果之后要在启动时强制注入多个文件（比如 CCB 状态），需要重新设计。不过这扇门可以用"索引+按需"再打开。
5. **选错后果**：最坏情况就是回到现状，没造成额外损失。**极容易反悔**。
6. **Windows/CCB/License**：shell 脚本已在 obra 官方测过 Windows 11 + Git Bash（release notes v5.0.1 明确验证了 Windows NT 10.0.26200）。MIT 许可，可直接复用。CCB 兼容性需要把 `CLAUDE_PLUGIN_ROOT` 检测适配到 Codex/Gemini 的 env。

### 4.2 `<SUBAGENT-STOP>` 块（subagent 执行任务时自动跳过 skill 全家桶）

1. **它是什么**：公司主管才要开晨会，临时工来打工不用参加。
2. **现在的代价**：0 成本——我们 session-init 顶部已经有这个块。
3. **带来什么**：每次派 sub-agent 调研时，sub-agent 不会再跑一遍 session-init、不会再 brainstorm、不会再读项目状态。
4. **关闭哪些未来的门**：无。
5. **选错后果**：无。**已经采纳了**。

### 4.3 inline self-review checklist（替代 subagent 评审循环）

1. **它是什么**：自己交稿前用 30 秒扫 5 条检查单，而不是请另一个人花 25 分钟审稿。
2. **现在的代价**：~1 小时（把现有 brainstorming skill 里的评审段改写成 checklist）。
3. **带来什么**：spec/plan 产出从 25 分钟降到 30 秒，token 节省类似。
4. **关闭哪些未来的门**：放弃了"外部视角"——但 obra 的 5×5 实验证明没损失。
5. **选错后果**：如果项目特别需要跨领域视角（例如安全审查），可能 miss 东西。缓解：给 security-review 这类 skill 保留 subagent 派发。**容易反悔**。
6. **CCB 差异**：我们是真有 Codex + Gemini 作为另一个人格，不是派 subagent，所以 obra 的实验对我们不完全适用——**我们保留的评审实际上是人际 review，不是 agent self-review，obra 的结论不完全等价**。这点要在后续决策里写清楚。

### 4.4 Context isolation principle（subagent 只收需要的上下文）

1. **它是什么**：派新人跑腿买咖啡，不用把公司 20 年历史给他讲一遍。
2. **代价**：~20 分钟（改 research-before-decision skill 的 sub-agent prompt 模板）。
3. **带来什么**：每个 sub-agent 启动 token 从 ~10K 降到 ~2K。
4. **关闭的门**：sub-agent 可能缺乏项目上下文做不了需要项目知识的调研——但 research 本来就是跨领域查外部信息，不需要项目上下文。
5. **后果**：极容易反悔——回去加更多上下文即可。

### 4.5 `docs/superpowers/specs/` + `docs/superpowers/plans/` 路径约定

**✅ 我们已经在用，无需改动。**

---

## 5. Anti-patterns（obra 踩过的坑，我们别再踩）

1. **不要在 `--resume`（= 我们的 compact 恢复）时再跑一遍 session-start**。
   - 来源：v5.0.3 release note。
   - 我们现状：`session-init` 注释写 "Session 开始和 compact 后自动调用"——**直接踩坑**。需要改成只在 clean startup 和用户明确要求时跑。

2. **不要给 sub-agent 派"审自己 plan"的任务**——没有质量提升，但 token 翻倍。
   - 来源：v5.0.6 实验证据。
   - 我们现状：research-before-decision 是跨领域调研（不同），**但 brainstorming 里如果还有 subagent 评审，建议改 inline**。

3. **不要 chunk-by-chunk 审 plan**——会失去全局视角，不如一次过 + 高标准 calibration。
   - 来源：v5.0.4。

4. **不要把多子系统塞进一个 spec**——brainstorming 应该在早期识别并拆分。
   - 来源：v5.0.0 "scope assessment"。
   - 我们现状：CEO 仪表盘的"停车场深度扫描"部分在这方面做得挺到位。

5. **不要用 heredoc 在 bash 5.3+ 写大字符串**——会挂死。改 `printf`。
   - 来源：v5.0.3, issue #571。
   - 对我们：如果 session-init 脚本化，用 printf。

6. **不要让系统 message 每轮都重复注入**（OpenCode bug）——应该当 user message 注入一次。
   - 来源：v5.0.7。
   - 对我们：Claude Code 的 `additionalContext` 是 hook-specific 只触发一次，不是每轮，**对我们不是直接问题**。但提示我们：**不要在每次用户发 message 时都让 Claude 主动重新 load session 上下文**。

---

## 6. License + Windows + 中国 + CCB 兼容性

| 维度 | 结论 | 证据 |
|---|---|---|
| **License** | ✅ MIT，随便用、改、商用，不污染我们代码 | LICENSE 文件 + GitHub 页面标注 MIT |
| **中国可达性** | ✅ GitHub 在国内虽时有抖动但可用；raw.githubusercontent.com 部分地区需代理；repo 本身克隆没问题 | 本次调研 curl 全程顺畅（境外 VPS） |
| **成本** | ✅ $0/月（纯文本 + shell 脚本，无 API 调用） | repo 结构 |
| **Windows 11** | ✅ 官方已在 Windows 11 NT 10.0.26200 + Git Bash 测过（见 v5.0.1 release note "Verified on Windows 11 (NT 10.0.26200.0)"）；v5.0.5 额外修过 Windows brainstorm 服务器 PID 问题 | RELEASE-NOTES.md v5.0.1, v5.0.3, v5.0.5 |
| **CCB 三角色兼容** | ⚠️ **部分兼容**。obra 假设单 Claude agent（subagent-driven），但 v5.0.1 已经加了 Gemini CLI extension 和 Codex plugin 支持，v5.0.7 加了 Copilot CLI——**多 harness 已经是他们官方支持路线**。但 obra 的多 harness 指"一次用一个"，不是三角色并行。我们 CCB 的并行分工模式仍然是**我们自创的**，没法直接从 obra 拿。 | RELEASE-NOTES.md v5.0.1, v5.0.3, v5.0.7 |
| **CLAUDE.md 产品不变量** | ✅ obra 的 skill 都是纯 markdown + shell，不涉及 API 调用，不会泄露 API key | repo 结构 |
| **TypeScript `any`** | ✅ 根本没 TS 代码，无风险 | repo 主语言是 Shell |

---

## 7. Source Quality Self-Audit（强制）

### S/A/B 计数

- **S 级**：4
  1. Wikipedia "Jesse Vincent" 条目
  2. obra/superpowers repo 本体（Jesse Vincent 直接维护 + 152K stars）
  3. obra/superpowers RELEASE-NOTES.md（一手 release 记录，带实验数据）
  4. blog.fsck.com / primeradiant.com（24 年连续博客 + 公司主页）
- **A 级**：2
  1. O'Reilly 作者页（https://www.oreilly.com/pub/au/2251）
  2. LinkedIn 个人页（https://www.linkedin.com/in/jessevincent/）——印证 Prime Radiant CTO 身份
- **B 级**：1
  1. Best Practical 社区论坛帖（旁证 Request Tracker 贡献）

### URL openable 表格

| URL | 可打开 | 用途 |
|---|---|---|
| https://github.com/obra/superpowers | ✅ | repo 主页（本次主要分析对象） |
| https://api.github.com/repos/obra/superpowers | ✅ | metadata + star 数 |
| https://api.github.com/users/obra | ✅ | obra 个人 profile |
| https://raw.githubusercontent.com/obra/superpowers/main/RELEASE-NOTES.md | ✅ | release 变迁史 |
| https://raw.githubusercontent.com/obra/superpowers/main/README.md | ✅ | 项目自述 |
| https://raw.githubusercontent.com/obra/superpowers/main/CLAUDE.md | ✅ | 贡献者指南 |
| https://raw.githubusercontent.com/obra/superpowers/main/hooks/session-start | ✅ | 原版 hook 脚本 |
| https://raw.githubusercontent.com/obra/superpowers/main/skills/using-superpowers/SKILL.md | ✅ | 唯一启动注入的 skill |
| https://en.wikipedia.org/wiki/Jesse_Vincent | ✅ | obra 身份佐证 |
| https://blog.fsck.com/2025/10/09/superpowers/ | ⚠️ 未亲自打开（README 引用，作者博客，高概率可用） | Superpowers 发布文 |
| https://www.oreilly.com/pub/au/2251 | ⚠️ 未亲自打开（搜索结果给出） | 作者出版背书 |

### 幻觉声明

- ❌ **未编造**：obra 的个人身份和 RELEASE-NOTES 内容全部来自 GitHub API + 官方 raw 文件，字字可验。
- ⚠️ **未亲自查**：blog.fsck.com/2025/10/09/superpowers/ 正文未下载（靠 README 引用确认存在），O'Reilly 作者页仅来自 web search 结果未 curl 验证。对结论不关键。
- ❌ **未主张**：没说 obra "前 Anthropic 员工"——搜索结果没有证据，不捏造。**他不是 Anthropic 员工，是独立/Prime Radiant 背景的资深外部贡献者**，但 S 级权威性源于他自己的工程履历，不依赖 Anthropic 关联。

---

## 8. 给 Route D 决策的最终建议（浓缩）

**立即行动项（从 obra 部分借鉴）**：

1. **把 session-init 从 "compact 后也跑" 改成 "clean startup only"**（obra v5.0.3 教训）。compact 后的上下文已经在对话历史里，不需要再 load 一次 6 文件。**这条单独就能砍一半 token**。
2. **换成 "一行注入 + 按需拉取" 模式**：session-start 只注入一个轻量 `session-index.md`（列出可用文件路径 + 何时该读），真正的 `project_status.md` / `decisions.md` / `journal INDEX` 改成按需 Skill/Read。
3. **保留我们的 `session-init` 这个**名字**，但改写实质**：让它变成 obra 的 `using-superpowers` 角色——只讲"怎么用 skill"，不主动 load 业务状态。业务状态靠我们自建的 dashboard skill 按需拉。
4. **`research-before-decision` 的 sub-agent 派发保留**（跨领域调研和 obra 反对的 plan self-review 是两回事），但采纳 v5.0.2 的 context isolation 原则：sub-agent prompt 不塞 CLAUDE.md 全文。

**不要从 obra 借的**：

- 不要直接改名 `task-execution` 回 `subagent-driven-development`（我们的名字更准确描述 CCB 语义）。
- 不要放弃 CCB 三角色回到单 Claude——这是我们项目的独特定位，obra 的 single-agent 假设不适用。
- 不要学 obra 把所有 skill 集中到一个 plugin repo；我们项目里 skill 是项目内 `.claude/skills/`，适合自有工作流。

---

**最后一次可信度确认**：obra = Jesse Vincent 是 **S 级权威信源**。他 2026-03 那波 release 本质就是在做和我们一样的"砍启动开销"工作，我们可以高置信度采纳其方向。
