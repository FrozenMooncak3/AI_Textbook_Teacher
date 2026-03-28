# MVP 重新设计：AI 教材精学教练

**日期**：2026-03-21
**状态**：已审核
**参与者**：项目负责人 + Claude（PM/架构师）

---

## 1. 产品定义

**产品名**：AI 教材精学教练

> 注：原名"AI 教材精学老师"。改名反映产品定位变化——从"老师"（知识传授）转向"教练"（执行力驱动）。详见 decisions.md。

**一句话**：上传教材 PDF，系统自动提取知识点、安排学习顺序、出题测试、调度复习——用户只需要读书和答题。

**目标用户**：中国留学生——有学习意愿但自驱不够，离开国内中学和家长的外力约束后缺乏结构化学习能力。不是纯学霸，也不是纯来玩的，是那批"想学但需要有人推一把"的人。有付费意愿和付费能力。

**核心价值**：学习执行力外包——用户不需要决定学什么、怎么练、什么时候复习。系统全部安排好，用户只需要执行。

**与竞品的区别**：竞品是工具（大纲、翻译、划词、错题本——所有动作由用户发起），这个产品是教练（系统告诉用户该做什么）。对于自驱不够的用户，"教练"比"工具"值钱得多。

**MVP 范围**：
- 教练链路：KP 提取 → 模块地图 → 读前指引 → Q&A（含 worked example）→ 测试 → 错题诊断 → 复习调度
- PDF 阅读器：在 app 内看书
- 独立问答通道：截图问 AI，不污染学习链路，记录自动归档并反哺学习链路
- 阅读笔记：用户读书时随手记录，纳入 Q&A 出题和笔记生成的上下文

**MVP 不做**：翻译、书签、单词本、知识图谱、文件夹管理、多用户/登录

---

## 2. 用户旅程

### 2.1 首次使用

```
上传 PDF
    ↓
立刻进入 PDF 阅读器（可以先看书）
    ↓
后台：OCR 处理 → 提取器 AI 三阶段 KP 提取 → 生成模块地图
    ↓
提示："模块地图已生成" → 用户查看并确认
    ↓
进入第一个模块
```

**模块地图确认**：用户可以查看 KP 数量、类型分布、模块划分。确认是一个"确认知悉"步骤（acknowledge），不是审批门。如果用户对模块划分有异议，可以反馈，系统提供"重新生成"按钮触发提取器 AI 重新提取。但 MVP 阶段不支持用户手动编辑模块地图。

### 2.2 每个模块的学习循环

```
Step 1: 读前指引
        系统告诉你：这个模块学完能判断什么、重点是什么、容易踩什么坑
            ↓
Step 2: 读原文
        在 PDF 阅读器里读对应章节
        读的过程中可以随时截图问 AI（独立通道）
        可以随手做笔记
        点"我读完了"进入下一步
            ↓
Step 3: Q&A 练习
        系统出题（题量由 KP 数量决定）：
        - 计算类 KP：先给范例 → 再给渐进题 → 最后独立题（Sweller worked example）
        - 其他类 KP：选择题（带脚手架提示）/ 简答 / 辨析
        - 穿插 20% 历史模块复习题（优先覆盖历史错题 KP）
        一次一题，答完即时反馈（Ericsson 即时反馈原则）
            ↓
Step 4: 系统自动生成本模块学习笔记（整合 KP + 用户笔记 + Q&A 结果）
        笔记存入 module_notes 表，用户可在学习阶段随时查看
        测试阶段禁止查看（不变量 #3）
            ↓
Step 5: 软提醒："建议明天再做测试，间隔效应让记忆更牢"
            ↓
Step 6: 模块测试（盲测）
        不能查笔记、不能查 Q&A 记录
        独立作答 → AI 评分
            ↓
Step 7: 过关判断
        ≥ 80% → 通过，错题记录，模块进入复习时钟
        < 80% → AI 诊断错题类型（盲点/程序性/混淆/粗心）→ 补救建议 → 重新测试
            ↓
Step 8: 进入下一个模块（循环）
```

