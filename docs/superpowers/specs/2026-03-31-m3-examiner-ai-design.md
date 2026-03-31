# M3：考官 AI 设计文稿

**日期**：2026-03-31
**状态**：已审核
**参与者**：项目负责人 + Claude（PM/架构师）

---

## 1. M3 职责边界

考官 AI 只做两件事：**出题** 和 **评分+诊断**。

与教练 AI 的边界：教练负责学习阶段（读前指引、Q&A、笔记），考官负责评估阶段（测试、评分、诊断）。两者不交叉。

### 1.1 完整流程

```
用户完成 Q&A → 软提醒"建议隔天再做" → 用户点"开始测试"
    ↓
[考官 AI·出题] ← KP 表 + 测试规则 + 历史错题
    ↓
试卷写入 DB（test_papers + test_questions）
    ↓
前端渲染试卷（盲测：禁止查看笔记/Q&A，产品不变量 #3）
    ↓
用户作答，全部答完后提交
    ↓
[考官 AI·评分] ← 试卷（含预设答案）+ 用户答案
    ↓
评分结果写入 DB（test_responses + mistakes）
    ↓
≥ 80% → 通过，模块 learning_status → completed
< 80% → 展示错题诊断 + 补救建议，可重新测试（全新试卷）
```

### 1.2 产品不变量检查

| 不变量 | M3 如何遵守 |
|--------|------------|
| #1 读完原文才能进 Q&A | M3 不涉及（M2 负责） |
| #2 Q&A 已答不可修改 | M3 不涉及（M2 负责） |
| #3 测试阶段禁止查看笔记和 Q&A | 前端测试页面不渲染任何笔记/Q&A 入口 |
| #4 过关线 80% 硬规则 | 代码强制：`is_passed = pass_rate >= 0.8` |
| #5 Q&A 一次一题+即时反馈 | M3 不涉及（测试是全部展示+统一提交，和 Q&A 不同） |

---

## 2. 两次 AI 调用

### 2.1 调用 1：出题（test_generation）

| 项 | 内容 |
|---|---|
| 触发 | 用户点"开始测试" |
| 输入 | 本模块 KP 表（含 type、importance、detailed_content）、测试规则、历史错题 |
| 输出 | JSON：questions 数组 |
| AI 角色 | examiner |
| AI 阶段 | test_generation |

**出题时 AI 同时生成题目+正确答案+解析**，全部存入 `test_questions` 表。评分时 AI 有预设答案做参照，评分更快更准。

### 2.2 调用 2：评分（test_scoring）

| 项 | 内容 |
|---|---|
| 触发 | 用户提交全部答案 |
| 输入 | 主观题的题目+预设答案+用户答案（单选题不送 AI） |
| 输出 | JSON：每道主观题的评分结果 + 错题诊断 |
| AI 角色 | examiner |
| AI 阶段 | test_scoring |

**混合评分策略**：
- 单选题：代码直接比对字母，零 AI 成本，不送 AI
- 主观题（C2 评估、计算、思考）：打包送 AI 评分
- AI 负责主观题的分数判定 + 所有错题（含单选）的错误类型诊断
- **total_score、pass_rate、is_passed 由服务端代码计算**，不依赖 AI 输出

---

## 3. 题量与覆盖规则

### 3.1 核心原则

**所有 KP 必须被至少 1 道题覆盖，上限 10 题。** 通过合并相关 KP 到同一题来控制题量。

| 约束 | 值 |
|------|---|
| 下限 | 5 题 |
| 上限 | 10 题 |
| KP 覆盖 | 100%（每个 KP 至少被 1 道题考到） |

### 3.2 题型与覆盖密度

| 题型 | 覆盖的 KP 类型 | 每题可覆盖 KP 数 |
|------|--------------|----------------|
| 单选题 | C1 判断类 + 定义类 | 1-2 |
| C2 评估题 | C2 评估类（必须含矛盾信号） | 2-3 |
| 计算题 | 计算类（虚构数据，多步计算） | 1-2 |
| 思考题 | 综合跨类（mini 案例） | 3-4 |

AI 在出题时自己规划覆盖方案——先统计所有 KP，按类型分组，设计题目组合使得 10 题以内覆盖全部 KP。这是 CC 版"出题前置报告"的自动化版本，AI 内部执行，不暴露给用户。

