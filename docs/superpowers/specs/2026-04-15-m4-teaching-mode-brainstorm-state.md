---
date: 2026-04-15
topic: M4教学模式Brainstorm进度追踪
type: spec
status: resolved
keywords: [M4, teaching-mode, brainstorm, WIP, compact-defense]
---

# M4 教学系统最小闭环 Brainstorm 进行中状态（WIP）

**创建日期**: 2026-04-15
**用途**: compact 防御——记录 M4 brainstorm 进度，避免 session 断档丢失状态
**最终产出**: `docs/superpowers/specs/2026-04-15-m4-teaching-mode-design.md`
**父设计**: `docs/superpowers/specs/2026-04-12-teaching-system-design.md`（顶层教学系统设计，2026-04-14 拍板）

> ⚠️ compact 后恢复时**先读这个文件**，再读父设计 spec，不要从 summary 重建——summary 会丢细节。

---

## 基础设定（不会变）

以下来自父设计 spec（`2026-04-12-teaching-system-design.md`），M4 brainstorm **不重开讨论**：

1. **方案 C**：两段式 M4（最小闭环）+ M5（差异化升级）——父 §2
2. **M4 scope**：全部 7 项 schema 改动 + Entitlement 地基 + 新 5 类 KP + source_anchor 提取 + 5 套 teacher prompts + Phase 2 对话 API + 纯单栏对话 UI + 模式切换入口 + Phase 0 简化版（只目标清单） + QA/Test 隐藏教学记录——父 §2.1
3. **M4 不做**（M5 做）：SplitPane / Phase 0 完整版 / module_notes / 笔记 tab / 付费墙 UI——父 §2.1
4. **状态流 8 值**：`not_started → activating → reading → [taught] → qa_in_progress → qa_complete → tested → completed`——父 §3.2
5. **6 AI 角色**：extractor / coach / examiner / reviewer / assistant / **teacher**（新）——父 §3.3
6. **产品不变量 5 条全保留**，教学模式下延伸不变量 #3——父 §8.1
7. **Entitlement**：MVP `canUseTeaching()` 永远 return true，但 API guard 必须到位——父 §6
8. **数据模型 7 项改动**：books 加 2 列、modules.learning_status CHECK、knowledge_points.type + source_anchor、teaching_sessions 新表、user_subscriptions 新表、prompt_templates 加 5 条 teacher 模板——父 §4

---

## 调研

**父设计已引用（M4 brainstorm 可复用）**：
- `docs/research/2026-04-11-knowledge-type-classification.md` — 5 类 KP 判断标准
- `docs/research/2026-04-11-pedagogy-knowledge-matching.md` — 5×5 教学法×KP 类型匹配 + 5 种 teacher 人格
- `docs/research/2026-04-11-ai-prompt-encoding.md` — 三层 prompt 架构 + 认知卸载防护硬规则
- `docs/research/2026-04-11-teaching-ux.md` — 微学习 7 条 UX 规则
- `docs/research/2026-04-12-optimal-learning-sequence.md` — ICAP + Gagne 9 Events

**M4 brainstorm 可能新增**：
- 🟡 teacher 模型选择（Opus 4.6 vs Sonnet 4.6 vs Haiku 4.5 在教学引导任务的能力/成本对比）
- 🟡 cluster 完成判定（pedagogy 推荐判定机制）
- 🟡 5 套 teacher prompt 的 JSON 响应结构（统一 vs 因人而异）

---

## 已拍死的决策（不再讨论）

### 决策 1：teacher 模型选择（2026-04-15 拍板）

**拍定**：**MVP 单档 Sonnet 4.6（premium）+ 地基支持多档位按价格分层**

**地基改动（M4 后端）**：

1. `prompt_templates` 表加列 `model TEXT NULL`——每条 teacher 模板可独立 override 模型；null 时 fallback 到 tier 默认模型
2. 新建 `src/lib/teacher-model.ts`：
   ```ts
   type Tier = 'free' | 'premium'
   const tierModelMap: Record<Tier, string> = {
     free: 'google:gemini-2.5-flash-lite',   // 占位，MVP 不触发（canUseTeaching() 永远返 true → 所有用户当 premium）
     premium: 'anthropic:claude-sonnet-4-6', // MVP 默认
   }
   export function getTeacherModel(tier: Tier, overrideModel?: string | null) {
     return overrideModel ?? tierModelMap[tier]
   }
   ```
3. 5 条 teacher prompt 模板插入时 `model=NULL`——全走 premium tier = Sonnet 4.6
4. M4 Phase 2 教学对话路由（`teaching-sessions/[sessionId]/messages`）调 `getTeacherModel(userTier, template.model)` 取实际模型

**为什么 premium=Sonnet 4.6 而非 Opus**（用户拍）：
- 用户已有 ANTHROPIC_API_KEY（项目默认 AI_MODEL = Sonnet），零 provider 新增
- Sonnet 4.6 在 coach 角色已验证可用，教学质量下限有保障
- MVP 100 用户 × 1 书成本 ~$104，可接受
- 发现某 KP 类型（如 analytical / evaluative）教学深度不足 → SQL 一行升 Opus：`UPDATE prompt_templates SET model='anthropic:claude-opus-4-6' WHERE stage='teach_analytical'`

