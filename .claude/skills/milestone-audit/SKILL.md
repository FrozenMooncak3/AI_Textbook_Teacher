---
name: milestone-audit
description: 里程碑收尾时审计 architecture.md 接口契约。触发：里程碑任务全部完成后、closeout 前。
---

# Milestone Audit

里程碑收尾时对 `docs/architecture.md` 进行结构化审计，确保接口契约与代码现状一致。

## 为什么需要

`architecture.md` 是下个里程碑 brainstorming 的设计基础。如果它和代码不一致，设计就建在错误假设上。

现有防线只覆盖单任务粒度：
- `structured-dispatch`：派任务前检查相关合约（预防性，窄）
- `requesting-code-review`：review 后更新相关合约（反应性，窄）

本 skill 补上**里程碑粒度**的全量扫描（总结性，宽）。

## 触发条件

- 里程碑所有任务完成
- 最终 code review 通过
- 准备进入 closeout（finishing-a-development-branch）之前

## 执行步骤

### Step 1: 确定审计范围

查看本里程碑改了哪些文件，按类别归组：

```bash
# 找本里程碑的起始 commit（通过 changelog/project_status 确定日期）
git log --oneline --after="<milestone_start_date>" --name-only
```

按以下类别分组，**只审计有改动的类别**：

| 文件模式 | 类别 |
|----------|------|
| `src/app/**/page.tsx`, `layout.tsx` | 页面路由 |
| `src/app/api/**` | API 端点 |
| `src/lib/db.ts` | DB schema |
| `src/lib/seed-templates.ts` | AI prompt 模板 |
| `src/lib/**`（其他） | 工具库 |
| `src/components/**` | 前端组件 |

### Step 2: 定向审计

读取 `docs/architecture.md`，对每个**有改动的**类别执行对比：

| 类别 | 怎么查 |
|------|--------|
| 页面路由 | 用 Glob 搜索所有 `src/app/**/page.tsx`，对比 architecture.md 路由清单 |
| API 端点 | 用 Glob 搜索所有 `src/app/api/**/route.ts`，对比 architecture.md API 清单 |
| DB 表 | 读 `src/lib/db.ts`，找所有 CREATE TABLE 语句，对比 architecture.md 表清单 |
| AI 角色 | 读 `src/lib/seed-templates.ts`���找所有模板定义，对比 architecture.md 角色清单 |
| 接口契约 | 逐条读 architecture.md 契约描述，用 Grep/Read 去代码里确认还对不对 |
| 学习状态流 | 用 Grep 搜索 `learning_status` 赋值，对比 architecture.md 状态流图 |

**关键原则**：必须**读代码**确认，不能只看文件名下结论。重点放在跨模块连接点。

### Step 3: 更新 architecture.md

不一致的地方直接修正：
1. **系统总图**：更新路由、API、DB 表、AI 角色清单
2. **接口契约**：修改过期描述、新增跨模块依赖
3. **学习状态流**：更新状态转换（如有变化）

### Step 4: 处理 ⚠️ 标记

- 已修复的问题：摘掉 ⚠️ 标记，更新描述
- 新发现的断裂风险：标上 ⚠️，给下个里程碑看
- 🚨 **严重断裂**（影响下个里程碑的前提假设）：必须在 closeout 前修复，不带到下个里程碑

### Step 5: 输出报告

输出审计报告到对话中，同时写入 `docs/journal/<date>-m<N>-milestone-audit.md`，更新 journal INDEX.md。

报告格式：

```
═══ 里程碑审计报告：M<N> ═══

📊 变更范围
  改动文件数：X
  涉及类别：[列出被改动的类别]

✅ 契约确认有效
  - [契约名]

⚠️ 已更新的契约
  - [契约名]：[改了什么]

🆕 新增跨模块依赖
  - [描述]

🔧 ⚠️ 标记变化
  已修复（摘除）：...
  新发现（标记）：...

📝 下个里程碑注意事项
  - [风险点]

═══════════════════
```

---

## Chain 位置

**Closeout Chain**（完整版）：
1. requesting-code-review（最终 review）
2. **milestone-audit** ← 你在这里
3. claudemd-check（合规检查）
4. finishing-a-development-branch（分支收尾）

**Next step:** 审计完成并更新 architecture.md 后，调用 `claudemd-check`。
