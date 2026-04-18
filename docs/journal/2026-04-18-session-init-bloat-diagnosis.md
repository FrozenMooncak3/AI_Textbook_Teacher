---
date: 2026-04-18
topic: Session-Init Token 膨胀诊断（优化后不降反增）
type: diagnosis
status: open
keywords: [session-init, token-optimization, context-bloat, skill-anti-pattern, MCP, skills-list, @import, INDEX]
---

# Session-Init Token 膨胀诊断

> **用途**：下一个 clean session 开始 brainstorming 具体 fix 方案前，必读此文件。此文件承载全部调研数据、真实膨胀拆解、根因分析、候选 fix 方向。不写任何具体改动 diff——diff 在下一 session brainstorm 后产出。

---

## 1. TL;DR

2026-04-15 完成的 "Session-Init Token Optimization" 里程碑**反而让 session-init 变重了**。

- **优化前**：跑完 session-init 后 /context = 28%，其中 MCP 占 14%（system tools 里 eager-loaded），**非-MCP 部分 = 14% ≈ 28k tokens**。
- **优化后**（2026-04-18 实测）：跑完 session-init 后 /context = **32%**，MCP 变成 on-demand（Claude Code 版本升级，非用户操作），**非-MCP 部分 = 32% ≈ 65k tokens**。
- **净效果**：session-init 相关部分膨胀 **+37k tokens（翻倍多）**。MCP 省下的 14% 被 session-init 自己全吃，还多吃 18%。

**最大三个根因**：
1. 把 `session-rules` / `skill-catalog` / `ccb-protocol-reference` **做成 skill**——skill frontmatter 进 "available skills" reminder 永久加载，`@import` 让 session-rules body 进 memory baseline 永久加载
2. **INDEX 拆成 3 份**（journal + research + superpowers），加起来比原来还贵
3. **停车场深度扫描**指令在 parked 数量多时线性放大（指令本身老早就有，不是新加的，但今天执行时才看清膨胀效应）

---

## 2. 真实测量数据

### 2.1 优化前（用户报告）
- /context 总占用：**28%**
- MCP 占：**14%**（system tools eager-loaded）
- 非-MCP 部分（baseline + session-init messages）：**14% ≈ 28k**

### 2.2 优化后实测（2026-04-18，fresh session 跑完 session-init 后）

```
Context Usage: 64.8k / 200k tokens (32%)

Estimated usage by category:
- System prompt: 8.7k (4.3%)
- System tools: 11.4k (5.7%)   ← MCP 已不在此处，变成 on-demand
- Memory files: 6.3k (3.2%)    ← CLAUDE.md 2.7k + session-rules 1.5k + MEMORY.md 2.2k
- Skills: 2.4k (1.2%)          ← 31 project + 12 user + 2 plugin skill 的 frontmatter
- Messages: 36.9k (18.4%)      ← ★ session-init 真正产生的

MCP tools: loaded on-demand（6 个 Google/Gmail 工具，Available 但未加载 schema）
```

Baseline（非-Messages）= 28.8k = 14.4%
Messages（session-init 贡献）= 36.9k = 18.4%

### 2.3 真实膨胀

| 维度 | 优化前 | 优化后 | 差 |
|---|---|---|---|
| 总 /context | 28% | 32% | +4% |
| 其中 MCP | 14% | 0（on-demand） | -14% |
| **非-MCP** | **14% ≈ 28k** | **32% ≈ 65k** | **+18% ≈ +37k** |

---

## 3. Messages 36.9k 完整拆解

fresh session 跑完 session-init 到 /context 截图时，messages 区块分解如下：

| 区块 | 估算 tokens | 归属 | 可控性 |
|---|---|---|---|
| 系统启动 reminder：available skills 列表（48 项：31 project + 12 user + 2 plugin + 3 built-in），每项含名字+简介 | ~6-8k | Claude Code 注入 | 🟡 skill 越多越胖 |
| 系统启动 reminder：deferred tools 列表（22 个） | ~2k | Claude Code 注入 | ❌ 不可控 |
| 系统启动 reminder：claudeMd 重复注入（CLAUDE.md 内容）| ~3-4k | Claude Code 注入 | ❌ 不可控 |
| `/session-init` slash command 回显 SKILL.md body（122 行） | ~3k | SKILL body | 🟡 SKILL 越短越便宜 |
| 5 个 Read 并行： | **~12k** | session-init 读 | ✅ 可控 |
|   - project_status.md 121 行 | 3.6k | | |
|   - journal/INDEX.md 63 行 | 1.9k | | |
|   - research/INDEX.md 55 行 | 1.7k | | |
|   - superpowers/INDEX.md 83 行 | 2.5k | | |
|   - architecture.md 80 行（实际 §0 只到 52 行，今天多读了 28 行） | 2k | | |
| 7 个 Bash（git log / status / ls）+ tool call overhead | ~3k | session-init 调用 | ✅ 可控 |
| 4 个 parked journal 文件（深度扫描，按 SKILL 指令应读全部 13 条 parked） | ~4k | session-init 读 | ✅ 可控 |
| 我的仪表盘响应 + 第二波小读取（archive §0 确认、2 个补充 journal）| ~3k | 我生成 | ✅ 可控 |
| **合计** | **~36-39k** | | |

