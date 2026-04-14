# 调研：SaaS 订阅降级策略与 Entitlement Management

**调研日期**: 2026-04-13
**用途**: 指导 AI 教材精学 App 在 MVP 阶段的 schema 和状态流设计，确保未来加付费墙（"教学模式"作为高价订阅）时不必重构地基
**核心问题**: 如果用户从高级订阅降级到基础订阅，已经走过教学路径的模块数据怎么处理？需要怎样的 schema 才能"pure"到不必因为加付费而重写

---

## 核心结论（先看这一节）

调研 6 个主流 SaaS（Notion / Figma / Airtable / Slack / Dropbox / Jira）和 3 份架构权威（Stripe Entitlements、Stigg Downgrade Guide、Garrett Dimon Data Modeling）后得到的 4 个关键共识：

1. **降级不等于删除**。所有 6 个产品都采用"保留数据 + 限制操作"的模式，没有任何一个在降级当下立即清理数据。
2. **"读 vs 写"是最常用的权限切面**。超限内容普遍"只读可见 + 不能新增"，而不是"藏起来"或"删掉"。
3. **Entitlement 必须和 Pricing 解耦**。Stripe、Stigg、Garrett Dimon 都强调不能把 `is_premium` 字段直接写到业务表上；要么独立 entitlement 表，要么用 feature flag 在运行时判断。
4. **状态流必须"pure"**。学习进度（已读完 / 已教学 / 已完成测试）是一种事实，不应该混入"你是否还能用教学模式"这种订阅决定。

映射到我们的产品：**`modules.learning_status` 不应承载付费信息**，付费判断应该在一个独立层。"这个模块走过教学路径"是事实（schema 应记录），"你现在还能不能开新的教学"是运行时查询（不该写进模块表）。

---

## 第一部分：6 个产品的降级策略对比

每个产品都按 3 个维度调研：UI 呈现 / 数据保留 / 升级回购。

### 1. Notion（Free / Plus / Business / Enterprise）

| 维度 | 做法 |
|------|------|
| **UI 呈现** | 工作区 sidebar 出现 block 用量通知；降级后 automations、charts、forms 变"只读"（view-only）；超限时显示升级 CTA。提供 **3 天 grace period** |
| **数据保留** | 所有内容保留不删。Free 单人账户 block 无限，多人账户限 1000 block。降级到 Plus：历史版本从 90 天缩到 30 天；到 Free：缩到 7 天。Charts 保留第一个，其他不可访问。Forms/automations 可查看不可编辑 |
| **升级回购** | 功能"立即"恢复；保留的内容重新可编辑。文档未明确说明"是否有回购期" |

**关键细节**：Notion 的模式非常"仁慈"——已创建的内容全部保留，只是**新操作受限**。这是最"符合直觉"的降级模式，对用户心理伤害最小。