### 2.3 复习流程

```
App 首页显示："你今天有 N 个复习任务"
    ↓
每个复习任务：
  - 按聚类出题，题量 = P 值（1-4 题/聚类）
  - 答完后 P 值更新
  - 纯软件调度（3 → 7 → 15 → 30 → 60 天），不需要 AI 参与定时
```

**P 值完整规则**：

| P 值 | 含义 | 出题数 |
|------|------|--------|
| 1 | 已掌握（连续 2 次全对） | 1 题 |
| 2 | 正常基线 | 2 题 |
| 3 | 有错题（默认初始值，凡含已知错题） | 3 题 |
| 4 | 反复错（连续 2 次有错） | 4 题 |

**初始 P 值**：无已知错题的聚类 = 2，含已知错题的聚类 = 3。

**P 值更新规则**：
```
IF 本次全对:
    P = max(1, P - 1)
ELIF 本次有错 AND 上次也有错:
    P = min(4, P + 1)
ELIF 本次有错 AND 上次全对:
    P 不变（单次失误不惩罚）
```

**题量上限**：每次复习总题数 ≤ 12，超过时等比缩减，但每聚类至少 1 题。

**P=1 的聚类**：仍然出 1 题（不从复习中毕业）。如果连续 3 次 P=1 且全对，该聚类在下一轮复习间隔中跳一级（如 15 天直接跳到 60 天）。

**复习调度与聚类的关系**：复习按模块触发（整个模块到期），但题目按聚类分配（每聚类按自己的 P 值出题）。

### 2.4 独立问答通道

```
PDF 阅读器里随时可以框选截图
    ↓
助手 AI 回答（独立上下文，不影响学习链路）
    ↓
用户可以追问
    ↓
对话记录自动归档到这本书的"提问记录"里
    ↓
教练 AI 出题时可以读取这些记录作为参考
（用户问过某个概念 → 说明有困惑 → 针对性出题）
```

### 2.5 边界情况

| 情况 | 处理 |
|------|------|
| 用户中途关闭 app（Q&A 进行中） | 进度保存在数据库，下次打开从上次的题目继续 |
| 用户点"我读完了"但读了很短时间 | 纯信任制，不强制最短阅读时间。MVP 不做阅读时间检测 |
| 测试未通过后重新测试 | 重新生成新试卷（不是同一份），避免记忆性通过 |
| 重新测试次数 | 无上限，但每次都是新题。如果连续 3 次未通过，系统建议重新做 Q&A |
| OCR 质量差（扫描版模糊） | 提取器 AI 在 KP 表中标注"OCR 损坏，需用户确认"，不影响其他 KP |

---

## 3. AI 调度架构

### 3.1 核心原则

CC 的做法：一个 AI + 800 行 prompt + 一个上下文窗口，什么都往里塞。
Web App 的做法：5 个 AI 角色，每个只拿自己需要的上下文，互不干扰。

### 3.2 五个 AI 角色

| 角色 | 职责 | 调用时机 | 输入 | 输出 |
|------|------|---------|------|------|
| **提取器** | KP 提取 + 模块地图 | 上传后，后台一次性 | OCR 文本 + 提取规则 | KP 表 + 模块地图 → DB |
| **教练** | 读前指引、Q&A 出题、反馈、笔记生成 | 每模块学习阶段 | 本模块 KP 表 + Q&A 规则 + 用户笔记 + 截图问答记录 + 历史错题 | 指引/题目/反馈/笔记 → DB |
| **考官** | 测试出题、评分、错题诊断 | 每模块测试阶段 | 本模块 KP 表 + 测试规则 + 历史错题 | 试卷/评分/诊断 → DB |
| **复习官** | 复习出题、评分、P 值更新 | 复习日到期 | 聚类 + P 值 + KP 表 + 历史错题 | 复习题/评分/P 值变更 → DB |
| **助手** | 截图问 AI、自由提问 | 用户随时触发 | 截图 OCR 文本 + 对话历史 | 回答 → 对话记录库 |

### 3.3 数据流