实测 36.9k，与拆解吻合。

### 3.1 大头归类

- **不可控（系统 reminder 每次注入）**：~11-14k（系统启动 reminder 总和）
- **SKILL body 回读**：~3k（SKILL 每次被 /session-init 触发时全文回显到 messages）
- **session-init 主动读取**：~15-19k
- **我的响应**：~1.5-3k

---

## 4. 根因分析（按膨胀量排序）

### 根因 1：把 3 份文档错误地做成 skill

优化里程碑新建了 4 个 skill，其中 3 个本质是**文档**，不是需要智能触发的能力：

| skill | 内容 | 本质 |
|---|---|---|
| `session-rules` | 5 条运行规则 + skill 自动触发表 | 文档 |
| `skill-catalog` | 23 个 skill 使用手册 | 文档 |
| `ccb-protocol-reference` | CCB 派发协议精华 | 文档（主文档已有 `docs/ccb-protocol.md`） |
| `memory-cleanup` | 周期清理 journal/decisions 的操作流程 | 真正的能力（保留合理） |

**为什么 skill 化是错误**：
- skill frontmatter 进 "available skills" system reminder，每个 session 启动都注入（即使整个 session 不用也烧）
- `CLAUDE.md` 里加了 `@.claude/skills/session-rules/SKILL.md`，让 session-rules body（1.5k）永久进 memory baseline
- 所谓 "按需加载" 是幻觉——skill 的 frontmatter 永远在，body 只有在 Skill tool 被调用时才展开。但 frontmatter 本身也不便宜。

**本该怎样**：
- 普通 `.md` 文件放在 `docs/` 下
- session-init SKILL 里写 "需要时 Read docs/xxx.md"（持指针不持内容）

**膨胀量**：
- 3 skill frontmatter 在 available skills reminder：~200-400 tokens（/skills 显示 29+27+31=87 tokens，但 reminder 里还有 name+description 展开）
- session-rules @import 永久 baseline：+1.5k
- **合计 ~2-3k，其中 1.5k 是永久 baseline**

### 根因 2：INDEX 拆成 3 份反而更贵

优化意图："INDEX 比全文便宜"。但把 1 份 journal INDEX 拆成 3 份（journal + research + superpowers），加起来比原来贵：

| INDEX | 行数 | tokens |
|---|---|---|
| `docs/journal/INDEX.md` | 63 | ~1.9k |
| `docs/research/INDEX.md` | 55 | ~1.7k |
| `docs/superpowers/INDEX.md` | 83 | ~2.5k |
| **合计** | 201 | **~6.1k** |

原本只读 journal INDEX（~2.4k 当时），现在读 3 份 ~6.1k。**新增 ~4k**。

每份 INDEX 又不是纯"标题 + 1 行摘要"，而是带 keywords / 状态 / 路径链接的元数据表。真正的 INDEX 应该更轻。

### 根因 3：@import session-rules = 永久 baseline 1.5k

`CLAUDE.md` 末尾的 `@.claude/skills/session-rules/SKILL.md` 把该 skill body 永久塞进 memory files：

- 好处：compact/resume 后运行规则仍生效
- 坏处：**1.5k 永久在 memory baseline，即使整 session 不用**

权衡问题：compact 多频繁？compact 后需要手动触发 session-init 的代价有多大？是否值 1.5k 永久烧？

### 根因 4：停车场深度扫描的规模放大

SKILL Step 2 指令："**逐条读取** journal INDEX 中每个 parked 项的**完整 journal 文件**"。

- parked 数量稳定在 ~13 条（用户明确说 parked 没变多）
- 按指令严格执行 = 读 13 个 journal 文件 ≈ 10-12k
- 今天我执行不严，只读了 4 个 ≈ 4k
- 这个指令**老早就在**，不是优化时新加。但它的成本和 parked 数量成正比，任何优化都绕不过它。

### 根因 5：我今天执行不严

- architecture.md §0 实际边界到第 52 行，我读了 80 行 = 多 1k
- 仪表盘响应 + 第二波小读取 = 多 1.5k

这部分是我的执行 bug，不是设计问题。

---

## 5. 设计 anti-pattern（必须推翻的优化原则）

1. **"文档 skill 化" ≠ 按需加载**
   skill frontmatter 永久在 available skills reminder 里，永远烧 token。真正按需 = Read 普通文件。

2. **"INDEX 化" ≠ 减少读取量**
   如果 1 份胖 INDEX 拆成 3 份瘦 INDEX，加起来没瘦就没省。真正的 INDEX 应该是"标题 + 1 行"，而不是"标题 + keywords + 状态 + 路径"。

3. **"@import" ≠ 免费持久化**
   永久 baseline 是真·永久。不管用不用都在。

4. **"深度扫描指令" ≠ 无代价的周全**
   指令和数据规模成正比。parked/journal/INDEX 增长时成本自动翻倍。

---

## 6. 用户的核心目的（不可砍的功能）

