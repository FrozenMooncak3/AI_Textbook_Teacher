# M4 复习系统设计

**日期**：2026-04-02
**状态**：已审核
**参与者**：项目负责人 + Claude（PM/架构师）

---

## 1. 目标

模块测试通过后，系统按间隔调度复习。复习按模块触发，题目按聚类分配，P 值驱动题量。用户只需要打开 app、看到"有复习"、做题。

**M4 范围**：复习调度 + 复习出题 + 逐题反馈 + P 值更新 + P 值方向修正
**M4 不做**：QA 穿插 20% 复习题（M4 之后）、首页仪表盘（M5）、复习提醒推送

---

## 2. 用户流程

```
首页看到"复习 (N)"按钮
    ↓
点击 → 展开到期模块列表
    ↓
选一个模块 → 进入复习 session
    ↓
系统介绍："系统会根据你的复习表现动态调整题目"
    ↓
逐题作答（QA 模式：一题 → 作答 → 即时反馈 → 下一题）
    ↓
全部答完 → 结果摘要（正确率 + 各聚类对错情况）
    ↓
后台：P 值更新 + 创建下一轮调度
```

---

## 3. P 值系统（方向修正）

### 3.1 问题

M3.5 实现的 P 值方向与原始 spec 相反：代码做的是高=好（1-5），spec 定义的是低=好（1-4）。reviewer prompt 也跟了代码方向。

### 3.2 统一方向：低=好

| P 值 | 含义 | 出题数 |
|------|------|--------|
| 1 | 已掌握（连续 2 次全对） | 1 题 |
| 2 | 正常基线（初始值，无已知错题） | 2 题 |
| 3 | 有错题（含已知错题的聚类初始值） | 3 题 |
| 4 | 反复错（连续 2 次有错） | 4 题 |

P = 基础题数（超过总量上限时等比缩减，见 Section 6.2）。

### 3.3 P 值更新规则

```
IF 本次全对:
    P = max(1, P - 1)
    consecutive_correct += 1
ELIF 本次有错 AND last_review_result IN ('has_errors'):
    P = min(4, P + 1)
    consecutive_correct = 0
ELIF 本次有错 AND (last_review_result = 'all_correct' OR last_review_result IS NULL):
    P 不变（单次失误不惩罚；首次复习视同无前科）
    consecutive_correct = 0
```

更新后同步写入 `last_review_result`（'all_correct' 或 'has_errors'）。

**NULL 处理**：`last_review_result` 在模块首次复习时为 NULL（test/submit 不写此字段）。NULL 视同 'all_correct'，即首次复习出错不惩罚。

### 3.4 P=1 跳级规则

**跳级条件**：模块内**所有** cluster 均满足 P=1 且 consecutive_correct >= 3 时，该模块下一轮复习间隔跳一级（如 15 天直接跳 60 天）。只要有任何一个 cluster P >= 2，不跳级。

跳级后所有 cluster 的 consecutive_correct 重置为 0。

### 3.5 需要修正的现有代码

| 位置 | 修正 |
|------|------|
| `test/submit/route.ts` P 值初始化逻辑 | 改为简单赋值：cluster 全对 → P=2（基线），cluster 有错 → P=3（有已知错题）。不动 consecutive_correct 和 last_review_result（这两个由复习流程管理）。删除现有的增量更新逻辑 |
| `seed-templates.ts` reviewer prompt | 出题策略修正（P=1 出 1 题，P=4 出 4 题）；question_type 改用 `single_choice`（对齐 examiner）；移除 `{review_rules}` 占位符，规则内联到模板中 |
| `seed-templates.ts` 新增模板 | 添加 role='reviewer', stage='review_scoring' 种子模板 |
| `architecture.md` 接口契约 | P 值方向和规则描述修正 |
| `clusters` 表数据 | 重置所有 current_p_value=2, consecutive_correct=0, last_review_result=NULL（开发环境，无生产数据） |

---

## 4. 复习调度

### 4.1 间隔表

| 轮次 (review_round) | 间隔 |
|---------------------|------|
| 1 | 3 天 |
| 2 | 7 天 |
| 3 | 15 天 |
| 4 | 30 天 |
| 5 | 60 天 |

第 5 轮之后不再创建新调度（复习毕业）。

### 4.2 调度创建时机

- **首次调度**（round=1）：模块测试通过时创建，due = today + 3 天（M3.5 已实现）
- **后续调度**（round=2+）：每次复习完成后创建下一轮，due = today + 对应间隔
- **P=1 跳级**：模块内所有 cluster 均 P=1 且 consecutive_correct >= 3 时，下一轮间隔跳一级