```
用户上传 PDF
    ↓
  [OCR 后台处理]
    ↓
  [提取器 AI] ← OCR 文本 + 提取规则
    ↓
  KP 表 + 模块地图 → 数据库（所有后续 AI 的"教材"）
    ↓
  ┌─────────── 每个模块循环 ───────────┐
  │                                     │
  │  [教练 AI] ← KP 表 + 用户笔记       │
  │     + 截图问答记录 + 历史错题         │
  │     ↓                               │
  │  读前指引 → Q&A → 反馈 → 笔记        │
  │     ↓                               │
  │  [考官 AI] ← KP 表 + 测试规则        │
  │     + 历史错题                       │
  │     ↓                               │
  │  测试 → 评分 → 诊断                  │
  │     ↓                               │
  │  通过？→ 模块进入复习时钟             │
  │                                     │
  └─────────────────────────────────────┘
    ↓
  [复习到期] → [复习官 AI] → 评分 → P 值更新

  ─── 独立通道（全程可用）───
  [助手 AI] ← 截图 + 对话历史 → 回答归档
  教练 AI 出题时可读取助手 AI 的对话记录
```

### 3.4 为什么这比 CC 好

| 维度 | CC | Web App |
|------|-----|---------|
| 上下文大小 | 800 行 prompt + 全书文本 + 对话历史 | 每次调用几十行 prompt + 该模块 KP 表 |
| 规则遗忘 | compact 后忘记出题规则 | 规则在 prompt 模板里，永远不忘 |
| 数据持久性 | markdown 文件手动维护 | 数据库自动存储，永不丢失 |
| 提问污染 | 问一个问题就污染上下文 | 助手 AI 独立，且记录反哺学习 |
| 复习调度 | 靠用户自己记日期 | 软件自动计算，到期推送 |
| 出题质量 | AI 负担重，经常不按规则来 | 每次调用专注一件事，更易遵守规则 |

### 3.5 Prompt 模板管理

每个 AI 角色的 prompt 是可替换的模板，存在 `prompt_templates` 表中：

```
角色: coach
阶段: qa_generation
版本: v1
模板:
  你是一个教材学习教练。根据以下知识点表，为学生出 Q&A 练习题。
  ## 规则
  {qa_rules}
  ## 本模块知识点
  {kp_table}
  ## 用户阅读笔记
  {user_notes}
  ## 用户截图问答记录
  {user_qa_history}
  ## 历史错题
  {past_mistakes}
  ## 输出要求
  ...
```

改 prompt 只需要改模板文本，不需要改代码。

> `prompt_templates` 表保留 `version` 和 `is_active` 字段，这是有意的前瞻性投资——字段加上几乎无额外成本，但为未来 prompt 迭代和 A/B 测试打好了基础。MVP 阶段每个 role+stage 只有一个激活版本。

### 3.6 提取器 AI：三阶段 KP 提取协议

提取器是整个系统最重要的 AI 角色——KP 提取质量决定了后续所有出题、测试、复习的质量。

**Stage 0：结构扫描**

- **输入**：OCR 全文
- **操作**：每隔约 200 行扫描一次，只识别小节标题和页码范围
- **输出**：章节结构地图（小节名 + 页码范围 + 预估 KP 数 + 预计模块数）
- **目的**：为 Stage 1 的分块精读提供路线图

**Stage 1：分块精读 + KP 初提取**

- **输入**：每块 100-180 行正文（按 Stage 0 的结构地图切分）
- **操作**：
  - 过滤 OCR 噪音（页眉、页码、分隔线）
  - 识别内容类型（技术内容 → 提取 KP；举例 → 归入上一个 KP；故事 → 提取规则不提取情节）
  - 填入 KP 表（编号、所属小节、描述、类型、重要度、详细内容）
  - 标注跨块风险项（KP 内容横跨两个块，待下一块补全）
- **输出**：每块的 KP 初提取表 + 跨块风险标记