### 3.3 可调性

题量规则全部在 prompt 模板中，改模板文字即可调整，不需要改代码。

---

## 4. 评分与过关机制

### 4.1 评分规则

| 题型 | 评分方式 | 分值 |
|------|---------|------|
| 单选题 | 代码自动判（比对字母） | 每题 5 分 |
| C2 评估题 | AI 评分（有预设答案参照） | 每题 5 分 |
| 计算题 | AI 评分（检查过程+结果） | 每题 5 分 |
| 思考题 | AI 评分（多 KP 综合） | 每题 10 分 |

### 4.2 过关判断

**总得分 / 总满分 >= 80%**。硬规则，代码强制。

**总满分计算（服务端）**：遍历试卷所有题目，按 question_type 求和（single_choice/c2_evaluation/calculation = 5 分，essay = 10 分）。`pass_rate` 和 `is_passed` 均由服务端代码计算，不依赖 AI 输出——这确保产品不变量 #4 的硬规则由代码强制执行。

### 4.3 错误类型诊断

每道错题由 AI 诊断为以下四类之一：

| 错误类型 | 特征 | 补救建议 |
|----------|------|---------|
| blind_spot（知识盲点） | 完全不知道概念 | 重读对应章节 + 重做相关 Q&A |
| procedural（程序性失误） | 懂原理但步骤错 | 回去重做该 KP 的 Q&A worked example |
| confusion（概念混淆） | 把 A 误认为 B | 对比辨析 + 针对性复习 |
| careless（粗心错误） | 偶发，非系统性 | 标记即可，不阻塞 |

### 4.4 未通过流程

1. 展示成绩 + 每道错题的诊断（错误类型 + AI 反馈 + 正确答案解析）
2. 错题写入 mistakes 表（含 error_type、remediation、source='test'）
3. 用户可选"重新测试" → 生成全新试卷（新 test_paper，attempt_number +1）
4. 连续 3 次未通过 → 界面提示"建议回去重做 Q&A"（软提醒，不强制）

### 4.5 通过流程

1. 展示成绩 + 错题反馈（通过了也可能有错题）
2. 错题写入 mistakes 表
3. 模块 learning_status 更新为 `completed`
4. M3 不创建复习计划——预留接口给 M4

### 4.6 CC "强制口述协议"的替代

CC CLI 可以要求用户口述计算步骤，Web App 做不到。替代方案：程序性失误的补救建议指向"回去重做该 KP 的 Q&A worked example"，通过 worked example 的三步序列（范例→渐进→独立）达到同样效果。

---

## 5. API 端点设计

三个端点，遵循 M2 的 `handleRoute` + `getModel` + `getPrompt` 模式。

### 5.1 POST `/api/modules/[moduleId]/test/generate`

**职责**：生成测试试卷

**前置检查**：
- moduleId 有效且存在
- 模块 learning_status 为 `notes_generated`（Q&A 已完成）
- 如果已有未提交的 test_paper → 返回已有试卷（不重复生成）

**流程**：
1. 查询模块所有 KP（knowledge_points 表）
2. 查询历史错题（mistakes 表，该模块 + is_resolved=0）
3. 调用 `getPrompt('examiner', 'test_generation', { kp_table, test_rules, past_mistakes })`
4. 调用 `generateText()` 获取 AI 响应
5. 解析 JSON，验证字段完整性
6. 事务写入：创建 test_paper + 批量插入 test_questions
7. 返回试卷（题目+选项，**不含** correct_answer 和 explanation）

**重考逻辑**：请求参数含 `retake: true` 时，创建新 test_paper（attempt_number = 上一次 +1），生成全新题目。

### 5.2 POST `/api/modules/[moduleId]/test/submit`

**职责**：提交答案，评分，诊断

**输入**：`{ paper_id: number, answers: [{ question_id: number, user_answer: string }] }`

**流程**：
1. 验证 paper_id 属于该 moduleId，且未提交过
2. 从 test_questions 获取完整试卷（含 correct_answer）
3. 单选题：代码直接比对 `user_answer === correct_answer`
4. 主观题：打包送 AI 评分（`getPrompt('examiner', 'test_scoring', { ... })`）
5. 事务写入：
   - 批量插入 test_responses（每题的 is_correct、score、ai_feedback、error_type）
   - 错题写入 mistakes 表
   - 更新 test_papers（total_score、pass_rate、is_passed）
   - 如果通过：更新模块 learning_status 为 `completed`
