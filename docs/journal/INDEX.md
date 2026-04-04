# Journal Index

## open（需要关注）
- [bug] M5.5 验收：test_ch1_2 显示 PDF 处理失败（实际有 PDF）+ 读财报模块地图白屏（TXT 上传）→ [2026-04-04-m5.5-user-testing.md](./2026-04-04-m5.5-user-testing.md)

## in_progress（解决中）

## parked（停车场）

> Tier 说明：T1 = M5.5 必做 | T2 = 独立里程碑评估 | T3 = MVP 后再议

### AI / Prompt
- **T2** 复习出题 KP 覆盖率——cluster 内 KP 轮换或改为 KP 粒度出题 → [2026-04-03-review-kp-coverage.md](./2026-04-03-review-kp-coverage.md)

### 功能
- **T2** Dashboard 日历视图——学习/复习时间表 → [2026-04-03-dashboard-calendar.md](./2026-04-03-dashboard-calendar.md)
- **T2** 笔记+QA 联动：阅读写笔记 → AI 结构化 → QA 侧边栏弹要点 → [2026-03-29-notes-qa-integration.md](./2026-03-29-notes-qa-integration.md)
- **T3** OCR 后生成思维导图 → [2026-03-31-walking-ideas.md](./2026-03-31-walking-ideas.md)
- **T3** 渐进 Hint 系统（浅提示→跳原文→解析，subscription 分级）→ [2026-04-03-review-ux-ideas.md](./2026-04-03-review-ux-ideas.md)

### 交互 / UX
- **T1** QA/复习时旁边可以看原文 → [2026-04-03-review-ux-ideas.md](./2026-04-03-review-ux-ideas.md)
- **T1** 全局缺导航：所有页面没有返回键，需导航 sidebar + 面包屑 → [2026-04-03-m5-testing-ux.md](./2026-04-03-m5-testing-ux.md)
- **T1** PDF 阅读器太弱：替换为成熟库（react-pdf-viewer 等），补齐缩放/搜索/书签 → [2026-04-03-m5-testing-ux.md](./2026-04-03-m5-testing-ux.md)
- **T1** 大 PDF 分块提取：230K+ 字符文本需分块处理才能 KP 提取（369 页真实教材无法使用）→ [2026-04-03-m5-testing-ux.md](./2026-04-03-m5-testing-ux.md)
- **T2** 模块阅读选文字问AI（选中文字→提问→AI回答，复用screenshot-ask第二步）→ [2026-04-03-module-text-ask-ai.md](./2026-04-03-module-text-ask-ai.md)
- **T2** 笔记跳转原文 → [2026-03-31-walking-ideas.md](./2026-03-31-walking-ideas.md)
- **T2** 右键选中多功能：做笔记、高亮等 → [2026-03-31-walking-ideas.md](./2026-03-31-walking-ideas.md)
- **T2** 学习计划定制（百词斩模式）：AI 预估时长+用户自定节奏 → [2026-03-31-m3-brainstorming.md](./2026-03-31-m3-brainstorming.md)

### 基础设施
- **T2** 预生成系统——后台预生成下一步内容，消灭等待 → [2026-04-04-pregeneration-system.md](./2026-04-04-pregeneration-system.md)
- **T2** 支持 PPT + 扫描版 PDF（独立里程碑）→ [2026-03-31-walking-ideas.md](./2026-03-31-walking-ideas.md)
- **T3** 语言模式系统——自动切换 prompt 语言，多国语言版本 → [2026-03-22-m0-verification.md](./2026-03-22-m0-verification.md)

### 商业
- **T2** Subscription 分级（hint access levels 等付费功能区分）→ [2026-04-03-review-ux-ideas.md](./2026-04-03-review-ux-ideas.md)
- **T2** 优先面向扫描版 PDF 用户群体 → [2026-03-31-walking-ideas.md](./2026-03-31-walking-ideas.md)

### 工程流程
- **T1**🔴 执行任务 skill——双层 review + fix 循环 + 自动派发 + 调研 PM 方法论 → [2026-04-04-execution-skill.md](./2026-04-04-execution-skill.md)

### 已决策归档
- [decision] 第三次 brainstorming 砍掉的项 H6/H8/H12/H13 → [2026-03-28-skill-automation.md](./2026-03-28-skill-automation.md)