**KP 粒度控制**：
- 太宽：描述里有"以及""包括X个方面" → 必须拆分
- 太窄：只是某公司某年具体数字，不可迁移 → 归入上一 KP 的例子
- 判断标准：这个 KP 换一家公司还适用吗？适用 = 独立 KP，不适用 = 例子

**Stage 2：跨块缝合 + 质量验证**

- **输入**：Stage 1 所有块的 KP 表
- **操作**：
  - 合并跨块 KP（找到"跨块风险=是"的条目，读取下一块补全）
  - 去重（两个 KP 的考法完全相同 → 合并）
  - 类型分布检查（每模块至少覆盖 4 种 KP 类型）
  - 计算类 KP 完整性验证（必须含公式 + 步骤 + 注意事项）
  - 模块间 KP 数量比例检查（不超过 2:1）
- **输出**：最终 KP 表 + 模块地图 → 写入数据库

**质量验证门（写入数据库前必须通过）**：
```
□ 每个小节至少有 1 个 KP
□ 每 10 页 OCR 约 8-15 个 KP（明显低于 8 = 可能遗漏）
□ 计算类 KP 全部包含完整公式和步骤
□ C2 评估类 KP 全部包含矛盾信号
□ 没有"太宽" KP（描述超过 25 字且含多个独立概念）
□ OCR 损坏区域已标注
□ 跨块 KP 已合并
□ 模块间 KP 数量比例 ≤ 2:1
```

---

## 4. 数据模型

### 4.1 表结构总览

```
核心实体
├── books              — 书籍（已有，微调）
├── modules            — 模块（已有，微调）
├── knowledge_points   — 知识点（🆕 核心）
└── clusters           — KP 聚类（🆕 复习用）

学习链路
├── reading_notes      — 用户阅读笔记（🆕）
├── module_notes       — AI 生成的模块学习笔记（🆕）
├── qa_questions       — Q&A 题目（替代旧 questions）
├── qa_responses       — Q&A 回答 + AI 反馈
├── test_papers        — 测试卷（🆕）
├── test_questions     — 测试题目
├── test_responses     — 测试回答 + 评分
└── mistakes           — 错题记录（已有，扩展）

复习系统
├── review_schedule    — 复习日程（🆕）
└── review_records     — 复习结果 + P 值变更

独立问答
├── conversations      — 对话（已有）
└── messages           — 消息（已有）

AI 调度
└── prompt_templates   — Prompt 模板（🆕）
```

### 4.2 全部表定义

**books**（已有，微调）
```sql
id              INTEGER PRIMARY KEY AUTOINCREMENT,
title           TEXT NOT NULL,
raw_text        TEXT,                -- OCR 提取的全文
file_path       TEXT,                -- PDF 文件路径
parse_status    TEXT DEFAULT 'pending',  -- pending/processing/completed/failed
kp_extraction_status TEXT DEFAULT 'pending',  -- 🆕 pending/processing/completed/failed
ocr_current_page INTEGER DEFAULT 0,
ocr_total_pages  INTEGER DEFAULT 0,
created_at      TEXT DEFAULT (datetime('now'))
```

**modules**（已有，微调）
```sql
id              INTEGER PRIMARY KEY AUTOINCREMENT,
book_id         INTEGER NOT NULL REFERENCES books(id),
title           TEXT NOT NULL,
summary         TEXT,
order_index     INTEGER NOT NULL,
kp_count        INTEGER DEFAULT 0,   -- 🆕
cluster_count   INTEGER DEFAULT 0,   -- 🆕
page_start      INTEGER,             -- 🆕 对应 PDF 起始页
page_end        INTEGER,             -- 🆕 对应 PDF 结束页
learning_status TEXT DEFAULT 'not_started',  -- not_started/reading/qa/testing/completed
created_at      TEXT DEFAULT (datetime('now'))
```

