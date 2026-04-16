---
date: 2026-04-07
topic: UX全面重设计brainstorm
type: journal
status: resolved
keywords: [UX重设计, Action Hub, 书首页, 设计决策]
---

# UX 重设计 Brainstorm — 2026-04-07

type: brainstorm
status: in_progress

## 背景

用户实测 M6 后发现多个 UX 问题，启动全面 UX 重设计讨论。

## 已确认的设计决策

### 1. 书首页 = Action Hub（Option 2 风格）

用户进入一本书后的落地页。核心理念：**打开就知道该干什么**。

布局：
- Hero CTA 区域：当前进度 + "继续学习 [模块名]" 大按钮
- 行动提醒卡片：待复习数量、错题数量，可直接跳转
- 下方：紧凑的模块网格（显示状态：已完成/进行中/未开始）
- 底部：最近考试成绩

用户反馈："方向对但不够 fancy"——视觉美化交给 Stitch/Gemini 后续处理。

### ~~2. Learning Path~~ — 已砍掉

理由：Action Hub 的模块网格已经显示全部模块状态，再加一页是重复信息+多一次点击。
Khan Academy 同样做法：课程页就是地图，点击直接进入学习。

### 2. 点击模块 → Split Panel（Option 5 风格）

模块学习页面。核心理念：**左边导航右边内容**。

布局：
- 左侧：可折叠的目录/章节导航（类似 PDF 目录，可跳转）
- 右侧：学习内容区域（指引→阅读→QA→笔记 流程都在这里）
- 左侧栏可以关掉，给内容更多空间

### 用户流（最终版）

```
打开一本书 → Action Hub（我该干什么 + 全部模块状态）
    ↓ 点"继续学习"或点任意模块
Split Panel（左边 KP 目录可折叠可跳转，右边学习内容）
```

Learning Path 已砍掉——Action Hub 的模块网格就是地图。

### Split Panel 左侧栏确认
- 内容：模块内的知识点(KP)列表，可跳转到对应 QA 题
- 可折叠，给内容区更多空间
- 不是学习流程步骤，不是模块列表

## 用户报告的 Bug/UX 问题（待修复）

### PDF 处理卡在 preparing 0/0
- 来自 PdfViewer.tsx:125 的状态横幅
- 原因：OCR 服务可能未启动或未回写进度到 DB
- 需要确认运行环境（Docker vs 本地）

### PDF 阅读器 UX 问题
| 问题 | 难度 | 方案 |
|------|------|------|
| UI 太丑 | 中 | CSS 主题定制 |
| 目录不能跳转 | 低 | bookmark plugin 配置 |
| 组件英文 | 低 | 设置 localization 参数 |
| 默认缩放 300% | 低 | 设 defaultScale={1.2} |
| 切页面不记住位置 | 低 | localStorage 持久化 |

### 书详情页加载问题（被重设计解决）
- 原问题：点模块地图/仪表盘显示"加载中"
- 解决方案：合并为 Action Hub，不再有独立的模块地图/仪表盘页

## 行业调研结论

- Coursera: 左侧大纲 + 顶部 Tab
- Khan Academy: 彩色方块网格，进度 = 颜色
- Duolingo: 线性路径，进度内嵌
- Quizlet: 横向模式切换
- **共识**：进度不独立成页、3-5 子视图用顶部 Tab、客户端切换零加载

## Stitch 工作流（已确认）

两次 brainstorm：
1. 第一次（本次）：确认页面结构 + 功能需求 → 输出 Stitch prompt
2. 第二次：用户带 Stitch 生成的画面回来 → 定 spec → 派 Gemini 实现

Stitch = Google Labs AI UI 工具（stitch.withgoogle.com），可导出 React+Tailwind+design.md。

## 侧栏导航变更

- 书内导航（模块地图/仪表盘）从侧栏移除
- 侧栏只保留 app 级导航：首页、上传、设置
- 书内视图切换通过页面内的路由跳转（Action Hub → Learning Path → Split Panel）

## 还没做的页面 → 第二次 brainstorm 已完成（2026-04-08）

全部 7 个页面方向已定，Stitch prompt 已生成。详见：
- 决策记录：`docs/superpowers/specs/2026-04-07-ux-redesign-chain.md` → "第二次 Brainstorm 成果"
- Stitch prompts：`docs/superpowers/specs/stitch-prompts.md`

## Wireframe 文件

已生成 5 选项 wireframe：`wireframe/0704-book-dashboard/index.html`
用户选择了 Option 2 (Action Hub) + Option 5 (Split Panel) 融合方案。
Learning Path (Option 4) 已砍掉——Action Hub 网格已覆盖其功能。
模块卡片信息密度、Split Panel 细节 → 交给 Stitch 探索。
