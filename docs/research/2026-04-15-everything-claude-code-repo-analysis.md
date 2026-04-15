---
date: 2026-04-15
topic: everything-claude-code repo 零件级分析（session-init token 优化调研 D2）
triage: 🔴
template: A
budget: 45min
sources: { S: 0, A: 4, B: 1 }
---

# everything-claude-code（ECC）零件级分析

**Repo**: https://github.com/affaan-m/everything-claude-code
**作者**: Affaan Mustafa（@affaan-m, 4.6K followers, Itô Markets 创始人, GitHub 2023 开户, Anthropic Hackathon 获奖者 — 自述）
**License**: MIT（Copyright 2026 Affaan Mustafa）
**规模**: 47 agents, 181 skills, 79 legacy 命令, 12 种语言生态系统
**最新 release**: v1.10.0（2026-04-05），最新 commit 2026-04-13
**Star**: 156,090（参考：整个 Claude Code 生态目前最大的零件库之一）

---

## 1. 这是什么（生活类比）

**它不是一把螺丝刀，它是一整家五金超市。**

- 你走进去可以整套搬回家（`install.sh --profile full`），也可以只买一颗螺丝（复制一个 skill 文件）。
- 货架分成几个区：agents（专业工人）、skills（操作手册）、hooks（自动感应器）、rules（语言规范）、MCP 配置。
- 货真价实 — 作者自述已用 10+ 个月做真实产品，持续迭代；但也正因为规模庞大，**整套搬回家会比我们现在的 session-init 更臃肿**。
- 定位自己是"agent harness performance optimization system"（多工具平台的性能优化系统），不只服务 Claude Code，还号称覆盖 Codex / Cursor / OpenCode / Gemini。

**结论**：它是**工具箱（toolkit/collection）**，不是单一工具。我们的策略应该是**只拆零件**，不要整套引入。

---

## 2. 分类地图（与我们相关的 5 大区）

| 分区 | 内容 | 与我们 session-init 优化的相关度 |
|------|------|------------------------------|
| `skills/` | 181 个独立能力（类似我们 `.claude/skills/`） | 🔴 高：可挑零件 |
| `hooks/hooks.json` | 33 个 hook 覆盖 PreToolUse/SessionStart/PreCompact/Stop 等 | 🔴 高：SessionStart 钩子是关键 |
| `agents/` | 47 个专业子代理 | 🟡 中：我们没在用 agent 体系 |
| `rules/` | 按语言分目录（common/typescript/python…） | 🟢 低：与 context 优化无关 |
| `commands/` | 79 个 legacy 斜杠命令 | 🟢 低：作者自己也在迁移弃用中 |

---

## 3. 可借鉴的零件（按 CLAUDE.md 5 问作答）

### 零件 A：`skills/context-budget/` — 上下文预算审计 🔴

- **Claim**: ECC 内置一个专门审计 agents/skills/rules/MCP/CLAUDE.md token 消耗、分类"总需要/有时需要/很少需要"三档、输出优化建议的 skill。
- **Quote**: "Analyze token overhead across every loaded component in a Claude Code session and surface actionable optimizations to reclaim context space."
- **URL**: https://raw.githubusercontent.com/affaan-m/everything-claude-code/main/skills/context-budget/SKILL.md
- **Tier**: [A · 仓库一手产物，作者有 10 月持续迭代史但无 S 级交叉引用]
- **Project implication（5 问）**
  1. **它是什么**：像家里的电表，告诉你每个电器（每个 skill、每条规则）耗了多少电，哪些可以拔掉
  2. **现在的代价**：把 SKILL.md 复制进 `.claude/skills/`，适配我们的目录路径 — 2 小时工作量
  3. **带来什么**：**精准定位 session-init 20-30% 中的 token 是被谁吃掉的** — 直接服务 D2 调研目标
  4. **关闭什么门**：无明显锁定，是纯分析工具
  5. **选错后果**：不好用就删掉，0 代价
- **推荐**：✅ **强烈借鉴**（不是照抄，是吸收它的分类法：Always/Sometimes/Rarely needed）