**knowledge_points**（🆕 核心）
```sql
id              INTEGER PRIMARY KEY AUTOINCREMENT,
module_id       INTEGER NOT NULL REFERENCES modules(id),
kp_code         TEXT NOT NULL,       -- 如 "2.3-01"
section_name    TEXT NOT NULL,       -- 所属小节
description     TEXT NOT NULL,       -- 一句话描述
type            TEXT NOT NULL,       -- position/calculation/c1_judgment/c2_evaluation/definition
importance      INTEGER DEFAULT 2,   -- 1-3
detailed_content TEXT NOT NULL,      -- 完整出题依据（自足内容）
cluster_id      INTEGER REFERENCES clusters(id),
ocr_quality     TEXT DEFAULT 'good', -- good/uncertain/damaged
created_at      TEXT DEFAULT (datetime('now'))
```

**clusters**（🆕）
```sql
id              INTEGER PRIMARY KEY AUTOINCREMENT,
module_id       INTEGER NOT NULL REFERENCES modules(id),
name            TEXT NOT NULL,
current_p_value INTEGER DEFAULT 2,   -- 1-4
last_review_result TEXT,             -- all_correct/has_errors
consecutive_correct INTEGER DEFAULT 0,  -- 连续全对次数（用于 P=1 跳级）
next_review_date TEXT,
created_at      TEXT DEFAULT (datetime('now'))
```

**reading_notes**（🆕 用户手写笔记）
```sql
id              INTEGER PRIMARY KEY AUTOINCREMENT,
book_id         INTEGER NOT NULL REFERENCES books(id),
module_id       INTEGER REFERENCES modules(id),
page_number     INTEGER,
content         TEXT NOT NULL,
created_at      TEXT DEFAULT (datetime('now'))
```

**module_notes**（🆕 AI 生成的学习笔记）
```sql
id              INTEGER PRIMARY KEY AUTOINCREMENT,
module_id       INTEGER NOT NULL REFERENCES modules(id),
content         TEXT NOT NULL,       -- AI 生成的完整笔记（markdown）
generated_from  TEXT,                -- 记录生成依据：kp_ids + qa_ids + reading_note_ids
created_at      TEXT DEFAULT (datetime('now'))
```

**qa_questions**（替代旧 questions 表的 Q&A 部分）
```sql
id              INTEGER PRIMARY KEY AUTOINCREMENT,
module_id       INTEGER NOT NULL REFERENCES modules(id),
kp_id           INTEGER REFERENCES knowledge_points(id),
question_type   TEXT NOT NULL,       -- worked_example/scaffolded_mc/short_answer/comparison
question_text   TEXT NOT NULL,
correct_answer  TEXT,                -- worked_example 的 step1 无正确答案
scaffolding     TEXT,                -- 脚手架提示（选择题用）
order_index     INTEGER NOT NULL,
is_review       INTEGER DEFAULT 0,  -- 是否为旧章穿插题
source_module_id INTEGER,            -- 如果是穿插题，来源模块
created_at      TEXT DEFAULT (datetime('now'))
```

**qa_responses**
```sql
id              INTEGER PRIMARY KEY AUTOINCREMENT,
question_id     INTEGER NOT NULL REFERENCES qa_questions(id),
user_answer     TEXT NOT NULL,
is_correct      INTEGER,             -- 1/0/NULL(worked_example step1)
ai_feedback     TEXT,                -- AI 即时反馈内容
score           REAL,
created_at      TEXT DEFAULT (datetime('now'))
```

**test_papers**（🆕）
```sql
id              INTEGER PRIMARY KEY AUTOINCREMENT,
module_id       INTEGER NOT NULL REFERENCES modules(id),
attempt_number  INTEGER DEFAULT 1,   -- 第几次测试（支持重考）
total_score     REAL,
pass_rate       REAL,
is_passed       INTEGER DEFAULT 0,
created_at      TEXT DEFAULT (datetime('now'))
```

**test_questions**
```sql
id              INTEGER PRIMARY KEY AUTOINCREMENT,
paper_id        INTEGER NOT NULL REFERENCES test_papers(id),
kp_id           INTEGER REFERENCES knowledge_points(id),
question_type   TEXT NOT NULL,       -- single_choice/c2_evaluation/calculation/essay
question_text   TEXT NOT NULL,
options         TEXT,                -- JSON: 选择题的选项
correct_answer  TEXT NOT NULL,
explanation     TEXT,                -- 参考答案解析
order_index     INTEGER NOT NULL,
created_at      TEXT DEFAULT (datetime('now'))
```