**为什么 free 占位用 Gemini Flash-Lite**（Claude 判断）：
- 用户上一轮说"先搞一个 Google 派的，中文的之后再说但是可以做"——Google 派占住 free tier 符合意图
- Flash-Lite $3/100 用户，全场最便宜，品牌安全（对海外用户）
- MVP 不触发 free tier（canUseTeaching 永远 true → 所有人当 premium），占位值只为地基完整
- M5 启动 paywall 时可 A/B 切 DeepSeek V3.2 / Kimi K2.5 测中文教材场景

**为什么 5 条模板初始 model=NULL**（YAGNI）：
- 不预设 Opus 升级，MVP 跑一轮看实际反馈再做 per-template 差异化
- 预设会埋没"真实需要 Opus 的具体类型"的信号

**反悔成本**：
- 换 premium tier 模型：改 tierModelMap 常量一行
- 升级某类 KP：UPDATE SQL 一行
- 加中文派：改 tierModelMap.free 或为 tier enum 扩展

**调研记录**：`docs/research/2026-04-15-teacher-model-selection.md`（7 款模型 2026-04 官方 pricing）

**决定的下游影响**：
- 决策 5（cost tracking）：记 token 时需要记实际用的 model_id（因为可能 per-template 不一样）
- 决策 6（5 套 prompt 结构）：prompt 长度上限按 Sonnet 4.6 算（200K context 足够）
- 决策 12（失败处理）：429 / 超时时是否 fallback 到更便宜 tier？留给决策 12 讨论

---

### 决策 3：cluster 完成判定机制（2026-04-15 拍板）

**拍定**：**Option C 混合模式（AI 状态 + UI 进度条 + 学生可控 + struggling 硬上限）**

**核心机制**：

1. **teacher 每轮输出 status 枚举**：
   - `teaching`：还在教学中，继续对话；UI "下一节"按钮存在但灰度不高亮
   - `ready_to_advance`：AI 判断学生懂了；UI "下一节"按钮变绿发光提示推进
   - `struggling`：AI 判断学生卡住；UI 弹"查看原文"链接 + 下一轮 teacher 换教学角度（换问法 / 换类比）

2. **"下一节"按钮永远可点**——学生自主跳过权优先于 AI 判定；AI 只发建议，学生自己决定啥时候走

3. **无全局轮数上限**（用户明确否决"full=10 / light=6 全局硬上限"）——有效教学对话可能 15+ 轮，一刀切会杀掉深度讨论

4. **struggling 硬上限（唯一保底机制）**：
   - 连续 3 轮 `status: 'struggling'` → 教学对话**冻结**
   - 弹强制二选一（不提供"继续聊"）：
     - `← 回去再读一次原文`（跳回 Phase 1，可重新开启 Phase 2）
     - `→ 直接进 QA 试试`（跳到 Phase 3，靠 QA 错题反馈补）
   - 中间任意一轮非 struggling 计数清零
   - 为什么是 3：1 轮可能只是没答好；2 轮算趋势；3 轮是 AI 换过一次角度仍未通——系统性卡住，再聊也是循环

5. **KP 教学顺序**：按 cluster 内 knowledge_points 表的现有顺序（已按难度/重要度排过），**不新增 schema 字段**

6. **按钮文案**：
   - 中间 cluster：`→ 下一节`
   - 本模块最后一个 cluster：`→ 进入 QA`

7. **教学收获捕获（retention 支柱 M4 种子）**：
   - transcript 每条消息打 `kind` 标签（具体枚举值由决策 4 最终定）
   - teacher 每教完一个 KP → transcript 自动插入一条 `kind='kp_takeaway'` 消息（AI 生成 1-2 句精简总结）
   - **M4 只捕获不暴露**；M5 笔记 tab 新增"从教学中学到的"板块查询这些 takeaway
   - 与 `reading_notes`（用户手打的笔记）**分开存**——避免来源混淆

**teacher 每轮响应 schema**（JSON）：

```json
{
  "message": "Socratic 问题 / 解释 / 鼓励",
  "status": "teaching | ready_to_advance | struggling",
  "progress": {
    "currentKpId": 123,
    "coveredKpIds": [121, 122]
  },
  "kpTakeaway": {
    "kpId": 122,
    "summary": "1-2 句精简总结"
  }
}
```

(`kpTakeaway` 为 null 时表示本轮没教完任何 KP)

**被 reject 的方案**：
- **A) 纯固定步数**（full=5 / light=3）：无法适配学生节奏，聪明学生前 3 轮浪费，吃力学生第 5 轮仍糊涂被硬推进 QA
- **B) 纯 AI 判定**（无按钮无进度条）：黑箱无学生控制——学生觉得懂了走不了 / AI 判断错误就被推走
- **全局硬上限 10/6 轮**：用户明确否决——有效学习可能 15+ 轮；真正需要保底的是"循环无效"场景，struggling 连续 3 轮已精确捕获

**反悔成本**：
- 改 struggling 阈值 3：一行常量（极低）
- 换 status 枚举值：prompt + API + UI 三处联动（中等）
- 取消进度条：UI 组件不渲染即可（低）
- 取消 kp_takeaway 捕获：prompt 删字段 + transcript kind 删枚举值（低），但 M5 笔记 tab 会失去数据源

