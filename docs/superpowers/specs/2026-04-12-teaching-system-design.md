---
date: 2026-04-12
topic: 教学系统顶层设计
type: spec
status: resolved
keywords: [teaching-system, architecture, data-model, API-contract, phasing]
---

# 教学系统顶层设计

**设计日期**：2026-04-12 启动，2026-04-14 拍板完成
**Brainstorm WIP**：`docs/superpowers/specs/2026-04-12-teaching-system-brainstorm-state.md`（10 个决策完整记录）
**范围**：总体设计文档，覆盖教学系统的战略定位、架构决策、数据模型、接口契约与分期范围。M4/M5 的详细实现 spec 在各里程碑启动时另开。

---

## 1. 背景与目标

### 1.1 战略定位

教学模式是产品的**付费墙护城河**：
- **完整模式（Full Mode）**= MVP 基础版，所有用户默认可用。学习路径：阅读 → QA → 测试 → 复习
- **教学模式（Teaching Mode）**= 高价 subscription 解锁。学习路径：阅读 → **AI 教学** → QA → 测试 → 复习。教学环节是 Chi & Wylie 2014 ICAP 框架的 Interactive 层，竞品均无

商业意义：
- token 成本差异可作为卖点宣传（教学模式 > 完整模式）
- MVP 阶段所有用户默认开通教学模式（收集反馈），地基必须支持未来加付费墙无需重构

### 1.2 研究支撑

本次设计基于 10 份调研（`docs/research/` 目录）：

| 调研主题 | 文件 |
|---------|------|
| 5 类知识类型分类 | `2026-04-11-knowledge-type-classification.md` |
| 5×5 教学法×知识类型匹配 | `2026-04-11-pedagogy-knowledge-matching.md` |
| AI 教学 prompt 三层架构 | `2026-04-11-ai-prompt-encoding.md` |
| 微学习 7 条 UX 规则 | `2026-04-11-teaching-ux.md` |
| Testing Effect 边际价值 | `2026-04-12-testing-effect-marginal-value.md` |
| 形成性 vs 总结性评估最优组合 | `2026-04-12-formative-summative-optimal-combo.md` |
| 6 种评估方法按知识类型匹配 | `2026-04-12-alternative-assessment-methods.md` |
| ICAP + Gagne 9 Events 最优序列 | `2026-04-12-optimal-learning-sequence.md` |
| 订阅降级 Entitlement 模式 | `2026-04-13-subscription-downgrade-patterns.md` |
| 前后端顺序 | `2026-04-12-frontend-backend-order.md` |

学习者视角的通用学习路径指南：`docs/learning-path-guide.md`

---

## 2. 范围与分期

**方案 C：两段式**——M4 最小闭环 + M5 差异化升级。

### 2.1 M4：Teaching Mode 最小闭环

**目标**：所有地基一次做对 + 核心教学对话走通，允许 UI 简陋。M4 做完即可上线给用户/朋友试用。

**纳入**：
- 全部 7 项 schema 改动（§4）
- Entitlement 地基（§6）
- 新 5 类知识类型 + `source_anchor` 提取（§4.3, §4.5）
- 5 套 teacher prompts（§5.3）
- Phase 2 教学对话 API + 纯单栏对话 UI
- 模式切换入口（上传页 + 书级按钮）
- Phase 0 简化版（**只显示目标清单**，不做探测题 + 缓存）
- 教学模式下 QA/Test 按产品不变量 #3 延伸隐藏教学对话记录

**不纳入（M5 做）**：
- SplitPane 自动同步高亮
- Phase 0 完整版（探测题生成 + 缓存）
- module_notes 个性化诊断 UI
- 笔记 tab 完整 UI
- 付费墙 UI / 升级 CTA

### 2.2 M5：Teaching Mode 差异化升级

**目标**：基于 M4 用户反馈，做付费墙亮点功能。

