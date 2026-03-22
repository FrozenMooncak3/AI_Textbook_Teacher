---
name: claudemd-check
description: CLAUDE.md 合规自检。自动触发：每次声称任务完成、准备 commit、或即将结束会话时，必须先跑此检查。手动触发：用户输入 /claudemd 时执行。检查项包括：必读文件是否已读、project_status.md 和 changelog.md 是否已更新、commit 是否已 push、文件边界是否被遵守、沟通协议是否被遵循。
---

# CLAUDE.md 合规自检

每次声称任务完成前，逐项检查以下清单。任何一项未通过，必须先修复再声称完成。

## 检查清单

### 1. 会话初始化（仅检查是否遗漏）

- [ ] 读了 `docs/project_status.md`
- [ ] 读了 `docs/decisions.md`
- [ ] 读了 `docs/journal/INDEX.md`

如果当前会话没读过这 3 个文件，立即读取，不要跳过。

### 2. 任务完成后必须更新的文件

- [ ] `docs/project_status.md` 反映了当前真实状态（日期、里程碑进度、下一步）
- [ ] `docs/changelog.md` 追加了本次变更记录（做了什么、改了哪些文件）

验证方法：读两个文件，确认最后一条记录覆盖了本次工作。如果没有，现在更新。

### 3. Git 状态

- [ ] 所有改动已 commit（`git status` 无遗漏的已修改文件）
- [ ] 所有 commit 已 push 到远端（`git log origin/master..HEAD` 为空）

验证方法：运行 `git status` 和 `git log origin/master..HEAD --oneline`。如果有未 push 的 commit，立即 `git push origin master`。

### 4. 文件边界

- [ ] Claude（PM）没有写入 `src/**`、`scripts/**`、`package.json`（除非用户明确授权越界）

验证方法：回顾本次会话中自己写入或修改的文件列表，确认没有越界。如果用户授权了越界，此项通过。

### 5. 产品不变量

- [ ] 本次改动没有违反 CLAUDE.md 中的 5 条产品不变量

快速回顾：
1. 必须读完原文才能进 Q&A
2. Q&A 已答不可改
3. 测试阶段禁看笔记和 Q&A
4. 过关线 80% 硬规则
5. Q&A 一次一题 + 即时反馈

### 6. 技术红线

- [ ] 没有写 TypeScript `any`
- [ ] 没有在客户端暴露 `ANTHROPIC_API_KEY`
- [ ] `data/app.db` 没有被 git 追踪
- [ ] 没有在生产代码留 `console.log`

### 7. 沟通协议（仅在向用户汇报技术选项时检查）

- [ ] 每个选项回答了 5 个问题（是什么、代价、收益、关闭的门、选错后果）
- [ ] 标注了可逆性（容易反悔 / 难以反悔）
- [ ] 给了明确推荐，选项不超过 3 个

## 输出格式

检查完成后，输出简洁报告：

```
CLAUDE.md 自检完成
✓ 会话初始化：3/3 文件已读
✓ 状态文件：project_status.md + changelog.md 已更新
✓ Git：已 commit + 已 push
✓ 文件边界：未越界（或：已授权越界）
✓ 产品不变量：未违反
✓ 技术红线：未违反
⚠ 沟通协议：本次无技术汇报，跳过

结果：全部通过 / N 项需修复
```

如果有未通过项，先修复，再重新运行检查，直到全部通过。
