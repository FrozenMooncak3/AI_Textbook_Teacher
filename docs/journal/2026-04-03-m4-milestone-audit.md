---
date: 2026-04-03
topic: M4里程碑审计：architecture.md验证
type: journal
status: resolved
keywords: [M4, 里程碑审计, architecture, 复习系统, 接口契约]
---

# M4 Milestone Audit — architecture.md 验证

**日期**：2026-04-03
**类型**：audit
**状态**：resolved

---

## 审计范围

M4 复习系统涉及的变动类别：
- API 组（新增 review/ 端点）
- DB 表（新增 4 张复习表）
- AI 角色（新增复习官）
- 学习状态流（testing → completed 触发复习调度）
- 接口契约（测试→复习、复习系统内部）

## 审计结果

### 已验证一致（5/6 类别）

| 类别 | 结果 |
|------|------|
| 页面 | 一致——`/review?scheduleId=X` 已记录 |
| API 组 | 一致——`review/due`、`review/[scheduleId]/generate,respond,complete` 已记录 |
| DB 表 | 一致——review_schedule, review_records, review_questions, review_responses 4 张表已记录 |
| AI 角色 | 一致——复习官 (reviewer) 已记录，职责描述准确 |
| 学习状态流 | 一致——`unstarted → reading → qa → notes_generated → testing → completed` 已记录 |

### 发现 1 个缺漏

**接口契约 — 错题流转 error_type 约束未文档化**

- mistakes.error_type 只允许 4 个值：`blind_spot / procedural / confusion / careless`
- `review/respond` 使用 `normalizeReviewErrorType()` 做模糊归一化（M4 bug fix）
- `test/submit` 只做空值兜底（`?? 'blind_spot'`），未归一化

**严重度**：⚠️（已知风险，非阻塞）——examiner AI 返回非标准值时 test/submit 会直接入库

### 修复动作

已在 architecture.md 错题流转 section 补充 error_type 约束 + ⚠️ 标记。

## 结论

architecture.md 与 M4 代码基本一致，1 处缺漏已补全。M4 收尾完成，可进入 M5 brainstorming。