**决定的下游影响**：
- **决策 4（transcript 格式）**：每条消息必须有 `kind` 字段；枚举至少覆盖 `socratic_question` / `student_response` / `kp_takeaway` / `struggling_hint`
- **决策 6（5 套 prompt 结构）**：teacher prompt 必须输出上述 schema 的 JSON；推荐 Vercel AI SDK `generateObject` + Zod schema（强制结构化、失败可重试）
- **决策 12（失败处理）**：teacher JSON 解析失败是单独一类错误，不能 fallback 为"继续聊"（会丢 status 信号）
- **M5 retention 支柱**：`teaching_takeaways` 表/视图基于 kind='kp_takeaway' 的 transcript 条目构建

---

### 决策 4：transcript JSONB 格式（2026-04-15 拍板）

**拍定**：**Option B 信封结构 + per-teacher-message tokens + version 字段**

**完整 schema**：

```json
{
  "version": 1,
  "state": {
    "depth": "full | light",
    "currentKpId": 123,
    "coveredKpIds": [121, 122],
    "strugglingStreak": 0,
    "startedAt": "2026-04-15T10:00:00Z",
    "lastActiveAt": "2026-04-15T10:15:00Z",
    "tokensInTotal": 5000,
    "tokensOutTotal": 800
  },
  "messages": [
    {"kind": "socratic_question", "role": "teacher", "content": "...", "kpId": 121, "ts": "...", "tokensIn": 1200, "tokensOut": 150, "model": "anthropic:claude-sonnet-4-6"},
    {"kind": "student_response", "role": "user", "content": "...", "ts": "..."},
    {"kind": "kp_takeaway", "role": "teacher", "kpId": 121, "summary": "...", "ts": "...", "tokensIn": 800, "tokensOut": 80, "model": "anthropic:claude-sonnet-4-6"},
    {"kind": "struggling_hint", "role": "teacher", "content": "...", "kpId": 122, "ts": "...", "tokensIn": 1500, "tokensOut": 200, "model": "anthropic:claude-sonnet-4-6"}
  ]
}
```

**字段表**:

| kind | 必填 | 可选 |
|------|------|------|
| `socratic_question` | kind, role='teacher', content, ts | kpId, tokensIn, tokensOut, model |
| `student_response` | kind, role='user', content, ts | — |
| `kp_takeaway` | kind, role='teacher', kpId, summary, ts | tokensIn, tokensOut, model |
| `struggling_hint` | kind, role='teacher', content, ts | kpId, tokensIn, tokensOut, model |

**state 字段语义**：
- `version`：schema 版本号，M4 起始为 1；M5 增字段时 +1，迁移代码读 version 决定如何 parse
- `depth`：'full' 或 'light'，session 创建时定（决策 11 中途切换若以后启用，会动这里）
- `currentKpId`：当前正在教学的 KP id（cluster 第一个 KP 默认）
- `coveredKpIds`：已完成 takeaway 的 KP id 列表；UI 进度条 = coveredKpIds.length / cluster.kpCount
- `strugglingStreak`：连续 struggling 轮数计数器；决策 3 的 3 轮硬上限读这个；任意一轮非 struggling → 重置为 0
- `startedAt` / `lastActiveAt`：决策 7（中断恢复，L2 延后）的时间窗判断依据
- `tokensInTotal` / `tokensOutTotal`：session 累计，UI 显成本快速读；权威源是 per-message tokens，total 为 derived cache，messages 写入时同步累加

**为什么 state 在 JSONB 信封而非 SQL 列**：
- 不扩父 spec §4 teaching_sessions 的列定义（父 spec 已锁 schema 改动 7 项，避免 scope creep）
- 状态原子更新：消息追加 + state 更新一次 JSONB 写入，事务一致性免费
- 缺点：复杂状态查询不友好（如"strugglingStreak=3 被冻结的 session"），但 M4 不需要这种查询

**为什么 teacher 消息带 per-message tokens / model**：
- 决策 1 允许 per-template model override，未来某些 KP 类型可能 Sonnet，某些 Opus
- per-message 记 model + tokens 才能精确算成本 / 调优
- 学生消息不带 tokens（学生输入不过 AI，无意义）

**为什么 version 字段**：
- M5 可能加字段（hintsUsed, replayCount, ratingByUser），有 version 才能写迁移代码
- 不加 version → M5 只能 best-effort parse 老数据，容易 silent broken

**被 reject 的方案**：
- **A) 扁平数组**：state 派生自消息（遍历算），每次 UI 更新进度条 / 检查 strugglingStreak 都要 re-derive，效率差且容易写错
- **C) state 下沉到 SQL 列**：扩 teaching_sessions schema 触父 spec 已锁定的 7 项改动列表（scope creep）；两个源（state 列 vs 从消息派生）易漂移

**反悔成本**：
- 加新字段：JSONB 自由扩，向前兼容（旧数据没该字段就 undefined）
- 删字段：不删旧 session 数据，新写不放即可
- envelope → flat：要写 migration 把 state 字段塞入第一条特殊 message（中等代价）
- envelope → SQL 列下沉：ALTER TABLE + migration UPDATE，触父 spec scope（需要重开父决策）

**决定的下游影响**：
- **决策 6（5 套 prompt 结构）**：teacher prompt 必须输出能 map 到 4 种 kind 的 JSON；推荐 Vercel AI SDK `generateObject` + Zod schema 强制结构化
- **决策 12（失败处理）**：JSON 解析失败时不写入新 message，但要更新 state.lastActiveAt 防止"卡住假装活着"
- **决策 5（cost tracking，L3 延后）**：可直接读 state.tokensInTotal/Out 或 SUM messages，无需新表
- **决策 7（中断恢复，L2 延后）**：用 state.lastActiveAt + state.currentKpId 决定续 vs 重开

