---
date: 2026-04-08
topic: Amber Companion设计令牌
type: spec
status: resolved
keywords: [design-tokens, Stitch, CSS, Tailwind, Amber-Companion]
---

# Design Tokens — Amber Companion

> 从 Stitch 导出的 11 个 HTML 文件中提取，全部页面交叉验证一致。
> Gemini 实现时统一写入 `tailwind.config.js`，不散落在组件中。

---

## 颜色系统（Material 3 风格，暖橙色调）

### 核心色

| Token | 值 | 用途 |
|-------|-----|------|
| `primary` | `#a74800` | 主交互色（按钮边框、active 状态） |
| `primary-container` | `#ff7a23` | CTA 渐变终点、大按钮背景 |
| `primary-fixed` | `#ff7a23` | 同 primary-container |
| `primary-fixed-dim` | `#f06c0b` | 进度条已完成段、已答题圆点 |
| `primary-dim` | `#943f00` | 深色变体 |
| `on-primary` | `#ffffff` | primary 上的文字 |
| `on-primary-container` | `#3f1700` | container 上的文字 |

### 辅助色

| Token | 值 | 用途 |
|-------|-----|------|
| `secondary` | `#9b5100` | 辅助交互 |
| `secondary-container` | `#ffc69d` | 辅助容器 |
| `tertiary` | `#845d00` | 金色，复习/提醒/Flag |
| `tertiary-container` | `#febb28` | Flag 背景、当前题高亮 |
| `tertiary-fixed` | `#febb28` | 同 tertiary-container |
| `tertiary-fixed-dim` | `#efad16` | tertiary 暗色 |

### 错误色

| Token | 值 | 用途 |
|-------|-----|------|
| `error` | `#be2d06` | 错误文字、错题数字 |
| `error-container` | `#f95630` | 错误背景 |

### 表面色

| Token | 值 | 用途 |
|-------|-----|------|
| `surface` | `#fffbff` | 页面底色 |
| `surface-container-lowest` | `#ffffff` | 白卡片 |
| `surface-container-low` | `#fefae8` | 侧栏底色、body 背景 |
| `surface-container` | `#f8f4e2` | 卡片/面板底色 |
| `surface-container-high` | `#f2eedb` | 深卡片 |
| `surface-container-highest` | `#ece9d4` | 最深卡片 |
| `surface-variant` | `#ece9d4` | 未完成进度段 |
| `surface-dim` | `#e7e3ce` | 禁用状态 |

### 文字色

| Token | 值 | 用途 |
|-------|-----|------|
| `on-surface` | `#39382d` | 主文字 |
| `on-surface-variant` | `#666558` | 次级文字、标签 |
| `outline` | `#838174` | 边框 |
| `outline-variant` | `#bcb9ab` | 淡边框 |

### 语义状态色（非 Material 3 Token，从设计中提取）

| 状态 | 背景 | 文字 | 用途 |
|------|------|------|------|
| Completed/Mastered | `emerald-100` | `emerald-800` | 模块完成 badge、KP 掌握圆点 |
| In Progress | `orange-100` | `orange-800` | 模块进行中 badge |
| Improving | `blue-100` | `blue-700` | KP 提升中圆点 |
| Weak | `orange-100` | `orange-700` | KP 薄弱圆点 |
| Flagged | `tertiary-fixed` | `on-tertiary-fixed` | 测试 Flag 标记 |

---

## 字体

| Token | 字体 | 用途 |
|-------|------|------|
| `headline` | Plus Jakarta Sans | 标题、数字、标签 |
| `body` | Be Vietnam Pro | 正文、段落 |
| `label` | Plus Jakarta Sans | 小标签、badge |

需要引入：
```html
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Be+Vietnam+Pro:wght@300;400;500;600&display=swap" rel="stylesheet">
```

---

## 圆角

| Token | 值 | 用途 |
|-------|-----|------|
| `DEFAULT` | `1rem` (16px) | 卡片、输入框 |
| `lg` | `2rem` (32px) | 大卡片、侧栏圆角 |
| `xl` | `3rem` (48px) | 超大圆角 |
| `full` | `9999px` | 按钮、badge、进度条 |

