# MVP 扩展时间线

**创建日期**: 2026-04-11
**状态**: 进行中

---

## 三项 MVP 扩展

| 项目 | 内容 | 优先级 | 前置依赖 |
|------|------|--------|---------|
| **扫描 PDF** | 扫描版 PDF 作为主功能 + 多书种类支持 | P0（先做） | 无 |
| **教学系统** | 加入 AI 教学环节（阅读→**教学**→QA），按知识类型匹配教学法 | P1（第二） | 扫描 PDF 完成 |
| **留存机制** | 用户留存与学习动机设计 | P2（最后） | 教学系统设计完成 |

## 执行时间线

```
Session A（当前）: 扫描 PDF brainstorm → 设计 → 开发
    │
    ├── 完成后 →
    │
Session B: 教学系统深度调研 + brainstorm → 设计
    │   调研范围：
    │   ├── 通用知识类型分类方案（Bloom vs 自定义）
    │   ├── 教学法 × 知识类型匹配（Hattie effect size）
    │   ├── AI 教学 prompt 编码方案
    │   └── 教学对话 UX 研究
    │   参考文档：docs/research/（已有 5 份调研文档）
    │   关键输入：月饼投资 spec（D:\已恢复\Users\Sean\月饼投资计划\docs\specs\04-teaching-system.md）
    │   关键产品决策：两种模式（教学模式 / 完整模式）→ docs/journal/2026-04-11-two-learning-modes.md
    │
    ├── 教学设计完成后 →
    │
Session C: 留存机制调研 + brainstorm → 设计
    │   调研范围：
    │   ├── Duolingo 留存设计案例
    │   ├── 学习动机理论（Self-Determination Theory）
    │   ├── 游戏化研究（有效 vs 噱头）
    │   └── 基于教学系统设计的留存钩子
    │
    └── 全部设计完成 → 各项进入开发
```

## 顺序依赖的原因

- **扫描 PDF 先做**: 基础功能缺失，不需要等其他调研，独立性最强
- **教学在留存之前**: 留存设计包裹在学习体验外面。不知道学习 session 长什么样，就没法设计留存钩子。两种模式（教学/完整）的留存策略可能完全不同
- **留存的基础调研可以提前做**: Duolingo 案例、动机理论等领域知识不依赖教学设计，但留存的**产品设计**必须等教学设计完成

## 已完成的调研（供后续 session 使用）

所有文件在 `docs/research/`：
- `2026-04-11-competitive-analysis.md` — 竞品（NotebookLM/Khanmigo/OpenMAIC 等）
- `2026-04-11-learning-sciences-overview.md` — 学习科学学术领域 + Hattie effect size
- `2026-04-11-ai-cost-and-moat.md` — Token 成本趋势 + 护城河分析
- `2026-04-11-user-positioning.md` — 用户定位
- `2026-04-11-teaching-spec-evaluation.md` — 月饼投资教学 spec 评价（可借鉴/需改造/不借鉴）