**纳入**：
- SplitPane 壳 + 锚点自动同步高亮（数据已在 M4 备好，只加前端）
- Phase 0 完整版：探测题生成 + 缓存（首次进入模块触发）
- module_notes 个性化诊断（QA 完后生成，结合答题表现）
- 笔记 tab 完整 UI（KP 区块 + AI/用户对照 + amber 色）
- 付费墙 UI 预留位（功能标识 + 升级 CTA）

### 2.3 为什么选 C 而非其他

- **一锤子（M4 全做完）**：工作量超 6 周，风险集中，中途一个教学法 prompt 效果差就得整体返工
- **三段式（M4 地基→M5 闭环→M6 体验）**：M4 全后端无前端，无法独立上线验证
- **C 方案**：M4 即可上线验证核心教学闭环，M5 基于真实反馈做差异化

---

## 3. 架构总览

### 3.1 两种模式共存

两种模式**叠加不替代**：
- 完整模式是基础路径
- 教学模式在 QA 之前**插入**教学环节

| 阶段 | 完整模式 | 教学模式 |
|------|---------|---------|
| Phase 0 激活 | 有（目标清单） | 有（目标清单） |
| Phase 1 阅读 | 有 | 有 |
| Phase 2 AI 教学 | **无** | **有**（按知识类型选教学法） |
| Phase 3 QA | 有（闭卷） | 有（闭卷，隐藏教学对话） |
| Phase 4 测试 | 有（80% 过关） | 有（80% 过关，隐藏教学对话+笔记） |
| Phase 5 间隔复习 | 有 | 有 |

### 3.2 学习状态流扩展

**现有状态流**（`docs/architecture.md` §学习状态流，行 87-91）：
```
unstarted → reading → qa → notes_generated → testing → completed
```

**新状态流（pure enum，同时容纳两路径）**：
```
not_started → activating → reading → [taught] → qa_in_progress → qa_complete → tested → completed
                                      ↑ 教学路径走这一步，完整路径跳过
```

关键点：
- `activating`：Phase 0 状态（M4 简化版 = 看一眼目标清单就切下一步）
- `taught`：完整模式**跳过**这个状态（reading → qa_in_progress）
- `notes_generated`：**删除**（现有 `generate-notes` 调用保留为 QA 后的**静默后台触发**，不占状态枚举；M4 完成后状态直接从 `qa_in_progress → qa_complete`，中间由 QA 完成 API 内部 trigger generate-notes，不阻塞流程）
- `qa_in_progress` / `qa_complete`：拆分原 `qa` 为两阶段，更清晰
- `tested` 语义：**"测试已启动或已做过但未通过"**（相当于现有 `testing` 状态的 rename）。测试通过时 `tested → completed` 的 trigger 就是 `test/submit` 的 `is_passed=true`，与现有行为一致，无需新增 trigger 逻辑
- 枚举值**不含 tier 字样**（`taught` 不是 `premium_taught`）——业务表只记事实，权限层解耦

### 3.3 AI 角色（6 个）

现有 5 个角色（`docs/architecture.md` §AI 角色）：extractor / coach / examiner / reviewer / assistant

**新增**：
| 角色 | 职责 |
|------|------|
| **teacher**（新增） | Phase 2 教学对话（按知识类型选教学法） |

不扩展 coach 的理由：
- coach = "评价对错 + 纠错"，teacher = "引导建构"，语义不同
- teacher 可配更贵模型（Opus），coach 用便宜的（Sonnet），成本可控
- cost tracking 清晰：教学 token 与 QA token 分开统计

---

## 4. 数据模型变更

### 4.1 books 表

**新增字段**：
```sql
ALTER TABLE books ADD COLUMN learning_mode TEXT NOT NULL DEFAULT 'full'
  CHECK (learning_mode IN ('teaching', 'full'));
ALTER TABLE books ADD COLUMN preferred_learning_mode TEXT
  CHECK (preferred_learning_mode IN ('teaching', 'full') OR preferred_learning_mode IS NULL);
```

