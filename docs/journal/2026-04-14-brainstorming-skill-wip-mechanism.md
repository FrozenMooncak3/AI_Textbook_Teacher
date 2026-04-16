---
date: 2026-04-14
topic: brainstorming skill加入WIP防compact机制
type: journal
status: resolved
keywords: [brainstorming, WIP, compact防御, skill改动, 状态存档]
---

# brainstorming skill 加入 WIP 防 compact 机制

**日期**：2026-04-14
**类型**：skill 改动 / 工程流程
**状态**：parked (T1)
**优先级**：**最最优先**——本次 brainstorm（教学系统设计）结束后立即处理，不等到下个里程碑

---

## 问题

当前 brainstorming skill（`.claude/skills/brainstorming/SKILL.md`）**没有** compact 防御机制：
- grep "WIP | brainstorm-state | compact | state file" 整个 skill 目录，无匹配
- skill 的流程是：explore context → questions → approaches → design → spec 文件 → review loop
- spec 文件是**最终产物**，不是**进行中状态存档**

## 为什么需要

本次教学系统 brainstorm（2026-04-12 启动，10 个决策）遇到的实际痛点：
1. context 接近上限时会触发 compact
2. summary 会丢细节（尤其已拍死的具体条款、子决策的推理路径）
3. 单个大 brainstorm 长度远超 context 窗口，必须跨 session 进行

**临时方案**：这次 brainstorm 创建了 `docs/superpowers/specs/2026-04-12-teaching-system-brainstorm-state.md` 作为 WIP 状态文件，每拍一个决策就更新。compact 后恢复时**先读 WIP 文件**，不从 summary 重建。

这个机制有效，但是：
- 临时发明，没写进 skill
- 下次做其他 brainstorm 时我又会忘，又要临时重建一遍
- 不是系统能力，是"我这次记得做了"

## 要加什么

brainstorming skill 应该包含：

### 1. 判断规则

什么时候需要开 WIP 文件：
- **必须开**：决策数 ≥ 5，或者预计总 context 超过 50%，或者跨 session
- **不用开**：单个简单 brainstorm（<5 个决策，预计一两轮对话搞定）

判断时机：开场 explore context 后，估算完再决定。

### 2. WIP 文件模板

路径：`docs/superpowers/specs/YYYY-MM-DD-<topic>-brainstorm-state.md`
（和最终 spec 同目录，名称加 `-brainstorm-state` 后缀；完成后可删或归档）

结构：
- 基础设定（产品定位、不会变的铁律）
- 调研（全部完成的调研文件列表）
- 已拍死的决策（每决策一个小节，带日期 + 完整 detail）
- 待 brainstorm 的决策（按依赖顺序）
- 当前进度
- 最终产出（说明 brainstorm 完成后转成什么 spec）

### 3. 运行规则

- **每拍一个决策**：立即更新 WIP 文件（不等 session 结束）
- **每次 session 开始**：先读 WIP 文件，不从 summary 重建
- **compact 后恢复**：第一动作是读 WIP 文件
- **memory 指针**：在 `MEMORY.md` 加 `project_<topic>-brainstorm-wip.md` 指针，指到 WIP 文件位置

### 4. 最终 spec 生成

brainstorm 全部拍完后：
- 把 WIP 文件转成正式 design spec（`docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md`）
- 可选：删除 WIP 文件（信息已迁移）或保留作为历史
- 删除 memory 指针

## 实施方式

改 `.claude/skills/brainstorming/SKILL.md`：
- 在 "Process Flow" 之前加 "WIP State File Protocol" 小节
- 在 checklist 里增加 step：开场后判断是否需要开 WIP 文件
- 在 "Key Principles" 里加一条：大型 brainstorm 必须开 WIP 状态文件

可能也要改 `session-init` skill，增加一条"检测到 brainstorm WIP 文件存在时自动加载"的规则——但这个放到实际做的时候再判断。

## 触发条件

**本次教学系统 brainstorm 结束时**（转 design spec 完成后），立即处理这个 skill 改动。不要等到下个里程碑。

理由：
- 下一个大 brainstorm（M4 详细设计 / M5 详细设计）会紧接着来
- 没有 skill 化，我又会忘一次
- 改 skill 本身工作量小（加一两个小节 + 判断规则），半小时内完成
