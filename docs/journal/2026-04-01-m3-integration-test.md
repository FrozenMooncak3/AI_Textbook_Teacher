# M3 集成测试进度

**类型**: progress
**状态**: resolved
**日期**: 2026-04-01

## 已完成

M3 全部 9 个 Task 代码完成并 push：
- Codex batch 1 (T1+T2+T4): schema migration, test generate API, test status API
- Codex batch 2 (T3+T5+T6): test submit API, mistakes rewrite, delete old routes
- Gemini (T7+T8): test page, TestSession, mistakes page
- Claude review fixes: pass_rate bug, TypeScript any, empty AI 评价, answer layout, prompt KP codes
- Claude (T9): API_CONTRACT.md, project_status.md, changelog.md

Commits: f19ef8e → 137a892 (8 commits on master)

## 阻塞已解决（commit deb82c5）

4 层修复：

1. **Turbopack 打包破坏原生模块** → `next.config.ts` 添加 `serverExternalPackages`（undici + AI SDK 全链）
2. **undici Response 流式不兼容** → `ai.ts` fetch wrapper 改为 `arrayBuffer()` 一次性读取 + 全局 `Response` 重包装
3. **thinking tokens 挤占输出空间** → `maxOutputTokens` 16384 → 65536（Gemini 2.5 Flash thinking tokens 算在 output budget 内）
4. **AI 返回 JSON 格式不可靠** → 剥离 markdown 代码块 + 字符串内控制字符消毒（状态机） + 单题验证失败跳过而非整体失败

### 教训（retrospective 2026-04-01）

前 3 次修复全是盲猜，没有先加诊断日志看实际错误。如果第 1 步就 log `text.length` + `finishReason`，2 轮内就能找到根因。已写入 memory 和 session-init 触发规则：**同一问题修复失败 ≥2 次 → 强制走 systematic-debugging**。

## UI/UX 已修复的问题（commit 137a892）

1. 答对的题不再显示空的"AI 评价："
2. 正确答案改为全宽纵向排列 + whitespace-pre-wrap
3. Prompt 模板禁止 KP 编号出现在用户可见文本中
4. Generate route 允许 completed 状态重测

## 已知质量问题（非阻塞，待后续修复）

1. 题目顺序：思考题在前选择题在后，应按难度从简到难排序
2. MD 格式泄露：AI 生成的文本含 `**加粗**` 等 markdown 标记，前端未渲染（归入 M5-T4）