---

### 决策 6：5 套 teacher prompt 结构（2026-04-15 拍板）

**拍定**：**Option B 三层架构 + 共享 Zod schema + 直接采用研究已有 5 套 persona**

**三层职责分工**：

| Layer | 内容 | 存储位置 | 改动代价 |
|-------|------|---------|---------|
| Layer 1 | universal 规则（5 老师共用） | `src/lib/teacher-prompts.ts` 常量 + Zod schema | 改一处，5 老师全同步 |
| Layer 2 | per-KP-type persona + 教学法（5 套） | `prompt_templates` 表 5 条记录（role='teacher'） | SQL UPDATE 一行 |
| Layer 3 | per-call 动态上下文 | API route 运行时拼装 | 代码改一处 |

**Layer 1 内容**（7 大块，写死在 `src/lib/teacher-prompts.ts`）：

1. **认知卸载防护铁律**（来自 `docs/research/2026-04-11-ai-prompt-encoding.md` §168-185）：不在学生尝试前给答案 / 一次只推进一步 / 不说"答案是 X" / 学生直问答案时回"一步步来想"
2. **困惑诊断策略**（§187-198）：4 种困惑层级 × 4 种应对；不问"懂了吗"，让学生用自己话复述
3. **反馈原则**（§200-209）：不说"错了"用间接暗示；错误 3 类（手误/概念/系统性）对应 3 种处理
4. **回复长度控制**（§211-218）：100-200 字；一次只教一个要点；不超过 3 段
5. **输出 JSON schema**（决策 4 TranscriptMessage 约束）：必须吐能 map 到 4 种 kind 的 JSON
6. **status 判定语义**（决策 3）：teaching / ready_to_advance / struggling 各自触发条件
7. **角色边界**：你是 teacher，不是 coach / examiner；不出题不判分，只引导对话

**Layer 2 内容**（5 条 prompt_templates 记录）：

| stage | KP 类型 | 教学人格 | 教学法核心 |
|-------|---------|---------|------------|
| `teach_factual` | 事实型 | 教授型（清晰高效） | 类比锚定 → 正式定义 → 追问"为什么用这个词" → 学生复述 |
| `teach_conceptual` | 概念型 | 导师型（引导思考） | 激活先知 → 日常类比 → 正反例对比 → 学生用自己话解释 |
| `teach_procedural` | 过程型 | 教练型（耐心示范） | 完整演示 → Faded → 独立 → 变式迁移 |
| `teach_analytical` | 分析型 | 师傅型（展示思维） | Modeling → Coaching → Scaffolding → Articulation |
| `teach_evaluative` | 评估型 | 同行型（一起讨论） | 案例 → 学生判断 → 反面论点 → What-if 变条件 |

直接采用 `docs/research/2026-04-11-pedagogy-knowledge-matching.md` §51-157 的完整 5 步流程定义，**brainstorm 不重写 prompt 文案**，留 M4 implementation 阶段写。

**Layer 3 内容**（API route 运行时拼装）注入：
- 当前 KP：`kp_content` / `kp_name` / `kp_type` / `source_anchor`
- 当前 cluster 内 KP 列表（供 status.progress 用）
- `transcript.messages` 最近 10 条（token 预算决定 N，M4 取 10）
- `transcript.state.strugglingStreak`（决策 3 硬上限依据）
- 学生上一轮 response

**生成方式**：Vercel AI SDK `generateObject({ schema: TranscriptOutputSchema })` 替代 `generateText + JSON.parse`
- 非法 JSON 自动重试（schema 级）
- TypeScript + Zod 编译/运行期双重类型安全
- 决策 12 失败处理只需处理 schema validation error，不手写 JSON.parse try-catch

**5 条记录的 model 字段**：全部 NULL——走 `tierModelMap.premium = Sonnet 4.6`（决策 1）。发现某类教学深度不足再 SQL 一行升级：`UPDATE prompt_templates SET model='anthropic:claude-opus-4-6' WHERE role='teacher' AND stage='teach_analytical'`。

**被 reject 的方案**：
- **A) 5 套完全独立 prompt**：universal 规则（防认知卸载、输出 schema、回复长度）5 份各写一遍；铁律变动要改 5 处；Zod schema 重复 5 次
- **C) 单一 mega prompt + 类型分支**（system 里 if-else 切 5 套）：prompt 巨长；模型易在分支间混淆；每次调用 ~3000 tok 浪费在不相关分支

**反悔成本**：
- Layer 1 铁律调整：改 `src/lib/teacher-prompts.ts` 常量一处（极低）
- Layer 2 单类 persona 调整：UPDATE prompt_templates WHERE stage='teach_xxx'（极低）
- Layer 2 拆分（例如按 KP 难度再分）：新 stage + 新记录（中）
- 整体三层 → 五独立：要拆 shared constants、迁移 Zod schema（较大）

**决定的下游影响**：
- **决策 12（失败处理）**：generateObject 抛 Zod 验证失败是单独一类错误，要和 network timeout / API 429 分开处理
- **M4 implementation deliverable**：
  - 新文件 `src/lib/teacher-prompts.ts`（Layer 1 常量 + TranscriptOutputSchema Zod + buildTeacherMessages 拼装函数）
  - 修改 `src/lib/seed-templates.ts` 末尾追加 5 条 role='teacher' 记录
  - 新 API route `src/app/api/teaching-sessions/[sessionId]/messages/route.ts`