### 4.3 过期处理

到期未做的复习累积为 pending，首页按钮显示总的到期数量。不自动跳过、不惩罚。

---

## 5. 数据模型

### 5.1 新增表

**review_questions**

```sql
CREATE TABLE IF NOT EXISTS review_questions (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    schedule_id     INTEGER NOT NULL REFERENCES review_schedule(id) ON DELETE CASCADE,
    module_id       INTEGER NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
    cluster_id      INTEGER NOT NULL REFERENCES clusters(id),
    kp_id           INTEGER REFERENCES knowledge_points(id),
    question_type   TEXT    NOT NULL CHECK(question_type IN ('single_choice','c2_evaluation','calculation','essay')),
    question_text   TEXT    NOT NULL,
    options         TEXT,              -- JSON: 选择题选项
    correct_answer  TEXT    NOT NULL,
    explanation     TEXT,
    order_index     INTEGER NOT NULL,
    created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);
```

`module_id` 冗余但必要：去重查询（上一轮 review_questions）需按 module 过滤，避免每次 JOIN review_schedule。

**review_responses**

```sql
CREATE TABLE IF NOT EXISTS review_responses (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    question_id     INTEGER NOT NULL REFERENCES review_questions(id) ON DELETE CASCADE,
    user_answer     TEXT    NOT NULL,
    is_correct      INTEGER,
    score           REAL,
    ai_feedback     TEXT,
    error_type      TEXT,  -- blind_spot/procedural/confusion/careless
    created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);
```

### 5.2 现有表不变

- `review_schedule` — 保持原样
- `review_records` — 保持原样，存 per-cluster 聚合（P 值变更记录）
- `clusters` — 字段不变（current_p_value, last_review_result, consecutive_correct），只改值域和更新方向
- `mistakes` — 复习错题写入，source='review'

---

## 6. API 设计

### 6.1 GET `/api/review/due`

查询到期复习列表。

**响应**：
```json
{
  "reviews": [
    {
      "schedule_id": 1,
      "module_id": 3,
      "module_title": "资产负债表",
      "book_id": 1,
      "book_title": "读财报",
      "review_round": 1,
      "due_date": "2026-04-05"
    }
  ]
}
```

**查询逻辑**：`review_schedule WHERE status='pending' AND due_date <= date('now')` JOIN modules JOIN books。

### 6.2 POST `/api/review/[scheduleId]/generate`

生成复习题目，启动复习 session。

**幂等性**：若该 schedule_id 已有 review_questions，不重新生成。检测未作答的第一题并返回（支持断点续答）。

**流程**（首次调用）：
1. 检查是否已有 review_questions for this schedule_id → 有则跳到步骤 7
2. 读该 schedule 对应模块的所有 clusters + P 值
3. 按 P=基础题数分配题量，总量 ≤ 10（超过时等比缩减，每聚类至少 1 题）
4. 读 mistakes（module_id 匹配，is_resolved=0）用于优先覆盖
5. 读上一轮 review_questions（same module, round-1）用于 `{recent_questions}` 去重
6. 调 reviewer AI（review_generation prompt）生成题目 → 解析 JSON → 写入 review_questions
7. 找第一道未作答的题（LEFT JOIN review_responses WHERE response IS NULL）→ 返回

**响应**：
```json
{
  "total_questions": 8,
  "current_index": 1,
  "question": {
    "id": 101,
    "type": "single_choice",
    "text": "...",
    "options": ["A. ...", "B. ...", "C. ...", "D. ..."]
  }
}
```

**题量分配算法**：
```
raw_counts = { cluster_id: P_value for each cluster }
total = sum(raw_counts)
if total > 10:
    scale = 10 / total
    for each cluster:
        adjusted = max(1, round(P_value * scale))
    // 微调使总和 = 10
```

### 6.3 POST `/api/review/[scheduleId]/respond`

提交单题答案，获取即时反馈。

**请求**：
```json
{
  "question_id": 101,
  "user_answer": "B"
}
```

**前置验证**：校验 question_id 属于 URL 中的 schedule_id，不匹配则返回 400。

**流程**：
1. 读题目信息（question_text, correct_answer, explanation, kp_id）
2. 调 reviewer AI（review_scoring prompt）评分 + 生成反馈
3. 写入 review_responses
4. 如答错 → 写入 mistakes：`module_id`（from schedule）, `kp_id`（from question）, `knowledge_point`（KP description）, `error_type`（from AI）, `source='review'`, `remediation`（from AI）
5. 返回反馈 + 下一题（如有）

