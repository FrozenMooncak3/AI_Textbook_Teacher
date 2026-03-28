---
name: using-superpowers
description: 每次 session 开始必读——建立 skill 使用规则，任何动作前先查 skill
---

# Using Skills

## 核心规则

**任何动作前，先查是否有 skill 适用。** 哪怕只有 1% 的可能性，也必须先激活 skill 再行动。

这不是建议，是规则。不可协商，不可跳过。

## 优先级

1. **用户指令**（AGENTS.md、直接请求）— 最高优先
2. **Skill 规则** — 覆盖默认行为
3. **默认行为** — 最低优先

如果 AGENTS.md 说"不用 TDD"而 skill 说"必须 TDD"，听 AGENTS.md。

## Trigger Table

收到任务后，对照此表激活 skill：

| 触发条件 | 激活 skill |
|----------|-----------|
| 写 API route | $api-design, $api-contract |
| 改 database / schema / migration | $database-migrations |
| 修 bug / 排错 / 意外行为 | $systematic-debugging |
| 写新功能（任何） | $test-driven-development |
| 声称完成 / 准备 commit / 提交代码 | $verification-before-completion |
| OCR / PaddleOCR / 截图相关问题 | $debug-ocr |
| 任何代码编写 | $coding-standards |
| 涉及 auth / input validation / secrets / API 安全 | $security-review |

**多个条件同时满足时，全部激活。** 例如"写一个新的 API route"→ 激活 $api-design + $api-contract + $test-driven-development + $coding-standards。

## 红旗检查

这些想法意味着你在找借口跳过 skill，停下来：

| 想法 | 现实 |
|------|------|
| "这只是个简单任务" | 简单任务也有 skill。查表。 |
| "我先看看代码" | Skill 告诉你怎么看。先查 skill。 |
| "这不需要正式的 skill" | 如果 skill 存在，用它。 |
| "我记得这个 skill 的内容" | Skill 会更新。读当前版本。 |
| "先做完这一步再说" | 动作前查 skill，不是动作后。 |

## Skill 类型

**刚性 skill**（TDD、debugging）：严格遵循，不可变通。
**柔性 skill**（patterns）：原则不变，细节可调。

Skill 本身会说明自己是哪种。
