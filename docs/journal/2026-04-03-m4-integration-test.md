# M4 集成测试 — 2 个 Bug

**类型**: bug
**状态**: open — 代码已修复（f54baf0），待集成测试验证
**日期**: 2026-04-03

## 背景

M4 复习系统代码全部完成并合并到 master。集成测试时发现 2 个 bug，均与 AI 调用相关。

## Bug 1：复习出题数量不足（只出了 2 题，应出 6 题）

**现象**：3 个 cluster 各 P=2，应生成 6 题（每 cluster 2 题），实际只保存了 2 题。

**根因**：AI 生成了 6 题，但验证器跳过了 4 题。日志显示 "Question N must have null options" — 非选择题（c2_evaluation 等）的 `options` 字段被 AI 返回为非 null，触发了验证器的严格校验。

**修复方向**：
- 选项 A：放宽验证 — 非选择题的 options 为非 null 时自动置 null，而非跳过整题
- 选项 B：在 prompt 中更明确要求非选择题 options 必须为 null
- 推荐 A+B 双管齐下

**位置**：`src/app/api/review/[scheduleId]/generate/route.ts` 中的 `validateGeneratedQuestion()` 函数

## Bug 2：复习评分 AI 响应截断（respond 端点 500）

**现象**：提交答案后 AI 评分失败，返回"服务暂时不可用"。

**根因**：与 M3 同类问题 — `maxOutputTokens: 1024` 对 Gemini Flash 不够（thinking tokens 算在 output budget 内），JSON 响应被截断。

**修复方向**：`respond/route.ts` 第 212 行 `maxOutputTokens: 1024` → `8192`（评分任务不需要 65536 那么大，但 1024 明显不够）

**位置**：`src/app/api/review/[scheduleId]/respond/route.ts:212`

## 历史教训

这是第 4 次遇到 Gemini Flash thinking tokens 挤占 output budget 的问题：
- M2 generate-questions: 4096 → 16384
- M2 generate-notes: 4096 → 16384
- M3 test/generate: 16384 → 65536
- M4 review/generate: 4096 → 65536（已修复，commit 1e676e4）
- M4 review/respond: 1024 → 待修复

**建议**：建立 Codex 编码规范 — 所有 AI 调用 `maxOutputTokens` 最低 8192，生成类任务 65536。
