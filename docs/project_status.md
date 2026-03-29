# 项目状态（Project Status）

> 每次新 session 的第一个文件。保持"此刻的真实状态"。
> 每完成任何一个操作，必须更新这个文件。

---

## 当前状态（2026-03-29）

**方向**：MVP 重新设计——教练核心 + PDF 阅读器 + 独立问答通道

**设计文稿**：`docs/superpowers/specs/2026-03-21-mvp-redesign-design.md`

**当前里程碑**：Gemini Flash Smoke Test — 已完成

**最新完成**：Session-Init 升级 + Skill 治理。session-init 升级为 CEO 仪表盘（5 板块 + 详略自动判断 + session-wide 运行规则）；claudemd-check 新增 skill 合规审计；executing-plans 合并了 subagent-driven-development；删除 3 个冗余 skill（26→22）；CLAUDE.md 引用更新。

**实现计划**：`docs/superpowers/plans/2026-03-29-multi-model-abstraction.md`

**设计文稿**：`docs/superpowers/specs/2026-03-29-multi-model-abstraction-design.md`

**M2（已完成）**：教练 AI — 全部代码 + review 修复完成。

**M2 实现计划**：`docs/superpowers/plans/2026-03-28-m2-coach-ai.md`

**M1（已完成）**：提取器 AI——上传 PDF → 三阶段 KP 提取 → 模块地图写入 DB → 前端展示。

**M0（已完成）**：地基重建——19 张表 + prompt 模板系统 + bug 修复 + 最终验证通过

**下一步**：进入 M3（考官 AI：测试出题 → 盲测 → 评分 → 80% 过关 → 错题诊断）

**架构**：CCB 多模型协作（Claude PM + Codex 后端 + Gemini 前端），Superpowers + Skill 体系，Hook 自动化守卫

---

## 里程碑总览

> 里程碑定义以设计 spec（Section 6）为准。

| 里程碑 | 内容 | 状态 |
|--------|------|------|
| M0 | 地基重建：19 张表 + prompt 模板系统 + bug 修复 | **已完成**（2026-03-22） |
| M1 | 提取器 AI：上传 PDF → 三阶段 KP 提取 → KP 表和模块地图写入 DB → 模块地图页面 | **已完成**（2026-03-28） |
| M2 | 教练 AI（核心）：读前指引 → 阅读（笔记+截图问答）→ Q&A（4 种题型+即时反馈+预生成）→ 学习笔记生成 | **已完成**（2026-03-29） |
| M3 | 考官 AI：测试出题 → 盲测 → 评分 → 80% 过关 → 错题诊断 | 未开始 |
| M4 | 复习系统：复习调度（3/7/15/30/60 天）→ 聚类出题 → P 值更新 → **Q&A 穿插 20% 历史复习题** | 未开始 |
| M5 | 体验打磨：首页仪表盘 + 笔记查看/导出 + 截图问 AI 流程改造 + UI/UX 打磨 | 未开始 |

### M5 已知任务（来自 M0 验证观察）

| 编号 | 任务 | 类型 |
|------|------|------|
| M5-T1 | 截图问 AI 流程拆分：OCR 识别（Step 1）→ 用户提问（Step 2）→ AI 回答（Step 3），不再自动解释 | 功能修正 |
| M5-T2 | 截图问 AI 语言匹配：AI 用内容语言回答（中文内容→中文回答），prompt 改为中文 | 功能修正 |
| M5-T3 | 截图处理进度反馈：分阶段显示「识别中...」→「文字已识别」→「AI 思考中...」 | UX |
| M5-T4 | AI 回复 Markdown 渲染（react-markdown 或类似方案） | UX |
| M5-T5 | OCR 进度条精度优化 | UX |

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
- **数据库从 12 张表扩展到 19 张表**，破坏性迁移（删旧建新）

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
