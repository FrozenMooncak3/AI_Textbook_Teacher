# 项目状态（Project Status）

> 每次新 session 的第一个文件。保持"此刻的真实状态"。
> 每完成任何一个操作，必须更新这个文件。

---

## 当前状态（2026-04-04）

**方向**：MVP 重新设计——教练核心 + PDF 阅读器 + 独立问答通道

**当前里程碑**：M5.5 稳固 & App Shell — **已完成**（2026-04-04）

**最新完成**：M5.5 milestone-audit 通过 + task-execution skill 已实现（统一执行引擎）。

**下一步**：重新分配停车场想法 → 大更项目文件 → 下一个里程碑规划

**架构**：CCB 多模型协作（Claude PM + Codex 后端 + Gemini 前端），Superpowers + Skill 体系，Hook 自动化守卫

---

## 里程碑总览

> 里程碑定义以设计 spec（Section 6）为准。

| 里程碑 | 内容 | 状态 |
|--------|------|------|
| M0 | 地基重建：19 张表 + prompt 模板系统 + bug 修复 | **已完成**（2026-03-22） |
| M1 | 提取器 AI：上传 PDF → 三阶段 KP 提取 → KP 表和模块地图写入 DB → 模块地图页面 | **已完成**（2026-03-28） |
| M2 | 教练 AI（核心）：读前指引 → 阅读（笔记+截图问答）→ Q&A（4 种题型+即时反馈+预生成）→ 学习笔记生成 | **已完成**（2026-03-29） |
| M3 | 考官 AI：测试出题 → 盲测 → 评分 → 80% 过关 → 错题诊断 | **已完成**（2026-04-01） |
| M3.5 | 里程碑衔接修复：测试→复习调度触发 + schema 清理 + reviewer prompt 重写 | **已完成**（2026-04-02） |
| M4 | 复习系统：复习调度（3/7/15/30/60 天）→ 聚类出题 → P 值更新 → 前端复习会话 | **已完成**（2026-04-02） |
| M5 | 功能补完：截图问 AI 两步流程 + AIResponse Markdown 渲染 + 正确答案展示 + 仪表盘 + 错题诊断 | **已完成**（2026-04-03） |
| M5.5 | 稳固 & App Shell：侧栏导航 + 白屏修复 + OCR 自动触发 + 进度显示 + LoadingState | **已完成**（2026-04-04） |

### M5 完成内容

| 任务 | 描述 | 状态 |
|------|------|------|
| T1 | Schema migration: mistakes 表 + screenshot_qa 模板修复 | ✅ |
| T2 | AIResponse 组件 + react-markdown 依赖 | ✅ |
| T3 | 截图问 AI API 拆分（screenshot-ocr + screenshot-ask 重写） | ✅ |
| T4 | 正确答案/解析：review/respond + test/submit 返回值增强 | ✅ |
| T5 | Dashboard + Mistakes 后端 API | ✅ |
| T6 | AiChatDialog 前端两步流程 | ✅ |
| T7 | ReviewSession/TestSession 正确答案展示 + AIResponse 迁移 | ✅ |
| T8 | Dashboard + Mistakes 前端页面 | ✅ |
| T9 | AIResponse 全站 rollout | ✅ |

### 依赖关系

```
M0 → M1 → M2 → M3 → M4 → M5
              ↑
       独立问答通道（已有，持续可用）
```

---

## 核心架构变化（相比旧 Phase 1/2）

- **5 个 AI 角色**：提取器 / 教练 / 考官 / 复习官 / 助手，各有独立 prompt 模板
- **KP 成为一级实体**：知识点有独立表，驱动所有学习活动
- **即时反馈**：Q&A 每题答完立即反馈（不再是全部答完后批量）
- **P-value 复习权重**：动态权重系统控制复习题量
- **数据库从 12 张表扩展到 21 张表**，破坏性迁移（删旧建新）

---

## 已有资产（Phase 1 + Phase 2 遗留，M0 后部分复用）

- Phase 1 完整学习流程可运行（上传 → 模块 → Q&A → 测试 → 错题）
- Phase 2 PDF 阅读器 + 截图问 AI 后端已完成
- PaddleOCR 常驻 HTTP 服务（`scripts/ocr_server.py`）
- Vercel AI SDK 多模型客户端（`src/lib/ai.ts`，支持 Anthropic/Google/OpenAI 兼容 provider）

---

## 历史记录

| 日期 | 里程碑 |
|------|--------|
| 2026-03-14 | Phase 0 完成，文档体系建立 |
| 2026-03-15 | Phase 1 完成，完整学习流程可运行 |
| 2026-03-17 | 引入多 Agent 架构 |
| 2026-03-18 | Phase 2 启动，后端 M1-M5 全部完成 |
| 2026-03-21 | 架构迁移到 CCB + Skill 体系 |
| 2026-03-21 | MVP 重新设计，目标用户定位中国留学生 |
| 2026-03-21 | 旧文件清理，文档体系精简 |
| 2026-03-22 | M0 Task 0-5 完成（schema 重写 + prompt 模板 + bug 修复） |
| 2026-03-22 | **M0 完成**：最终验证通过（8/8 checks） |
| 2026-03-28 | **Hook 自动化完成**：4 个 hook + structured-dispatch skill + claudemd-check 更新 |
| 2026-03-28 | **第三次 brainstorming 实施完成**：session-init skill + retrospective skill + 6 skill chain 声明 + CLAUDE.md/using-superpowers 更新 |
| 2026-03-29 | **M2 完成**：教练 AI 全部代码 + review 修复完成，6 项 fix 已 push |
| 2026-03-29 | **多模型抽象层完成**：Vercel AI SDK 集成，12 个调用点迁移，`AI_MODEL` 环境变量切换 |
| 2026-03-29 | **Session-Init 升级 + Skill 治理**：CEO 仪表盘、skill 合规审计、skill 合并/清理（26→22） |
