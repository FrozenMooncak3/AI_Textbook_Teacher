---
date: 2026-04-10
topic: Page1首页精调审计通过
type: journal
status: resolved
keywords: [审计, 首页精调, CourseCard, 组件契约]
---

# Page 1 Refinement 审计报告

## 变更范围

改动文件数：4（src/）+ 8（docs/journal/specs）
涉及类别：页面路由（HomeContent）、前端组件（CourseCard、FAB、ReviewButton）

## 契约确认有效

- 页面路由：architecture.md 首页描述已更新为 Multi-Column Dashboard，与 HomeContent.tsx 实际布局一致
- 组件清单：33 个组件数量不变，CourseCard 描述已更新
- API 端点：无变更，跳过
- DB 表：无变更，跳过
- AI 角色：无变更，跳过
- 学习状态流：无变更，跳过

## 已修复的问题

- **CourseCard arbitrary shadow 违规**：`shadow-[0_2px_20px_-2px_rgba(167,72,0,0.12)]` 和 `shadow-[0_20px_40px_-10px_rgba(167,72,0,0.15)]` 违反 "禁止 shadow-[...] arbitrary values" 规则
  - 修复：新增 `--shadow-course` 和 `--shadow-course-hover` 两个 shadow tokens（globals.css），CourseCard 改用 token class
  - shadow tokens 从 8 个增至 10 个，architecture.md 已同步

## 无新增 ⚠️ 标记

## 下个里程碑注意事项

- CourseCard hover 效果 A/B 测试中（shadow vs pedestal），用户尚未确认偏好
- 右上角装饰图标 `text-black/[0.12]` 可能仍不够明显，待用户反馈
- HeroCard 仅在 Action Hub 使用，首页已不再引用
- ReviewButton 是页面级组件（`src/app/ReviewButton.tsx`），不在 `src/components/ui/`