**test_responses**
```sql
id              INTEGER PRIMARY KEY AUTOINCREMENT,
question_id     INTEGER NOT NULL REFERENCES test_questions(id),
user_answer     TEXT NOT NULL,
is_correct      INTEGER,
score           REAL,
ai_feedback     TEXT,                -- 评分后的反馈
error_type      TEXT,                -- blind_spot/procedural/confusion/careless（仅错题）
created_at      TEXT DEFAULT (datetime('now'))
```

**mistakes**（已有，扩展）
```sql
id              INTEGER PRIMARY KEY AUTOINCREMENT,
module_id       INTEGER NOT NULL REFERENCES modules(id),
kp_id           INTEGER REFERENCES knowledge_points(id),  -- 🆕 关联到具体 KP
knowledge_point TEXT,                -- 保留旧字段兼容，新记录优先用 kp_id
error_type      TEXT NOT NULL,       -- blind_spot/procedural/confusion/careless
source          TEXT DEFAULT 'test', -- 🆕 test/qa/review（错误来源）
remediation     TEXT,                -- AI 补救建议
is_resolved     INTEGER DEFAULT 0,   -- 🆕 是否已通过复习解决
created_at      TEXT DEFAULT (datetime('now'))
```

**review_schedule**（🆕 替代旧 review_tasks）
```sql
id              INTEGER PRIMARY KEY AUTOINCREMENT,
module_id       INTEGER NOT NULL REFERENCES modules(id),
review_round    INTEGER NOT NULL,    -- 第几轮复习（1=3天, 2=7天, 3=15天, 4=30天, 5=60天）
due_date        TEXT NOT NULL,
status          TEXT DEFAULT 'pending',  -- pending/completed
completed_at    TEXT,
created_at      TEXT DEFAULT (datetime('now'))
```

**review_records**（🆕）
```sql
id              INTEGER PRIMARY KEY AUTOINCREMENT,
schedule_id     INTEGER NOT NULL REFERENCES review_schedule(id),
cluster_id      INTEGER NOT NULL REFERENCES clusters(id),
questions_count INTEGER NOT NULL,
correct_count   INTEGER NOT NULL,
p_value_before  INTEGER NOT NULL,
p_value_after   INTEGER NOT NULL,
created_at      TEXT DEFAULT (datetime('now'))
```

**prompt_templates**（🆕）
```sql
id              INTEGER PRIMARY KEY AUTOINCREMENT,
role            TEXT NOT NULL,       -- extractor/coach/examiner/reviewer/assistant
stage           TEXT NOT NULL,       -- 如 kp_extraction_stage0, qa_generation, test_scoring
version         INTEGER DEFAULT 1,
template_text   TEXT NOT NULL,
is_active       INTEGER DEFAULT 1,
created_at      TEXT DEFAULT (datetime('now')),
UNIQUE(role, stage, version)
```

### 4.3 现有表处理与迁移策略

> MVP 为单用户产品，现有数据量极小。采用**破坏性迁移**：备份旧数据库 → 删除旧表 → 创建新表。不做数据迁移脚本。

| 现有表 | 处理 |
|--------|------|
| books | 保留，加 `kp_extraction_status` 字段 |
| modules | 保留，加 `kp_count`、`cluster_count`、`page_start`、`page_end` |
| questions | 删除，拆为 `qa_questions` + `test_questions` |
| user_responses | 删除，拆为 `qa_responses` + `test_responses` |
| mistakes | 保留结构，加 `kp_id`、`source`、`is_resolved`。旧记录的 `knowledge_point` TEXT 字段保留兼容，新记录优先用 `kp_id` |
| review_tasks | 删除，替换为 `review_schedule` + `review_records` |
| conversations / messages | 保留不动 |
| highlights | 保留不动（前端后续接入） |
| notes | 删除，替换为 `reading_notes` |