### 零件 B：`skills/strategic-compact/` + `suggest-compact.js` hook — 战略性压缩建议 🟡

- **Claim**: 不依赖 Claude 的自动 auto-compact，而是通过 PreToolUse hook 计数工具调用，在逻辑边界（50 次调用后）主动提示用户手动 `/compact`。
- **Quote**: "Suggests manual /compact at strategic points in your workflow rather than relying on arbitrary auto-compaction."
- **URL**: https://raw.githubusercontent.com/affaan-m/everything-claude-code/main/skills/strategic-compact/SKILL.md
- **Tier**: [A]
- **Project implication（5 问）**
  1. **它是什么**：像汽车仪表盘的油耗提示，提醒你在合适时机"停车加油"
  2. **现在的代价**：需要装 Node.js hook 脚本（我们已有 Node 环境 ✅），并配置 settings.json
  3. **带来什么**：补齐 Route D 中"periodic cleanup skill"这个部件 — 我们自己要写的逻辑
  4. **关闭什么门**：hook 会加到每次 Edit/Write 的 PreToolUse，如果写得慢反而拖慢体验
  5. **选错后果**：移除 hook 配置即可，可逆
- **推荐**：🟡 **借鉴思路，不直接用脚本**（我们自己实现更轻，因为 Windows 路径问题见 §5）

### 零件 C：`skills/codebase-onboarding/` — 代码库侦察 + 生成 CLAUDE.md 🟢

- **Claim**: 通过并行扫描 package.json/go.mod 等清单、framework 指纹、入口点、目录结构等 6 类信号，输出一份结构化 onboarding 文档。
- **Quote**: "Systematically analyze an unfamiliar codebase and produce a structured onboarding guide."
- **URL**: https://raw.githubusercontent.com/affaan-m/everything-claude-code/main/skills/codebase-onboarding/SKILL.md
- **Tier**: [A]
- **Project implication**：与 session-init 的**"每次会话注入太多项目上下文"**高度相关。它的 6 类侦察分类法（清单/框架/入口/目录/配置/测试）可以**作为我们分层索引的"Layer 0 静态骨架"的设计参考** — 这部分信息本质是冷数据，每次注入全文是浪费，应该压缩成 50 行指纹。
- **推荐**：🟡 **借鉴"指纹压缩"思想**，不直接用 skill。

### 零件 D：`hooks/hooks.json` 里的 `SessionStart` 钩子 + `PreCompact` 钩子 🔴

- **Claim**: ECC 的 SessionStart 只挂了 1 个脚本 `session:start`（"Load previous context and detect package manager on new session"），PreCompact 也只有 1 个 `pre:compact`（"Save state before context compaction"）。33 个 hook 中绝大多数挂在 PreToolUse/PostToolUse/Stop — **证据是作者刻意把 SessionStart 保持极简**。
- **Quote（hooks.json 结构）**: "SessionStart (1 hooks): session:start | Load previous context and detect package manager on new session"
- **URL**: https://raw.githubusercontent.com/affaan-m/everything-claude-code/main/hooks/hooks.json
- **Tier**: [A · 源码事实]
- **Project implication**：**这是最关键的发现。** 业内顶级 Claude Code 工具箱（156K star）的作者，SessionStart 只放"加载上次上下文 + 检测包管理器"两件小事，**不在启动时注入大量业务知识**。我们现在 session-init 挂 6 个文件 + 7 个 shell 命令，属于典型反模式。
- **推荐**：✅ **直接对齐这个设计原则** — SessionStart 只做"指针注入"（本文件去哪里找），把具体内容延迟到需要时再读。

### 零件 E：`skills/token-budget-advisor/` — 响应前预算选择器 🟢

- **Claim**: 用户可以在每次提问前选择 Essential(25%)/Moderate(50%)/Detailed(75%)/Exhaustive(100%) 四档深度，skill 根据 prompt 复杂度估算 token 区间。
- **URL**: https://raw.githubusercontent.com/affaan-m/everything-claude-code/main/skills/token-budget-advisor/SKILL.md
- **Tier**: [A]
- **Project implication**：这是"输出 token"优化，跟我们"输入 context 优化"是两个问题。**不借鉴**，但记录在案。