6. 返回：完整评分结果

### 5.3 GET `/api/modules/[moduleId]/test`

**职责**：查询测试状态

**返回**：
- 是否有进行中的试卷（已生成未提交）
- 历史测试记录（每次的分数、是否通过、attempt_number）
- 当前模块 learning_status

---

## 6. 前端交互流程

现有 `TestSession.tsx` 状态机骨架需改造适配新 API。

### 6.1 状态机

```
[test_intro]  → 软提醒（建议隔天）+ "开始测试"按钮
     ↓
[generating]  → 调 generate API → loading 动画
     ↓
[answering]   → 渲染试卷
     ↓
[submitting]  → 调 submit API → loading 动画
     ↓
[results]     → 展示成绩 + 反馈
```

### 6.2 answering 状态详细

- 所有题目一次展示（和 Q&A 的一次一题不同——测试模拟真实考试）
- 顶部显示进度（已答 3/10）
- 单选题：radio 按钮组
- 计算/思考/C2：文本输入框（支持多行）
- **产品不变量 #3**：界面不出现任何笔记/Q&A 入口
- 全部答完后"提交"按钮激活

### 6.3 results 状态详细

**通过时**：
- 总分 + 通过标记
- 逐题反馈（含错题解析）
- "进入下一模块"按钮

**未通过时**：
- 总分 + 未通过标记
- 错题诊断（错误类型 + AI 反馈 + 正确答案 + 解析）
- "重新测试"按钮（生成全新试卷）
- 连续 3 次未通过：额外提示"建议回去重做 Q&A"

---

## 7. Prompt 模板设计

### 7.1 test_generation 模板

质量规则来源：CC textbook-tutor skill 的 `test-rules.md`，翻译为 prompt 约束。

**核心规则框架**：

```
你是考试出题专家。

## 覆盖规则
- 所有 KP 必须被至少 1 道题覆盖
- 上限 10 题，通过合并相关 KP 到同一题控制题量
- 下限 5 题
- 每道题标注覆盖的 kp_ids

## 题型分配
- 单选题 → C1 判断类 + 定义类 KP（1-2 KP/题）
- C2 评估题 → C2 评估类 KP（2-3 KP/题，必须含矛盾信号）
- 计算题 → 计算类 KP（虚构数据，多步计算，至少 1 道逆向）
- 思考题 → 综合跨类 KP（3-4 KP/题，mini 案例）

## 出题质量自检（内部执行，不输出给用户）
- 单选题答案字母分布均匀（4 题及以上时 A/B/C/D 大致均匀，任一字母不超过 40%）
- 正确答案不是最长选项
- 错误选项来自真实认知误区（混淆概念、遗漏条件、因果倒置等）
- C2 题包含至少 1 个正面信号 + 1 个负面信号
- 计算题数据自洽（出完后验算）
- 不用原文原数字，必须 paraphrase
- 避免绝对词（"一定""绝对""所有"）

## 输出格式
JSON: { "questions": [{ "kp_ids": [1,2], "type": "single_choice|c2_evaluation|calculation|essay", "text": "...", "options": ["A..","B..","C..","D.."], "correct_answer": "...", "explanation": "..." }] }
```

### 7.2 test_scoring 模板

```
你是考试评分专家。

## 评分标准
- 单选题已由系统自动判分，你只处理主观题
- 计算题：过程和结果都对 → 满分；过程对结果错 → 扣部分分；过程错 → 0 分
- 思考题：按覆盖 KP 数量分段给分，分析深度和逻辑完整性
- C2 评估题：结论合理+分析到位 → 满分；结论对但分析不完整 → 部分分

## 错误诊断（仅错题，必填）
每道错题判断类型：blind_spot / procedural / confusion / careless
并给出针对性反馈和补救建议

## 输出格式
JSON: { "results": [{ "question_id": N, "is_correct": bool, "score": N, "feedback": "...", "error_type": "..." }] }
注意：不输出 total_score / pass_rate / is_passed，这些由服务端计算。
```

