# CLAUDE.md — AI 教材精学老师

> 这是项目的核心指令文件。每次对话开始时必须先读完这个文件，再读"必读文件"清单。

---

## 项目是什么

一个面向教材型文本的 AI 老师 Web App。用户上传 `.txt` 文件，系统完成：
**模块拆解 → 读前指引 → 逐题 Q&A → 模块测试 → 错题诊断记录**

目标不是帮用户省时间，而是帮用户真正学扎实。

---

## 每次对话开始时，必须按顺序读

1. **`docs/project_status.md`** — 当前做到哪了，正在做什么，下一步是什么
2. **`docs/decisions.md`** — 已关闭的决策清单（避免重新讨论已解决的问题）
3. 如果要实现学习功能：**`docs/learning_flow.md`** — Q&A / 测试 / 评分 / 错题的实现规则

---

## 技术栈

- **框架**: Next.js 15 (App Router)
- **UI**: React + Tailwind CSS（不使用其他 UI 库）
- **AI**: Claude API，模型 `claude-sonnet-4-6`
- **数据库**: SQLite，路径 `data/app.db`，使用 `better-sqlite3`
- **文件输入**: 用户上传 PDF，服务端自动提取文本，用户不感知转换过程。Phase 1 使用 `pdf-parse` 库处理普通 PDF，扫描版 OCR 作为后续增强

---

## 数据库（6 张表）

```
books          → 教材（id, title, raw_text, created_at, parse_status）
modules        → 学习模块，属于 book（含 kp_count, learning_status, pass_status）
questions      → 题目，type: qa/test/review，属于 module
user_responses → 用户回答，属于 question（含 score, error_type）
mistakes       → 错题记录，属于 module（含 knowledge_point, next_review_date）
review_tasks   → 复习任务，属于 module（Phase 2 使用）
```

详细字段定义见 `docs/architecture.md`。

---

## 产品不变量（这些规则定义了产品本质，任何功能实现都不得违反）

1. **用户必须读完原文才能进入 Q&A**，不能提供跳过按钮
2. **Q&A 已答的题不可修改**，只能继续向前
3. **测试阶段禁止查看笔记和 Q&A 记录**，界面上不得出现相关入口
4. **模块过关线是 80%**，这是硬规则，不是建议值，不得改为软提示
5. **Q&A 是一次一题**：显示一题 → 用户作答 → 点"下一题" → 全部答完后 AI 逐题评价。不是流式聊天，不是一次展示所有题目

---

## 已关闭的决策（不重新讨论，理由见 `docs/decisions.md`）

| 决策 | 结论 |
|------|------|
| Q&A 交互方式 | 一次一题，已答不可改，全部答完后统一评价 |
| 测试时机 | 软性提醒隔夜，不强制锁定 |
| 原文阅读位置 | App 内原文视图，可跳转 |
| 错题处理 | AI 诊断 4 种错误类型，给对应补救建议 |
| 存储方案 | SQLite（Phase 1-2），Vercel 部署时迁移 Supabase（Phase 3）|
| PDF 处理 | App 内处理，服务端自动提取文本，用户上传 PDF 即可，不需手动转换 |
| 用户系统 | MVP 不做，单用户本地优先 |

---

## GitHub

- **仓库地址**：`https://github.com/FrozenMooncak3/AI_Textbook_Teacher.git`
- **分支**：`master`
- **用途**：代码备份 + 版本历史 + Phase 3 Vercel 部署入口
- **git 身份**：`zs2911@nyu.edu` / `FrozenMooncak3`

### Commit 规范
- 每完成一个 Phase 1 步骤后 commit + push
- commit message 格式：`Phase X 第N步：做了什么`
- 不得 commit `data/app.db`、`.env.local`、`node_modules`

---

## 技术红线（违反会导致安全或质量问题）

- 不写 TypeScript `any`，不绕过类型系统
- 不在客户端代码中暴露 `ANTHROPIC_API_KEY`，API 调用只在服务端
- `data/app.db` 不得提交到 git（已在 `.gitignore` 中配置）
- 不在生产代码中留 `console.log`

---

## 工作协议

### 开始一个任务前
- 读 `docs/project_status.md` 确认当前状态
- 说明这个任务会修改哪些文件

### 完成一个任务后（必须全部做完才算完成）
1. 更新 `docs/project_status.md`：已完成 / 当前进行 / 下一步 / 已知风险
2. 追加 `docs/changelog.md`：日期 + 做了什么 + 修改了哪些文件
3. 如果做出了新的产品或技术决策，追加 `docs/decisions.md`

### 遇到不确定的情况
- `project_spec.md` 范围之外的新功能 → 先问，不自行实现
- 技术方案有多种选择 → 提出 1-3 个选项，等用户决定
- 发现 bug 或意外情况 → 先报告，再动手

---

## 禁止事项

- 禁止引入多用户 / 登录 / 注册系统
- 禁止添加 MVP 范围外的功能（社区、个性化推荐、游戏化等）
- 禁止未经确认就修改产品不变量
- 禁止在未更新三个日志文件的情况下声称任务完成

---

## 与项目负责人的沟通协议

> 项目负责人不具备技术背景，以高管视角参与决策。
> 所有技术汇报必须遵守以下格式，不得使用技术术语堆砌。

### 汇报技术选项时，每个选项必须回答 5 个问题

1. **它是什么**：用生活类比一句话说清楚，不解释原理
2. **现在的代价**：时间/复杂度，不是技术细节
3. **它给我们带来什么**：具体能力，不是抽象优点
4. **它关闭了哪些未来的门**：用了它之后，什么事会变难
5. **选错了后果是什么**：最坏情况，有多难纠正

### 所有技术决策必须标注可逆性

- **容易反悔**：改了代价小，直接给推荐，不必过度讨论
- **难以反悔**：牵一发动全身，必须慢下来让负责人参与决策

### 其他原则

- 永远给出明确推荐，不只列选项让负责人自己猜
- 选项最多 3 个，超过 3 个先筛选再汇报
- 不确定时明说，不用技术自信掩盖判断模糊
