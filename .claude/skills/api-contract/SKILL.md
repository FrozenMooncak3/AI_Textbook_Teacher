---
description: 新增或修改 API 接口时，更新 .agents/API_CONTRACT.md
globs: src/app/api/**/*.ts
alwaysApply: false
---

# API Contract

## 何时使用
- 新增 API 端点
- 修改现有 API 的请求/响应格式
- 前端需要对接新接口

## 更新规范

### 新增接口时，必须在 API_CONTRACT.md 中添加

1. **HTTP 方法 + 路径**：如 `GET /api/books/[bookId]/conversations`
2. **Request Body**（如有）：JSON 格式，含字段类型
3. **Response 200**：JSON 格式，含字段类型
4. **错误响应**：遵循统一错误格式 `{ "error": "描述", "code": "ERROR_CODE" }`

### 格式模板

参考 `.agents/API_CONTRACT.md` 中已有接口的格式，保持一致。

### 变更记录

在 API_CONTRACT.md 底部的"变更记录"区追加一条：
`[日期] [Codex/Gemini] 新增/修改了什么接口`

## 通知流程
- Codex 新增接口后 → Claude 通过 /ask gemini 通知前端
- Gemini 发现需要新接口 → Claude 通过 /ask codex 委派后端实现