---

## 5. 现有代码处理

### 5.1 保留（直接复用）

- PDF 阅读器（reader 页面 + pdf.js）
- 截图问 AI（前端框选 + 后端 OCR + Claude 回答）
- 目录导航侧边栏
- OCR 后台处理 + 进度条（修 bug）
- 上传页面（微调）
- 基础框架（Next.js + SQLite + Tailwind）

### 5.2 改造（保留骨架，重写内部逻辑）

- 模块地图生成 API → 改为提取器 AI 三阶段协议
- Q&A API → 从 KP 表出题，支持 4 种题型
- 测试 API → 拆为独立考官 AI
- 模块学习页面 → 重新设计匹配新学习循环
- 数据库 → 新增表 + 破坏性迁移旧表

### 5.3 新建

- 复习系统（后端调度 + P 值计算 + 前端页面）
- 阅读笔记功能
- AI 生成学习笔记功能
- Prompt 模板管理
- 首页仪表盘

---

## 6. 里程碑

### M0：地基改造

数据库升级 + prompt 模板系统 + 修复现有 bug（OCR 进度条、截图 OCR）

**验收**：新表可读写，prompt 模板能正确加载和变量替换

### M1：提取器 AI

上传 PDF → 三阶段 KP 提取 → KP 表和模块地图写入数据库 → 模块地图页面展示

**验收**：上传《读财报》一个章节，KP 提取质量不低于 CC 手动提取

### M2：教练 AI

读前指引 → 阅读（含笔记 + 截图问答）→ Q&A（4 种题型 + 即时反馈）→ 学习笔记生成

**验收**：完整走完一个模块的学习阶段，体验不低于 CC

### M3：考官 AI

测试出题 → 盲测 → 评分 → 80% 过关 → 错题诊断

**验收**：测试出题符合 v2.0 规则，过关/未过关流程完整

### M4：复习系统

复习调度（3/7/15/30/60 天）→ 聚类出题 → P 值更新

**验收**：模块通过后正确触发复习，P 值按规则更新

### M5：体验打磨

首页仪表盘 + 笔记查看/导出 + 问答历史 + 截图问 AI 流程改造 + UI/UX 打磨

**已知任务**（来自 M0 验证观察）：
- M5-T1：截图问 AI 流程拆分——OCR 识别（快、免费）→ 用户输入问题 → AI 回答（按需调用），不再自动解释
- M5-T2：截图 AI 语言匹配——AI 用内容语言回答（中文→中文），prompt 改中文
- M5-T3：截图处理进度反馈——分阶段「识别中...」→「文字已识别」→「AI 思考中...」
- M5-T4：AI 回复 Markdown 渲染（react-markdown 或类似方案）
- M5-T5：OCR 进度条精度优化

**验收**：用户（你自己）愿意用这个 app 替代 CC 学习

### 依赖关系

```
M0 → M1 → M2 → M3 → M4 → M5
              ↑
       独立问答通道（已有，持续可用）
```

---

## 7. 产品不变量

继承自 CLAUDE.md，本次更新了第 5 条（详见 decisions.md 2026-03-21 Q&A 反馈决策）：

1. 用户必须读完原文才能进入 Q&A，不能跳过
2. Q&A 已答的题不可修改，只能继续向前
3. 测试阶段禁止查看笔记和 Q&A 记录
4. 模块过关线是 80%，硬规则
5. **Q&A 一次一题 + 即时反馈**：显示一题 → 用户作答 → 立即显示评分和解析 → 点"下一题"继续（原为"全部答完后批量反馈"，因 Ericsson 即时反馈原则更改）

---

## 8. 未来方向（不在 MVP 范围内）

- 翻译功能（整页/划词）
- 知识图谱 / 知识目录 + 跳转
- 书签 + 单词本
- 文件夹管理
- 多用户 / 登录系统
- 个性化 CLI / 外置大脑 / RAG 系统
- Prompt A/B 测试（基础设施已在 MVP 预埋）
- 商业化（免费试用 + 两档定价）
