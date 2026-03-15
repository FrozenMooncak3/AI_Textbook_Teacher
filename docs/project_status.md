# 项目状态（Project Status）

> 这是 Context 压缩后恢复工作状态的第一个文件。
> 规则：每完成任何一个操作，必须更新这个文件。保持"此刻的真实状态"。

---

## 当前状态（2026-03-15）

**阶段**：Phase 1 进行中

**正在做**：无

**下一步**：Phase 1 第3步 — 模块地图生成（Claude API）+ 展示页面

---

## Phase 1 任务清单（按顺序）

- [x] 第1步：数据库建表（6张表，app 启动时自动初始化）
- [x] 第2步：文本上传 API + 上传页面
- [ ] 第3步：模块地图生成（Claude API）+ 展示页面
- [ ] 第4步：读前指引（任务锚生成 + 原文视图）
- [ ] 第5步：Q&A 页面（逐题交互）
- [ ] 第6步：模块测试页面
- [ ] 第7步：错题诊断 + 记录

---

## Phase 0 已完成清单

- [x] Next.js 15 项目初始化（TypeScript + Tailwind）
- [x] 安装核心依赖（`@anthropic-ai/sdk`、`better-sqlite3`）
- [x] `CLAUDE.md`（项目核心指令，含产品不变量、决策日志、工作协议）
- [x] `project_spec.md`（产品规格书）
- [x] `docs/learning_flow.md`（学习规则）
- [x] `docs/ROADMAP.md`（Phase 0-3 路线图）
- [x] `docs/decisions.md`（决策日志，7 条已关闭决策）
- [x] `docs/changelog.md`（变更日志）
- [x] `.gitignore` 修复（保护 `data/app.db`）
- [x] `data/` 目录创建

---

## 已知风险

| 风险 | 影响 | 应对 |
|------|------|------|
| Claude API 处理长文本成本高 | Phase 1 第3步 | 按模块分批处理，不一次性发全文 |
| SQLite 不支持 Vercel 文件系统 | Phase 3 | MVP 先本地测试，Phase 3 再迁移 Supabase |

---

## 历史记录

| 日期 | 里程碑 |
|------|--------|
| 2026-03-14 | Phase 0 完成，文档体系建立 |