- `learning_mode`：**当前生效的模式**，上传时由用户选择，可切换
- `preferred_learning_mode`：**用户偏好记录**（保留用户意图，与当前 subscription 状态解耦）。未来降级场景用

### 4.2 modules 表

**字段改动**：

现有 `modules.learning_status` 是 `TEXT NOT NULL DEFAULT 'unstarted'`（schema.sql 行 35），**没有 CHECK 约束**。Migration 需要**添加**约束（不是替换）：

```sql
-- Step 1: 数据迁移（旧枚举 → 新枚举，顺序很重要：先改 default 再转 data 再加 check）
ALTER TABLE modules ALTER COLUMN learning_status SET DEFAULT 'not_started';

-- Step 2: 数据转换（幂等）
UPDATE modules SET learning_status = CASE learning_status
  WHEN 'unstarted' THEN 'not_started'
  WHEN 'qa' THEN 'qa_in_progress'
  WHEN 'notes_generated' THEN 'qa_complete'
  WHEN 'testing' THEN 'tested'
  ELSE learning_status
END;

-- Step 3: 加 CHECK 约束（首次添加，非替换；用 IF NOT EXISTS 保证幂等）
ALTER TABLE modules ADD CONSTRAINT modules_learning_status_check
  CHECK (learning_status IN ('not_started', 'activating', 'reading', 'taught',
                              'qa_in_progress', 'qa_complete', 'tested', 'completed'));
```

⚠️ **schema.sql 同步**：initDb() 仅在表不存在时执行 CREATE TABLE，不会更新已有表的默认值或约束。所以上述 ALTER 必须放在独立 migration 文件或 initDb() 后的升级步骤，不能只改 schema.sql。

⚠️ 数据迁移 mapping：
- `unstarted` → `not_started`
- `reading` → `reading`（不变）
- `qa` → `qa_in_progress`
- `notes_generated` → `qa_complete`
- `testing` → `tested`
- `completed` → `completed`（不变）
- 新值 `activating` / `taught` 新记录才会出现，旧数据无需映射

### 4.3 knowledge_points 表

**字段改动**：

现有 `knowledge_points.type` 是列级内联 CHECK（schema.sql 行 59）：
```sql
type TEXT NOT NULL CHECK(type IN ('position','calculation','c1_judgment','c2_evaluation','definition'))
```

Postgres 对列级 CHECK 的自动命名为 `<table>_<column>_check`（通常），但不保证。用 `DROP CONSTRAINT IF EXISTS` 保证幂等：

```sql
-- Step 1: 删除旧 CHECK（用 IF EXISTS 兼容自动命名不确定性）
ALTER TABLE knowledge_points DROP CONSTRAINT IF EXISTS knowledge_points_type_check;

-- Step 2: 添加新 CHECK
ALTER TABLE knowledge_points ADD CONSTRAINT knowledge_points_type_check
  CHECK (type IN ('factual', 'conceptual', 'procedural', 'analytical', 'evaluative'));

-- Step 3: 新增源锚点字段（供 M5 SplitPane 使用，M4 提取时必须填入）
ALTER TABLE knowledge_points ADD COLUMN IF NOT EXISTS source_anchor JSONB;
-- 格式：{ "page": number, "paragraph_index": number, "char_start": number?, "char_end": number? }
```

⚠️ 如果 Postgres 实际生成的约束名不是 `knowledge_points_type_check`，M4 实施时需先用 `SELECT conname FROM pg_constraint WHERE conrelid = 'knowledge_points'::regclass AND contype = 'c'` 查出真名。

⚠️ **无需数据迁移**：当前数据库**一个 KP 都没提取过**（由 session-init 核实），直接替换类型枚举不影响任何既有数据。

旧 5 类（position / calculation / c1_judgment / c2_evaluation / definition）**全部废弃**。TypeScript 类型（`src/lib/services/kp-extraction-types.ts`）同步更新。

### 4.4 teaching_sessions 表（新建）