来源：
- [Notion - What happens when I downgrade](https://www.notion.com/help/plan-downgrade)
- [Notion - Understanding block usage](https://www.notion.com/help/understanding-block-usage)
- [Notion Pricing](https://www.notion.com/pricing)

### 2. Figma（Free Starter / Professional / Organization / Enterprise）

| 维度 | 做法 |
|------|------|
| **UI 呈现** | 降级到 Starter 后超限团队出现 "Locked" 标签 banner；超限文件强制 **view-only**；文件顶部显示 "View Only" 指示器；published sites/Make apps 自动 unpublished |
| **数据保留** | 所有文件保留，不删除。Starter 限制：每个 team 1 个 project、3 个 Design 文件、3 个 FigJam 文件、每文件 3 页。超限时**整个 team 被锁定**直到用户手动把多余文件移走 |
| **升级回购** | "Re-subscribe to edit again"——重新订阅后立刻恢复编辑权限，文件内容无损 |

**关键细节**：Figma 采取了比 Notion 更"激进"的策略——**超限不是限制新增，而是整个团队 freeze**。用户必须手动"瘦身"（move to drafts / delete projects）才能继续用。这对迁移式降级（从团队协作退回单人）是个警示：**lock 策略太硬会逼用户操作**。

来源：
- [Figma - Upgrade or downgrade your plan](https://help.figma.com/hc/en-us/articles/360046216313-Upgrade-or-downgrade-your-plan)
- [Figma Forum - Editing locked after downgrading](https://forum.figma.com/report-a-problem-6/editing-locked-after-downgrading-from-professional-to-starter-plan-49488)
- [Figma Forum - What happens to designs after downgrade](https://forum.figma.com/ask-the-community-7/what-will-happen-to-designs-made-with-paid-tools-after-downgrading-professional-plan-to-free-plan-19598)

### 3. Airtable（Free / Team / Business / Enterprise）

| 维度 | 做法 |
|------|------|
| **UI 呈现** | workspace、base、interface 顶部显示 banner 警告超限；超限警告可能持续 24-48 小时 |
| **数据保留** | 所有 records 保留不删。超限后不能**新增**记录，其他功能正常（只读/查询/编辑现有记录都 OK） |
| **升级回购** | 重新订阅后限制立即解除 |

**关键细节**：Airtable 是最"柔和"的模式——**只禁新增、不禁其他**。用户可以继续 edit/read/query 已有数据，产品体验接近完整，只是无法持续增长。这对"数据是核心资产"的产品特别友好。

来源：
- [Airtable - Changing your workspace plan](https://support.airtable.com/docs/changing-your-airtable-workspace-plan)
- [Airtable Community - What happens to records after downgrade](https://community.airtable.com/other-questions-13/what-happens-to-my-records-if-i-decided-to-downgrade-to-free-plan-16233)
- [Airtable plans overview](https://support.airtable.com/docs/airtable-plans)

### 4. Slack（Free / Pro / Business+ / Enterprise Grid）

| 维度 | 做法 |
|------|------|
| **UI 呈现** | 没有明确的"锁定"UI；消息列表自动按 90 天截断（看不见旧消息）；app 安装限 10 个，超限需先卸载。Canvases/Lists 在降级后变"read-only"；workflows 停止运行；guest 账号 deactivated |
| **数据保留** | **独特的双层策略**：<br>• **90 天内**：完整可见<br>• **90 天-1 年**：**隐藏但未删除**（升级后可恢复）<br>• **1 年以上**：从 2024-08-26 起**rolling 永久删除**，升级也救不回来 |
| **升级回购** | 升级后 90 天-1 年内的消息立即"re-revealed"；1 年以上的数据永久丢失 |

**关键细节**：Slack 是唯一一个"**会真正删数据**"的产品。其他家都"保留不删"，Slack 因为消息规模实在太大，用"隐藏 + 1 年后删"来控制存储成本。这个决策在 2022 年引发用户愤怒（Zulip 博客记录了抱怨潮），提醒我们：**删数据是最激进的选项，只在存储成本真的会压垮产品时才用**。

来源：
- [Slack - Feature limitations on the free version](https://slack.com/help/articles/27204752526611-Feature-limitations-on-the-free-version-of-Slack)
- [Slack - Usage limits for free workspaces](https://slack.com/help/articles/115002422943-Usage-limits-for-free-workspaces)
- [Zulip Blog - Why Slack's free plan change is causing an exodus](https://blog.zulip.com/2022/08/26/why-slacks-free-plan-change-is-causing-an-exodus/)

### 5. Dropbox（Basic / Plus / Family / Professional / Business）

| 维度 | 做法 |
|------|------|
| **UI 呈现** | 超限时**多封邮件提前通知**；接近/到达限额时客户端弹窗提醒；文件可能变 read-only；sharing 和 preview 受限 |
| **数据保留** | **最激进**：超 2GB 限额后 Dropbox 会**按"最久未修改"的顺序逐步删除**用户文件，直到账户回到限额内。只删 owner 自己的文件，共享文件不删 |
| **升级回购** | 升级后立刻解除 sync 限制；但**已被自动删掉的文件永久丢失**（除非在 30 天 trash 保留期内手动恢复） |

**关键细节**：Dropbox 是唯一会"**主动删用户文件**"的产品（不是时间到期，而是"超限触发"）。这种模式在行业内很少见，理由是存储成本直接和用户行为挂钩。这给我们的启示是反面的——**不要学 Dropbox**，因为这个模式需要"多轮邮件通知 + LRU 淘汰算法 + trash 保留期"一整套保障，实施代价极高。

来源：
- [Dropbox - Exceeding storage space on Basic](https://help.dropbox.com/storage-space/over-quota)
- [Dropbox Community - Downgrading what happens with data](https://www.dropboxforum.com/discussions/101001018/downgrading---what-happens-with-data/753203)
- [Dropbox Community - Did Dropbox keep data after downgrading to Basic](https://www.dropboxforum.com/discussions/101001013/did-dropbox-keep-the-data-of-my-old-plus-account-or-is-it-lost-after-downgrading/834117)

### 6. Jira / Atlassian Cloud（Free / Standard / Premium / Enterprise）

| 维度 | 做法 |
|------|------|
| **UI 呈现** | Premium 功能的菜单仍保留可见（如 Assets menu），但点进去只能看到 "Try it now" 升级引导；Advanced Roadmaps、sandboxes、scheduled releases 从 UI 中消失；Assets 字段从 screens 上不再显示 |
| **数据保留** | 核心 issue 和 project 数据 100% 保留。**Premium-only 功能数据（如 Advanced Roadmaps 的 PLAN data、Assets objects）全部保留在数据库中**，只是访问路径被关闭。Sandboxes 会被**永久删除**（这是例外） |
| **升级回购** | **这是所有产品里最"优雅"的设计**：升级回 Premium 后，所有 PLAN data、Assets data **自动完整恢复**，无需用户操作或数据迁移。**如果完全取消订阅（不是降级），数据保留 60 天后永久删除** |

**关键细节**：Atlassian 给出了**最成熟的"数据在床下"模式**——Premium 功能的**数据层保持在数据库**，只是**访问层关闭**。菜单还在、数据还在，只是 UI 告诉用户"升级以解锁"。这种设计下，升级 / 降级完全是**零数据迁移**的。Sandboxes 被删是因为它占用独立资源，保留成本太高。60 天 grace period 是业界常见的"完全注销保护期"。

**这是我们产品该学习的主模式**。

来源：
- [Atlassian - What happens to PLAN data when subscription changes](https://support.atlassian.com/jira/kb/what-happens-to-plan-data-when-subscription-is-changed/)
- [Atlassian - What happens to Assets when JSM plan is downgraded](https://support.atlassian.com/jira/kb/what-happens-to-assets-when-jsm-plan-is-downgraded-to-standard-free/)
- [Atlassian Community - Downgrading Premium to Standard](https://community.atlassian.com/forums/Advanced-planning-questions/Downgrading-Premium-to-Standard/qaq-p/1948742)

---

## 第二部分：共性模式提炼

从 6 个产品和 3 份架构文章中归纳出 **4 个主流模式**。每个模式都标注了推荐度和应用场景。

### 模式 1：数据保留 + 写禁用（Freeze Writes, Preserve Reads）

**定义**：降级后，用户的所有已存数据保持**只读可见**。限制体现在**不能新增、不能修改**（或者不能超限新增），但现有内容完全可浏览。

**采用产品**：Airtable（不能新增记录）、Notion（automations 只读、charts 只读）、Figma（超限文件 view-only）

**优点**：
- 用户心理伤害小，"我的东西还在"
- 开发成本低：只需在写入 API 加 entitlement 检查
- 对用户升级回归有天然吸引力："想继续用就回来吧"

**缺点**：
- 数据持续占用存储成本（对大文件产品如 Dropbox 不适用）
- 功能"看得见摸不着"容易产生付费焦虑

**结论**：**这是主流且推荐的默认模式**。

### 模式 2：Entitlement 与 Pricing 解耦（Separate Entitlement Layer）

**定义**：订阅信息、定价版本、功能许可是 **3 个独立概念**，通过一个独立的 entitlement 层在运行时动态判断。数据库里不应该有 `user.is_premium` 这种硬编码字段。

**采用产品 / 框架**：Stripe Entitlements API、Stigg、Garrett Dimon 数据模型、Schematic HQ

**推荐的表结构**（综合多家建议）：
```
features        -- 功能定义（独立于订阅）
                -- 例: teaching_mode, advanced_export, sso
plans           -- 订阅计划 (basic, premium, ...)
plan_features   -- plan 和 feature 的多对多 join
subscriptions   -- 用户的订阅记录（含 plan、开始/结束日期）
user_entitlements  -- 运行时 cache（可选，加速查询）
```

**优点**：
- 定价改版不影响业务代码
- 可以给特定用户授予"非标准许可"（退款补偿、Beta tester、合作伙伴）
- feature flag 和订阅层一体化

**缺点**：
- 前期需要设计 3-4 张表
- 对 MVP 来说可能"过度工程"

**结论**：**完整实施要等有真实订阅再做，但 MVP 阶段必须至少在 schema 里隔离"学习事实"和"订阅权限"，不能把两者混在同一张表**。

### 模式 3：Grace Period + 延迟生效（Delayed Enforcement）

**定义**：降级请求不立即执行，而是**调度到当前计费周期结束后生效**。订阅取消则提供 60 天 "complete-cancellation grace"，给用户反悔机会。

**采用产品 / 框架**：Stripe（downgrades 在 next billing period 生效）、Atlassian（60 天 full-cancel 保留）、Notion（3 天 block 超限 grace）

**优点**：
- 用户有缓冲期不会"突然断气"
- 为产品留下"挽回订阅"的营销时机
- 减少客服纠纷

**缺点**：
- 调度逻辑需要后台 job 和 webhook 处理
- UI 要显示"将在 X 日降级"信息

**结论**：**MVP 不必做，但 schema 层要预留 `subscriptions.effective_at` 字段**，否则未来加入时必须 migrate。

### 模式 4：UI 提示分层（Visible Menu, Locked Access）

**定义**：高阶功能的 UI 入口**保持可见**，但点击进入后显示升级 CTA 而非功能界面。用户永远知道"我曾经有这些能力"。

**采用产品**：Jira（Assets menu 保留但页面锁）、Notion（features 变 view-only 但仍在页面上）

**优点**：
- 对升级回归用户极友好——入口一直在，点进去就能用
- 创造"我错过了什么"的心理，促进回购
- 减少"我的数据哪去了"的客服咨询

**缺点**：
- 容易让免费用户觉得"处处是付费墙"，反感
- UI 上需要清晰的"locked"视觉语言（不是彻底藏起来）

**结论**：**对我们的产品特别合适**——教学模式的入口始终可见，未订阅用户看到的是"升级以开启"，已订阅用户直接进入教学。

---

## 第三部分：架构 schema 启示

基于上述 4 个模式，给出**数据库层面的设计原则**。

### 原则 1：权限表和状态表必须分离（最重要）

**错误设计**：
```sql
-- 反例：把订阅信息混进业务表
CREATE TABLE modules (
  id uuid PRIMARY KEY,
  book_id uuid,
  learning_status text,  -- 'reading', 'taught', 'qa', 'tested', 'completed'
  is_premium_only boolean,  -- 🚫 这会耦合订阅到模块表
  requires_teaching_tier boolean  -- 🚫 同上
);
```

**正确设计**：
```sql
-- 业务表只表达事实
CREATE TABLE modules (
  id uuid PRIMARY KEY,
  book_id uuid,
  learning_status text  -- 只表达学习进度
);

-- 订阅 / 权限独立表
CREATE TABLE user_subscriptions (
  user_id uuid PRIMARY KEY,
  tier text,  -- 'basic' | 'premium'
  effective_at timestamp,  -- 延迟生效支持
  expires_at timestamp
);

-- （可选）feature 映射表，为未来扩展留空间
CREATE TABLE feature_flags (
  feature_key text PRIMARY KEY,  -- 'teaching_mode'
  required_tier text
);
```

**为什么这样最稳**：Garrett Dimon 的原则"Policies Don't Care About Pricing"（策略不关心定价）——功能是否启用，是 `canUseTeaching(user)` 这种运行时函数决定的，不是表上的字段决定的。

### 原则 2：`subscription_tier` / `feature_flags` / `allowed_features` 字段的取舍

**MVP 阶段推荐最简方案**：
- 只需 `user_subscriptions.tier` 字段（enum: 'basic' | 'premium'）
- 代码层用一个 `entitlements.ts` 模块封装判断逻辑：`canUseTeaching(userId)`
- 所有 API endpoint 调用这个函数做守卫
- **MVP 期间函数内直接 `return true`**，未来加付费墙时改函数实现即可

**不推荐 MVP 就做 `feature_flags` 表**：
- 3 表的 join 对 MVP 过度
- 目前只有 1 个 feature（教学模式），值不大

**未来扩展时再加的部分**：
- `feature_flags` 表（当 feature 数量 ≥ 3）
- `plan_features` join 表（当有多个付费 tier）
- `user_feature_overrides` 表（给特殊用户授权，如退款补偿）

### 原则 3：用户生命周期事件（升级 / 降级 / 重订阅）的数据操作

| 事件 | 数据操作 |
|------|---------|
| **订阅升级** | 写入 `user_subscriptions`，立即生效；不触碰任何业务表 |
| **订阅降级** | 写入 `user_subscriptions`，可立即或延迟生效；**不删除任何教学数据**；UI 层在运行时检查权限 |
| **订阅过期** | `expires_at` 过期后由定时任务或运行时判断失效；数据保留 |
| **重新订阅** | 更新 `user_subscriptions.tier` 和 `expires_at`；**过往教学数据自动可重新访问**（因为本来就没删） |
| **完全注销** | 60 天 grace period 后清除业务数据（MVP 不必做，留 hook） |

**关键**：每个事件都**不应该触发对业务表的修改**。业务表只记录"学了什么"，订阅表只记录"能不能用"。两者在 UI/API 层通过 entitlement 函数汇合。

### 原则 4：状态流的"pure"设计

**学习状态流**应该**只表达学习进度本身**，不混入"为什么走到这一步"：

**推荐的 `modules.learning_status` enum**：
```
'not_started'    -- 还没开始
'reading'        -- 正在读原文
'taught'         -- 已完成 AI 教学环节（事实记录）
'qa_in_progress' -- 正在做 QA
'qa_complete'    -- QA 全答完
'tested'         -- 测试已完成（含及格/未及格）
'completed'      -- 整个模块过关
```

**为什么这样 pure**：
- `taught` 只表示"这个模块走过教学环节"，是**事实**
- 不包含"是否付费"、"是否有资格"、"用的是哪个 tier"
- 即使未来用户降级失去教学资格，`taught` 状态**仍然成立**——因为它是**历史事实**

**反例（禁止这样写）**：
```
'taught_premium'    -- 🚫 混入了 tier
'taught_by_ai'      -- 🚫 混入了 AI 来源（未来可能有人工教学）
'needs_re_teaching' -- 🚫 混入了权限判断
```

---

## 第四部分：应用到我们的场景

这是最关键的部分。针对 AI 教材精学 App 的两条学习路径，给出具体建议。

### 4.1 Schema 建议

#### 4.1.1 `books.learning_mode` 字段是否足够？

**结论：不够，但 MVP 够用。需要更 pure 的抽象。**

当前可能的设计：
```sql
books (
  learning_mode text  -- 'complete' | 'teaching'
)
```

**问题**：`learning_mode` 混淆了两个概念——"用户的意图"和"实际走过的路径"。如果用户中途切换（先选 complete，再后悔想走 teaching），这个字段无法表达。

**推荐的 pure 设计**：

```sql
-- 用户在 book 级别选择的偏好（意图）
books (
  id uuid PRIMARY KEY,
  user_id uuid,
  preferred_learning_mode text  -- 'complete' | 'teaching'
  -- 这只是用户的偏好设置，不是事实
)

-- 模块级别的学习路径记录（事实）
modules (
  id uuid PRIMARY KEY,
  book_id uuid,
  learning_status text  -- 见 §3.4 pure enum
)

-- 独立的教学会话表（事实 + 内容）
teaching_sessions (
  id uuid PRIMARY KEY,
  module_id uuid,
  started_at timestamp,
  completed_at timestamp,
  transcript jsonb  -- 教学对话完整记录
)

-- 订阅层（与上述完全独立）
user_subscriptions (
  user_id uuid PRIMARY KEY,
  tier text,  -- MVP 阶段默认 'premium'（付费墙关闭）
  expires_at timestamp
)
```

#### 4.1.2 `teaching_sessions` 表是否需要独立？

**结论：强烈推荐独立。**

**理由**：
1. **数据解耦**：教学对话的 transcript 是大字段（jsonb），不应挤在 modules 表
2. **降级场景友好**：降级后，teaching_sessions 表数据保留，UI 层控制访问——完全对应 Atlassian 的 "data retained, access gated" 模式
3. **扩展友好**：未来可能要做"教学回顾"、"教学分享"、"教学 stats"，这些都基于这张表

**反之，如果把教学 transcript 塞进 modules.teaching_transcript 字段**：
- 业务表膨胀
- 降级时必须决定"要不要清空这个字段"（违反 pure 原则）
- 未来做教学 analytics 需要 migrate

#### 4.1.3 `modules.learning_status` 的推荐 enum

基于 §3.4 的设计：
```
not_started → reading → taught → qa_in_progress → qa_complete → tested → completed
                ↑ 分叉：teaching 路径才有这一步，complete 路径直接 reading → qa_in_progress
```

**关键点**：`taught` 是可选的 intermediate state。同一个 enum 可以容纳两条路径：
- 完整模式：reading → qa_in_progress → qa_complete → tested → completed
- 教学模式：reading → taught → qa_in_progress → qa_complete → tested → completed

**降级场景下的语义完备性**：
- 用户曾用 teaching 路径完成的模块，`learning_status` 仍是正常流转（completed 就是 completed）
- 用户降级后新开始的模块只能走 complete 路径（运行时权限控制）
- **不需要"降级后修改已有模块的 learning_status"**

### 4.2 降级处理逻辑（未来实装时怎么做）

假设未来某天真的上线付费墙，用户从 premium 降到 basic：

| 场景 | 处理 |
|------|------|
| **已完成教学的模块** | `modules.learning_status` 保持不变；`teaching_sessions` 记录完整保留 |
| **教学中途的模块**（进行到一半降级） | 采用 "Grace Period" 模式：当前 session 允许完成，但不能开新 session。或 soft-lock 该 module 允许只读 transcript |
| **未开始教学的模块** | 只能走完整模式路径，UI 上"教学"入口显示升级 CTA |
| **历史 teaching_sessions 的访问权限** | **推荐可读**——符合 Airtable/Notion/Jira 模式，对用户心理友好 |

**UI 上的呈现**（借鉴 Atlassian "Visible Menu, Locked Access" 模式）：

```
[模块 A] (已走过教学路径)
  ✓ 教学回顾 ← 可点击查看历史对话
  → 继续 QA

[模块 B] (未开始教学)
  🔒 开启 AI 教学（升级解锁）← 点击触发升级 CTA
  → 跳过教学，进入 QA
```

### 4.3 MVP 必做 vs MVP 之后做（这节特别重要）

明确区分两类：

#### MVP 必做（地基，即使现在不实装付费墙也要做对）

| 项 | 为什么必做 |
|----|-----------|
| **`teaching_sessions` 表独立** | 事后从 modules 表剥离成本极高；未来降级逻辑依赖此 |
| **`modules.learning_status` 用 pure enum（不含 tier）** | 一旦数据写入就难改语义；pure 命名保持正确性 |
| **`user_subscriptions` 表预埋（即使所有人默认 premium）** | 这是未来付费墙的锚点；没有就必须 migrate |
| **entitlement 函数封装（如 `canUseTeaching(userId)`）** | MVP 内实现为 `return true`，但所有 teaching 入口必须走这个检查 |
| **API endpoint 上的权限守卫习惯** | 每个 teaching-related endpoint 必须调用 entitlement 函数；这是**代码习惯**，不是功能 |
| **`books.preferred_learning_mode` 设计为偏好而非事实** | 避免"用户中途切换模式"破坏数据 |
| **`teaching_sessions.transcript` 用 jsonb** | text 字段后续改大对象代价高 |

#### MVP 之后做（可以延后，不影响地基）

| 项 | 为什么放这里 |
|----|-------------|
| **付费墙 UI（升级 CTA、价格页面）** | 纯 UI 工作，和 schema 无关 |
| **降级引导话术、挽留文案** | UX/营销工作，可事后迭代 |
| **Billing / Stripe 集成** | 可以挂到 `user_subscriptions` 表上，零侵入 |
| **`feature_flags` 表** | feature 数量少（只有 teaching）时不值得；未来 feature ≥ 3 再抽象 |
| **`plan_features` join 表** | 同上，等有多个 tier 再做 |
| **Grace period 调度逻辑** | 需要后台 job 系统，MVP 没必要 |
| **60 天数据保留 / 60 天后清除** | 用户注销场景，MVP 不考虑 |
| **降级后的 soft-lock UI（"升级以解锁"banner）** | 付费墙上线时一起做，不影响数据 |
| **数据迁移脚本** | 只有在 schema 变化时才需要；如果 MVP 地基正确，这些脚本可能永远不用写 |
| **订阅状态管理系统（状态机）** | 用 Stripe webhook + 简单 enum 就够了，不必过早抽象 |

#### 一张表总结 MVP 决策

| Schema / 代码元素 | MVP 必做 | MVP 之后 |
|------------------|---------|---------|
| `books.preferred_learning_mode` | ✓ | |
| `modules.learning_status` pure enum | ✓ | |
| `teaching_sessions` 独立表 | ✓ | |
| `user_subscriptions` 表存在（即使都是 premium） | ✓ | |
| `canUseTeaching()` entitlement 函数 | ✓ | |
| Teaching API 走 entitlement 守卫 | ✓ | |
| `feature_flags` 表 | | ✓ |
| `plan_features` join 表 | | ✓ |
| Stripe 集成 | | ✓ |
| 降级 UI / banner / CTA | | ✓ |
| Grace period / 调度 / 定时 job | | ✓ |
| 60 天 auto-delete | | ✓ |

---

## 结论与推荐

**一句话建议**：**现在按 Atlassian 模式设计 schema——数据保留、访问层控制、零数据迁移的升降级。MVP 阶段的所有 teaching 相关入口都走一个 `canUseTeaching()` 函数，函数内暂时 `return true`。未来加付费墙只改函数实现，不碰业务表。**

**三条硬规则**：

1. **业务表只记事实，不记权限**。`modules.learning_status = 'taught'` 永远不包含"你付没付费"的信息。
2. **`teaching_sessions` 必须是独立表**。不要为了省表把 transcript 塞进 modules。
3. **所有 teaching API endpoint 必须调用 `canUseTeaching(userId)` 守卫**，即使 MVP 阶段它永远返回 true。代码习惯先立好。

**最不该做的两件事**：

1. 在 modules 表加 `is_teaching_tier_only` 或 `premium_required` 字段——这会把付费逻辑永久绑死在业务数据上
2. 为了"简化 MVP" 省掉 `teaching_sessions` 表把 transcript 塞进 modules——这是未来最难纠正的决定

---

## 来源汇总

### 官方文档
- [Notion - Plan downgrade](https://www.notion.com/help/plan-downgrade)
- [Notion - Change your plan](https://www.notion.com/help/upgrade-or-downgrade-your-plan)
- [Notion - Understanding block usage](https://www.notion.com/help/understanding-block-usage)
- [Notion Pricing](https://www.notion.com/pricing)
- [Figma - Upgrade or downgrade your plan](https://help.figma.com/hc/en-us/articles/360046216313-Upgrade-or-downgrade-your-plan)
- [Airtable - Changing workspace plan](https://support.airtable.com/docs/changing-your-airtable-workspace-plan)
- [Airtable - Plans overview](https://support.airtable.com/docs/airtable-plans)
- [Slack - Feature limitations on free version](https://slack.com/help/articles/27204752526611-Feature-limitations-on-the-free-version-of-Slack)
- [Slack - Usage limits for free workspaces](https://slack.com/help/articles/115002422943-Usage-limits-for-free-workspaces)
- [Dropbox - Exceeding storage on Basic](https://help.dropbox.com/storage-space/over-quota)
- [Atlassian - What happens to PLAN data](https://support.atlassian.com/jira/kb/what-happens-to-plan-data-when-subscription-is-changed/)
- [Atlassian - What happens to Assets on downgrade](https://support.atlassian.com/jira/kb/what-happens-to-assets-when-jsm-plan-is-downgraded-to-standard-free/)

### 架构 / 开发者文档
- [Stripe Entitlements](https://docs.stripe.com/billing/entitlements)
- [Stripe - Feature API](https://docs.stripe.com/api/entitlements/feature)
- [Stripe - How subscriptions work](https://docs.stripe.com/billing/subscriptions/overview)
- [Stigg - Upgrade/Downgrade flows Part 2](https://www.stigg.io/blog-posts/the-only-guide-youll-ever-need-to-implement-upgrade-downgrade-flows-part-2)
- [Stigg - Entitlements untangled](https://www.stigg.io/blog-posts/entitlements-untangled-the-modern-way-to-software-monetization)
- [Garrett Dimon - Data Modeling SaaS Entitlements and Pricing](https://garrettdimon.com/journal/posts/data-modeling-saas-entitlements-and-pricing)
- [Schematic HQ - The Entitlements Layer](https://schematichq.com/blog/the-entitlements-layer-how-saas-products-control-customer-access)
- [Schematic HQ - Feature flags for entitlements](https://schematichq.com/blog/guide-how-to-use-feature-flags-to-manage-entitlements-without-writing-code)
- [Orb - What are entitlements in SaaS](https://www.withorb.com/blog/what-are-entitlements-in-saas)
- [Lago - How entitlements work in SaaS](https://getlago.com/blog/saas-entitlements)

### 第三方资料 / 用户反馈
- [Figma Forum - Editing locked after downgrading](https://forum.figma.com/report-a-problem-6/editing-locked-after-downgrading-from-professional-to-starter-plan-49488)
- [Figma Forum - What happens to designs after downgrade](https://forum.figma.com/ask-the-community-7/what-will-happen-to-designs-made-with-paid-tools-after-downgrading-professional-plan-to-free-plan-19598)
- [Airtable Community - What happens to records after downgrade](https://community.airtable.com/other-questions-13/what-happens-to-my-records-if-i-decided-to-downgrade-to-free-plan-16233)
- [Zulip Blog - Why Slack's free plan change caused exodus (2022)](https://blog.zulip.com/2022/08/26/why-slacks-free-plan-change-is-causing-an-exodus/)
- [Dropbox Community - Downgrading what happens with data](https://www.dropboxforum.com/discussions/101001018/downgrading---what-happens-with-data/753203)
- [Atlassian Community - Downgrading Premium to Standard](https://community.atlassian.com/forums/Advanced-planning-questions/Downgrading-Premium-to-Standard/qaq-p/1948742)