## resolved（已解决）
- [audit] M5.5 milestone-audit 通过：App Shell + ProcessingPoller + 错误边界全量验证，architecture.md 与代码一致（2026-04-04）→ [2026-04-04-m5.5-milestone-audit.md](./2026-04-04-m5.5-milestone-audit.md)
- [audit] M5 milestone-audit 通过：architecture.md 与代码一致，3 条新契约已文档化，⚠️ test/submit error_type 未变（2026-04-03）→ [2026-04-03-m5-milestone-audit.md](./2026-04-03-m5-milestone-audit.md)
- [M5完成] 评分后显示正确答案：T4/T7 实现（review/respond + test/submit 返回 correct_answer/explanation，前端展示）（2026-04-03）
- [M5完成] 错题本功能：T5/T8 实现（书级 mistakes API + 多维筛选前端页面）（2026-04-03）
- [M5完成] 测试 Dashboard：T5/T8 实现（dashboard API + 四宫格仪表盘页面）（2026-04-03）
- [audit] M4 milestone-audit 通过：1 处缺漏已补（error_type 约束），architecture.md 与代码一致（2026-04-03）→ [2026-04-03-m4-milestone-audit.md](./2026-04-03-m4-milestone-audit.md)
- [infra:resolved] milestone-audit skill 已实现——architecture.md 守护体系（两道关卡闭环）（2026-04-03）→ [2026-04-03-milestone-audit-skill.md](./2026-04-03-milestone-audit-skill.md)
- [bug:resolved] M4 集成测试 2 bug 已修复（commit f54baf0）：验证放宽 + token 预算提升（2026-04-03）→ [2026-04-03-m4-integration-test.md](./2026-04-03-m4-integration-test.md)
- [audit] M3→M4 代码审计：6 个问题全部分流，3 个修复于 M3.5，剩余 3 个归入 M4（2026-04-02）→ [2026-04-02-m3-to-m4-code-audit.md](./2026-04-02-m3-to-m4-code-audit.md)
- [infra] CCB 文件消息系统：替代 ask 命令，双向通信验证通过（2026-04-02）→ [2026-04-02-ccb-file-messaging.md](./2026-04-02-ccb-file-messaging.md)
- [infra] CCB 迁移到 Claude Code Bridge v5.2.9：验证通过，ask/ping 双向通信正常（2026-04-02）→ [2026-04-01-ccb-migration.md](./2026-04-01-ccb-migration.md)
- [blocked→resolved] M3 集成测试：4 层修复（代理+流式+token+JSON 解析），commit deb82c5（2026-04-01）→ [2026-04-01-m3-integration-test.md](./2026-04-01-m3-integration-test.md)
- [idea] UI/UX Pro Max Skill → 已安装给 Gemini，适配 Next.js+Tailwind（2026-03-30）→ [2026-03-21-mvp-redesign.md](./2026-03-21-mvp-redesign.md)
- [idea] Wezterm 双向发送问题 → 已修复：内容用 paste 模式，提交用键盘模式（2026-03-30）→ [2026-03-29-wezterm-report-submit.md](./2026-03-29-wezterm-report-submit.md)
- [idea] Session Init 全局报告 → 升级为 CEO 仪表盘 + skill 治理（2026-03-29）→ [2026-03-29-session-init-report.md](./2026-03-29-session-init-report.md)
- [decision] 第三次 brainstorming：session-init + retrospective + chain declarations 已实施（2026-03-28）→ [2026-03-28-skill-automation.md](./2026-03-28-skill-automation.md)
- [decision] 第二次 brainstorming：Claude hook 自动化（H1-H7）→ 已实施，commit 09aaaef → [2026-03-28-skill-automation.md](./2026-03-28-skill-automation.md)
- [issue] Codex/Gemini skill list 可见性 → 已确认可见（2026-03-28）→ [2026-03-28-skill-automation.md](./2026-03-28-skill-automation.md)
- [idea] 优化 AI 协作的任务记忆文档体系 → 已通过 journal 系统解决（2026-03-21）
- [验证] M0 最终验证通过（8/8），发现截图 AI 5 项改进 → 已归入 M5 → [2026-03-22-m0-verification.md](./2026-03-22-m0-verification.md)
