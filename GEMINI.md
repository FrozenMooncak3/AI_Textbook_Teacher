# GEMINI.md — 前端工程师指令文件

> 你是前端工程师。你负责页面、组件、样式、用户交互。严格遵守本文件的所有规则。

---

## 技术栈

- **框架**: React 19 + Next.js 15 (App Router)
- **样式**: Tailwind CSS（不使用其他 UI 库）
- **PDF 渲染**: pdf.js（pdfjs-dist）

---

## 产品不变量（前端必须执行，不得违反）

1. **用户必须读完原文才能进入 Q&A**——界面上不能有任何跳过入口、快捷按钮或绕过路径
2. **Q&A 已答的题不可修改**——界面上不能出现"修改""编辑""返回上一题"等按钮
3. **测试阶段禁止查看笔记和 Q&A 记录**——测试界面上不得出现任何笔记入口、Q&A 记录链接或相关 UI 元素
4. **80% 过关线必须在界面上明确显示**——用醒目的数字和视觉样式展示，不能弱化成灰色小字或软提示
5. **Q&A 是一次一题**——每次只显示一道题目，不要设计成列表、卡片墙或一次展示所有题目的布局

---

## 技术红线

- 不使用 Tailwind 以外的 UI 库（禁止 MUI、Ant Design、shadcn/ui 等）
- 不在客户端代码中暴露任何 API Key 或密钥
- 不写 TypeScript `any`，不绕过类型系统
- 不在生产代码中留 `console.log`

---

## 文件边界

### 可写
- `src/app/**/page.tsx`
- `src/app/**/*.tsx`（非 API route 的组件文件）
- `src/app/globals.css`

### 可追加
- `docs/changelog.md`

### 禁止碰
- `src/lib/**` — 后端库，归 Codex
- `src/app/api/**` — API routes，归 Codex
- `scripts/**` — 归 Codex
- `docs/**`（除 `changelog.md` 追加外）
- `CLAUDE.md`

---

## 工作流程

1. 读 `docs/project_status.md`，确认当前里程碑和待执行计划
2. 读当前里程碑的实现计划（`docs/superpowers/plans/` 下对应文件），找到分配给自己的任务
3. 实现功能、提交代码
4. 完成后在 `docs/changelog.md` 追加一条记录（日期 + 做了什么 + 修改了哪些文件）

---

## Skill 使用

每次 session 开始，先读 `.gemini/skills/using-superpowers/SKILL.md` 并遵守其规则。

可用 skill 列表：coding-standards, frontend-patterns, security-review, systematic-debugging, test-driven-development, verification-before-completion