### 不借鉴清单（避免误入）

- `skills/continuous-learning-v2/` — hook 里每次 PreToolUse 都跑 `observe.sh`，属于持续收集数据，对我们反而加 token
- `skills/continuous-agent-loop/` / `autonomous-agent-harness/` — 与我们 CCB 多模型协作冲突，ECC 假设单 Claude 主导
- 33 个 hook 整体引入 — 我们 CCB 已有自己的调度，加这些会导致双系统抢控制权

---

## 4. 维护活跃度评估

| 指标 | 数据 | 评价 |
|------|------|------|
| 最新 commit | 2026-04-13（2 天前） | ✅ 极活跃 |
| 最新 release | v1.10.0 / 2026-04-05 | ✅ 每月一个大版本 |
| Open issues | 95（其中 #1435 是 2 天前的 Windows 严重 bug） | 🟡 有积压 |
| Contributors | 170+（README 自述），30+ PR/月 | ✅ 社区健康 |
| 付费分层 | ECC Tools Pro / 企业版 / GitHub App Marketplace | 🟡 有商业化动机（注意：作者可能优先服务付费用户） |
| Star/Fork | 156K / 24K | ✅ 业内头部 |

**结论**：**活跃维护，非实验品，非遗弃品。** 但开放 issue 数量（95）+ 商业化双重策略意味着 bug 修复优先级可能倾斜。

---

## 5. License + Windows + 中国 + CCB 兼容性

### License — ✅ 安全
- **MIT License** by Affaan Mustafa 2026 — 允许自由复制、修改、商用、再分发，只需保留 copyright 和 MIT 文本。
- **URL**: https://raw.githubusercontent.com/affaan-m/everything-claude-code/main/LICENSE
- **行动**：任何零件借鉴时，在我们文件头加一句 `Adapted from affaan-m/everything-claude-code (MIT)` 即可。

### Windows 兼容性 — 🔴 **已知严重 bug**
- **Claim**: `gateguard-fact-force.js` 里的 `fs.renameSync` 在 Windows 上抛 EEXIST，被空 catch 吞掉，导致 Edit/Write/Bash 被永久阻断。
- **Quote**: "`gateguard-fact-force.js` permanently blocks every Bash, Edit, and Write call on Windows... On Windows, it throws EEXIST if the destination already exists. The catch (_) {} swallows the error silently"
- **URL**: https://github.com/affaan-m/everything-claude-code/issues/1435
- **Tier**: [A · 维护者自己的 issue 报告]
- **Project implication**：我们是 Windows 11 用户。作者 README 声称"now fully supports Windows"，但实际**原子写文件模式在 Windows 上有陷阱**。**直接整套安装风险极高。** 零件级借鉴时必须自己测试，不能信任他们的 Windows 声明。

### 中国可达性 — ✅ **可克隆**
- GitHub 主站在中国可访问（可能需要 clash/加速器，但 `curl + raw.githubusercontent.com` 测试成功）
- 无 blocked dependencies（npm 包 `ecc-universal`、`ecc-agentshield` 走 npm 公共 registry）
- 中文 README (`README.zh-CN.md`) 存在 — 有中文社区翻译贡献

### CCB 多模型兼容性 — 🟡 **部分冲突**
- ECC 核心假设：**一个 agent harness 主导**（Claude 或 Codex 或 Cursor），通过 hooks 钩子系统控制该 harness。
- 我们 CCB：**Claude (PM) + Codex (后端) + Gemini (前端) 三人协作，Claude 是总指挥**
- **冲突点**：ECC 的 `/multi-plan` `/multi-execute` 等 6 个 multi-* 命令依赖 `ccg-workflow` 外部 runtime，与我们的 CCB 派发协议不兼容。
- **不冲突点**：单个 skill 文件（如 context-budget）、单个 hook 脚本逻辑，这些是**中立的**，不绑定特定 harness。
- **行动**：**只借零件，不要任何涉及 multi-* / harness orchestration 的部分。**

