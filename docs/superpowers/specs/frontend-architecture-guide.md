# Frontend Architecture Guide — AI 教材精学老师

> 类型：长期参考手册（非一次性 spec）
> 创建：2026-04-09
> 来源：5 方向深度调研（shadcn/ui、Design Token、Headless vs Styled、视觉防漂移、Claude Code 工作流）
> 用途：所有前端设计决策的参考依据。frontend-design skill 会自动扫描本文件。

---

## 目录

1. [组件库架构](#1-组件库架构)
2. [Design Token 管理](#2-design-token-管理)
3. [Headless vs Styled 决策框架](#3-headless-vs-styled-决策框架)
4. [视觉保真保障](#4-视觉保真保障)
5. [AI 辅助前端工作流](#5-ai-辅助前端工作流)
6. [工具清单](#6-工具清单)

---

## 1. 组件库架构

### 核心模型：shadcn/ui 风格（复制代码，非 npm 包）

我们的组件库不是安装的第三方库，而是项目内的源码。这和 shadcn/ui 的理念一致：
- 组件代码在 `src/components/ui/` 目录内，开发者完全控制
- 不依赖外部 npm 包的视觉更新
- 每个组件是独立的 `.tsx` 文件，可单独修改

### 必须采纳的模式

#### 1.1 cn() 工具函数（clsx + tailwind-merge）

```ts
// src/lib/utils.ts
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

**作用**：合并 CSS 类时自动解决冲突。后传入的类覆盖先前的同类属性。

**每个组件必须**：
1. 接受 `className?: string` prop
2. 用 `cn(baseClasses, className)` 合并

**依赖**：`clsx`（条件类拼接）+ `tailwind-merge`（Tailwind 类冲突解决）

#### 1.2 data-slot 属性

每个组件的根元素加 `data-slot="component-name"`。

```tsx
export default function ContentCard({ children, className }: Props) {
  return (
    <div data-slot="content-card" className={cn("bg-surface-container-lowest ...", className)}>
      {children}
    </div>
  )
}
```

**用途**：调试时快速识别组件、父组件可通过 CSS 精准定位子组件。

#### 1.3 文件组织

| 规则 | 说明 |
|------|------|
| 扁平结构 | `src/components/ui/AmberButton.tsx`，不套文件夹 |
| PascalCase 文件名 | 和组件名一致 |
| 直接 import | `import AmberButton from '@/components/ui/AmberButton'`，不用 barrel export |
| 一个文件可含多个导出 | 复合组件（如 SplitPanel + SplitPanelSidebar）放同一文件 |

#### 1.4 组合优于继承

复杂组件通过组合简单组件构建，不继承：
- HeroCard 内部 import ContentCard + ProgressRing + AmberButton
- 不做 `class HeroCard extends ContentCard`

### 明确不采纳的模式

| 模式 | 为什么跳过 |
|------|-----------|
| CVA (class-variance-authority) | Spec 已决定不做过度泛化，AmberButton 和 Badge 是两个组件而非一个 Button 带 10 种 variant |
| Barrel export (index.ts) | 直接 import 路径更明确，AI 生成代码更不容易出错 |
| 切换到 shadcn 的 token 命名 | 我们已用 Material 3 命名（primary, surface-container-low 等），不换 |

---

## 2. Design Token 管理

### 核心原则：Tailwind v4 @theme inline 就是 token 管道

不需要 Style Dictionary、不需要 JSON token 文件、不需要构建步骤。`globals.css` 里的 `@theme inline {}` 就是唯一真相源。

### Token 层级

采用简化的两层架构（不用 MD3 完整三层）：

```
@theme inline（系统 token）
  → 颜色：--color-primary, --color-surface-container-low, ...
  → 阴影：--shadow-card, --shadow-header, ...
  → 字体：--font-headline, --font-body, ...
  → 圆角：--radius-lg, --radius-xl, ...
      ↓
组件库（消费 token）
  → 组件用 Tailwind 工具类引用 token（bg-primary, shadow-card）
  → 组件内部锁定 token 选择，页面无法绕过
      ↓
页面（只 import 组件）
  → 不直接使用 token 类
  → 只通过 className 做布局微调（间距、宽度）
```

### 什么应该变成 token

| 应该 token 化 | 不需要 token 化 |
|--------------|----------------|
| 品牌颜色（`#a74800`, `#ff7a23`） | 布局尺寸（`w-72`, `h-[40%]`, `max-w-[420px]`） |
| 阴影（每种阴影类型一个 token） | Tailwind 内置间距（`p-8`, `gap-3`） |
| 字体族 | Tailwind 调色板色（`emerald-100`, `blue-50`） |
| 圆角 | 单组件专用的 arbitrary value |

### 判断标准

> **如果改一个地方应该全局生效 → token。如果只影响一个组件 → 局部值。**

### 阴影 token 参考清单

```css
--shadow-card: 0 40px 40px -15px rgba(167, 72, 0, 0.06);
--shadow-card-lg: 0 40px 80px -30px rgba(167, 72, 0, 0.08);
--shadow-header: 0 40px 40px 0 rgba(167, 72, 0, 0.06);
--shadow-bottom-nav: 0 -8px 40px rgba(167, 72, 0, 0.08);
--shadow-cta: 0 20px 25px -5px rgba(167, 72, 0, 0.1);
--shadow-fab: 0 40px 40px -15px rgba(167, 72, 0, 0.4);
--shadow-feedback: 0 -20px 50px rgba(0, 0, 0, 0.05);
--shadow-mistake: 0 16px 48px rgba(167, 72, 0, 0.1);
```

---

## 3. Headless vs Styled 决策框架

### 默认选择：Styled（直接写带样式的组件）

对于 88% 的组件（纯视觉容器 + 简单交互），headless 库零收益、非零成本。

### 何时用 Headless 原语

当组件满足以下**全部条件**时，考虑引入单个 Radix 原语：
1. 有复杂键盘导航（箭头键切换、Tab 管理）
2. 需要 ARIA 角色和状态（radio group、switch、combobox）
3. 手动实现超过 30 行代码

### 当前项目的决策结果

| 组件 | 决策 | 理由 |
|------|------|------|
| MCOptionCard（选项组） | `@radix-ui/react-radio-group`（3KB） | radio group 语义 + 键盘导航 |
| ToggleSwitch | `@radix-ui/react-switch`（2KB） | switch 角色 + a11y |
| QuestionNavigator | 手写 ARIA（~25 行） | 不完全匹配任何 Radix 原语 |
| FilterBar | 手写 ARIA（~15 行） | checkbox group，简单 |
| FeedbackPanel | `role="alert"`（1 个属性） | 极简 |
| 其余 28 个组件 | 纯 styled，无 headless | 原生 HTML 语义足够 |

### 为什么不全用 Headless

1. AI agent（Gemini）用扁平 API（`<Badge variant="success">`）成功率 ~95%
2. 用 compound component 嵌套（`<RadioGroup.Root><RadioGroup.Item asChild>`）容易出错
3. 我们不是做通用组件库给外部消费者用，不需要"行为和样式分离"

---

## 4. 视觉保真保障

### 三层防线

```
层 1：约束输入 → AI 知道有什么组件可用
层 2：约束输出 → 代码层面禁止违规
层 3：视觉验证 → 实现和设计对比
```

### 层 1：Storybook + MCP

- **Storybook**：每个组件有 `.stories.tsx`，PM 打开浏览器即可查看所有组件
- **Storybook MCP addon**（`@storybook/addon-mcp`）：AI agent 可通过 MCP 查询组件清单和 props。Gemini 不会自己发明组件，因为它能查到现有的

### 层 2：Linting + Grep

| 工具 | 规则 | 作用 |
|------|------|------|
| `oxlint-tailwindcss` | `no-hardcoded-colors: "error"` | 禁止 `bg-[#ff5733]` 等硬编码颜色 |
| grep CI 检查 | `rgba(` 和 `shadow-[` 在组件文件中 | 任何匹配即拒绝提交 |

### 层 3：Playwright 视觉快照

- `toHaveScreenshot()` 对比实现页面和基线截图
- 在 Docker 中运行保证跨平台一致
- 免费、自托管

### 层 3 补充：Glance MCP

- 给 Claude Code 一个浏览器，可以截图和视觉对比
- 工作流：实现 → 截图 → 和 Stitch PNG 对比 → 修到一致

### Dispatch 指令模板

给 Gemini 的 dispatch 必须包含：

```
FORBIDDEN in page-level code:
- Any rgba() value
- Any shadow-[...] arbitrary shadow
- Any hex color (#xxx)
- Any bg-[...] with a color value
- Any inline style with color/shadow

USE INSTEAD:
- Token classes from @theme (shadow-card, bg-primary, etc.)
- Components from src/components/ui/

If a component doesn't exist for your need, STOP and report. Do NOT create ad-hoc styled elements.
```

### 代码审查清单（视觉相关）

- [ ] 页面代码无 `bg-[#...]`、`text-[#...]`、`shadow-[...]`
- [ ] 所有颜色类使用 token 名（`bg-primary` 非 `bg-orange-600`）
- [ ] 所有 UI 元素通过 `src/components/ui/` import，无内联重实现
- [ ] 视觉截图与 Stitch 参考对比差异 <2%

---

## 5. AI 辅助前端工作流

### Stitch → React 提取流

```
Stitch MCP 拉 HTML
  → Claude Code 读 HTML + Spec
  → 提取组件（逐字复制 CSS 类）
  → Glance MCP 截图实现效果
  → 与 Stitch 截图对比
  → 修到一致 → 循环
```

### 关键规则

1. **CSS 逐字复制**：从 Stitch HTML 复制 Tailwind 类，不改、不优化、不"改良"
2. **一次一个组件**：批量提取会导致 AI 开始"解读"和"改进"
3. **Image 读取注意**：Claude Code Read 工具读图片不稳定。用 Stitch MCP API 拿截图，或用 Glance MCP 浏览器截图

### 并行策略

| 阶段 | 并行方式 | 理由 |
|------|---------|------|
| L1 组件（21 个） | 3-4 个 subagent 并行 | 互相独立，无依赖 |
| L2 组件（12 个） | 顺序执行 | 依赖 L1 组件 |
| 页面重写 | 可按页面并行 | 每个页面独立 |

### stitch-extract Skill 核心规则

```
1. 读 spec 中该组件的 Key CSS 字段
2. 读源 HTML 文件
3. 定位对应 HTML 片段
4. CSS 类逐字复制到 React 组件
5. Props 严格按 spec 定义
6. 'use client' 仅在有交互时使用
7. NEVER modify, simplify, or "improve" Tailwind classes
```

---

## 6. 工具清单

### 必装（组件库开始前）

| 工具 | 用途 | 安装 |
|------|------|------|
| `clsx` | 条件 CSS 类拼接 | `npm i clsx` |
| `tailwind-merge` | Tailwind 类冲突解决 | `npm i tailwind-merge` |
| `@radix-ui/react-radio-group` | MCOptionCard a11y | `npm i @radix-ui/react-radio-group` |
| `@radix-ui/react-switch` | ToggleSwitch a11y | `npm i @radix-ui/react-switch` |

### 推荐（组件库完成后）

| 工具 | 用途 | 安装 |
|------|------|------|
| Storybook | 组件可视化合同 | `npx storybook@latest init` |
| `@storybook/addon-mcp` | AI agent 查询组件 | Storybook addon |
| Glance MCP | Claude Code 浏览器截图 | `.mcp.json` 配置 |
| `oxlint-tailwindcss` | 禁止硬编码颜色 | `npm i -D oxlint-tailwindcss` |

### 可选（视觉回归测试）

| 工具 | 用途 | 备注 |
|------|------|------|
| Playwright `toHaveScreenshot()` | 页面视觉回归 | 免费、Docker 内运行 |
| Lost Pixel OSS | Storybook 故事截图 | 免费开源 |
| Chromatic | 视觉 diff 审查 UI | 5000 截图/月免费，超出 $149/月 |

---

## 调研来源

本指南基于 2026-04-09 的 5 方向深度调研，主要参考：
- shadcn/ui v4 架构、CVA、tailwind-merge 文档
- Material Design 3 Token 规范
- Tailwind CSS v4 @theme 文档
- Radix UI、Ark UI/Zag.js、React Aria、Headless UI 对比
- Storybook MCP、Glance MCP、Playwright 视觉测试
- oxlint-tailwindcss、eslint-plugin-tailwindcss
- Stitch MCP (davideast/stitch-mcp)
- Claude Code subagent、worktree、skill 文档
- 社区博文：CSS Architecture for AI Agents、Making Claude Code Lovable、Round-Trip Screenshot Testing
