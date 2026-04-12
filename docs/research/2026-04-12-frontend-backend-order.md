# 调研：前后端开发顺序策略

**调研日期**: 2026-04-12
**用途**: CCB 派发策略优化——是否需要改变"先后端后前端"的顺序

---

## 结论：当前顺序基本正确，不需要反转

**"先前端"的逻辑**：AI agent 生成前端代码有可视化结果可以立即验证；前端确定后 API 格式被"锁定"，后端任务更明确。适用于需求不确定、快速原型阶段。

**不适用于我们的原因**：
- 我们的 spec 已经很详细（不是"需求不确定"场景），"先前端"的快速验证优势不成立
- 后端涉及 AI 调用、PDF OCR、数据库操作，复杂度高且接口格式容易变，前端先做大概率返工
- Gemini 写前端时如果后端 API 已就绪，可以直接集成测试，减少 mock 成本

## 可优化的点

1. **Spec 中定义 TypeScript 接口契约**（请求/响应类型），让前后端基于同一份类型定义开发
2. **纯 UI 改版（不涉及新 API）可以并行派发**，不必串行等待后端
3. **Contract-first 是业界主流**（2024-2025）：先定义 API 契约，两端基于契约独立开发

## 前沿趋势（2024-2025）

- **API-first / Contract-first**：OpenAPI 或 TypeScript 类型作为契约。tRPC 在 Next.js 生态流行
- **BFF 模式**：Next.js App Router 的 Server Components + Route Handlers 本身就是 BFF
- **Server Components 模糊边界**：RSC 让前端代码直接查数据库，传统前后端分界线在模糊化

## 对 CCB 派发策略的建议

维持现有顺序：Claude 写 spec → Codex 做后端 → Gemini 做前端。唯一改进：spec 中增加 TypeScript 接口类型定义，减少前后端对接返工。
