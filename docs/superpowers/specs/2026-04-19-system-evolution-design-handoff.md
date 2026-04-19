# 系统进化 · 系统设计 Brainstorm 启动指令（Handoff）

**创建日期**: 2026-04-19
**用途**: 给下一个 session 的冷启动交接。用户会 `/clear` 后让新 session 读这个文件。
**你（新 session 的 Claude）要做的事**：启动 `brainstorming` skill，做系统进化机制的**系统设计**（方案 A）。

---

## 你的任务一句话

上一轮调研已经完成（2026-04-19 落盘）。现在要把调研结论里的 5 维 × N 个机制**挑出适合我们的、排优先级、拆里程碑**，产出系统设计 spec。

**不是**执行。只是设计。执行靠后续 writing-plans → task-execution。

---

## 必读清单（按顺序读）

### 1. 核心输入（必全文读）

| 文件 | 为什么读 |
|---|---|
| `docs/research/2026-04-19-system-evolution-survey.md` | **本次设计的唯一真相源**。57KB，5 维发现 + synthesis + 推荐机制 |
| `docs/superpowers/specs/2026-04-18-system-evolution-research-design.md` | 上一轮调研的 spec。明确本轮是**方案 A** — 新开 brainstorm 做系统设计 |
| `docs/superpowers/specs/2026-04-18-system-evolution-research-brainstorm-state.md` | 上一轮 brainstorm 的 WIP，6 个决策的推理链。**不要从 summary 重建，读原文** |

### 2. brainstorming skill 默认必读（按其 mandatory 清单）

- `docs/architecture.md` §0 摘要卡（设计不能违反产品不变量）
- `docs/project_status.md`（hook 已注入 system prompt，可能不用再读）
- `docs/journal/INDEX.md` parked 段（检查有没有相关想法应该拉出）
- `docs/superpowers/INDEX.md`（看之前的 spec）
- `docs/research/INDEX.md`（除了今天的 survey，其他调研有没有相关的）
- `CLAUDE.md`（产品不变量 + 文件边界 + CCB 协议）

### 3. 已经对应的当前系统状态（按需读）

| 文件 | 什么时候读 |
|---|---|
| `.claude/skills/*/SKILL.md`（23 个） | 设计 skill 相关机制时（B/E 维度） |
| `.claude/settings.json` SessionStart/PreCompact hook | 设计 hook 机制时（C 维度） |
| `CLAUDE.md` 里的 `@import` | 设计 session-rules 相关机制时 |
| `MEMORY.md`（user 的 auto-memory 索引） | 设计记忆相关机制时（A 维度） |

---

## 上一轮调研的 5 条结论（survey §顶部合成）

1. **A 记忆**：架构方向对（对齐 Anthropic "按需读"）；短板是**手动整理**。
2. **B 技能**：手工派主张对（Anthropic + obra）；短板是**没有 TDD 验证**，写了不知道真管用。
3. **C 事件捕获**：最大红利区。Claude Code 给了 24 种免费 hook，我们只接了 2 种。
4. **D 工作流**：CCB 串行方向对；短板是 **review loop 终止太主观** + **retry 无硬 cap**。
5. **E 自我诊断**：完全空白。但最便宜补（因为信号源和工具都现成）。

## Survey 的 3 档路径（不要直接抄，要用 brainstorm 重新评估）

| 档 | 动作 | 风险 |
|---|---|---|
| **低成本**（1-2 天） | 1% 强触发语 / PostToolUseFailure hook / "同问题 ≥2 次"计数 | 低 |
| **中成本**（1-2 周） | sleep-time agent / condenser / skill-audit / review loop 外化 | 中 |
| **高成本**（1 月+） | GEPA 自动生成 skill / 向量记忆 | 高，**survey 明确不推荐现阶段** |

---

## Brainstorm 要锁定的决策（初步，可调整）

按 brainstorming skill 流程走，但预期会有以下关键决策：