session-init 的存在价值：

1. **每次开 session 知道项目全貌**
   - 当前里程碑、已完成、下一步
   - 阻塞、风险
   - 近期完成（git log 摘要）

2. **根据记录给建议**
   - 停车场里 "触发条件到期" 的条目主动拉出
   - 停车场里 "基础设施影响" 的条目主动拉出
   - 需要决策的事列出来等用户拍板

3. **做事情时知道去哪查看**
   - 知道有哪些 specs / plans / research 存在
   - 分别是干啥的
   - 通过 keywords 匹配快速定位

**所有 fix 方案必须保留这三点**。不能用"砍功能"换 token。

---

## 7. 候选 fix 方向（下一 session 开会讨论）

> 下面只是**讨论起点**，不是最终方案。下一 session 走完整 brainstorming 流程后才定。

**方向 A：skill 反 skill 化**
- `session-rules` / `skill-catalog` / `ccb-protocol-reference` 降级为普通 md 文件
- 撤销 `CLAUDE.md` 的 `@import session-rules`
- 运行规则 merge 回 session-init SKILL，或保留为文件让 session-init 持指针
- 预计省：skills list reminder ~0.5-1k + baseline 1.5k = **~2-2.5k**
- 代价：compact 后运行规则不自动生效，需触发 session-init 才有

**方向 B：3 INDEX 合一**
- 建 `docs/INDEX.md` master index，分节 journal / specs+plans / research
- 每节每条 1 行（标题 + 路径，keywords 简化）
- session-init 只读 master INDEX
- 预计省：~3-4k
- 代价：INDEX 格式重写；新文件要同时更新主 INDEX 和子 INDEX 的判断（或彻底删子 INDEX）

**方向 C：停车场扫描降级**
- 指令改为："读 INDEX 行摘要 + keywords；命中 **触发条件到期** 或 **基础设施影响** 信号时才 Read 完整文件"
- 关键依赖：journal frontmatter 需要有 **触发条件** 字段 或 INDEX 行要有显式 tag
- 预计省：~3-4k
- 代价：漏报风险——关键字段没撞上但实际需要拉出的 parked 项

**方向 D：修我执行不严**
- architecture.md 读取硬限 `offset: 0, limit: 52`
- 仪表盘固定模板，禁止延展
- 预计省：~1.5-2k

**总计预估省：~10-13k ≈ 5-6% context**
**预期新 session /context：~27-28%**

> 注意：spec 原始目标 "≤ 10%" 不可达——baseline 14.4% 已经是死成本（system prompt 4.3% + system tools 5.7% + memory 3.2% + skills 1.2%）。现实目标应重定为 **≤25-28%**。

---

## 8. 还需讨论的权衡（下一 session 要答）

1. **@import 撤销后 compact 行为**：compact 多频繁？compact 后需要手动 `/session-init` 才有规则，这个代价可接受吗？
2. **skill-catalog 删除后 skill 发现**：Claude 怎么知道有哪些 skill、什么时候用？是否在 session-init SKILL 里列关键 skill 名？
3. **停车场扫描降级的漏报**：如何确保关键字段设计能覆盖"触发条件到期""基础设施影响"这两个维度？需要在 journal frontmatter 加字段吗？
4. **新测量基准**：fix 完后的 /context 目标值 = ?
5. **是否借这次重新审视优化里程碑的验收**：原 plan 的验收标准（≤10%、brainstorming ≤5k、compact 后跳过）现在只有"compact 后跳过"有意义。要不要重新定义？

---

## 9. 相关 artifacts

- **优化 spec**：`docs/superpowers/specs/2026-04-15-session-init-token-optimization-design.md`
- **优化 plan**：`docs/superpowers/plans/2026-04-15-session-init-token-optimization.md`
- **当前 session-init SKILL**：`.claude/skills/session-init/SKILL.md`（122 行，带 Step 0 marker 检测）
- **3 个"文档 skill"**：
  - `.claude/skills/session-rules/SKILL.md`
  - `.claude/skills/skill-catalog/SKILL.md`
  - `.claude/skills/ccb-protocol-reference/SKILL.md`
- **memory-cleanup**（保留合理，参考设计风格）：`.claude/skills/memory-cleanup/SKILL.md`
- **CLAUDE.md** 末尾的 `@import session-rules`：`CLAUDE.md` 第 111 行
- **3 个 INDEX**：`docs/journal/INDEX.md` / `docs/research/INDEX.md` / `docs/superpowers/INDEX.md`
- **settings.json hook**：`.claude/settings.json` SessionStart hook（已验证无副作用，`rm -f .ccb/session-marker`）

---

## 10. 下一 session 的 entry point

用户将 /clear 后开 fresh session。开 session 第一件事：

1. 用户会明确 reference 本文件路径
2. Claude 按本文件"Section 9 相关 artifacts"逐一 Read 相关文件
3. 走 `/brainstorming` 流程，对本文件"Section 7 候选 fix 方向"展开讨论
4. brainstorm 完成 → `/writing-plans` → 执行

---

## 变更记录

- 2026-04-18：创建（本 session 诊断产出）
