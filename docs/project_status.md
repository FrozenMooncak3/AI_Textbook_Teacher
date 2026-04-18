# 项目状态

> 当前项目状态的权威快照。SessionStart hook 自动注入。
> 里程碑切换 / 关键决策 / architecture 变动 / 新 spec 产生 / 阻塞变化时必须同步更新。

---

## 1. 当前里程碑

**方向**：MVP 扩展三线——扫描 PDF（✅）→ 教学系统（M4，待启动）→ 留存机制，串行执行

**进行中**：云部署
- 阶段 1 ✅ 完成（2026-04-16）：R2 + Vercel + Neon + OCR 代码层兼容，生产冒烟通过
- 阶段 2 ⬜ 未开始：Cloud Run OCR + CI/CD + Google Vision
- 阶段 3 ⬜ 未开始：自定义域名 + 监控 + Secrets 管理

**排队中**：M4 教学系统最小闭环
- 设计全完成（spec + plan 就绪）
- 启动条件：云部署上线 + 验收通过 → 开新 session dispatch
- L1 引擎 Codex + L2 Tier A Gemini 可并行

**下一步**：云部署阶段 2 plan 编写，或 F.3 session-init 重设计实施（当前 session 在做）

---

## 2. 最近关键决策

- 2026-04-18 session-init F.3 重设计：SessionStart hook 注入 project_status + PreCompact block 强制刷新 + SKILL 瘦身 → [spec](superpowers/specs/2026-04-18-session-init-F2-redesign.md) · [plan](superpowers/plans/2026-04-18-session-init-F3-redesign.md)
- 2026-04-15 调研能力建设：research-before-decision skill + brainstorming Research Trigger Check，解决 OCR 决策捏造定价事件 → [spec](superpowers/specs/2026-04-14-research-capability-design.md)
- 2026-04-14~15 云部署 10 决策拍板：Vision OCR / Vercel Hobby / Cloud Run / R2 / Neon branch preview / CD UI / 平台 env vars / .com + Cloudflare Registrar / Sentry + Vercel Analytics / 3 阶段拆分 → [spec](superpowers/specs/2026-04-12-cloud-deployment-design.md)
- 2026-04-14 教学系统 10 决策全部拍板 → [spec](superpowers/specs/2026-04-15-m4-teaching-mode-design.md)
- 2026-04-12 扫描 PDF 里程碑完成，9 tasks 闭环，architecture.md 补 OCR_PROVIDER 等 4 条约束
- 2026-04-09 Component Library 完成：33 组件 + 全页面重写

完整决策历史见 `docs/decisions.md`（早期）和各 spec 文件（2026-04 之后）。

---

## 3. 文件地图（Navigation）

**代码结构**：`docs/architecture.md §0 摘要卡`（只读摘要卡，不读 §1-N）

**当前 WIP / 排队中里程碑**：
- 云部署：`docs/superpowers/specs/2026-04-12-cloud-deployment-design.md`
- M4 教学系统：`docs/superpowers/specs/2026-04-15-m4-teaching-mode-design.md` + `plans/2026-04-15-m4-teaching-mode.md`
- Session-Init F.3（当前 session）：`docs/superpowers/specs/2026-04-18-session-init-F2-redesign.md` + `plans/2026-04-18-session-init-F3-redesign.md`

**历史里程碑完整任务表**：`docs/milestones/`

**想法 / 停车场**：`docs/journal/INDEX.md`（11 条 parked，分类 T1/T2/T3）· 归档见 `INDEX-resolved.md`

**调研知识库**：`docs/research/INDEX.md`（云部署 / PDF 处理 / 学习科学 / 竞品 / 护城河）

**Specs 索引**：`docs/superpowers/INDEX.md`

**CCB 协议**：`docs/ccb-protocol.md`（派发 / 语言 / Review 规范）

**已关闭决策**：`docs/decisions.md`（早期产品决策，不重新讨论）

---

## 4. 未决问题

- **扫描 PDF 端到端人工测试**：本地 OCR server 起不来，改为云环境测试（阶段 2 上线后跑）
- **Advisory 累计**：11 条中剩 9 条经人工评估为 by-design，不单独追修
- **M3 阶段 3 收尾**：域名、监控、Secrets 三件事打包（低优先，阶段 2 稳定后再做）