- **父 spec §4 schema 改动 #6**（prompt_templates + 5 teacher 记录）至此完全具体化

**调研引用**：
- `docs/research/2026-04-11-ai-prompt-encoding.md` §100-218（三层架构 + Layer 1 铁律全文）
- `docs/research/2026-04-11-pedagogy-knowledge-matching.md` §51-157（5 套 persona 完整流程）
- **代码现状核实**（2026-04-15）：`src/lib/seed-templates.ts` 现有 5 角色（extractor/coach/examiner/reviewer/assistant），**无 teacher 角色**，M4 新增是 greenfield

---

### 决策 12：教学失败/超时处理（2026-04-15 拍板）

**拍定**：**Option A——3 次指数退避重试 + 失败后 toast + 保留对话**

**错误分类**（2 大类）：

| 类别 | 触发情况 | 处理路径 |
|------|---------|---------|
| **网络层** | 超时 / 429 限流 / 5xx / 断网 | 3 次退避重试（1s → 2s → 4s） |
| **内容层** | `generateObject` Zod schema 校验失败（模型输出格式错 / 缺字段 / status 非枚举值） | 同样 3 次重试（模型抽风是概率事件，重发大概率过） |

**3 次都失败后**：
- API 返回 503 + error payload `{ reason: 'teacher_unavailable' | 'invalid_output', retryable: true }`
- 前端 toast 提示 "AI 暂时不在线，请稍后继续"（全中文，不暴露技术原因）
- **teaching_sessions 对话状态完全保留**：不写入失败那轮的 message，`transcript.state.lastActiveAt` 更新到最后一次成功的时刻，status 保留原值
- 用户可点"重发"手动再试；或退出重入（决策 7 中断恢复走同一 state）

**不做 fallback 降档**（拒绝 Option B）：
- 决策 1 已承诺"用户选 tier"对应的具体模型能力；自动降档打破承诺
- 付费用户如果被悄悄降档，教学体验与计费不匹配
- 如果真要做降档是产品决策，不在 M4 范围

**不做 C（一次失败直接 toast）**：
- 429 大多瞬时，不重试等于"用户随时被打断"，体验差

**strugglingStreak 与失败的区分**：
- strugglingStreak=3 是**教学状态**（学生连续困惑），由 API 层拦截不再调模型、推送"重读 / 跳 QA"二选一
- 失败是**系统故障**，与 struggling 计数无关——重试成功后照常累加或归零 strugglingStreak，重试失败不改变 strugglingStreak（那轮视为未发生）

**具体实现**：
- `src/app/api/teaching-sessions/[sessionId]/messages/route.ts` 内包一层 `retryWithBackoff(fn, { maxAttempts: 3, base: 1000 })` 辅助函数
- 网络错误（`fetch` 抛错 / timeout / 429 / 5xx）和 Zod 校验错（`generateObject` 抛 `AI_TypeValidationError`）都进重试循环
- 4xx（除 429）不重试：直接 500 + 写入 console.error（通常是代码 bug）
- 3 次失败后数据库写 `transcript.state.lastError = { reason, at, attemptCount: 3 }`（不持久化错误消息到 messages 数组，避免污染对话历史）

**Downstream 影响**：
- 决策 1 的 tier → model 映射保持单向不降级
- 决策 4 的 envelope 增加可选字段 `state.lastError?: { reason: 'teacher_unavailable' | 'invalid_output', at: timestamp, attemptCount: number }`
- 决策 7（中断恢复）可通过 `state.lastError` 在续课时判断上次是否因故障中断，给用户显示"上次对话因系统问题中断，已为你保留进度"

