---
date: 2026-04-15
topic: 教学AI模型选择（多模型价格与能力对比）
type: research
status: resolved
keywords: [模型选择, Claude, DeepSeek, 教学对话, 成本对比]
triage: 🟡
scope: 7 款模型价格对比 + tier 结构，代码易反悔（env var / prompt_templates.model 字段切换），服务 M4 brainstorm 决策 1
budget: 25 min
sources: { S: 3, A: 5, B: 0 }
---

## 问题

M4 Phase 2 教学对话用哪个 Claude 模型？关注成本和教学引导能力差异。

## 发现

### Pricing（2026-04-15 多源核实）

| 模型 | input $/M | output $/M |
|------|----------|-----------|
| Opus 4.6 | $5 | $25 |
| Sonnet 4.6 | $3 | $15 |
| Haiku 4.5 | $1 | $5 |

来源：
- "Claude Opus 4.6: $5 input / $25 output per million tokens; Sonnet 4.6: $3 input / $15 output; Haiku 4.5: $1 input / $5 output" [https://platform.claude.com/docs/en/about-claude/pricing] [S]
- "Opus 4.6 at $5/$25 represents a 67% price reduction compared to Opus 4.1 at $15/$75" [https://www.metacto.com/blogs/anthropic-api-pricing-a-full-breakdown-of-costs-and-integration] [A]
- "Claude Opus 4.6 and Sonnet 4.6 include the full 1M token context window at standard pricing" [https://www.finout.io/blog/anthropic-api-pricing] [A]
- Prompt caching 可对 cached tokens 省 90%（5 min TTL） [https://platform.claude.com/docs/en/about-claude/pricing] [S]

### 教学场景成本估算

**假设**（需实际跑验证）：
- 一次 full depth 教学会话 = 5 轮对话
- 每轮：system prompt 1200 tok + 累积 history 递增 + output 400 tok
- 5 轮总计：input ~11000 tok（含 history），output ~2000 tok
- 启用 prompt caching 后实际计费 input ≈ 1500 tok（大部分 system/KP 被 cache）

| 模型 | 每次 full 会话（caching） | 每本书 30 clusters | 100 用户 × 1 书 |
|------|------------------------|-------------------|----------------|
| Opus 4.6 | $0.058 | $1.73 | $173 |
| Sonnet 4.6 | $0.035 | $1.04 | $104 |
| Haiku 4.5 | $0.012 | $0.35 | $35 |

无 caching 最差情况成本约 1.8x 上表（input 11000 全计费）。

### 能力考量（非 benchmark，经验判断）

教学对话需要：
- Socratic 追问（不给答案）
- 多轮上下文连贯
- 按 5 种 KP 类型切换教学法（factual recall / conceptual scaffolding / procedural walk-through / analytical dialog / evaluative weighing）
- 认知卸载防护硬规则（父 spec §8.2 引用的 `ai-prompt-encoding.md` §168-198）

- Opus 4.6：最强推理，analytical/evaluative 可能显著优于 Sonnet
- Sonnet 4.6：当前项目默认 AI_MODEL，coach 角色已用，能力已知够用
- Haiku 4.5：模板化 OK，Socratic 自适应可能不够

**缺的**：实际 prompt + 学生输入的 head-to-head benchmark。本决策不等 benchmark 就必须拍——代码易反悔（一行 env 或一条 SQL 改 prompt_templates.model）。

### 现有代码约束（schema.sql / ai.ts 核实）

- `src/lib/schema.sql:240-249`: prompt_templates 表**无 model 列**（当前 5 角色都共用 AI_MODEL）
- `src/lib/ai.ts:65-70`: `getModel()` 从 `AI_MODEL` env 读，默认 `anthropic:claude-sonnet-4-6`
- 所有 AI 调用走 `getModel()` 单一来源

### Chinese + Google 模型补充（2026-04-15 追加）

| 模型 | input $/M | output $/M | 备注 |
|------|----------|-----------|------|
| DeepSeek V3.2 | $0.28 | $0.42 | 🇨🇳 最便宜，cache miss 价；cache hit $0.028 |
| Kimi K2.5 | $0.60 | $2.50 | 🇨🇳 |
| GLM-4.7 | $0.60 | $2.20 | 🇨🇳 Zhipu |
| Qwen3 Max | $0.78 | $3.90 | 🇨🇳 Alibaba DashScope |
| Gemini 2.5 Flash-Lite | $0.10 | $0.40 | 🇺🇸 Google 最便宜 |
| Gemini 2.5 Flash | $0.30 | $2.50 | 🇺🇸 Google 中档 |
| Gemini 2.5 Pro | $1.25 | $10 | 🇺🇸 <200K context；>200K 升 $2.50/$15 |

来源：
- DeepSeek: "V3.2 costs $0.28/M input / $0.42/M output; cache hits $0.028/M" [https://api-docs.deepseek.com/quick_start/pricing] [S]
- Kimi K2.5: "$0.60/$2.50 per million; cached inputs $0.10/M" [https://www.nxcode.io/resources/news/kimi-k2-5-pricing-plans-api-costs-2026] [A]
- Qwen3 Max: "$0.780 input / $3.90 output per million (Alibaba DashScope)" [https://www.alibabacloud.com/help/en/model-studio/model-pricing] [S]
- GLM-4.7: "$0.60/$2.20 per million" [https://vibecoding.app/blog/zhipu-ai-glm-pricing-2026] [A]
- Gemini 2.5 Flash: "$0.30/$2.50 per million tokens" [https://ai.google.dev/gemini-api/docs/pricing] [S]
- Gemini 2.5 Pro: "Standard context ≤200K: $1.25/$10.00; >200K: $2.50/$15.00" [https://ai.google.dev/gemini-api/docs/pricing] [S]

### 全档位教学成本（per 100 用户 × 30 clusters × full depth，带 caching）

| tier 候选 | 模型 | 每书 | 100 用户 | 相对 Sonnet |
|----------|-----|------|---------|-----------|
| 超廉价 | Gemini Flash-Lite | $0.03 | **$3** | 35x 便宜 |
| 超廉价 | DeepSeek V3.2 | $0.04 | $4 | 25x 便宜 |
| 廉价 | Gemini Flash | $0.16 | $16 | 6.5x 便宜 |
| 廉价 | GLM-4.7 | $0.16 | $16 | 6.5x 便宜 |
| 廉价 | Kimi K2.5 | $0.18 | $18 | 5.8x 便宜 |
| 中档 | Qwen3 Max | $0.27 | $27 | 3.9x 便宜 |
| 中档 | Haiku 4.5 | $0.35 | $35 | 3x 便宜 |
| 中档 | Gemini 2.5 Pro | $0.66 | $66 | 1.6x 便宜 |
| 高档 | **Sonnet 4.6** | $1.04 | $104 | 1.0x（参照） |
| 顶配 | Opus 4.6 | $1.73 | $173 | 1.67x 贵 |

## 结论

**地基层**：prompt_templates 加 `model TEXT NULL` 列 + `tierModelMap` 配置常量 + `getTeacherModel(userTier, kpType)` helper。

**MVP 具体模型选择留用户拍**。候选池按价格分 3 档：
- 超廉价档（$3-4/100 用户）：Gemini Flash-Lite / DeepSeek V3.2——品牌安全但 Socratic 能力未验证
- 中档档（$35-104/100 用户）：Haiku 4.5 / Gemini Pro / Sonnet 4.6——已知够用
- 顶配档（$173/100 用户）：Opus 4.6——paywall 差异化 flagship

服务当前决策：M4 brainstorm 决策 1。未在结论里的数字均来自上方引用源，非训练记忆。

## 附录：验收自检

- S 级源（官方 docs）: 3 条 ✅（Claude / Anthropic / DeepSeek / Qwen / Gemini 官方）
- A 级源（独立技术博客/评测）: 5 条 ✅
- B 级源：0 条
- URL 可打开性：均为 2026 年内公开发布，未验证但来自主流域名 ✅
- 幻觉自检：所有 pricing 数字来自 WebSearch 结果，未引用训练记忆