---

## 渐变

```css
.amber-glow {
  background: linear-gradient(135deg, #a74800 0%, #ff7a23 100%);
}
```

用途：CTA 按钮（"Continue Learning"、"Start Review"）、侧栏 logo icon、活跃模块编号。

---

## 阴影

从 HTML 中提取的常用阴影：

| 用途 | 值 |
|------|-----|
| 卡片默认 | `shadow-sm shadow-orange-900/5` |
| CTA 按钮 | `shadow-xl shadow-orange-700/10` → hover: `shadow-orange-700/30` |
| 顶栏 | `shadow-[0_40px_40px_0_rgba(167,72,0,0.06)]` |
| 底部导航栏 | `shadow-[0_-8px_40px_rgba(167,72,0,0.08)]` |
| 大卡片 | `shadow-[0_40px_80px_-30px_rgba(167,72,0,0.08)]` |
| KP 掌握圆点 | `shadow-[0_0_8px_rgba(16,185,129,0.4)]` (emerald glow) |

---

## 图标

- **库**: Material Symbols Outlined (Google)
- **引入**: `<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap">`
- **默认设置**: `font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24`
- **填充图标**: `style="font-variation-settings: 'FILL' 1;"` 用于 active/selected 状态

常用图标映射：

| 场景 | 图标名 |
|------|--------|
| 首页 | `home` |
| 上传 | `cloud_upload` |
| 设置 | `settings` |
| 帮助 | `help` |
| 登出 | `logout` |
| 复习 | `refresh` / `history_edu` |
| 错题 | `running_with_errors` |
| 测试 | `quiz` |
| 提示 | `lightbulb` |
| 旗标 | `flag` (FILL 1) |
| 计时器 | `timer` |
| 正确 | `check_circle` (FILL 1) |
| 警告 | `warning` |
| 分析 | `analytics` |
| 阅读 | `auto_stories` / `menu_book` |
| 箭头 | `arrow_forward` / `arrow_back` / `chevron_right` |

---

## Tailwind Config 模板

```javascript
// tailwind.config.js extend 部分
module.exports = {
  theme: {
    extend: {
      colors: {
        "primary": "#a74800",
        "primary-container": "#ff7a23",
        "primary-fixed": "#ff7a23",
        "primary-fixed-dim": "#f06c0b",
        "primary-dim": "#943f00",
        "on-primary": "#ffffff",
        "on-primary-container": "#3f1700",
        "secondary": "#9b5100",
        "secondary-container": "#ffc69d",
        "tertiary": "#845d00",
        "tertiary-container": "#febb28",
        "tertiary-fixed": "#febb28",
        "tertiary-fixed-dim": "#efad16",
        "error": "#be2d06",
        "error-container": "#f95630",
        "surface": "#fffbff",
        "surface-container-lowest": "#ffffff",
        "surface-container-low": "#fefae8",
        "surface-container": "#f8f4e2",
        "surface-container-high": "#f2eedb",
        "surface-container-highest": "#ece9d4",
        "surface-variant": "#ece9d4",
        "surface-dim": "#e7e3ce",
        "on-surface": "#39382d",
        "on-surface-variant": "#666558",
        "on-secondary": "#ffffff",
        "on-tertiary": "#ffffff",
        "on-error": "#ffffff",
        "on-error-container": "#520c00",
        "on-secondary-container": "#703900",
        "on-tertiary-container": "#563b00",
        "outline": "#838174",
        "outline-variant": "#bcb9ab",
        "inverse-surface": "#0f0f06",
        "inverse-primary": "#f77113",
      },
      fontFamily: {
        "headline": ["Plus Jakarta Sans", "sans-serif"],
        "body": ["Be Vietnam Pro", "sans-serif"],
        "label": ["Plus Jakarta Sans", "sans-serif"],
      },
      borderRadius: {
        DEFAULT: "1rem",
        lg: "2rem",
        xl: "3rem",
        full: "9999px",
      },
    },
  },
}
```
