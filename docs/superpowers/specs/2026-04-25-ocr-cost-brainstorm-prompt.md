# Brainstorm 启动指引：OCR + KP 提取成本架构重设

> **给下一个 session 的 Claude**：本文件是 2026-04-24 → 04-25 跨 session 状态交接。直接按下面流程开始，不要等用户重新解释。

---

## 第 1 步：上下文加载（读这些）

按顺序读：

1. **`docs/journal/2026-04-25-ocr-cost-shock.md`** — 触发事件 + 成本估算 + 战略问题陈述
2. **`docs/project_status.md`** — 当前里程碑状态（M4.6 已收尾，等成本决策）
3. **`docs/architecture.md` `## 0. 摘要卡` + OCR 相关章节** — 当前 Vision API + Cloud Run 架构
4. **memory `project_mvp-direction.md`** — MVP 三方向（扫描 PDF / 教学 / 留存）
5. **memory `project_teaching-mode-paywall.md`** — 教学模式商业护城河
6. **memory `user_product-owner-tester.md`** — 用户是非技术 + 准备抖音 / 小红书引流
7. **`docs/journal/INDEX.md`** parked 段 OCR / cost / 商业相关条目

不要重读已成功的 M4.6 hotfix 链（T15-T17）—— 它们 done 了。

---

## 第 2 步：直接进 brainstorming skill

**主题**：M4.6 收尾后，重新设计 OCR + KP 提取的成本架构，使之能撑住抖音 / 小红书引流的 100-1000 用户量级而不烧穿账户

**关键事实**：
- 已实测：369 页中文教材，T17 fix 后管线跑通（28s classify + 6 min OCR + KP 提取）
- KP 提取阶段触发 `Your prepayment credits are depleted` 失败
- 估算单本成本：50 页 ~3 元 / 369 页 ~8-15 元
- 抖音引流 100 人 × 1 本 = 一晚 500-1000 元 → 不可持续
- 用户已明确要求"重新考虑到底怎么 OCR 才行"

**约束（不可放松）**：
- **中文教材精度** 不能塌（这是产品命根，OCR 出错 = 教学全错）
- **零技术用户**（抖音 / 小红书引流，不能要求装客户端 / 配 API key）
- **教学模式付费墙不动**（已锁的商业护城河，见 memory）
- **首本不能强制充钱**（流失太严重）

---

## 第 3 步：Research Trigger Check —— 这是 🔴 调研

判定理由（满足任一即 🔴）：
- ✅ 多选项对比（OCR 商用 / 自托管开源 / 混合 / 用户侧 4+ 类）
- ✅ 难反悔（OCR 上量后切换成本巨大）
- ✅ 跨领域专家知识（OCR 模型选型 + 中文 NLP + 自托管成本 + 商业模式）
- ✅ 结论会被多决策引用（OCR 选型直接影响 KP 提取 + 缓存 + 付费策略）
- ✅ 用户明确要求

**必须调用 `research-before-decision` skill**，不能跳过用 🟡 light template。

调研维度建议（让 sub-agent 并行）：

1. **中文 OCR 横评**（精度 + 价格 + 自托管难度）
   - Google Vision（baseline）
   - PaddleOCR（项目早期用过，精度 / 维护现状变了吗）
   - Surya / dots.ocr / olmOCR / 其他 2025-2026 新开源
   - 阿里云 OCR / 腾讯云 OCR / 百度 OCR / 讯飞 / 字节火山
   - 输出表：精度（中文教材场景）/ 单页价 / 自托管 GPU 要求 / 调用 SDK 成熟度

2. **KP 提取 LLM 选型**（精度 vs 价格）
   - Gemini 2.5 Pro（当前）vs Gemini 2.5 Flash 精度差
   - DeepSeek V3 / R1（API 价 + 中文教材精度）
   - Qwen 系列（API + 自托管）
   - GLM / Yi / 国产其他
   - 输出表：百万 token 价格 / 中文长文本理解能力 / JSON 结构化输出可靠度

3. **架构层省钱手段**
   - PDF MD5 缓存命中策略（同书复用）
   - chunking 粒度（章节级 vs 全书）
   - 用户侧 OCR 可行性（浏览器内 WASM Tesseract / Mistral OCR 客户端版）

4. **商业模式 / 用户层防御**
   - 同类产品（Coursera / Khan / 中国 K12 / 网易有道 / 阿里夸克）的免费额度策略
   - 邀请稀缺度 + 上传额度 + 充值制 三种机制利弊
   - 学校 / 机构付费授权模式

每维度要 S 级源 ≥3 + 不能从训练记忆生成数字（必须有可点击 URL）。

---

## 第 4 步：WIP 状态文件

开 `docs/superpowers/specs/2026-04-25-ocr-cost-brainstorm-state.md`，按 brainstorming skill WIP 协议运行（每决策拍板后立刻更新，不批处理）。

预计决策点 5+ 个 → 必须开 WIP 文件 + MEMORY pointer。

---

## 第 5 步：5 问表格（CLAUDE.md 强约束）

每个候选方案必须用 5 问表格汇报：
1. 它是什么（生活类比）
2. 现在的代价（时间 / 复杂度，非技术细节）
3. 它给我们带来什么（具体能力）
4. 它关闭了哪些未来的门（用了之后什么变难）
5. 选错了后果是什么（最坏情况，多难纠正）

并标注可逆性（容易 / 难反悔）。

---

## 第 6 步：当前留下的 stuck artifacts（brainstorm 后再清）

- **book 18 / 17 / 16** 数据库行（cleanup 需要决策后一起改 schema 或确认不动）
- **commit `9a76458`** 本地未 push（网络）—— 下次有网时一把推
- M4.6 task-ledger 状态：T17 done，本 milestone 形式上可关闭，等成本架构方向定了再写 milestone-audit

---

## 不该做的事

- ❌ 不要直接派 Codex / Gemini 写代码——必须 brainstorm 完整流程后再到 plan → execute
- ❌ 不要单独评估单一选项（OCR 选 X / KP 选 Y），必须横评
- ❌ 不要绕过 research-before-decision skill 用"快速 WebSearch 一下"
- ❌ 不要重启 M4.6 调试——T17 已修好且实测验证

## 紧急度

**高** —— 决定能不能上量。但**不要赶 brainstorm**：花 1-2 个 session 把方向想清楚 > 仓促决策导致再次烧钱重做。