每次教学会话**独立存储**，不塞进 modules 表：

```sql
CREATE TABLE teaching_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id INTEGER NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  cluster_id INTEGER REFERENCES clusters(id) ON DELETE SET NULL,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  transcript JSONB NOT NULL DEFAULT '[]'::jsonb,  -- 完整对话记录
  depth TEXT NOT NULL DEFAULT 'full' CHECK (depth IN ('light', 'full')),  -- 3 步 vs 5 步
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_teaching_sessions_module ON teaching_sessions(module_id);
CREATE INDEX idx_teaching_sessions_user ON teaching_sessions(user_id);
```

设计理由：
- 独立表支持未来按 user / module / cluster 聚合查询
- `transcript JSONB` 记录完整对话，用于 QA/Test 时隐藏、未来生成笔记、cost tracking
- `depth` 字段支持决策 2 的 AI 默认 + 用户覆盖（importance=1 → light，其他 → full）

### 4.5 user_subscriptions 表（新建，预埋）

MVP 不实装付费墙，但**表结构必须到位**：

```sql
CREATE TABLE user_subscriptions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tier TEXT NOT NULL DEFAULT 'premium' CHECK (tier IN ('free', 'premium')),
  effective_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_user_subscriptions_user ON user_subscriptions(user_id);
```

MVP 策略：
- **新注册用户**：`src/app/api/auth/register/route.ts` 内在创建 users 记录后顺带插入 `(user_id, 'premium', NOW(), NULL)`
- **既有用户 backfill**（migration 一次性执行）：
```sql
INSERT INTO user_subscriptions (user_id, tier, effective_at)
SELECT id, 'premium', NOW() FROM users
WHERE id NOT IN (SELECT user_id FROM user_subscriptions);
```

未来加付费墙只需改 `canUseTeaching()` 函数。

### 4.6 prompt_templates 表

**新增 5 条 teacher 记录**：
- `role='teacher'`, `stage='teach_factual'`
- `role='teacher'`, `stage='teach_conceptual'`
- `role='teacher'`, `stage='teach_procedural'`
- `role='teacher'`, `stage='teach_analytical'`
- `role='teacher'`, `stage='teach_evaluative'`

内容参考 `docs/research/2026-04-11-ai-prompt-encoding.md` §128-134 的 5 种教学法人格 + §168-198 的认知卸载防护硬规则。

---

## 5. 核心接口契约

### 5.1 模式切换 API

**上传时选模式**：
```
POST /api/books
Body: { ..., learning_mode: 'teaching' | 'full' }
```

**书级切换**：
```
PUT /api/books/:bookId/learning-mode
Body: { learning_mode: 'teaching' | 'full' }
Guard: canUseTeaching(userId) 必须通过（若目标为 teaching）
```

切换逻辑：
- `full → teaching`：**不删除**任何 QA/Test/Review 数据，解锁教学入口
- `teaching → full`：**不删除** teaching_sessions，隐藏教学入口

### 5.2 教学对话 API（M4 核心）

**开启教学会话**：
```
POST /api/modules/:moduleId/teaching-sessions
Body: { cluster_id: number, depth?: 'light' | 'full' }
Guard: canUseTeaching(userId)
Response: { data: { sessionId, cluster, knowledgePoints, firstMessage } }
```

**depth 默认解析规则**（服务端）：
- 若 body 带 `depth`，直接用
- 若省略，按 cluster 内 KP 的 importance 解析：**任一 KP importance=1 → `light`；否则 → `full`**
- 这条规则实现在 `src/lib/services/teaching-session.ts` 的 session 创建逻辑里，前端不计算

**发送消息**：
```
POST /api/teaching-sessions/:sessionId/messages
Body: { message: string }
Guard: canUseTeaching(userId) + session ownership
Response: { data: { teacherResponse, shouldAdvance, kpProgress } }
```

