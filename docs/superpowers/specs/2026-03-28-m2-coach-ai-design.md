---
date: 2026-03-28
topic: M2教练AI核心设计
type: spec
status: resolved
keywords: [M2, coach, Q&A, reading-guide, study-notes]
---

# M2: 教练 AI（核心）— 设计文稿

> **范围**：读前指引（异步）→ 阅读（笔记 + 截图问答）→ Q&A（4 种题型 + 即时反馈 + 预生成）→ 学习笔记生成
>
> **不含**：20% 历史复习题穿插（→ M4）、学习进度仪表盘（→ M5）、笔记导出（→ M5）
>
> **验收**：完整走完一个模块的学习阶段（进入模块 → 阅读 → Q&A → 笔记生成 → 完成）

---

## 1. 学习流程与状态机

### 1.1 流程

```
用户从模块地图点进某模块
        ↓
  直接进入阅读（同时后台生成 guide）
        ↓                    ↓
   用户正常读书          guide 生成好后显示在顶部横幅（可折叠）
        ↓
   点"我读完了"
        ↓
   调 Claude 生成该模块全部 Q&A 题目（预生成）
        ↓
   一题一答 + 即时反馈
        ↓
   全部答完 → 自动生成学习笔记
        ↓
   展示笔记 → 点"完成本模块" → 返回模块地图
```

### 1.2 状态机

复用 `modules.learning_status` 字段（TEXT 类型）。现有代码使用 `unstarted`（非 `not_started`），M2 沿用并扩展：

```
unstarted → reading → qa → notes_generated → testing → completed
```

- `unstarted`：用户未进入该模块（沿用现有值）
- `reading`：用户正在阅读（进入模块即设置）
- `qa`：Q&A 题目已生成，用户正在答题
- `notes_generated`：笔记已生成，等待用户确认完成（M2 新增）
- `testing`：模块测试中（M3 使用，M2 不涉及但保留以免破坏现有代码）
- `completed`：用户完成本模块

用户重新进入时，根据状态恢复到对应阶段。

> **注意**：现有前端 `ModuleMap.tsx` 的 `STATUS_LABEL` 和后端 `status/route.ts` 的 `VALID_STATUSES` 都需要更新以包含 `notes_generated`。

### 1.3 阶段门控

| 转换 | 触发条件 |
|------|---------|
| unstarted → reading | 用户从模块地图点进模块 |
| reading → qa | 用户点"我读完了"（产品不变量 #1） |
| qa → notes_generated | 全部题目答完，自动触发笔记生成 |
| notes_generated → completed | 用户点"完成本模块" |

### 1.4 Guide 异步机制

- 进入模块时后台调 `coach/pre_reading_guide` 模板
- 生成完毕后在阅读器顶部显示可折叠横幅："本模块学习要点"
- 未生成完时不显示任何 UI，不阻塞阅读
- Guide 不参与状态机，纯异步装饰

---

## 2. 阅读阶段

### 2.1 PDF 阅读器（已有，不动）

复用现有阅读器，含截图问 AI 功能。

### 2.2 阅读笔记（新建）

- 阅读器侧边或底部加笔记输入区域
- 纯文本 textarea，自动保存
- 存入 `reading_notes` 表：`book_id` + `module_id` + `page_number` + `content`
- 支持多条笔记，按页码关联

### 2.3 "我读完了"按钮

- 阅读器底部固定按钮
- 点击后调出题 API，生成题目
- 生成完毕后跳转到 Q&A 阶段
- 生成过程中显示 loading 状态

---

## 3. Q&A 阶段

### 3.1 出题（预生成）

- 用户点"我读完了"时触发
- 一次性调 `coach/qa_generation` 模板生成全部题目
- 输入：KP 表 + 用户阅读笔记 + 截图问答记录
- 输出：题目数组，每题含：
  - `kp_id`：关联知识点
  - `question_type`：4 种之一
  - `question_text`：题目文本
  - `correct_answer`：正确答案
  - `scaffolding`：脚手架提示（选择题用）
  - `order_index`：顺序
- 全部题目写入 `qa_questions` 表

### 3.2 题型

