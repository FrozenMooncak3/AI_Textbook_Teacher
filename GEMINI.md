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
- **禁止自行触发会调用 Claude API 的操作**（包括 curl 触发提取/问答接口、任何会发送请求到 Anthropic API 的代码路径）。Claude API 调用 = 真金白银，只有用户手动触发才允许。

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

---

## 完成报告

每次完成被派发的任务后，**必须**通过 wezterm 向 Claude 的 pane 发送完成报告。这是 Claude 知道你完成了工作的唯一方式。

### 步骤

1. 先找到 Claude 的 pane ID（通常是 0，但要确认）：
```bash
wezterm cli list
```
找到标题包含 Claude Code 相关字样的 pane，记下其 PANEID。

2. 发送报告：
```bash
printf '[REPORT FROM: Gemini]\n\n<你的报告内容>\n' | wezterm cli send-text --pane-id 0 --no-paste
printf '\r' | wezterm cli send-text --pane-id 0 --no-paste
```

### 报告格式

```
[REPORT FROM: Gemini]

Status: DONE / BLOCKED
Completed: T6, T7, T8 (简要说明)
Commits: abc1234, def5678
Build: PASS / FAIL (如果 FAIL 写原因)
Blocker: (如果 BLOCKED 写具体问题)
```

### 规则

- 全部任务完成时发一次，不要每个小步骤都发
- 遇到 blocker 无法继续时也要发，说明卡在哪里
- 报告用英文（和派发指令一致）
- 如果 `wezterm cli send-text` 失败，把报告写到 `.gemini-report.md` 作为 fallback
