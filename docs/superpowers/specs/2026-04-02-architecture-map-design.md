# 设计文稿：架构地图系统

> 日期：2026-04-02
> 状态：已批准
> 解决的问题：随着代码量增长，里程碑之间的接入假设会过期，导致新里程碑基于错误假设设计

---

## 1. 问题

M3→M4 代码审计发现 6 个接入问题（测试不触发复习调度、prompt 乱码、schema 冗余等）。这些问题本质上是"上一个里程碑的输出"和"下一个里程碑的输入"之间的假设断裂。

当前没有机制追踪这些跨模块假设。代码本身是分散的，spec 描述的是理想状态，两者之间的差异只能靠手动全量阅读代码才能发现——这个方法随代码量增长不可持续。

## 2. 方案

新建 `docs/architecture.md`，包含两层信息：

### 第一层：系统总图

记录"有什么"。变化频率低（几个里程碑才改一次）。

内容：
- 页面路由清单
- API 组清单
- DB 表清单（表名，不含字段）
- AI 角色清单
- 学习状态流转图

### 第二层：接口契约

记录"它们怎么接在一起"。这是核心价值——里程碑之间最容易断的就是这些连接点。

内容：
- 按数据流方向组织（提取→学习→测试→复习→错题流转→prompt 模板）
- 每条记录一个跨模块依赖："A 做了什么 → B 依赖什么"
- `⚠️` 标记标注已知断裂点（里程碑审计时的重点）
- 断裂点修复后：由 Claude 在 code review 通过时去掉 `⚠️` 并更新描述（和 project_status 更新同步，不需要额外步骤）

### 不记录什么

- 模块内部实现细节（代码本身就是文档）
- 每个 API 的每个字段（太细，维护不住）
- 历史变更（git log 有）

## 3. 维护机制

不加新 skill，不改现有 skill 逻辑。

### 里程碑结束时：强制更新

CLAUDE.md 已有规则：
> "禁止在未更新 `project_status.md` 和 `changelog.md` 的情况下声称任务完成"

扩展为：
> "禁止在未更新 `project_status.md`、`changelog.md` 和 `architecture.md` 的情况下声称任务完成"

`claudemd-check` 会检查 CLAUDE.md 中的规则。该 skill 动态读取 CLAUDE.md 内容做合规检查，不是硬编码清单，所以新增规则后自动覆盖。

### 里程碑开始时：强制读取

session-init Step 1 的读取列表加一行 `docs/architecture.md`。brainstorming 做里程碑级工作时，接口契约中的 `⚠️` 标记即为审计重点。

### Codex/Gemini 不需要改指令文件

Codex/Gemini 通过 Claude 的 dispatch 指令获得上下文（structured-dispatch 模板会包含相关接口信息），不需要自己读 architecture.md。

## 4. 改动清单

| 文件 | 改动 |
|------|------|
| `docs/architecture.md` | **新建**，写入当前代码库的两层信息 |
| `CLAUDE.md` | 改一句话：完成时必须同步更新 architecture.md |
| `.claude/skills/session-init/SKILL.md` | Step 1 读取列表加一行 |

## 5. 验收标准

1. `docs/architecture.md` 存在且内容与当前代码库一致
2. CLAUDE.md 的"禁止事项"中包含 architecture.md
3. session-init 在 session 开始时读取 architecture.md
4. 接口契约中以下 3 个已知断裂点标有 `⚠️`：
   - 测试通过不创建 review_schedule、不更新 cluster P 值
   - clusters.next_review_date 与 review_schedule.due_date 冗余
   - reviewer prompt 模板是乱码 UTF-8
