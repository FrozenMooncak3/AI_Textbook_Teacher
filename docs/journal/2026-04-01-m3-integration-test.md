# M3 集成测试进度

**类型**: progress
**状态**: blocked
**日期**: 2026-04-01

## 已完成

M3 全部 9 个 Task 代码完成并 push：
- Codex batch 1 (T1+T2+T4): schema migration, test generate API, test status API
- Codex batch 2 (T3+T5+T6): test submit API, mistakes rewrite, delete old routes
- Gemini (T7+T8): test page, TestSession, mistakes page
- Claude review fixes: pass_rate bug, TypeScript any, empty AI 评价, answer layout, prompt KP codes
- Claude (T9): API_CONTRACT.md, project_status.md, changelog.md

Commits: f19ef8e → 137a892 (8 commits on master)

## 当前阻塞：AI 调用在 Next.js 内超时

**症状**：POST /api/modules/5/test/generate 返回 500（超时 64-74s）
**根因**：Next.js dev server 进程内的 AI 调用无法通过代理连接 Google API
**已排除**：
- 代理本身可用（curl 通过代理连 Google API 返回 404 = 连通）
- Node.js 直接调用可用（node -e + loadEnvFile + undici ProxyAgent → 成功）
- ai.ts 的 getCustomFetch() 逻辑正确（读 HTTPS_PROXY → undici ProxyAgent）
- 尝试过 lazy fetch 方案，无效已 revert

**猜测**：Next.js Turbopack dev server 的环境变量注入时机问题。.env.local 中的 HTTPS_PROXY 可能没被 Next.js 传递给 server runtime 的 process.env（或在 ai.ts 模块初始化时还不可用）。即使通过 shell 环境变量 `HTTPS_PROXY=... npm run dev` 启动也未生效。

**下一步排查方向**：
1. 在 API route 内部加 console.log(process.env.HTTPS_PROXY) 看运行时是否有值
2. 检查 Next.js 16 / Turbopack 是否有已知的 env 传递问题
3. 考虑在 next.config.ts 里用 env 配置显式传递
4. 或者临时切换回 Anthropic API（本地有 key）看是否是 Google 特有问题

## UI/UX 已修复的问题（commit 137a892）

1. 答对的题不再显示空的"AI 评价："
2. 正确答案改为全宽纵向排列 + whitespace-pre-wrap
3. Prompt 模板禁止 KP 编号出现在用户可见文本中
4. Generate route 允许 completed 状态重测

## UI/UX 待修复（用户反馈，需 AI 调用修复后验证）

1. KP 编号仍出现在 AI 输出中 — prompt 已改，需重新生成试卷验证
2. correct_answer 仍用 Markdown 格式 — prompt 已改，需验证
3. 用户希望 KP 能点击跳转到具体内容 — park，未来功能