### 7.3 模板可调性

所有规则（题量上下限、覆盖策略、评分标准、质量自检项）都是模板文字。修改 `prompt_templates` 表中对应记录即可调整，不需要改代码。

---

## 8. 数据库使用

M3 不新建表，但需要对 `test_questions` 做一处小改动。

### 8.0 Schema 改动

**问题**：`test_questions.kp_id` 是单值 INTEGER FK，但 M3 的覆盖规则要求一道题覆盖多个 KP（C2 题 2-3 个，思考题 3-4 个）。

**方案**：新增 `kp_ids TEXT` 列，存储 JSON 数组（如 `"[1,2,3]"`）。保留原 `kp_id` 列指向主要 KP（用于简单查询和 FK 完整性），`kp_ids` 存储完整覆盖列表（用于覆盖率验证）。

```sql
ALTER TABLE test_questions ADD COLUMN kp_ids TEXT;  -- JSON array, e.g. "[1,2,3]"
```

### 8.1 使用的表

| 表 | M3 用途 |
|---|---|
| test_papers | 创建试卷记录（attempt_number、分数、是否通过） |
| test_questions | 存储生成的题目（含 correct_answer、explanation） |
| test_responses | 存储用户答案 + 评分结果 + 错误诊断 |
| mistakes | 记录错题（error_type、remediation、source='test'） |
| knowledge_points | 读取 KP 表作为出题依据 |
| modules | 读取/更新 learning_status |
| prompt_templates | 读取 examiner 角色的模板 |

### 8.2 learning_status 状态转换

```
notes_generated → testing（开始测试）→ completed（通过）
```

重新测试时 learning_status 保持 `testing` 不变，仅创建新 test_paper（attempt_number +1）。

### 8.3 test_paper 提交状态判定

`test_papers` 表无显式 status 列。判定规则：`total_score IS NULL` = 未提交（进行中），`total_score IS NOT NULL` = 已提交（已评分）。

### 8.4 Prompt 模板 upsert

`seedTemplates()` 当前只对 extractor 和 coach 做 upsert。M3 实现时需将 examiner 加入 upsert 块，确保模板更新能同步到已有数据库。

---

## 9. 与其他里程碑的接口

| 里程碑 | M3 提供的接口 |
|--------|-------------|
| M2（教练） | M3 在 learning_status = notes_generated 时启动，不修改 M2 的数据 |
| M4（复习） | M3 通过后模块变 completed，M4 据此创建 review_schedule。M3 的 mistakes 记录供 M4 出复习题时参考 |
| M5（体验） | M3 的 test_papers/test_responses 数据供 M5 测试 Dashboard 展示 |

---

## 10. 现有代码处理

### 10.1 需要重写的旧文件

| 文件 | 问题 | 处理 |
|------|------|------|
| `src/app/api/modules/[moduleId]/test-questions/route.ts` | 用旧 schema + 内联 prompt | 删除，用新端点 `test/generate` 替代 |
| `src/app/api/modules/[moduleId]/test-evaluate/route.ts` | 用旧 schema + 不用 handleRoute + 写废弃的 `pass_status` 列 | 删除，用新端点 `test/submit` 替代。M3 用 `test_papers.is_passed` 替代旧的 `modules.pass_status` |
| `src/app/api/modules/[moduleId]/mistakes/route.ts` | 用旧 schema join | 重写，适配新 test_questions/test_responses 表 |

### 10.2 需要改造的前端

| 文件 | 改造内容 |
|------|---------|
| `src/app/books/[bookId]/modules/[moduleId]/test/page.tsx` | 适配新 API 路径 |
| `src/components/TestSession.tsx` | 新建（旧文件已不存在），实现状态机 + 适配新 API |
| `src/app/books/[bookId]/modules/[moduleId]/mistakes/page.tsx` | 适配新 mistakes 表结构 |

### 10.3 可复用的基础设施

- `src/lib/handle-route.ts` — API 响应封装
- `src/lib/ai.ts` — 多模型抽象
- `src/lib/prompt-templates.ts` — 模板读取+渲染
- `src/lib/mistakes.ts` — 错题记录工具
- `src/lib/errors.ts` — 错误类型