**实施 deliverables**：
- `src/lib/retry.ts`（新建，跨模块复用）— `retryWithBackoff` + 错误分类 helper
- `src/app/api/teaching-sessions/[sessionId]/messages/route.ts` 集成
- 前端 `components/TeachingChat`(决策 13 拆分）— toast + "重发" 按钮
- `transcript` TS 类型 `state` 扩展 `lastError?`

---

### 决策 8：模式切换弹窗 UX（2026-04-15 拍板）

**拍定**：**B 场景（认真选择）+ Y 轻量推荐 + 简化弹窗（告知+确认）+ 左侧 BookTOC 引导态选起点**

**子决策全锁定**（5 条）：

1. **场景定位 B**：弹窗以"帮用户决策这本书用哪种模式学"为目的。拒绝 A（好奇对比 MVP 几乎不发生）/ C（节省规避需付费墙）/ D（混合信息过载）。

2. **推荐机制 Y（轻量 if-else）**：基于书属性（KP 数量 / 扫描质量 / 学科）给一句提示。文案基调"建议"不"应该"。拒绝 X（不推荐）/ Z（重推荐 MVP 数据不足）。

3. **触发位置**：书级 ActionHub `/books/[bookId]` HeroCard 右上角 `⇄ 切换模式` 按钮。当前模式徽章 `当前：🎓 教学模式` 显示在按钮左侧。**上传页 `/upload` 的学习模式表单不走弹窗**（不在决策 8 scope）。

4. **切换方式**（2026-04-15 用户提案，替代 Claude 原提的三选一/下拉）：
   - 弹窗 = **纯告知+确认**（无选择器），展示 3 维差异表（流程 / 时间 / 学习效果）+ `[取消] [确定切换]`
   - 确认后弹窗关闭 → 左侧 BookTOC 进入**引导态**：边框加粗 / 尺寸放大 / 柔和发光 + 箭头动画指向推荐起点 + "点击模块从这里开始教学"提示
   - 箭头默认指向 **下一个 `not_started` 模块**（全部完成 → 第一模块）
   - 已完成/学习中模块灰化，未开始模块正常色
   - 起点模块处理：learning_status **reset 到 not_started**，清除半截 reading/qa/test 状态
   - 粒度：**模块级**（用户点哪个模块就从哪开始）

5. **前置依赖 `BookTOC` 新组件**：`/books/[bookId]` 左侧永久存在+可折叠，两层结构（章节 → 模块）。默认态显示模块状态（已完成✓ / 学习中 / 未开始 / 过关 / 未过），引导态为决策 8 专属。**不只服务决策 8**——M4 后续学习/复习/测试页都要用（M4 L2 必做）。

**文案草稿**（完整 → 教学方向，反向对称）：
```
标题：切换到教学模式？

💡 这本书 KP 密度较高（47 个），教学模式会把抽象概念拆开讲，
   更适合打基础。

| 维度     | 完整模式（当前）      | 教学模式（切换后）              |
|----------|----------------------|--------------------------------|
| 流程     | 读原文 → Q&A → 测试  | 读前指引 → 教学对话 → Q&A → 测试 |
| 时间     | 约 20 分钟/模块       | 约 35 分钟/模块（多教学对话）    |
| 学习效果 | 快速过完知识点        | AI 老师讲到你真的懂              |

点"确定"后，左侧目录会进入选择模式，请选一个模块开始教学。

  [ 取消 ]   [ 确定切换 ]
```

反向（教学 → 完整）：推荐语改为"这本书 KP 较少（X 个）/ 内容偏实用，完整模式够用"。

**实施 deliverables**：
- `src/components/BookTOC/`（Gemini，新组件）— 基础态 + 引导态 + 折叠
- `src/components/ModeSwitch/ModeSwitchDialog.tsx`（Gemini）— 弹窗 + 3 维表
- `src/app/books/[bookId]/page.tsx`（Gemini）— HeroCard 加按钮 + 左侧布局改造
- `src/app/api/books/[bookId]/switch-mode/route.ts`（Codex）— `POST {newMode, startModuleId}`
- `src/lib/book-meta-analyzer.ts`（Codex）— 轻量 if-else 推荐规则
- `src/lib/books/reset-module.ts`（Codex）— learning_status reset 到 not_started

**下游影响**：
- 决策 9（Phase 0 简化版视觉）：BookTOC 点击模块 → 跳转 `/modules/[moduleId]/activate`
- 决策 10（教学 → QA 过渡）：教学完成后 BookTOC 可用于高亮下一模块
- **books 表不加** `teaching_start_module_id` 字段（起点=用户点击的模块，reset 后无需持久化）
- M4 L2 scope 增量：**BookTOC 是新组件，非简单复用**，前置依赖

**反悔成本**：
- 改推荐规则：改 `book-meta-analyzer.ts` if-else 条件
- 改粒度（退回下拉/三选一）：改 BookTOC 引导态 handler + 弹窗增选择器
- 移除 BookTOC：影响决策 8/9/10，需同步改 3 个 UI 决策（成本较高——慎重）

---

### 决策 9：Phase 0 激活页（2026-04-16 拍板）

**拍定**：**方案 D · 新组件 `ObjectivesList`**（非 A 纯朴素、非 B 复用 KnowledgePointList）

**子决策**：

1. **视觉方向**：参照 B mockup 的分层 card 布局（比 A 的朴素 `<ol>` 视觉饱满，符合付费产品质感）
2. **type badge 处理**：**彻底不渲染**——KP type 是内部差异化信号（护城河）
3. **重要性星级处理**：**彻底不渲染**——同 type 一样是内部信号，且诱发"选择性跳过"倾向，违反产品不变量 #1
4. **组件归属**：**新建独立组件** `ObjectivesList`（不复用 KnowledgePointList——语义不同：书级知识总览 vs 模块级学习目标；也不加 `simplified` prop 折腾 KnowledgePointList）

**护城河原则**（2026-04-16 用户拍定，项目级战略）：
- 后端可存和用的"内部分类信号"永不渲染到 UI
- 目前已确认不暴露：`knowledge_points.type`（5 类分类）、`knowledge_points.importance`（重要性评级）
- 未来新增 KP 分类字段（难度 / pedagogical metadata 等）默认也不暴露
- 写入 MEMORY：`project_internal-signals-moat.md`

**实施 deliverables**：
- `src/components/ObjectivesList.tsx`（Gemini，新组件）— props 只接 `{ id, title, summary }[]`
- `src/app/modules/[moduleId]/activate/page.tsx`（Gemini）— HeroCard + ObjectivesList + 开始按钮
- 后端无变更（`GET /api/modules/[moduleId]` 复用；前端 fetch 后只取 3 字段）

**下游影响**：
- 决策 10（教学 → QA 过渡）：教学完成后 learning_status 迁移，不影响 activate 页本身
- 开发成本比 A 高 1-1.5 小时（独立组件 card 布局），比 B 低（不折腾 simplified prop）
- M5 Phase 0 完整版：activate 页整块替换为完整版（ICAP/Gagne 9 Events），`ObjectivesList` 可能废弃或扩展，对 M4 无影响

**反悔成本**：
- 改视觉（退回朴素 `<ol>`）：改 `ObjectivesList` 内部 JSX，组件 API 不变
- 加回 type/importance：违反护城河原则，需先 revert 项目记忆

---

### 决策 10：教学 → QA 过渡（2026-04-16 拍板）

**拍定**：**方案 B · 独立中间页 `/modules/[moduleId]/teaching-complete` + 用户主动点按钮进入 Q&A**

**核心机制**：
- 最后 cluster 完成 → 后端响应 `allClustersDone: true` + 自动迁移 `learning_status → taught`
- 前端跳 `/modules/[moduleId]/teaching-complete`（中间页，复用 HeroCard + ContentCard）
- 中间页展示"🎉 教学完成 + 回顾清单（KP title + ✓）+ Q&A 独立思考提示"
- 用户点"开始 Q&A 练习 →" → `POST /api/modules/[moduleId]/start-qa` → 迁移 `taught → qa_in_progress` + 创建 qa_session → 跳 Q&A 页

**选 B 的理由（vs A 自动跳 / C toast 延时）**：
1. 微学习 UX "segmentation" 原则——教学 30+ 分钟后需要明确段落结束
2. closure 感强化记忆（回顾清单 + ✓）
3. 用户主动开启 Q&A，有心理准备（防止突然切换节奏）
4. 开发成本适中（约 2h Gemini 做中间页 + 1h Codex 做 start-qa endpoint）

**严格禁止**（合规原则）：
- 中间页不展示任何教学对话片段（即使产品不变量 #3 只针对 test，保持一致的"教学已封存"体感）
- 不展示 KP type / 重要性（护城河原则）
- 不提供显式"返回 teach 页"按钮（浏览器 back 回去 → teach 页进入只读模式）

**实施 deliverables**：
- `src/app/modules/[moduleId]/teaching-complete/page.tsx`（Gemini，新页面）
- `src/app/api/modules/[moduleId]/start-qa/route.ts`（Codex，新 endpoint）
- teach page 最后 cluster 完成处理逻辑（Gemini） — 检测 `allClustersDone: true` 触发跳转
- teaching-sessions messages API 返回体扩展 `allClustersDone: boolean`（Codex，与决策 3 的 shouldAdvance 并列返回）
- teach page 只读模式支持（Gemini，用户浏览器 back 回来时 teach page 禁用输入框）

**下游影响**：
- 决策 2（session 创建时机）延后到 L3，但**状态迁移时机已定**：最后 cluster 后自动迁 `taught`，用户点按钮后迁 `qa_in_progress`
- BookTOC 组件（决策 8 新组件）：模块状态显示需新增"教学已完成（待 Q&A）"态，对应 `learning_status === 'taught'`

**反悔成本**：
- 改 A（自动跳转）：移除中间页 + 移除 start-qa API，耦合少
- 改 C（toast 延时）：中间页 JSX 改为 toast，state 仍由前端触发，成本低

---

### 决策 11：教学深度 user override（2026-04-16 拍板）

**拍定**：**方案 A · 用户不可 override，完全 AI 自动决定**

**核心机制**：
- `teaching_sessions.transcript.state.depth`（`full | light`）由后端在 session 创建时根据 KP importance 自动填入
- 前端不传 depth 参数；后端若收到则忽略
- **UI 无任何深度选择器**——激活页不加选项，teach 页不加切换按钮
- 用户**不知道** "depth" 这个概念的存在（黑盒智能）

**选 A 的理由（4 条）**：
1. YAGNI：MVP 无用户数据支持"哪些用户需要切深度"
2. 认知负担：新用户不需要理解 light vs full 的区别
3. M5 付费抓手：自定义深度 = 天然付费功能（免费=AI 自动，付费=可锁定全程 full）
4. 护城河一致性：depth 背后依赖 KP importance——暴露 override = 间接暴露 importance 分级存在

**不做的 deliverables**：
- 不加 `depth` parameter 到 teaching-sessions 创建 API
- 不加 UI 深度选择器到 activate 页或 teach 页
- 不加 teach 页"切换深度"按钮

**反悔成本**：
- M5 启用 override：API 加 optional `depth` 参数 + 激活页 radio + entitlement guard，约 1 天

---

## 待 brainstorm 的决策（按依赖顺序）

### 决策 2：teaching_session 创建时机

**Scope**: 什么时候写 teaching_sessions 表？
**Options**:
- A) 用户首次点"开始教学"时批量创建本 module 所有 cluster 的 session
- B) 用户进入某个 cluster 才创建该 session（lazy）
- C) Module 进入 `reading → taught` 过渡时后端预创建
**Upstream deps**: 无
**Downstream deps**: 中断恢复（决策 7）、教学 → QA 过渡（决策 10）
**Triage**: 🟢
**Expected output**: 选定时机 + API 路由设计