| 题型 | 适用 KP 类型 | 说明 |
|------|-------------|------|
| `worked_example` | calculation | 先范例 → 渐进题 → 独立题（Sweller 三步） |
| `scaffolded_mc` | 通用 | 选择题，带脚手架提示 |
| `short_answer` | 通用 | 简答题 |
| `comparison` | 通用 | 辨析题，对比易混淆概念 |

### 3.3 题量

- 由 KP 数量决定，大致 1-2 题/KP
- 计算类 KP 可能 3 题（范例 + 渐进 + 独立）
- 具体题量交给 prompt 控制，不硬编码

### 3.4 答题交互

遵守产品不变量 #2 和 #5：

1. 一次显示一题
2. 用户输入答案 → 点"提交"
3. 调 `coach/qa_feedback` 模板获取即时反馈
4. 反馈显示在题目下方（对错 + 评分 + 解析）
5. 点"下一题"继续
6. 已答题不可修改

### 3.5 即时反馈

- 输入：题目文本、正确答案、用户答案、KP 详细内容
- 输出：`is_correct`（bool）、`score`（0-1）、`feedback`（文字解析）
- 结果存入 `qa_responses` 表

---

## 4. 学习笔记生成

### 4.1 触发

Q&A 全部答完后自动调用。

### 4.2 输入

- KP 表（本模块所有知识点）
- 用户阅读笔记
- Q&A 答题结果（哪些对了、哪些错了、反馈内容）

### 4.3 输出

- Markdown 格式学习笔记
- 存入 `module_notes` 表（`module_id` + `content` + `generated_from`）

### 4.4 展示

- 生成后直接在页面渲染 Markdown 笔记
- 底部"完成本模块"按钮
- 点击后 `learning_status` → `completed`，返回模块地图

---

## 5. API 设计

### 5.1 新建 API

| 路由 | 方法 | 功能 | 输入 | 输出 |
|------|------|------|------|------|
| `/api/modules/[moduleId]/generate-questions` | POST | 预生成 Q&A 题目 | moduleId | `{ success, data: { questions } }` |
| `/api/modules/[moduleId]/qa-feedback` | POST | 单题即时反馈 | questionId, userAnswer | `{ success, data: { is_correct, score, feedback } }` |
| `/api/modules/[moduleId]/generate-notes` | POST | 生成学习笔记 | moduleId | `{ success, data: { noteId, content } }` |
| `/api/modules/[moduleId]/reading-notes` | GET/POST/DELETE | 阅读笔记 CRUD | book_id, module_id, page_number, content | `{ success, data: { notes } }` |

### 5.2 现有 API 复用

| 路由 | 改动 |
|------|------|
| `GET /api/modules/[moduleId]/guide` | 无改动，前端改为异步调用 |
| `/api/books/[bookId]/screenshot-ask` | 不动 |
| `/api/modules/[moduleId]/status` | 支持新的 learning_status 值 |

### 5.3 响应格式

统一 `{ success: boolean, data?: {...}, error?: string }`，与 M1 一致。

---

## 6. 前端改造

### 6.1 文件清单

| 文件 | 改动 |
|------|------|
| `ModuleLearning.tsx`（或等效入口组件） | 状态机改造：根据 `learning_status` 渲染阅读/Q&A/笔记阶段 |
| 阅读器页面 | 加笔记输入区 + guide 异步横幅 + "我读完了"按钮 |
| `QASession.tsx` | 改造为一题一答 + 即时反馈模式（调 qa-feedback API） |
| 新建笔记展示组件 | 渲染 Markdown 笔记 + "完成本模块"按钮 |

### 6.2 状态恢复

用户中途离开再回来时：
- `reading`：回到阅读器，笔记和 guide 状态保持
- `qa`：回到 Q&A，显示下一道未答题目（已答题从 `qa_responses` 恢复）
- `notes_generated`：显示已生成的笔记

---

## 7. 数据库

所有需要的表已在 M0 创建，无需新建：

| 表 | 用途 |
|----|------|
| `reading_notes` | 用户阅读笔记 |
| `module_notes` | AI 生成的学习笔记 |
| `qa_questions` | Q&A 题目 |
| `qa_responses` | 用户答案 + AI 反馈 |
| `modules` | `learning_status` 字段追踪学习进度 |