1. **Scope 决策**：这轮只做"低成本"？还是带"中成本"？"高成本"应该明确砍掉吗？
2. **优先级排序**：5 维 × N 机制里，哪几个**必做 T1**（当前里程碑做），哪些 T2（下里程碑评估），哪些 T3（MVP 后）？
3. **里程碑挂靠**：T1 的机制挂到哪？新开一个"系统进化"里程碑？还是分散塞进云部署 Phase 2 / M4 教学系统？
4. **成功度量**：每个采纳的机制，"做对了"的可观测信号是什么？（避免 E 维度警告的"改了但不知道有没有用"）
5. **回滚策略**：每个新机制如果不 work，怎么关闭？（survey Q5 强调"选错的代价"）
6. **与现有 skill/hook 的兼容**：采纳的机制会不会和 session-init F.3 刚改完的结构打架？

---

## 硬约束（不能违反）

1. **MVP 烧钱敏感**：多 agent 并行会烧 15× token（Anthropic 数据），某些 🟢 任务让 Claude 直接做可能比走 CCB 更省。brainstorm 要权衡。
2. **产品不变量不变**：CLAUDE.md 5 条产品不变量（必读原文 / Q&A 不可改 / 测试禁笔记 / 80% 过关 / 一次一题）不能被系统进化机制绕过。
3. **文件边界不变**：Claude 只写 `docs/**` + `.claude/skills/**` + `CLAUDE.md`。src/ 代码仍然靠 CCB 派给 Codex/Gemini。
4. **survey 警告必须遵守**：
   - 不让 Claude 自评派发效果（ECE 77%）
   - 不抄 Hermes GEPA 自动生成 skill（现阶段）
   - retry 必须有硬 cap（$47,000 案例）
   - max_iteration 必须真 check（OpenHands #6857）

---

## 产出（brainstorm 完成时应该有的东西）

1. **系统设计 spec**：`docs/superpowers/specs/YYYY-MM-DD-system-evolution-design.md`
   - 采纳的 N 个机制清单（带优先级 + 里程碑挂靠）
   - 每个机制的"怎么做 + 成功信号 + 回滚方案"
   - 被否决的机制清单 + 否决理由（避免未来反复讨论）
2. **WIP brainstorm state 文件**（如果决策数 ≥5，brainstorming skill 要求开）：`docs/superpowers/specs/YYYY-MM-DD-system-evolution-design-brainstorm-state.md`
3. **superpowers/INDEX.md** 追加两行
4. **project_status.md** 反映新里程碑或新决策（如果产生新里程碑）

---

## 下游（你这轮完成后会发生什么）

- spec 完成 → user 审阅 → writing-plans skill → 每个机制拆 tasks
- tasks 可能分派给 Codex（若涉及 src/ 或 scripts/）或 Claude 自己写（若纯 .md / skill / hook 配置）
- 参考 CCB 规则 4：当前阶段直接在 master 上开发，worktree 可选

---

## 启动步骤（按顺序）

1. 读本文件（handoff）
2. 读 survey（57KB，慢慢过）
3. 读前一轮 brainstorm WIP（决策推理链）
4. 读 architecture.md §0 摘要卡 + CLAUDE.md
5. 扫 journal INDEX parked 段 + superpowers INDEX（若有相关未展开的）
6. **调用 brainstorming skill 开始**。记得 skill 要求：
   - WIP 文件必开（预期决策数 ≥5）
   - 7a skeleton 立刻写
   - 7b 每锁一个决策立刻追加 spec + 更新 WIP
   - 7c 收尾做完整性检查
   - 7d 更新 superpowers/INDEX.md

---

## 用户画像提醒

- **非技术 CEO**：用生活类比，不堆术语。survey 的每个发现都带了类比——照学。
- **喜欢自主执行**：不要每一步都问"这样对吗"。lock 决策时确认一次即可。
- **MVP 阶段烧钱敏感**：任何"中/高成本"建议必须给出 ROI 和回滚路径。
- **讨厌变成中间人**：你判断好就直接推进；用户觉得不对会打断你。
