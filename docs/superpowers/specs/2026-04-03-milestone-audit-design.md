# 设计文稿：architecture.md 守护体系

> 日期：2026-04-03
> 状态：待批准
> 解决的问题：architecture.md 与代码不一致会导致下个里程碑设计建在错误假设上

---

## 1. 问题

`docs/architecture.md` 是所有里程碑设计的基础——brainstorming 读它来了解系统现状，基于它设计新功能。如果它和代码不一致，设计就建在错误假设上。

M3→M4 的 6 个断裂点就是这么来的：没有机制保证 architecture.md 始终准确。

现有防线只覆盖单任务粒度：
- structured-dispatch：派任务前检查相关合约（预防性，窄）
- requesting-code-review：review 后更新相关合约（反应性，窄）

缺失：里程碑级全量验证 + brainstorming 时的二次确认。

## 2. 方案：两道关卡闭环

```
里程碑结束 → milestone-audit（关卡 1：全量验证）
                ↓
下个里程碑 → brainstorming（关卡 2：用之前再查一遍）
```

关卡 1 是主力，关卡 2 是兜底。两道关卡在不同时间点检查同一个东西，就算第一道漏了，第二道会发现。

## 3. 改动 1：新建 milestone-audit skill

### 触发条件

- 里程碑所有任务完成
- 最终 code review 通过
- 准备进入 closeout 之前

### 流程

1. **确定范围**：看这个里程碑改了哪些文件，归类（页面 / API / 数据库 / AI prompt / 工具库 / 组件）
2. **定向审计**：只检查被改动的那几类，去代码里读实际状态，和 architecture.md 对比
3. **更新 architecture.md**：不一致的地方直接修正
4. **处理 ⚠️ 标记**：已修复的摘掉，新发现的标上
5. **输出报告**：写入 journal，给下个里程碑留参考

### 每类怎么查（半结构化）

| 类别 | 查法 |
|------|------|
| 页面路由 | 看里程碑期间新增/删除的 page.tsx、layout.tsx，对比 architecture.md 路由清单 |
| API 端点 | 看里程碑期间新增/删除的 route.ts，对比 architecture.md API 清单 |
| 数据库表 | 读 `src/lib/db.ts` 里的建表语句，对比 architecture.md 表清单 |
| AI 角色 | 读 `src/lib/seed-templates.ts`，对比 architecture.md 角色/模板清单 |
| 接口契约 | 逐条读契约描述，去代码里确认还对不对 |
| 学习状态流 | 看状态转换代码有没有变化 |

关键原则：必须读代码确认，不能只看文件名下结论。重点放在跨模块连接点。

### 报告格式

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

如果发现严重断裂（影响下个里程碑的前提假设），加 🚨 标记并在 closeout 前修复，不带到下个里程碑。

### Chain 位置

Closeout Chain（完整版）：
1. requesting-code-review（最终 review）
2. **milestone-audit**（全量验证）
3. claudemd-check（合规检查）
4. finishing-a-development-branch（分支收尾）

## 4. 改动 2：brainstorming skill 加强

brainstorming 的"探索项目上下文"步骤，从模糊的"看项目文件"改为明确读取列表：

| 文件 | 为什么读 |
|------|---------|
| `docs/architecture.md` | 系统现状——页面、接口、数据库、AI 角色、接口契约、⚠️ 标记 |
| `docs/project_status.md` | 当前进度、已完成的里程碑、下一步 |
| `docs/journal/INDEX.md` | 停车场里有没有相关想法要拉出来 |
| 上个里程碑的 spec（如有） | 之前的设计决策 |
| 相关模块的代码 | architecture.md 告诉你哪些文件和这次设计相关，去确认契约还对不对 |

前 4 个固定读，第 5 个根据 architecture.md 定向读。

新增硬性规则：里程碑级任务 brainstorming 时，如果发现 architecture.md 和代码不一致，先修正再设计。

## 5. 改动 3：CLAUDE.md 强化

### 新增"架构地图"段落（放在"技术栈"下面）

```
## 架构地图
`docs/architecture.md` 是系统现状的唯一真相源。所有里程碑设计必须基于它，不得凭记忆假设。
任何改动代码结构的工作完成后，必须同步更新。
```

### 禁止事项加一条

```
- 禁止在里程碑收尾时跳过 milestone-audit（architecture.md 全量验证）
```

## 6. 改动 4：claudemd-check 加检��项

新增两条检查：

1. **Step 3（任务完成更新）**：在检查 `project_status.md` 和 `changelog.md` 之外，也检查 `architecture.md` 是否已更新（如果本次工作涉及结构变化）。
2. **新增检查项（里程碑收尾时）**：确认 milestone-audit 已执行（journal 里有 `m<N>-milestone-audit` 记录）。没有则报 ✗。仅在里程碑收尾时���发，普通任务完成不检查。

## 7. 改动 5：session-init 更新

1. **规则 3 触发表**加一行：`里程碑结束 → milestone-audit → finishing-a-development-branch`
2. **规则 5 Closeout Chain** 更新为：`requesting-code-review → milestone-audit → claudemd-check → finishing-a-development-branch`
3. **Step 5 核心 skill 表**加一行：milestone-audit（10 → 11 个）

## 8. 改动清单汇总

| 文件 | 操作 | 改动 |
|------|------|------|
| `.claude/skills/milestone-audit/SKILL.md` | 修改 | 按 Section 3 校对草稿，确保与 spec 一致 |
| `.claude/skills/brainstorming/SKILL.md` | 修改 | 第一步改为明确读取列表 + `<HARD-GATE>` 验证规则 |
| `CLAUDE.md` | 修改 | 加"架构地图"段落 + 禁止事项加一条 |
| `.claude/skills/claudemd-check/SKILL.md` | 修改 | Step 3 加 architecture.md 检查 + 新增 milestone-audit 检查项 |
| `.claude/skills/session-init/SKILL.md` | 修改 | 触发表 + chain + skill 表 |
| `.claude/skills/requesting-code-review/SKILL.md` | 修改 | Chain Position 更新为 4 步 Closeout Chain |

## 9. 验收标准

1. milestone-audit skill 存在，流程完整（6 步 + 每类查法 + 报告格式）
2. brainstorming skill 第一步有明确的 5 项读取列表
3. CLAUDE.md 有"架构地图"段落 + 禁止事项包含 milestone-audit
4. claudemd-check 有 milestone-audit 检查项
5. session-init 的触发表、chain、skill 表均已更新
6. requesting-code-review 的 Chain Position 与新 Closeout Chain 一致