**完成会话**：
```
POST /api/teaching-sessions/:sessionId/complete
Guard: canUseTeaching(userId) + session ownership
副作用：设 module.learning_status = 'taught'（若所有 cluster 已教完）
```

### 5.3 Teacher Prompt 选择

Backend 函数：
```typescript
function getTeacherPrompt(kpType: KPType): PromptTemplate {
  const stageMap: Record<KPType, string> = {
    factual: 'teach_factual',
    conceptual: 'teach_conceptual',
    procedural: 'teach_procedural',
    analytical: 'teach_analytical',
    evaluative: 'teach_evaluative',
  };
  return getPrompt('teacher', stageMap[kpType], ...);
}
```

### 5.4 状态流 API 调整

现有 API 受影响：
- `GET /api/books/:bookId/module-status`：返回的 `learningStatus` 字段支持新 8 值
- `GET /api/books/:bookId/dashboard`：聚合逻辑需兼容新状态
- 任何判断 `learning_status === 'notes_generated'` 的代码需改为 `=== 'qa_complete'`
- 任何判断 `learning_status === 'qa'` 的代码需改为 `=== 'qa_in_progress'` 或 `=== 'qa_complete'`

### 5.5 KP 提取契约变化

`extractor` prompt（`src/lib/seed-templates.ts`）需更新：
1. 类型词表换为新 5 类，加入判断标准（参考调研 §101-109）
2. 输出格式**仅新增 `source_anchor` 字段**，其他字段**完全不变**（additive change）

**现有 extractor 输出格式**（保持）：
```json
{
  "kp_code": "...",
  "section_name": "...",
  "description": "...",
  "type": "conceptual",           // 值域：新 5 类（factual / conceptual / procedural / analytical / evaluative）
  "importance": 2,
  "detailed_content": "...",
  "cross_block_risk": "...",
  "ocr_quality": "good",
  "source_anchor": { "page": 12, "paragraph_index": 3 }   // ← 新增
}
```

⚠️ 写库链路 `writeResultsToDB` / `writeModuleResults`（`kp-extraction-service.ts`）对所有现有字段保持消费。M4 实施时只需：
- 改 extractor prompt 的 type 值域判断标准
- 加 source_anchor 到 prompt 输出要求
- 加 source_anchor 到 DB 写入语句

Backend 服务层 `src/lib/services/kp-extraction-types.ts` 的 `KPType` 定义替换：
```typescript
export type KPType = 'factual' | 'conceptual' | 'procedural' | 'analytical' | 'evaluative';
```

### 5.6 教学法→题型映射更新

现有契约（`docs/architecture.md` 行 101-102）：
> calculation → worked_example，其他 → scaffolded_mc/short_answer/comparison

**设计意图**（基于调研）：
| KP type | QA 题型（Phase 3） | 测试题型（Phase 4） |
|---------|------------------|-------------------|
| factual | 单选 / 简答 | 单选（不重复 QA 题型，改用填空） |
| conceptual | Teach-back + 预测题 | 预测 + 比较 |
| procedural | 简答 + 错误检测 | worked_example（或小案例） |
| analytical | 预测 + 比较 | 综合判断题 |
| evaluative | 比较 + 预测 | 案例 + 权衡题 |

跨格式检索效应（Pan & Rickard 2018）：测试题型与 QA 题型**必须不同**。

**M4 实施约束**：

现有 DB schema 限制 `question_type` 枚举值：
- `qa_questions.question_type` 仅支持 `worked_example | scaffolded_mc | short_answer | comparison`（schema.sql 行 123）
- `test_questions.question_type` 仅支持 `single_choice | c2_evaluation | calculation | essay`（schema.sql 行 158）

M4 **不扩展**这两个 CHECK 约束，改为**映射新题型到现有枚举**：