**响应**：
```json
{
  "is_correct": false,
  "ai_feedback": "...",
  "has_next": true,
  "next_question": {
    "id": 102,
    "type": "calculation",
    "text": "...",
    "options": null
  }
}
```

### 6.4 POST `/api/review/[scheduleId]/complete`

复习 session 结束，执行收尾。

**前置验证**：
- 检查所有 review_questions 都有对应 review_responses。如有未答题，返回 400 并指明缺失的 question_id
- 检查当前 schedule status 仍为 'pending'。如已 'completed'，返回 409（防重复调用）

**流程**：
1. 按 cluster 聚合 review_responses 结果
2. 对每个 cluster 执行 P 值更新（Section 3.3 规则）
3. 写入 review_records（p_value_before, p_value_after）
4. P=1 跳级检查（Section 3.4）
5. 创建下一轮 review_schedule（round+1，间隔查 Section 4.1）— **duplicate guard**：如果该 module 已有 round+1 的 schedule 则跳过
6. 标记当前 schedule status='completed', completed_at=now

**响应**：
```json
{
  "summary": {
    "total_questions": 8,
    "correct_count": 6,
    "accuracy": 0.75,
    "clusters": [
      { "name": "财务比率", "correct": 2, "total": 3 },
      { "name": "资产分类", "correct": 4, "total": 5 }
    ]
  },
  "next_review": {
    "round": 2,
    "due_date": "2026-04-09"
  }
}
```

---

## 7. Prompt 模板

### 7.1 review_generation（已有，需修正）

修正出题策略描述，对齐 P 值低=好方向：
- P=1（已掌握）：出 1 题
- P=2（正常）：出 2 题
- P=3（有错题）：出 3 题，优先覆盖历史错题 KP
- P=4（反复错）：出 4 题，优先覆盖历史错题 KP

同步修正：
- `question_type` 输出使用 `single_choice`（对齐 examiner 和 test_questions）
- 移除 `{review_rules}` 占位符，将复习规则直接内联到模板文本中
- 其余保持不变（输出 JSON 格式、质量自检规则）

### 7.2 review_scoring（新增）

职责：逐题评分 + 反馈。类比 QA 的 `qa_feedback` 模板。

输入占位符：
- `{question_text}` — 题目
- `{correct_answer}` — 参考答案
- `{user_answer}` — 用户作答
- `{kp_content}` — 对应知识点的详细内容
- `{explanation}` — 出题时的解析

输出 JSON：
```json
{
  "is_correct": true/false,
  "score": 0-1,
  "error_type": "blind_spot|procedural|confusion|careless|null",
  "feedback": "反馈文本",
  "remediation": "补救建议（仅错题）"
}
```

---

## 8. 前端

### 8.1 复习 session 页面

路由：`/books/[bookId]/modules/[moduleId]/review`

**交互流程**：
1. 进入页面 → 显示简短介绍："系统会根据你的复习表现动态调整题目"
2. 调 generate → 拿到第一题
3. 逐题：显示题目 → 用户作答 → 调 respond → 显示反馈 → 点"下一题"
4. 最后一题反馈后 → 调 complete → 显示结果摘要
5. 结果摘要：正确率 + 各聚类对错情况 + "返回首页"按钮

参照 QASession 组件模式实现，不需要全新设计。

### 8.2 首页入口

在现有书目列表页（`/`）加一个小按钮：
- 页面加载时调 `/api/review/due`
- 有到期 → 显示"复习 (N)"按钮
- 点击 → 展开到期模块列表（module_title + book_title + 轮次）
- 点具体模块 → 跳转复习 session
- 无到期 → 按钮隐藏

---

## 9. 边界情况

| 情况 | 处理 |
|------|------|
| 复习中途关闭 app | review_questions 已持久化；重新进入时调 generate（幂等），返回第一道未答题，从断点继续 |
| 模块只有 1 个 cluster 且 P=1 | 出 1 题，正常走流程 |
| 所有 cluster 都 P=1 且 ≤10 题 | 正常出题，不跳过 |
| 第 5 轮复习完成 | 不创建第 6 轮，该模块复习毕业 |
| 多个模块同日到期 | 各自独立显示，用户逐个完成 |
| 题量分配后总和超/少于目标 | 微调最高 P 值的聚类 ±1 题使总和 = 目标 |
