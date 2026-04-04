# 执行任务 Skill 设计

**类型**: idea
**状态**: parked
**日期**: 2026-04-04

## 问题

当前 dispatch chain 有 skill 管控（structured-dispatch → 等完成 → requesting-code-review），但：
1. review 环节没有标准化"双层 review"（subagent 查硬伤 + Claude 查品质）
2. fix 派发 → 再 review 的循环没有固化
3. 多任务执行时的任务状态跟踪靠手动
4. 容易漏步骤（比如忘了更新 project_status、忘了跑 claudemd-check）

## 想法

创建一个 `task-execution` skill，覆盖从 dispatch 到任务关闭的完整流程：

```
dispatch → 等完成报告 → 双层 review（subagent + Claude）
    → 有问题 → 派修复 → 再 review（循环，max 3 轮）
    → 通过 → 更新任务状态 → 检查下一个任务依赖 → 自动派发
```

### 双层 Review 标准化

| 层 | 负责 | 检查维度 |
|----|------|---------|
| Subagent | 硬伤 | spec 一致性、API 接口、类型错误、漏改文件 |
| Claude | 品质 | 设计意图、交互质量、用户体验、产品标准 |

### 与现有 skill 的关系

- 替代/增强 `requesting-code-review`（目前只是个 checklist，没有 subagent）
- 整合到 Dispatch Chain：structured-dispatch → **task-execution** → claudemd-check
- executing-plans 用于 Claude 自己执行的任务，task-execution 用于 CCB 派发的任务

## 评估

- 优先级高：每个里程碑都会用到，M5.5 就有 7 个任务要走这个流程
- 复杂度中等：主要是流程编排，不是技术难题
- 可逆性：容易反悔，skill 随时可改

## 调研方向（2026-04-04 用户补充）

1. **项目管理执行方法论**：本质上是 human-in-the-loop CI pipeline（stage → gate → stage），可参考 CI/CD 编排模式
2. **现有 skill 生态**：找现成的 task runner / execution loop 类 skill 参考，避免从零设计
3. **瓶颈分析**：唯一无法自动化的是"等待完成"（需用户通知），其余步骤（dispatch 生成、review 触发、fix 派发、下一任务）全部可 skill 化

## 处置

parked T1（用户标注 T0 级优先）。M5.5 本身就是最好的试验场——7 个任务正在走 dispatch → review 流程，做完后总结经验 + 调研 PM 方法论 + 找参考 skill，然后正式 brainstorm。