| 设计意图题型 | 映射到 qa_questions.question_type | 备注 |
|-------------|--------------------------------|------|
| Teach-back | `short_answer` | 提示词引导用自己话解释 |
| 预测题 | `scaffolded_mc` | 选项形式的预测 |
| 比较 | `comparison` | 原生支持 |
| 错误检测 | `short_answer` | 提示词附错误步骤让用户找 |
| 单选 | `scaffolded_mc` | 原生支持 |
| 简答 | `short_answer` | 原生支持 |
| worked_example | `worked_example` | 原生支持 |

| 设计意图题型 | 映射到 test_questions.question_type |
|-------------|-----------------------------------|
| 单选 / 填空 | `single_choice`（填空可走 essay） |
| 预测 / 比较 / 综合判断 | `essay` 或 `c2_evaluation`（按内容长度） |
| worked_example / 小案例 / 案例 / 权衡题 | `calculation` 或 `essay` |

**M5 再议**：若题型差异化体验不足，M5 可扩展 CHECK 约束增加原生题型值。M4 依赖 coach / examiner 的 **prompt 引导**实现题型差异，不依赖 schema。

---

## 6. Entitlement 地基

### 6.1 canUseTeaching(userId)

```typescript
// src/lib/entitlement.ts
export async function canUseTeaching(userId: number): Promise<boolean> {
  // MVP：默认所有用户可用
  return true;

  // 未来付费墙实装时：
  // const sub = await getCurrentSubscription(userId);
  // return sub?.tier === 'premium' && (!sub.expires_at || sub.expires_at > new Date());
}
```

### 6.2 所有 teaching-related API 必须走守卫

任何涉及 teacher 角色、teaching_sessions 表、learning_mode 切换到 teaching 的 API，**进入 route handler 第一步**：
```typescript
if (!await canUseTeaching(userId)) {
  return Response.json({ error: 'ENTITLEMENT_REQUIRED' }, { status: 402 });
}
```

### 6.3 books.preferred_learning_mode 语义

- 记录**用户意图**，不代表当前能否使用
- 降级场景（未来）：用户从 premium 降 free，`learning_mode` 可能被系统改为 `full`，但 `preferred_learning_mode='teaching'` 保留，升级回 premium 时自动恢复

---

## 7. UI 改动范围

### 7.1 M4 UI 改动

**新建**：
- `src/app/upload` 模式选择 UI（单选 radio：教学 / 完整）
- 书级页 Action Hub 增加"模式切换"按钮（弹窗确认）
- Phase 0 激活页（模块首次进入）：显示目标清单"本次你将掌握 X / Y / Z" + 继续按钮
- Phase 2 教学对话页（`/modules/:moduleId/teach`）：
  - 单栏对话布局，顶部显示 cluster 标题 + KP 列表进度
  - ChatBubble 复用现有组件（ai 色 / 用户 amber 色）
  - 底部"查看原文"按钮（跳转 PDF 阅读器）
  - 教学完成后"继续 QA"按钮

**修改**：
- QA 页：教学模式下**不显示**"查看教学记录"入口
- Test 页：教学模式下**不显示**教学记录、reading_notes、module_notes 入口

### 7.2 M5 UI 改动（后期）

- Phase 2 教学页：升级为 SplitPane（左 PDF + 右对话，锚点自动高亮）
- Phase 0 升级：加 1-2 道探测题
- 笔记 tab（模块详情页新增）：KP 区块 + AI/用户对照
- 付费墙 UI 预留位

### 7.3 不变的组件

- QASession / TestSession / ReviewSession 组件壳保留
- 组件库（AmberButton / ChatBubble / KnowledgePointList / FeedbackPanel 等）全部复用

---

## 8. 对现有系统的影响

### 8.1 产品不变量（全部保留）

CLAUDE.md 现有 5 条产品不变量**不改不加**：

| # | 不变量 | 教学模式下状态 |
|---|-------|--------------|
| 1 | 用户必须读完原文才能进入 Q&A | 保留（Phase 1 → Phase 2 前也要读完） |
| 2 | Q&A 已答的题不可修改 | 保留 |
| 3 | 测试阶段禁止查看笔记和 Q&A 记录 | **保留 + 延伸**：教学对话、reading_notes、module_notes 在 Phase 4 全部隐藏 |
| 4 | 模块过关线 80% | 保留 |
| 5 | Q&A 一次一题 + 即时反馈 | 保留 |