### 7.1 learning_status 值域变更

从 `unstarted / reading / qa / testing / completed` 扩展为 `unstarted / reading / qa / notes_generated / testing / completed`。

`learning_status` 是 TEXT 类型，无需 DB migration，直接写新值即可。需更新 `status/route.ts` 的 `VALID_STATUSES` 和前端 `ModuleMap.tsx` 的 `STATUS_LABEL`。

---

## 8. Prompt 模板

4 个已 seed 的教练模板：

| 模板 | 用途 | 状态 |
|------|------|------|
| `coach/pre_reading_guide` | 读前指引 | 已有 API，改为异步调用 |
| `coach/qa_generation` | Q&A 出题 | 需要新建 API 接入 |
| `coach/qa_feedback` | 即时反馈 | 需要新建 API 接入 |
| `coach/note_generation` | 学习笔记生成 | 需要新建 API 接入 |

模板内容可能需要在实现时微调，但结构已就绪。

---

## 9. 产品不变量遵守

| 不变量 | M2 如何遵守 |
|--------|------------|
| #1 用户必须读完才能进 Q&A | "我读完了"按钮是唯一入口 |
| #2 已答题不可修改 | Q&A 提交后只显示反馈，无编辑入口 |
| #5 一次一题 + 即时反馈 | 逐题展示 → 提交 → 反馈 → 下一题 |

不变量 #3（测试阶段禁止查看笔记）和 #4（80% 过关线）属于 M3 范围。

---

## 10. 实现注意事项

### 10.1 modules 表隐式列

现有代码中 `modules` 表有两个未在 `db.ts` schema init 中声明但已被使用的列：

- `guide_json TEXT`：guide API 缓存生成的指引 JSON（`guide/route.ts` 读写此列）
- `pass_status TEXT DEFAULT 'not_passed'`：模块测试通过状态（`ModuleMap.tsx`、`test-evaluate/route.ts` 使用）

实现时需确认这两列存在（可能通过 ALTER TABLE 或 SQLite 隐式行为添加）。guide 异步机制依赖 `guide_json` 列来缓存结果。

### 10.1b learning_status 现有不一致

代码中存在命名不一致的 bug：`db.ts` schema 默认值和 `confirm/route.ts` 使用 `'not_started'`，而 `status/route.ts` 和 `ModuleMap.tsx` 使用 `'unstarted'`。M2 统一为 `unstarted`，实现时需同步修复 `db.ts` 默认值和 `confirm/route.ts`。

### 10.2 响应格式

新建的 M2 API 统一使用 `{ success: boolean, data?: {...}, error?: string }` 格式。现有 API（guide、status 等）保持当前格式不变，避免引入不必要的破坏性改动。前端根据 API 分别处理。

### 10.3 Guide 异步模式

具体机制：
1. 用户进入模块时，前端调 `POST /api/modules/[moduleId]/guide`（已有）
2. 该 POST 如果缓存命中（`guide_json` 非空）直接返回，否则调 Claude 生成并缓存
3. 前端用 `fetch` 调用，不阻塞页面渲染——请求发出后用户立即可以阅读
4. 响应返回后更新 UI 显示 guide 横幅
5. 不需要轮询或 WebSocket，单次请求即可（生成耗时 10-20 秒）

### 10.4 现有 guide API 使用内联 prompt

当前 `guide/route.ts` 使用硬编码 prompt，未接入 `coach/pre_reading_guide` 模板。M2 实现时应改为使用模板系统（通过 `prompt-templates.ts` 的 `getTemplate()` 获取模板并填充变量），保持与其他 coach API 一致。

### 10.5 qa_generation 模板变量

模板中 `{past_mistakes}` 变量在 M2 阶段无数据（错题来自 M3），传空字符串即可。`{qa_rules}` 变量填入 Section 3.2/3.3 的出题规则。

模板输出字段名（`type`、`text`）与 DB 列名（`question_type`、`question_text`）不同，API 层需要做字段映射。