### CLAUDE.md 产品不变量 — ✅ **通过**
- 检查过的 skill 文件都是 Markdown 文稿 + Node 脚本，**无客户端 API key 泄漏**、**无 TypeScript `any`**（脚本用 JS）。
- 但 hook 脚本里大量使用 `catch (_) {}` 空 catch，这与我们"诊断优先"原则冲突，借鉴时需重写错误处理。

---

## 6. 源质量自审（hallucination declaration）

### S/A/B 统计
- **S-tier**: 0
- **A-tier**: 4（仓库 README、LICENSE、SKILL.md 源文件、GitHub API 元数据 + issue 正文）
- **B-tier**: 1（作者自述的 "Anthropic Hackathon Winner" — 无第三方来源佐证，降级为社区叙事）
- **hard-reject 过滤**：未使用任何 Medium/博客/SEO 内容

### URL 可验证性
| Claim | URL | ✅/❌ |
|------|-----|------|
| Repo 存在 + 156K star | api.github.com/repos/affaan-m/everything-claude-code | ✅ |
| MIT License | raw.githubusercontent.com/.../main/LICENSE | ✅ |
| context-budget skill 内容 | raw.../main/skills/context-budget/SKILL.md | ✅ |
| strategic-compact skill 内容 | raw.../main/skills/strategic-compact/SKILL.md | ✅ |
| codebase-onboarding skill 内容 | raw.../main/skills/codebase-onboarding/SKILL.md | ✅ |
| token-budget-advisor skill 内容 | raw.../main/skills/token-budget-advisor/SKILL.md | ✅ |
| hooks.json 结构（33 hooks, SessionStart 仅 1 条） | raw.../main/hooks/hooks.json | ✅ |
| 最新 release v1.10.0 / 2026-04-05 | api.github.com/.../releases | ✅ |
| 最新 commit 2026-04-13 | api.github.com/.../commits | ✅ |
| Windows 严重 bug #1435 | github.com/affaan-m/.../issues/1435 | ✅ |
| Anthropic Hackathon Winner 宣称 | 仅 README 自述，无第三方来源 | ❌ |

### Hallucination 声明
- **未引用我训练数据里的"印象"** — 所有数据在 2026-04-15 实时拉取。
- **无 S 级来源** — 诚实说明：ECC 是新兴项目，作者无 Thoughtworks/Google/Anthropic 官方身份、无 citable 学术工作，因此无 S 级信号。所有结论基于"仓库一手产物 + 维护者自己的 issue"，这是我们能获得的最高级别真相。
- **未查到**：作者 Affaan Mustafa 的 Anthropic Hackathon 获奖官方证据（仅 README 自述 + Twitter 链接）；本项目与 Simon Willison / Thoughtworks 等 S 级作者的交叉引用。这两条都是 B 级信号，不能作为决策依据。

---

## 7. 给 Route D 的具体建议

**总体原则：不整套安装，只吸收 3 样东西**
1. **分类法**：Always needed / Sometimes needed / Rarely needed 三档 — 用来重构我们 session-init 加载清单
2. **SessionStart 极简原则**：只挂"指针注入"（告诉 Claude 哪些 index 文件存在，按需 hydrate），不挂业务上下文
3. **context-budget skill 的 token 计算公式**：`words × 1.3`（散文）、`chars / 4`（代码）— 作为我们 cleanup skill 的度量基线

**绝不要做的事**
- 执行 `install.sh` / `install.ps1` — Windows 有已知 bug（#1435），会污染 `.claude/` 目录
- 引入他们的 `hooks.json` — 33 个 hook 会跟我们的 CCB 协议打架
- 使用 `multi-*` 命令 — 需要 `ccg-workflow` runtime，与 Claude/Codex/Gemini 三人协作冲突
- 信任 README 的 "Anthropic Hackathon Winner" 光环 — 这是 B 级信号，不是技术质量保证

**可逆性评估**
- 零件级借鉴（复制 1-2 个 SKILL.md 的思想）：🟢 **完全可逆**，不满意删掉即可
- 安装整套：🔴 **难以反悔**，会污染 `.claude/` 根目录、写 hook 配置、改 MCP 设置

---