### 8.2 认知卸载防护（prompt 层实现）

"AI 不能直接给答案"等 4 条硬规则**不提升为产品不变量**，由 teacher prompts 实现时直接引用 `docs/research/2026-04-11-ai-prompt-encoding.md` §168-198。

理由：产品不变量是 UI 可强制的行为规则；认知卸载防护是模型行为约束，属 prompt 层实现规范。

### 8.3 coach 角色职责不变

- Phase 3 QA 仍由 coach 出题 + 评分 + 反馈
- teacher 只负责 Phase 2 教学对话

### 8.4 现有数据状态

- `knowledge_points` 表当前为空，无迁移负担
- `modules.learning_status` 现有数据需简单重命名（6 条枚举改 8 条）
- `books` 表增字段无历史数据影响（DEFAULT 'full'）
- `prompt_templates` 表仅新增，不改旧记录

---

## 9. 开放问题（留到 M4 启动时决策）

以下问题本次顶层设计**不解**，留到 M4 详细 brainstorm 时讨论：

1. **teacher prompt 的具体内容**：5 套 system prompt 怎么写？需要 teacher prompt engineering 子任务
2. **cluster → teaching session 的创建时机**：模块进入 `taught` 状态前，是前端一次性创建所有 session，还是进入 session 才创建？
3. **教学中断恢复**：用户教学中退出，再进入是续上之前对话，还是重新开始？
4. **teaching_sessions.transcript 格式细节**：消息结构 `{role, content, timestamp}` 还是更复杂？
5. **cost tracking 具体字段**：teaching_sessions 要不要直接记 token 数量？还是复用现有 logs 表？
6. **模式切换的"提示/警告"UX**：切换弹窗显示什么信息？
7. **Phase 0 简化版的视觉**：目标清单用什么组件渲染？

---

## 10. 风险与未知

### 10.1 已识别风险

- **教学 prompt 效果不稳定**：5 种教学法依赖 prompt 工程质量，M4 可能需要多轮迭代
  - 缓解：teacher prompts 放在 `prompt_templates` 表而非硬编码，支持不改代码调优
- **状态流扩展可能遗漏既有代码路径**：现有 API / 前端有多处判断 `learning_status`
  - 缓解：M4 启动时先全局 grep `learning_status`，列出所有影响点
- **source_anchor 提取质量**：AI 可能输出错误的页码/段落索引
  - 缓解：M4 不消费 source_anchor（只存储），M5 消费时发现质量不够再补提取 prompt

### 10.2 未知

- **付费墙转化率**：MVP 不做付费墙，未来转化率需实际数据验证
- **teacher 模型成本**：Opus vs Sonnet 的教学效果差多少、成本差多少，需 A/B 测试
- **用户是否真的想要 SplitPane**：M5 功能基于假设"同屏对照提升体验"，需用户反馈验证

---

## 11. 下一步

1. **本 spec 进入 review loop**：dispatch general-purpose agent 做 5 维度审查
2. **用户审阅 spec** 后，按 brainstorming skill 流程进 writing-plans
3. **立即处理停车场 T1**（brainstorming skill WIP 机制沉淀）→ `docs/journal/2026-04-14-brainstorming-skill-wip-mechanism.md`
4. **M4 启动时**另开 brainstorm，解决本 spec §9 的开放问题
5. **M5 启动时**基于 M4 用户反馈再开 brainstorm

---

## 附录 A：决策索引

完整决策记录在 WIP 文件 `docs/superpowers/specs/2026-04-12-teaching-system-brainstorm-state.md`：

