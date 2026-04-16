---
date: 2026-04-03
topic: M5功能补完里程碑审计通过
type: journal
status: resolved
keywords: [M5, 里程碑审计, 功能补完, 页面路由, API端点]
---

# M5 Milestone Audit

**日期**：2026-04-03
**状态**：done
**类型**：audit

---

## 审计范围

M5 功能补完里程碑，共 9 个任务（T1-T9），跨 Codex/Gemini 协作完成。

### 改动文件分类

| 类别 | 改动数 |
|------|--------|
| 页面路由 | 2 新建 + 8 修改 |
| API 端点 | 3 新建 + 2 修改 |
| DB schema | 3 列新增（mistakes 表） |
| AI 模板 | 1 修复（assistant/screenshot_qa） |
| 前端组件 | 1 新建（AIResponse）+ 1 删除（MarkdownRenderer） |
| 工具库 | 1 新建（screenshot-ocr.ts） |

## 审计结果

### ✅ 契约确认有效

- **提取→学习**：KP 体系不变
- **学习→测试**：状态流不变
- **测试→复习**：触发逻辑不变
- **复习系统**：调度/出题/完成流程不变
- **DB 表结构**：21 张表确认，mistakes 新增 3 列已文档化

### ✅ 新增契约已文档化

- **截图问 AI（M5 改造）**：两步流程、screenshot-ocr/screenshot-ask API 响应格式
- **仪表盘与书级错题（M5）**：dashboard/mistakes API 响应格式 + 筛选参数
- **AI 文本渲染（M5）**：AIResponse 组件覆盖范围

### ⚠️ 标记状态

- **保留**：test/submit error_type `?? 'blind_spot'` 未归一化（非 M5 范围，M4 遗留）
- **无新增 ⚠️**

### 页面路由

| 代码实际 | architecture.md | 状态 |
|----------|----------------|------|
| `/books/[bookId]/dashboard` | ✅ 已记录 | 一致 |
| `/books/[bookId]/mistakes` | ✅ 已记录 | 一致 |
| 其他 11 条路由 | ✅ 无变化 | 一致 |

### API 端点

| 代码实际 | architecture.md | 状态 |
|----------|----------------|------|
| `books/[bookId]/screenshot-ocr` | ✅ 已记录 | 一致 |
| `books/[bookId]/dashboard` | ✅ 已记录 | 一致 |
| `books/[bookId]/mistakes` | ✅ 已记录 | 一致 |
| 其他 API | ✅ 无变化 | 一致 |

## 下个里程碑注意事项

- M5.5 如实现导航 sidebar，需更新页面路由树（layout 层级可能变化）
- test/submit error_type ⚠️ 建议在 M5.5 或更早修复