### 决策 5：cost tracking 字段

**Scope**: 教学 token 消耗怎么记？
**Options**:
- A) teaching_sessions 表直接加 `input_tokens INT / output_tokens INT / model TEXT` 汇总字段
- B) 每条消息记 tokens（纳入决策 4 transcript 每项）
- C) 完全复用现有 `logs` 表（role='teacher'）
- D) A+C 并行（表聚合 + logs 全记录）
**Upstream deps**: 决策 4
**Downstream deps**: 无（可单独追加）
**Triage**: 🟢
**Expected output**: 字段位置决定

### 决策 7：教学中断恢复

**Scope**: 用户教学中途退出，再进来是续 vs 重开？
**Options**:
- A) 续上之前对话（读 transcript，回放最后 N 条）
- B) 重新开始（清空 transcript，重建 session）
- C) 用户选择（弹窗"从第 X 步继续 / 重新开始"）
- D) 按时间：<24h 续、否则重开
**Upstream deps**: 决策 2（session 创建时机）、决策 4（transcript 格式）
**Downstream deps**: teach 页面 UI
**Triage**: 🟢
**Expected output**: 恢复逻辑 + session 状态字段（started_at / last_active_at）

### 决策 8：模式切换弹窗 UX（✅ 2026-04-15 拍板）