| # | 决策 | 对应本 spec 章节 |
|---|------|----------------|
| 1 | 两种模式切换机制 | §3.1, §4.1, §5.1, §6 |
| 2 | 教学 Session 粒度与分段 | §4.4（depth 字段） |
| 3 | 学习状态流 + Entitlement 地基 | §3.2, §4.4, §4.5, §6 |
| 4 | Phase 0 具体形态 | §2.1（M4 简化版）, §2.2（M5 完整版） |
| 5 | 教学与原文结合（SplitPane） | §4.3（source_anchor）, §7.2 |
| 6 | Notes 降级后的去处 | §3.2（删 notes_generated）, §7.2 |
| 7 | 知识类型迁移策略 | §4.3 |
| 8 | AI 角色组织（新增 teacher） | §3.3, §4.6, §5.3 |
| 9 | 产品不变量是否修改 | §8.1, §8.2 |
| 10 | 开发范围与分阶段（方案 C） | §2 |

---

## 附录 B：变更清单预览

**新建文件**（预计）：
- `src/lib/entitlement.ts`
- `src/lib/services/teaching-session.ts`
- `src/app/api/books/[bookId]/learning-mode/route.ts`
- `src/app/api/modules/[moduleId]/teaching-sessions/route.ts`
- `src/app/api/teaching-sessions/[sessionId]/messages/route.ts`
- `src/app/api/teaching-sessions/[sessionId]/complete/route.ts`
- `src/app/books/[bookId]/modules/[moduleId]/teach/page.tsx`
- `src/app/books/[bookId]/modules/[moduleId]/activate/page.tsx`（Phase 0）
- Migration SQL 文件（§4 全部 ALTER + user_subscriptions backfill）

**修改文件**（预计）：
- `src/lib/schema.sql`（新表 teaching_sessions / user_subscriptions 声明，用于新库初始化；已有库走 migration）
- `src/lib/seed-templates.ts`（extractor prompt type 值域更新 + 5 条 teacher 模板新增）
- `src/lib/services/kp-extraction-types.ts`（KPType 替换为新 5 类）
- `src/lib/services/kp-extraction-service.ts`（写库语句加 source_anchor）
- `src/lib/services/book-service.ts`（learning_mode / preferred_learning_mode 读写）
- `src/app/api/auth/register/route.ts`（注册时插 user_subscriptions 默认 premium 行）
- **消费 `learning_status` 的 21 个文件（grep 确认清单）**：
  - API：`src/app/api/modules/route.ts`, `src/app/api/modules/[moduleId]/{status,generate-notes,generate-questions,evaluate,questions}/route.ts`, `src/app/api/modules/[moduleId]/test/{route.ts,generate/route.ts,submit/route.ts}`, `src/app/api/books/[bookId]/{dashboard,module-map/route.ts,module-map/confirm/route.ts}/route.ts`
  - UI：`src/app/page.tsx`, `src/app/books/[bookId]/{ActionHub.tsx,ModuleMap.tsx}`, `src/app/books/[bookId]/modules/[moduleId]/{page.tsx,ModuleLearning.tsx,NotesDisplay.tsx,qa/page.tsx,test/page.tsx,test/TestSession.tsx}`
  - ⚠️ **特别注意硬编码 literal**：`module-map/confirm/route.ts` 有硬编码 `'unstarted'` 和 `'reading'` 字面量需同步改名，否则 module-map confirm 流程会 silent fail
- 上传页模式选择 UI（`src/app/upload/*`）
- Test 页 / QA 页的教学记录隐藏逻辑

**文档同步**（CLAUDE.md 硬规则，M4 收尾必须完成）：
- `docs/architecture.md` — 更新 DB 表数 24→26、AI 角色 5→6、新增 teaching-sessions API 分组、新状态流 8 值、新 learning-status 规则、§5.6 题型映射契约、§KP 提取契约 source_anchor 字段
- `docs/project_status.md` — 记录 M4 里程碑完成
- `docs/changelog.md` — 记录变更

具体文件清单在 M4 启动的详细 spec 中根据实际 grep 结果精确化。