**已锁定，见上方"已拍死的决策" §决策 8**。实施细节 → spec §5.3。

### 决策 9：Phase 0 激活页（✅ 2026-04-16 拍板）

**已锁定，见上方"已拍死的决策" §决策 9**。实施细节 → spec §5.1。

### 决策 10：教学 → QA 过渡（✅ 2026-04-16 拍板）

**已锁定，见上方"已拍死的决策" §决策 10**。实施细节 → spec §5.4。

### 决策 11：教学深度 user override（✅ 2026-04-16 拍板）

**已锁定，见上方"已拍死的决策" §决策 11**。实施细节 → spec §4.3 + §5.2。

### 决策 13：M4 任务拆分（Codex/Gemini）

**Scope**: M4 总工作量拆成几个 task？谁做哪个？
**Options**:
- A) 按 schema→API→UI 三段（3 大 task，每个内部细分）
- B) 按功能块（schema+entitlement / teaching-session CRUD / teach UI / mode switch UI / Phase 0 UI）
- C) 按角色（Codex 全后端 1 task / Gemini 全前端 1 task 太粗）
**Upstream deps**: 决策 1-12 全部
**Downstream deps**: writing-plans skill 的输入
**Triage**: 🟢
**Expected output**: 完整 task 清单 + 依赖图

---

## 本轮 scope 压缩（2026-04-15）

**用户指令**：13 决策太多，分 3 轮拍：
- **L1 引擎核心 5 项**（已完成 2026-04-15）：决策 1 / 3 / 4 / 6 / 12
- **L2 UI 层 4 项**（本 session 2026-04-15 启动）：决策 8 / 9 / 10 / 11
- **L3 生命周期与收尾 4 项**（延后）：决策 2 / 5 / 7 / 13

L1/L2 拆分依据：L1 先把 teacher 引擎 + prompt + transcript + 错误路径拍死，给 Codex 派后端；L2 在后端 plan 等 Codex 排队期间并行拍 UI 4 项，锁前端 Gemini 要做的决策。L3（session 生命周期 2/7 + cost tracking 5 + 任务拆分 13）到写 plan 阶段再定。

**本轮做（L2 UI 层 4 项）**：
- 决策 8（模式切换弹窗 UX）— Gemini 前端
- 决策 9（Phase 0 简化版视觉）— Gemini 前端
- 决策 10（教学 → QA 过渡 UX）— 前后端（状态迁移时机 + UI）
- 决策 11（教学深度 user override）— 前后端（UI + API 参数语义）

**本轮延后（L3 4 项）**：决策 2（session 创建时机）/ 5（cost tracking）/ 7（中断恢复）/ 13（任务拆分）——前三者和 API 生命周期耦合，等 writing-plans 时和 task 拆分一起拍，避免 L2 过度 over-specify。

## 当前进度

- ✅ 决策 1（teacher 模型选择）— 2026-04-15 拍板
- ✅ 决策 3（cluster 完成判定机制）— 2026-04-15 拍板
- ✅ 决策 4（transcript JSONB 格式）— 2026-04-15 拍板
- ✅ 决策 6（5 套 teacher prompt 结构）— 2026-04-15 拍板
- ✅ 决策 12（教学失败/超时处理）— 2026-04-15 拍板
- 🎯 **L1 全部完成（5/5）**
- ✅ 决策 8（模式切换弹窗 UX + BookTOC 新组件）— 2026-04-15 拍板
- ✅ 决策 9（Phase 0 激活页 ObjectivesList 新组件 + 护城河原则）— 2026-04-16 拍板
- ✅ 决策 10（教学 → QA 过渡 · 中间页方案 B）— 2026-04-16 拍板
- ✅ 决策 11（教学深度 user override · 不做，方案 A）— 2026-04-16 拍板
- 🎯 **L2 全部完成（4/4）**
- 🅿️ L3 延后：决策 2、5、7、13（4 项）

---

## L2 brainstorm 已完成（2026-04-16）

> 全部 4 个 L2 决策已锁定并迁入"已拍死的决策"区块。L2 进行中子决策区已清空。

---

## 最终产出

- 所有决策锁定后，`2026-04-15-m4-teaching-mode-design.md` 填完整工程章节（data model 改动细节、API schemas、UI 页面清单、prompt 模板内容、task 拆分）
- WIP 文件保留作为决策 trail，M4 完成后可归档
- 移除 MEMORY.md 中 M4 brainstorm pointer
- 进 spec review loop（subagent 5 维度审查）
- 用户确认后 → writing-plans skill
