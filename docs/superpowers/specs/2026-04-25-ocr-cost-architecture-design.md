---
title: OCR + KP 提取成本架构 设计文稿
status: in_progress（brainstorm 中，按 BS-1 7b 增量 append）
date: 2026-04-25
brainstorm_state: ./2026-04-25-ocr-cost-brainstorm-state.md
trigger_journal: ../../journal/2026-04-25-ocr-cost-shock.md
keywords: [OCR, KP-extraction, cost-architecture, scaling, paywall, business-model, scanned-pdf, 中文教材, Vision-API, Gemini, PaddleOCR, DeepSeek, Qwen]
---

# OCR + KP 提取成本架构设计

> 7+ 决策的成本架构 brainstorm 产出。每决策 lock 后按 BS-1 7b 规则追加对应 engineering 章节。完成后由 spec-document-reviewer subagent loop 验收，最终用户 review 后转 writing-plans。
>
> WIP 决策状态见 `./2026-04-25-ocr-cost-brainstorm-state.md`（compact 防御）。

## 0. 摘要卡（增量回填中）

| 项 | 值 | lock 状态 |
|---|---|---|
| MVP 接受文件类型 | TXT + 文字版 PDF + `.pptx`（拒 `.ppt` 旧格式）| ✅ D0 lock 2026-04-25 + PPT 扩展 lock 2026-04-25 |
| 文件大小上限 | ≤10 MB | ✅ D0 lock 2026-04-25 |
| PDF 页数上限 | ≤100 页 | ✅ D0 lock 2026-04-25 |
| PPT 幻灯片上限 | ≤200 张 | ✅ PPT 扩展 lock 2026-04-25 |
| 扫描 PDF 处理 | 前端拦截 + 邮箱收集（launch list） | ✅ D0 lock 2026-04-25 |
| PPT 嵌入图片 OCR | 不做（与扫描 PDF 一致拒）| ✅ PPT 扩展 lock 2026-04-25 |
| KP 提取模型 | DeepSeek V3.2（KP + 教学免费档）+ Qwen3-Max 备选 + Sonnet 4.6 付费档不动 | ✅ D5 lock 2026-04-25 |
| 缓存策略 | PDF MD5 全书级 + 半全局共享 + provider auto cache | ✅ D6 lock 2026-04-25 |
| 上传额度模型 | 首本免费 + 邀请 +1 本 / 1 小时速率 / >5 本月度告警 | ✅ D7 lock 2026-04-25 |
| 月度预算 | 单本 ≤1.5 元 / 月度 ≤500 元 + 邮件告警 | ✅ D1 lock 2026-04-25 |
| 上量目标 | 100 用户 / 2 周窗口 | ✅ D2 lock 2026-04-25 |

## 1. Goals & Non-Goals

> D0 lock 后填写（2026-04-25）。

### Goals

1. **MVP 阶段单本 OCR 成本归零** — 仅接受不需要 OCR 的 TXT + 文字版 PDF（pdf-parse 本地解析）
2. **KP 提取成本可控** — 单本 ≤1.5 元（D1 lock，DeepSeek V3.2 baseline 0.93 × 1.6 buffer）；月度账户上限 500 元 + 邮件告警（D1）
3. **break-even 设计** — OCR / KP 成本必须被订阅 / 充值 / 缓存复用 cover，不烧老板的钱
4. **众筹 / 抖音引流就绪** — 拒绝大型扫描 PDF 时收集邮箱进 launch list，限制变营销资产
5. **快速上线** — 优先速度 over 功能完整度（用户原话："不能卡在这半天出不去了"）

### Non-Goals

1. **MVP 不做 OCR 选型** — 扫描 PDF 直接拒绝（≤10MB + ≤100 页 + classifier 图像比例阈值），暂不调研 PaddleOCR / Surya / 国产云 OCR。**留 M5+ 众筹后**
2. **MVP 不做复杂商业模式** — 不做学校 / 机构付费授权 / 多档订阅；MVP 只做"上传额度 + 大小限制 + 邮箱收集"
3. **MVP 不动教学模式付费墙** — 已锁的商业护城河（见 memory `project_teaching-mode-paywall.md`），不重画
4. **MVP 不重写现有 classifier** — 复用 M4.6 现有 image-page-ratio 双轨逻辑，仅在 upload / confirm 入口加 reject 拦截

## 2. 成本预算与上量假设

> 决策 1（单本/月度上限）+ 决策 2（上量目标 + throughput）。

### 2.1 单本成本上限（D1 lock 2026-04-25）

**单本上限 1.5 元**（DeepSeek 单本 0.93 × 1.6 buffer）。来源：D5 lock 后 KP 单本 baseline + 安全缓冲。

实施：
- env `MONTHLY_BUDGET_PER_BOOK=1.5`
- KP 服务调用前先 estimate（pages × token rate × DeepSeek price），>1.5 元拦截上传 + 友好提示
- KP 服务调用后写 `cost_log`（actual cost），月度累计
- 触顶动作：拦该书上传，前端提示"教材太大，请减少页数或联系我们升级"

### 2.2 月度账户预算 + 触顶动作（D1 lock 2026-04-25）

**月度上限 500 元**（覆盖 100 用户首本免费 + 25% 缓存命中假设）。

成本结构（D2 上量假设 × D5 单本成本）：
- KP 提取：100 用户 × 2 本（含邀请扩额）× 0.7 元（25% 命中折算）≈ 140 元 / 月
- 教学免费档：100 用户 × 3 元 ≈ 300 元 / 月
- 教学付费档：独立 Anthropic billing（不计入此 500 元上限）
- 合计 ≈ 440 元 / 月，预留 60 元 buffer

实施：
- env `MONTHLY_BUDGET_TOTAL=500` / `BUDGET_ALERT_EMAIL=zs2911@nyu.edu`
- 新增 `monthly_cost_meter` 表（year_month / total_cost_yuan / last_updated_at）
- KP + 教学调用 hook 累加 cost
- 触顶动作：拦新上传（已上传老用户继续可用）+ 邮件告警 zs2911@nyu.edu
- 月初 1 号 0:00 北京时间自动 reset（Vercel cron `0 16 1 * *` UTC，等价北京 1 号 0:00）

### 2.3 上量目标 + 第一阶段窗口（D2 lock 2026-04-25）

**第一阶段 100 用户 / 2 周窗口**。

来源逻辑：抖音/小红书爆款一条 30-50 真实下载 × 2 周分批 3-4 条 = 日均 7 用户 × 14 天 ≈ 98 用户。

单用户预期：
- 首本免费 + 邀请码 +1 本 = 上限 2 本上传（D7 lock）
- 100 用户 × 2 本 = 200 本上传
- 25% 命中率 → 实际 LLM 调用 ≈ 150 本

合计成本估算（与 D1 月度 500 元上限对照）：
- KP：150 本 × 0.93 元 ≈ 140 元
- 教学免费档：单用户 3 元 × 100 ≈ 300 元
- 总计 ≈ 440 元（月度 500 元上限内）

后续扩量节奏：第一阶段验证后看实际 KP 单本成本 / 教学使用强度 / 缓存命中率，再调 D1 月度上限。

## 3. 免费 / 付费边界 与 商业模式

> D0 lock 后填写（2026-04-25）；D5 / D7 lock 后追加。

### 3.1 免费层范围（D0 + D7 共同确定）

**MVP 阶段**（D0 lock 落地）：
- ✅ 免费：TXT 上传 / 文字版 PDF 上传（≤10 MB / ≤100 页）/ KP 提取 / 教学模式（教学付费墙待 M5+ 启用）
- ❌ 拒绝：扫描 PDF（图像式）/ >10 MB 的 PDF / >100 页的 PDF
- 🆕 用户上传额度（D7 lock 2026-04-25）：新用户首本免费 + 邀请码 +1 本，第 3 本起付费墙 M5+ 启用；每用户 1 小时最多 1 本（rate-limit）；月度 >5 本告警

**M5+ 阶段**（众筹后扩展）：
- 解锁扫描 PDF（OCR 选型 D4 重启）
- 解锁更大 PDF（>10 MB / >100 页）
- 教学付费墙启用

### 3.2 付费墙位置

- **MVP 不引入 OCR / KP 付费墙** — D0 限制后单本成本可控
- **教学模式付费墙保留**（已锁的商业护城河，见 memory `project_teaching-mode-paywall.md`）
- **扫描 PDF 解锁可作为众筹早鸟特权**（D0 拒绝弹窗 CTA 落地）

### 3.3 充值 / 订阅 / 学校授权机制（M5+ Non-Goal）

MVP 阶段**不实现**充值制 / 多档订阅 / 学校机构付费授权。原因：
- D0 + D1 + D7 已通过"上传额度 + 月度预算 + 邀请码"三件套控制成本
- 教学模式付费墙保留（已锁的商业护城河，D5 §5.5）
- 第一阶段验证后看转化数据再 brainstorm（M5+ 启动时新开 spec）

## 4. OCR 选型 与 集成 — **MVP Non-Goal**

> **D0 lock 后此章降级为 Non-Goal**（2026-04-25）。MVP 阶段不做 OCR 选型——扫描 PDF 直接拒绝（前端拦 + 邮箱收集），保留现有 Cloud Run + Google Vision 链路供 M5+ 重启。
>
> **M5+ 重启时的入口**：重新 brainstorm 跑维度 1（中文 OCR 横评）；候选清单待 brainstorm 时刷新（PaddleOCR / Surya / dots.ocr / 阿里云 / 腾讯云 / 百度 / 讯飞 / 字节火山 / 用户侧 WASM）。

### 4.1 现有架构（不动）

- Cloud Run + Google Vision API（M4.6 T15-T17 已修硬基础设施）
- IAM-only 鉴权 + IdTokenClient audience 缓存
- `cloudbuild.ocr.yaml` 自动 build → push → deploy
- `scripts/ocr_server.py` Vision client singleton + 每 50 页 GC

### 4.2 D0 拒绝路径

扫描 PDF 在 upload / confirm 入口拦截，不进入 OCR 链路。Cloud Run + Vision 在 MVP 阶段保持 **standby** 状态——不删基础设施（M5+ 还要用）。

### 4.3 M5+ 重启路径（占位）

待众筹后 brainstorm 重新打开。

## 5. KP 提取模型 选型 与 集成

> 决策 5（KP LLM 选型 + 横评 + 5 问表格）。

### 5.1 候选评估表

> 数据来源：`docs/research/2026-04-25-kp-llm-zh.md`（S=5 / A=4 / B=1）。详细 5 问 + 横评见研究文件。

| Model | 上下文 | input $/M | output $/M | JSON 可靠度 | 中国可达 | 单本估价 | finalist? |
|---|---|---|---|---|---|---|---|
| Gemini 2.5 Pro (baseline 当前) | 1M | $1.25→$2.50 (>200K) | $10→$15 | 中（schema mode 掉点） | ❌ 翻墙 | ~6.7-11 元 | ❌ 太贵 |
| Gemini 2.5 Flash | 1M | $0.30 | $2.50 | 中 | ❌ 翻墙 | ~1.2-2 元 | ✅ fallback |
| **DeepSeek V3.2** | 64K | $0.27 (miss) / $0.07 (hit) | $1.10 | 低-中（偶发空响应需重试） | ✅ 国内直连 | **~0.93 / 0.64 元** | ✅ **首选** |
| DeepSeek R1 | 64K + 32K CoT | $0.55 (miss) | $2.19 | 同 V3.2 | ✅ | ~1.5-3 元 | ❌ KP 非推理任务 |
| **Qwen3-Max（国内）** | 1M | ~$0.115 | ~$0.688 | 中 | ✅ DashScope 国内站 | **~0.50 元** | ✅ **备选** |
| Qwen-Plus | 1M | $0.115 (国内) | $0.688 (国内) | 中 | ✅ | ~0.20-0.40 元 | ⚠️ 性能档次需 A/B |
| Qwen-Turbo | 1M | $0.044 (国内) | $0.087 (国内) | 中-低 | ✅ | ~0.05-0.10 元 | ❌ KP 漏抽风险 |
| GLM-4.7 | 待查 | $0.60 | $2.20 | 中 | ✅ Zhipu 国内 | ~0.5-1 元 | ⚠️ 上下文窗未明示 |
| Yi-Lightning | **16K** | $0.14 | $0.14 | 待查 | ✅ 01.AI 国内 | ~0.1-0.2 元 | ❌ 16K 不够用 |

### 5.2 选定方案

**Gemini 全下线 → DeepSeek V3.2 + 教学付费档 Sonnet 4.6 保留 双层架构**（2026-04-25 D5 lock）：

| 角色 | 之前 | 改成 | 启用条件 |
|---|---|---|---|
| KP 提取（`AI_MODEL` env）| `google:gemini-2.5-pro` | **`deepseek:deepseek-chat`** | 默认生产 |
| 教学免费档（`teacherModelMap.free`）| `google:gemini-2.5-flash-lite` | **`deepseek:deepseek-chat`** | 免费用户 |
| 教学付费档（`teacherModelMap.premium`）| `anthropic:claude-sonnet-4-6` | **保持不变** | 付费订阅（教学护城河）|
| Fallback 第二轨 | 无 | `qwen:qwen3-max`（DashScope 国内站）| DeepSeek 故障 / JSON 失败重试链 |
| Fallback 灾备第三轨 | 无 | `google:gemini-2.5-flash` | 紧急时充值 Google 账户激活 |

**单本估价**（基线 100 页 × 800 token/页输入 + 4 模块 × 4K 输出）：
- KP 提取：DeepSeek V3.2 ~0.93 元（cache miss）/ ~0.64 元（cache hit）
- 教学免费档：DeepSeek V3.2 单本 0.3 元 × full depth × 100 用户 = ~28 元
- 教学付费档：Sonnet 4.6 单本 1.04 美元 × 100 用户 = ~750 元（独立 Anthropic billing）

**简化运维收益**：
- Google AI Studio 账户彻底关停 → 不再需要充值 / 跨境支付 / 看 Gemini billing dashboard
- 一家 provider（DeepSeek）覆盖 KP + 免费档教学，一个 SDK + 一个 API key
- 国内用户教学体验无翻墙（DeepSeek 国内 endpoint 稳）

### 5.3 prompt 兼容性 / chunking 调整

- **Prompt 不重写**：现有 `src/lib/services/kp-extraction-service.ts` fenced markdown JSON 模式（非 native schema 模式）天然兼容 DeepSeek + Qwen + Gemini
- **教学 prompts 不重写**：`prompt_templates` 表 5 角色现状 prompt 在 DeepSeek 上也兼容（fenced markdown / 非 schema 模式）
- **JSON 失败重试**：DeepSeek 官方承认 JSON 模式 "may occasionally return empty content" → `parseJSON` 失败时一次重试，仍失败 → fallback 到 Qwen3-Max
- **chunk 大小**：DeepSeek 64K 上下文限制——chunk 上限按 50K input + 10K output + 4K overhead 估算（vs Gemini 1M 时的宽松边界）
- **chunking overlap**：维持 50-100 token（行业基线，详见 cache-arch 研究）
- **TOON 格式不采纳**（KP 字段不重复，TOON 优势在重复 keys）

### 5.4 切换 / Rollback 策略

⚠️ **首次启用前置工作**（spec review round 1 补充）：
现有 `src/lib/ai.ts:57-67` provider registry 仅注册 `anthropic` / `google` / `openai` 三个 provider，且 `ProviderModelId` 类型字面量限定为这三个前缀。**首次切到 DeepSeek/Qwen 必须先做代码改动**，env-only 切换的承诺仅在首次代码改动后生效：
- `src/lib/ai.ts`：加 `deepseek` provider（`@ai-sdk/deepseek` 或 `createOpenAI({ baseURL: 'https://api.deepseek.com' })` OpenAI compat 路径）+ 加 `qwen` provider（`createOpenAI({ baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1' })`）+ 扩 ProviderModelId 类型为 5 字面量 union
- `src/lib/teacher-model.ts`：扩 TeacherModelId 类型 + 扩 isTeacherModelId whitelist 加 `deepseek:` / `qwen:` 前缀
- 工程量：~半工作日（含单元测试）。把 D5 lock 的"现在的代价"从 1 工作日 → 1.5 工作日

后续切换（首次部署后）：
- 日常：单一 `AI_MODEL` env 切换 + `teacherModelMap` 修改一处常量，无运行时代码改动
- 紧急（DeepSeek 故障）：`AI_MODEL=qwen:qwen3-max`（DashScope OpenAI compat 已注册）+ `teacherModelMap.free=qwen:qwen3-max`，无需重启 Cloud Run
- 长期（2026-07-24 deepseek-chat EOL）：迁移到 DeepSeek V4-flash（届时 brainstorm 重启 KP 模型选型）
- KP 质量回归测试：每次切换跑 book-set fixture（≥3 本不同领域教材）对比 KP 输出 diff，人工抽查 10 KP 是否合理
- 教学质量回归测试：5 个角色 prompt × 10 个测试对话，人工抽查教学引导质量是否退化（用户原话："到时再测试"）

### 5.5 教学免费档 vs 付费档 tier 切换

- 用户登录态读 `users.tier` (free | premium)
- `getTeacherModel(tier)` 路由到 `teacherModelMap[tier]`
- 免费 → 付费升级：当场切换模型（无需重连接 / 重新加载 KP）
- 付费 → 免费降级（订阅取消）：保留历史 Q&A 不变，新对话走免费档
- 教学护城河保留（CLAUDE.md 商业不变量）：付费档体验显著优于免费档（Sonnet vs DeepSeek 推理深度差）

⚠️ **prompt_templates.model 优先级修正**（spec review round 1 补充）：
现有 `getTeacherModel(tier, overrideModel)` 实现（`src/lib/teacher-model.ts:18-23`）中 `overrideModel` 优先于 `tierModelMap[tier]`。这意味着如果 DB 里 `prompt_templates.model` 写了非 NULL 值，**付费档用户可能被路由到非 Sonnet 模型，护城河漏洞**。

修复要求（D5 落地时同步修代码 + DB 检查）：
- **代码改动**：`getTeacherModel` 增加 tier='premium' 永远返回 `tierModelMap.premium`（即 Sonnet 4.6），override 仅对 tier='free' 生效。teacher-model.ts 改 4-6 行
- **DB 检查**：D5 切换前 `SELECT id, role, model FROM prompt_templates WHERE model IS NOT NULL`——如有非 NULL row，逐条审查是否有意覆盖；现状 seed 5 条都是 model=NULL，预期空集
- **migration 可选**：如要彻底防御，在 D5 切换时 `UPDATE prompt_templates SET model=NULL`（破坏性，但 MVP 阶段仅有 seed 数据，影响为零）

## 6. 缓存 / 重用 / 架构层省钱

> 决策 6（PDF MD5 缓存 + provider auto cache）。数据来源：`docs/research/2026-04-25-cost-arch-optimization.md`（S=4 / A=3 / B=2）。

### 6.1 缓存键设计

**MVP 仅做 PDF MD5 全书级（chapter 级 / paragraph 级延后到 M5+）**：

| 缓存键 | 粒度 | 适用 | 命中率（保守估计）|
|---|---|---|---|
| `book.file_md5` | 全书 | KP 全量结果（modules + concepts + examples）| **20-25%**（同班 / 同课程 / 抖音爆款书）|
| ~~`chapter.text_hash`~~ | 章节 | M5+ 重启 | 待生产数据 |
| ~~`paragraph.shingle_hash`~~ | 段落 | M5+ 重启（边际收益低）| — |

**provider auto prompt cache**（独立于 MD5 缓存，自动触发）：
- DeepSeek **~74% off**（cache miss $0.27/M → hit $0.07/M，[官方定价](https://api-docs.deepseek.com/quick_start/pricing-details-usd) 数据 2026-04-25 核实；研究文件早期"90% off"措辞为口语化估算误差，spec round 1 review 修正）
- Qwen3-Max DashScope **auto cache discount**（DeepInfra blog 称 ~90%，DashScope 官方未明示具体折扣比例，待实测）
- Gemini 75% off（≥2048 tokens 起）

### 6.2 缓存读写时序（spec review round 1 补充）

**关键认知**：现有 KP 提取是**模块级**触发（`triggerReadyModulesExtraction` → 对每个 module 调 `extractModule`），但 cache 设计为**全书级**（key = pdf_md5）。两端粒度不同需要明确读写规则。

**读时机**（cache 命中查询）：
- 触发点：`POST /api/books/confirm` 在算完 PDF MD5 之后、调 `runClassifyAndExtract` 之前
- 查询：`SELECT kp_payload FROM kp_cache WHERE pdf_md5=? AND language=? AND page_count=?`
- **命中**（hit）：完全跳过 classify + OCR + extract 全管线。从 `kp_payload` 反序列化出 modules + KPs，**事务内**：
  - INSERT 所有 modules 到 `modules` 表
  - INSERT 所有 KPs 到 KP 表
  - UPDATE `books` SET `parse_status='done'`, `kp_extraction_status='done'`, `cache_hit=TRUE`
  - UPDATE `kp_cache.hit_count += 1`, `last_hit_at=NOW()`
- **未命中**（miss）：走正常 classify → OCR → 模块逐个 extract 流程

**写时机**（cache 填充）：
- 触发点：当 books.kp_extraction_status 从 processing 转 done 时（即所有 modules 已提取完毕，由 `triggerReadyModulesExtraction` 末尾或 OCR callback 末尾检测后触发）
- 写入：聚合该 book 的所有 modules + KPs → JSONB → INSERT INTO kp_cache（ON CONFLICT DO NOTHING，避免并发重写）
- **写入失败不影响主流程**：即便 cache 写入异常（如重复 MD5），用户的书已经完成，仅丢失一次缓存复用机会

### 6.3 数据库 schema 变更

**新增表 `kp_cache`**：

```sql
CREATE TABLE kp_cache (
  id            BIGSERIAL PRIMARY KEY,
  pdf_md5       TEXT UNIQUE NOT NULL,         -- 全书指纹
  page_count    INTEGER NOT NULL,             -- 必须匹配（防止部分文件冲突）
  language      TEXT NOT NULL,                -- 'zh' | 'en'，多语言不混缓存
  model_used    TEXT NOT NULL,                -- 'deepseek-v3.2' / 'qwen3-max' 等
  kp_payload    JSONB NOT NULL,               -- 完整 KP 提取结果
  hit_count     INTEGER DEFAULT 0,            -- 命中次数（监控）
  last_hit_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  -- 半全局共享：不存 user_id（KP 是教材客观知识点，非用户笔记）
  CONSTRAINT chk_lang CHECK (language IN ('zh', 'en'))
);

CREATE INDEX idx_kp_cache_md5 ON kp_cache(pdf_md5);
```

**books 表加列**：
```sql
ALTER TABLE books ADD COLUMN file_md5 TEXT;
ALTER TABLE books ADD COLUMN cache_hit BOOLEAN DEFAULT FALSE;
CREATE INDEX idx_books_md5 ON books(file_md5);
```

### 6.4 缓存失效 / TTL / 用户隔离

- **TTL**：永久（教材内容不变；如发现版权问题手动清除特定 row）
- **用户隔离**：`books` 表保留用户隔离（用户 A 看到自己的"书架"），但 `kp_cache` 半全局共享（不存 user_id）
- **CLAUDE.md 不变量保护**：仅 KP 数据共享（教材的客观知识点），用户笔记 / Q&A 进度 / 测试成绩绝不共享
- **失效触发**：手动（admin 工具）/ 模型升级时整表 truncate（auditing 重建）

### 6.5 命中率监控

- 每次命中 `kp_cache.hit_count` 自增 + `last_hit_at` 更新
- 上线后 7 天 / 30 天 / 90 天对比：
  - 命中率（hit_count_total / unique_books_uploaded）
  - 月度 KP cost 实际节省（与 baseline DeepSeek V3.2 全量计费对比）
- 命中率 <10% 持续 30 天 → brainstorm 重启 D6（章节级 / 段落级缓存）
- **社交信号**：UI 显示 "✓ 已为 N 个同学解析过这本书"（正向利用而非隐私泄露，类似 GitHub stars）

## 7. 用户侧防御 与 流控

> D0 + PPT 扩展 + D7 全部 lock 2026-04-25。

### 7.1 上传约束（D0 lock + PPT 扩展 2026-04-25）

| 约束 | 值 | 实现位置 |
|---|---|---|
| 文件大小 | ≤10 MB | 前端 `<UploadDropzone>` client-side + `presign` route 服务端 double-check |
| PDF 页数上限 | ≤100 页 | `confirm` route 在 pdf-parse 后校验 |
| PPT 幻灯片上限 | ≤200 张 | `confirm` route 在 python-pptx 解析后校验 |
| 文件类型 | TXT + PDF + .pptx（content-type whitelist；拒 .ppt 旧格式） | `presign` route 加 `application/vnd.openxmlformats-officedocument.presentationml.presentation` |
| PDF 子类型 | 文字版（classifier image-ratio < 阈值） | `confirm` route 在 classifier 后判断 |
| PPT 嵌入图片 OCR | 不做（与扫描 PDF 一致拒） | python-pptx 仅抽 text frames + tables + notes，跳过 picture 元素 |

### 7.2 拒绝时邮箱收集（众筹早鸟池）

**拒绝弹窗触发条件**：
- 文件大小 > 10 MB
- 页数 > 100
- classifier 判定为扫描 PDF

**新增端点 + 表**：
- `POST /api/email-collection/scan-pdf-waitlist` — 收 email + reject_reason + book_metadata（文件名 / 大小）
- 新增表 `email_collection_list`：id / email / reject_reason / book_filename / book_size_bytes / created_at / launch_notified_at

**新增组件**：
- `<ScanPdfRejectionModal>` Amber Companion 风格 — 文案 + 邮箱表单 + 友好的"先用电子版试试" 备选

### 7.3 上传额度模型（D7 lock 2026-04-25）

| 项 | 值 | 实现位置 |
|---|---|---|
| 新用户额度 | 首本免费（`users.book_quota_remaining DEFAULT 1`）| register route |
| 邀请码扩额 | +1 本（已用邀请码注册即生效，朋友互相邀请杠杆）| register route 检测 invite_code → quota +1 |
| 第 3 本起 | 付费墙 M5+ 启用（MVP 不做付费墙，前端提示"邀请好友获取额度"）| `presign` 拦截 |
| 学校/机构付费 | 不做（M5+ 再考虑）| — |

**schema**:

```sql
ALTER TABLE users ADD COLUMN book_quota_remaining INTEGER DEFAULT 1;
ALTER TABLE users ADD COLUMN invite_code_used TEXT NULL;
```

### 7.4 速率限制（D7 lock 2026-04-25）

每用户 1 小时最多上传 1 本（防滥用 + 给 OCR 链路喘息）。

实施：
- 新表 `book_uploads_log`（user_id / book_id / created_at），仅记录"成功落地"的上传事件
- **写入时机**（spec review round 1 补充）：在 `POST /api/books/confirm` 成功后写入（不在 presign 时写），原因：presign 拿到 URL 后用户可能放弃上传 / R2 PUT 失败 → 不应消耗用户额度。
- 拦截查询位置：在 `POST /api/uploads/presign` **入口**：`SELECT COUNT(*) FROM book_uploads_log WHERE user_id = ? AND created_at > NOW() - INTERVAL '1 hour'`
- 命中 → 4xx + 提示"上传太频繁，1 小时后再试"
- **quota 减扣同时机**：`book_quota_remaining -= 1` 在 confirm 成功后同事务写入（与 book_uploads_log 一起），避免拿 URL 不上传消耗额度
- **失败 refund 政策**（MVP 简化）：OCR / KP 提取失败时**不自动退还** book_quota_remaining。原因：(a) 失败原因可能是真坏书（PDF 损坏 / 加密），用户重试也会再失败；(b) refund 逻辑需要分布式事务跨 OCR callback；(c) MVP 用户量小，人工客服 SQL 退款即可。M5+ 上量后再设计自动 refund

### 7.5 异常用量告警（D7 lock 2026-04-25）

单用户月度 >5 本上传 → 邮件通知老板 zs2911@nyu.edu。

实施：
- 月度告警 cron（每日 UTC 0:00 执行）：
  - 扫 `book_uploads_log`，过去 30 天 GROUP BY user_id HAVING count(*) > 5
  - 命中 user → email alert + 标记 `users.suspicious_flag = TRUE`（人工 review）
- 不自动停服（避免误伤），由老板人工处理

**schema**:

```sql
ALTER TABLE users ADD COLUMN suspicious_flag BOOLEAN DEFAULT FALSE;
```

## 8. 数据模型 变更

> 由 D1 / D5 / D6 / D7 共同确定（2026-04-25 lock）。所有 schema 详细定义见对应章节（§6.3 / §7.3-7.5）。

### 8.1 新增表

| 表 | 用途 | 来源决策 |
|---|---|---|
| `kp_cache` | KP 全书级缓存（半全局共享，无 user_id）| D6 §6.3 |
| `monthly_cost_meter` | 月度累计成本（year_month / total_cost_yuan / last_updated_at）| D1 §2.2 |
| `cost_log` | 每次 KP / 教学调用的成本明细（book_id / user_id / model / cost_yuan / created_at）| D1 §2.1 |
| `book_uploads_log` | 上传事件流水（rate-limit + 异常检测查询用）| D7 §7.4-7.5 |
| `email_collection_list` | 拒绝时邮箱收集（launch list）| D0 §7.2 |

### 8.2 表加列

| 表 | 加列 | 来源决策 |
|---|---|---|
| `books` | `file_md5 TEXT` / `cache_hit BOOLEAN DEFAULT FALSE` | D6 §6.3 |
| `users` | `book_quota_remaining INTEGER DEFAULT 1` / `invite_code_used TEXT NULL` / `suspicious_flag BOOLEAN DEFAULT FALSE` | D7 §7.3 + §7.5 |

### 8.3 不变量保护（CLAUDE.md）

- **用户隔离不变量**：`books` / 用户笔记 / Q&A 进度 / 测试成绩 — 严格按 user_id 隔离
- **D6 半全局共享例外**：仅 `kp_cache`（教材客观知识点）跨用户共享，无 user_id 列
- **教学付费墙不变量**：`users.tier` 字段不动，付费档 Sonnet routing 不变（D5 §5.5）

## 9. APIs 变更

> 按决策聚合的 API 层影响清单。

### 9.1 新增端点

| 端点 | 用途 | 决策 |
|---|---|---|
| `POST /api/email-collection/scan-pdf-waitlist` | 拒绝时邮箱收集（reject_reason / book_metadata）| D0 §7.2 |
| `GET /api/cron/monthly-cost-reset` | 月初 1 号 reset monthly_cost_meter | D1 §2.2 |
| `GET /api/cron/abuse-alert` | 每日扫 book_uploads_log，>5 本月度告警 | D7 §7.5 |

### 9.2 修改端点

| 端点 | 改动 | 决策 |
|---|---|---|
| `POST /api/uploads/presign` | 加 contentType 白名单（TXT + PDF + .pptx）/ 大小校验 / quota 拦截 / 1 小时 rate-limit / 月度预算拦截 | D0 + D1 + D7 |
| `POST /api/books/confirm` | 加 page-count 校验 / classifier image-ratio 拦截 / PPT slide-count 校验 | D0 + PPT 扩展 |
| `POST /api/auth/register` | 邀请码已用 → `book_quota_remaining += 1` | D7 §7.3 |

### 9.3 内部服务调用 hook

| 服务 | hook 改动 | 决策 |
|---|---|---|
| `kp-extraction-service.ts` | (a) 调用前查 `kp_cache` 命中（D6）/ (b) DeepSeek + Qwen fallback chain（D5）/ (c) 写 `cost_log` + 累加 `monthly_cost_meter`（D1）| D1 + D5 + D6 |
| `getTeacherModel(tier, override)` | tier='premium' 强制返回 Sonnet（override 仅对 free 生效，护城河补丁）/ free 路由 DeepSeek | D5 §5.5 |
| `POST /api/teaching-sessions/[sessionId]/messages` | 教学对话 LLM 调用后写 `cost_log`（actual cost）；**仅免费档 DeepSeek 调用累加 monthly_cost_meter**；付费档 Sonnet 走独立 Anthropic billing 不计入此 500 元上限（D1 §2.2 已说明）| D1 + D5 |
| `POST /api/books/confirm` | (a) 算 PDF MD5（buffer 流式 hash 避免内存爆）/ (b) 查 kp_cache 命中→事务复用 modules+KPs，跳过下游管线 / (c) 未命中→正常进入 runClassifyAndExtract / (d) 写 books.file_md5 字段 | D6 §6.3 |

## 10. 部署 / 环境变量 / Secrets

> Vercel（Next.js app）+ Cloud Run（OCR standby）+ Neon Postgres 三侧。

### 10.1 新增环境变量

| Var | 值 | 部署点 | 决策 |
|---|---|---|---|
| `DEEPSEEK_API_KEY` | DeepSeek Platform secret | Vercel | D5 |
| `DASHSCOPE_API_KEY` | Qwen DashScope 国内站 secret（fallback）| Vercel | D5 |
| `AI_MODEL` | `deepseek:deepseek-chat` | Vercel | D5 |
| `AI_MODEL_FALLBACK` | `qwen:qwen3-max` | Vercel | D5 |
| `MONTHLY_BUDGET_PER_BOOK` | `1.5`（元）| Vercel | D1 |
| `MONTHLY_BUDGET_TOTAL` | `500`（元）| Vercel | D1 |
| `BUDGET_ALERT_EMAIL` | `zs2911@nyu.edu` | Vercel | D1 |

### 10.2 移除环境变量

| Var | 原值 | 决策 |
|---|---|---|
| `GOOGLE_API_KEY`（AI Studio）| Gemini API key | D5（Gemini 全下线，账户关停） |

注：`GOOGLE_APPLICATION_CREDENTIALS`（Cloud Run + Vision Service Account）**保留**——OCR 链路 standby 状态，M5+ 重启用。

### 10.3 Secret 管理流程

- Vercel：通过 Vercel API 自助管理（memory `feedback_vercel-self-service.md`）
- Cloud Run：不需要新 secret（OCR 链路不调 LLM）
- 切换前 backup 当前 env 到 `.ccb/vercel-env-backup-YYYY-MM-DD`（已有 backup pattern）

## 11. 监控 与 告警

### 11.1 成本监控

| 指标 | 阈值 | 动作 | 决策 |
|---|---|---|---|
| 月度总开销 | 100% × 500 元 | 拦新上传 + 邮件告警 | D1 |
| 月度总开销 | 80% × 500 元 = 400 元 | 邮件预警（非阻塞）| D1 |
| 单本估价 | >1.5 元 | 上传时拦截 + 友好提示 | D1 |
| KP 单本实际成本 | 偏离估价 ±50% | logfire 异常事件（人工 review）| D1 |

### 11.2 用量异常监控

| 指标 | 阈值 | 动作 | 决策 |
|---|---|---|---|
| 单用户月度上传 | >5 本 / 30d | 邮件告警 + `users.suspicious_flag = TRUE` | D7 |
| 单用户 1 小时上传 | ≥1 本 | 4xx 拦截 | D7 |

### 11.3 模型质量监控

| 指标 | 阈值 | 动作 | 决策 |
|---|---|---|---|
| KP JSON parse 失败率 | >5% / 24h | logfire 告警，触发 fallback chain 验证 | D5 |
| Qwen3-Max fallback 触发频率 | >10% / 24h | 邮件告警（DeepSeek 可能宕机）| D5 |
| 缓存命中率 | <10% / 30d | brainstorm 重启 D6（章节级）| D6 |
| 缓存命中率 | >40% / 30d | 调高 D1 月度上限（节省超预期）| D6 |

### 11.4 告警实现

- Vercel Cron（每日 UTC 0:00）扫监控指标 → resend.com / SMTP 发邮件
- Logfire / Sentry 仪表盘实时监控异常事件
- 月度报告：每月 1 号 0:00 北京时间（即 UTC `0 16 1 * *` cron）自动汇总上月数据 + reset monthly_cost_meter → 邮件给 `BUDGET_ALERT_EMAIL`

## 12. 迁移 / 切流 / Rollback

### 12.1 上线序列（按依赖）

1. **DB schema 迁移**（Neon）：新表 5 张（kp_cache / monthly_cost_meter / cost_log / book_uploads_log / email_collection_list）+ books 加 2 列 + users 加 3 列。一次性 migration（生产无现有数据冲突，全部 NULL-safe / DEFAULT 兼容）
2. **DeepSeek + Qwen provider 接入**（Vercel）：`src/lib/ai.ts` 加 OpenAI compat adapter + 注入 secret env vars + 单元测试 KP 提取 + 教学对话 ≥3 本 fixture
3. **AI_MODEL 切换**（Vercel）：`AI_MODEL=deepseek:deepseek-chat` 一键切换 + 跑回归 fixture（≥3 本不同领域中文教材 KP diff 对比 + 5 角色教学对话 × 10 测试）
4. **D0 拒绝逻辑 + 邮箱收集 + PPT 解析端点**：前端 + presign + confirm 三处 validate；python-pptx 部署位置 plan 阶段定（共 OCR server vs 独立服务）
5. **D6 缓存上线**：kp_cache 表已建 + extract-service hook 命中查询 + books.file_md5 写入 hook
6. **D1 budget guard + D7 quota / rate-limit / alert**：月度 cron + 单本拦截 + per-user rate-limit + 异常告警 cron

### 12.2 Rollback 路径

| 触发 | Rollback 动作 | 时长 |
|---|---|---|
| DeepSeek 短时故障 | `AI_MODEL=qwen:qwen3-max` env 切换 | <5 分钟 |
| DeepSeek 长期故障 / EOL | `AI_MODEL=google:gemini-2.5-flash` + 重新充值 Google AI Studio | 30 分钟 |
| KP 质量大幅退化 | 同上（先 Qwen，再 Gemini Flash 兜底）| 分级 |
| D6 缓存数据污染 | `TRUNCATE kp_cache`（不影响 books 用户数据）| 即时 |
| D1 budget 误伤正常用户 | 临时调高 `MONTHLY_BUDGET_TOTAL` env（hot patch）| <5 分钟 |
| D7 quota 误伤 | 手动 `UPDATE users SET book_quota_remaining = N WHERE id = ?` | 即时 |

## 13. 风险 与 未决问题

### 13.1 已知风险

| 风险 | 影响 | 缓解 | 决策来源 |
|---|---|---|---|
| DeepSeek 2026-07-24 deepseek-chat EOL | 主力模型停服 | 提前 30 天迁 V4-flash + 重启 brainstorm | D5 |
| DeepSeek JSON 偶发空响应 | KP 提取失败 | parseJSON 重试 + Qwen3-Max fallback | D5 |
| 缓存命中率达不到 20-25% 估算 | KP 月度成本超预期 | 监控 30 天 → 决定升章节级缓存 | D6 |
| 邀请码量产规模未定 | M5+ 营销启动时 quota 缺口 | 第一阶段 100 邀请码足够，后续按需扩 | D2 + D7 |
| launch list 法律合规（GDPR / PIPL）| 邮箱收集合规风险 | 弹窗加 "提交即同意接收发布通知" 显式 consent | D0 §7.2 |
| Vercel 月度 cost ≠ Vercel function quota | 用户并发突增可能撞 Vercel 平台限额 | M4.6 T17 已解决（`after()` 兜底）| D1 |

### 13.2 未决问题（不阻塞 brainstorm，但需 plan 阶段澄清）

1. **python-pptx 部署位置**：与 OCR server 共部署 vs 独立服务（影响 Cloud Run 编排 + cloudbuild config）— writing-plans 阶段定
2. **缓存"已为 N 同学解析过"具体 UI 文案 + 触发位置**（首本上传完成页 vs 书架卡片角标）— UI plan 阶段定
3. ~~monthly_cost_meter 月份定义~~ → **已 lock 北京时区**（spec review round 1）：cron 配置 `0 16 1 * *`（UTC 16:00 / 北京 1 号 0:00）reset；§11.4 daily alert cron 维持 UTC 0:00（用户夜间不在线，避免误打扰）
4. **付费墙 M5+ 启用条件**：第一阶段命中率 + 留存数据出来后再 lock — D7 备注
5. **DeepSeek/Qwen provider adapter 实现路径**（spec review round 1 新增）：`@ai-sdk/deepseek` 官方 SDK vs `createOpenAI` OpenAI compat 路径；DashScope OpenAI compat baseURL 是否覆盖所有 Qwen3-Max 功能 — writing-plans 阶段验证一次集成

### 13.3 技术红线核对（CLAUDE.md 不变量）

- ✅ 用户必须读完原文才能进入 Q&A — 不变
- ✅ Q&A 已答的题不可修改 — 不变
- ✅ 测试阶段禁止查看笔记和 Q&A 记录 — 不变
- ✅ 模块过关线 80% — 不变
- ✅ Q&A 一次一题 + 即时反馈 — 不变
- ✅ 教学模式付费墙 — 不变（D5 §5.5 显式保护）
- ✅ 用户笔记隔离 — 不变（D6 §6.4 显式保护，仅 KP 数据共享）

## 14. 5 问表格 速览（CLAUDE.md 强约束跨决策合表）

| 决策 | 它是什么 | 现在的代价 | 给我们带来什么 | 关闭哪些未来的门 | 选错后果 | 可逆性 |
|---|---|---|---|---|---|---|
| **D0 MVP 范围切割**（2026-04-25 lock）| TXT + 文字版 PDF + .pptx / ≤10 MB / ≤100 页 / ≤200 张 / 拒绝时收邮箱 | 半天 dispatch | OCR 成本归零 + 邮箱池营销资产 + 留学生主战场覆盖 | 短期不服务"扫纸质书" + 不做 .ppt 旧格式 | 太严流失 / 太松烧钱 | 🟢 容易（改数字 / 白名单） |
| **D1 单本 1.5 / 月 500 元上限**（2026-04-25 lock）| 系统级"刹车"——超额自动拦 + 邮件告警 | 1 工作日 | break-even 防御 / 抖音引流可放心扩 | 偶尔超大教材会被拒 | 改 env 秒切 | 🟢 容易（环境变量） |
| **D2 100 用户 / 2 周**（2026-04-25 lock）| 第一阶段抖音/小红书引流目标 | 0（数字）| 营销节奏 + 邀请码发放 + 缓存命中率验证 | 设大设小都不致命 | 看第一周数据调 | 🟢 极易（营销节奏） |
| ❌ D3 免费付费边界 | — 砍 — | — | — | — | — | — |
| ❌ D4 OCR 选型 | — 砍 — | — | — | — | — | — |
| **D5 KP 模型**（2026-04-25 lock）| Gemini 全下线 → DeepSeek V3.2 + Qwen3-Max 备 + Sonnet 付费档不动 | 1-2 工作日 | 单本 7 元 → 0.7 元（10x 降本）+ Google 账户关停 | DeepSeek 64K 上下文 + 2026-07-24 EOL | 中文质量回归 → 跑回归测试 fallback Qwen | 🟡 中等（env 30min 切回，需 Google 充值激活） |
| **D6 缓存**（2026-04-25 lock）| PDF MD5 全书级 + 半全局共享 + provider auto cache | 1 工作日 | 命中率 20-25% × 90% off → 月度再省 22% + 社交信号 | 章节级延后 M5+ | 命中率不达预期 → brainstorm 升粒度 | 🟢 容易（关 cache 查询） |
| **D7 上传额度 + 流控**（2026-04-25 lock）| 首本免费 + 邀请 +1 / 1 小时 1 本 / >5 本告警 | 1-2 工作日 | 单人燃烧上限 + 邀请杠杆 + 异常早发现 | 已发邀请码不能撤回 | 调整需通知用户 | 🟡 中等（额度 + 邀请码已发后调整需通知） |

## 附录 A：调研引用

3 维度调研全部完成（维度 1 + 维度 4 砍，维度 5 新增）：

- ❌ 维度 1（OCR 横评）：**砍**——D0 收缩使 MVP 不做 OCR 选型，留 M5+ 众筹后重启
- ✅ 维度 2（KP LLM）：[`docs/research/2026-04-25-kp-llm-zh.md`](../../research/2026-04-25-kp-llm-zh.md)（S=5 / A=4 / B=1）
- ✅ 维度 3（架构层省钱 / 缓存）：[`docs/research/2026-04-25-cost-arch-optimization.md`](../../research/2026-04-25-cost-arch-optimization.md)（S=4 / A=3 / B=2）
- ❌ 维度 4（复杂商业模式 / 用户层防御）：**砍**——D0 已锁邮箱收集 + 上传额度方向，复杂商业模式留 M5+
- ✅ 维度 5（用户画像 + PPT 可行性）：[`docs/research/2026-04-25-user-persona-ppt.md`](../../research/2026-04-25-user-persona-ppt.md)（S=5 / A=4 / B=6）

## 附录 B：相关 architecture.md 契约

本 spec 落地后需同步更新 `docs/architecture.md` 的以下章节（writing-plans 阶段细化 diff）：

- **§摘要卡 表名清单**：新增 5 张表（kp_cache / monthly_cost_meter / cost_log / book_uploads_log / email_collection_list）
- **§摘要卡 接口契约**：`POST /api/uploads/presign` + `POST /api/books/confirm` + `POST /api/auth/register` + 新增 `POST /api/email-collection/scan-pdf-waitlist`
- **§摘要卡 ⚠️ 约束**：`kp_cache` 半全局共享（无 user_id）+ `users.suspicious_flag` 异常用户标记 + `book_quota_remaining` 默认 1
- **§AI 模型层**：`AI_MODEL` 默认值变更（gemini-2.5-pro → deepseek-chat）+ `teacherModelMap.free` 变更（gemini-2.5-flash-lite → deepseek-chat）+ Qwen3-Max fallback adapter + ProviderModelId/TeacherModelId 类型扩展
- **§错误处理 / 重试层**（spec review round 1 补充）：DeepSeek JSON 偶发空响应 retry 逻辑 + Qwen3-Max fallback chain（DeepSeek 故障时切 Qwen）+ `retryWithBackoff` 现有逻辑扩展为支持 fallback model
- **§部署层**：新增 DeepSeek + Qwen secret 管理；GOOGLE_API_KEY 移除路径
- **§成本控制层（新增章节）**：D1 月度预算 + D7 quota / rate-limit / 异常告警三件套
- **§教学护城河层**：`getTeacherModel(tier, override)` 优先级从 override-first 改为 premium-tier-locked（spec round 1 补丁）

## 附录 C：受影响代码文件清单（spec-reviewer 用）

> 供 spec-document-reviewer subagent 验收用。writing-plans 阶段会进一步细化每个文件的具体 diff。

### C.1 后端（src/lib + src/app/api）

- `src/lib/ai.ts` — 加 DeepSeek + Qwen OpenAI compat adapter
- `src/lib/teacher-model.ts` — `teacherModelMap.free` 改 deepseek
- `src/lib/services/kp-extraction-service.ts` — cache 命中查询 + fallback chain + cost_log 写入
- `src/lib/services/cost-meter-service.ts`（新增）— monthly_cost_meter 累加 + budget guard
- `src/lib/services/quota-service.ts`（新增）— book_quota_remaining + rate-limit query
- `src/lib/schema.sql` — 5 张新表 + books / users 加列
- `src/app/api/uploads/presign/route.ts` — D0 + D1 + D7 拦截
- `src/app/api/books/confirm/route.ts` — D0 + PPT 校验
- `src/app/api/auth/register/route.ts` — D7 邀请码扩额
- `src/app/api/email-collection/scan-pdf-waitlist/route.ts`（新增）

### C.2 前端（src/app + src/components）

- `src/app/upload/page.tsx` — client-side 大小 / 类型校验
- `src/components/upload/ScanPdfRejectionModal.tsx`（新增）
- `src/components/book/CacheHitBadge.tsx`（新增）— "✓ 已为 N 同学解析过这本书" 社交信号
- `src/components/upload/QuotaIndicator.tsx`（新增）— 显示 book_quota_remaining

### C.3 OCR / PPT 解析（scripts/）

- `scripts/ocr_server.py` — standby（不动）
- `scripts/pptx_parser.py`（新增）— python-pptx 抽 text frames + tables + notes，部署位置 plan 定

### C.4 Cron / 后台任务

- `src/app/api/cron/monthly-cost-reset/route.ts`（新增）— 月初 1 号 reset monthly_cost_meter
- `src/app/api/cron/abuse-alert/route.ts`（新增）— 每日扫 book_uploads_log，>5 本月度告警

### C.5 配置 / 部署

- `vercel.json` — cron 配置
- Vercel env vars（API 自助）— DEEPSEEK_API_KEY / DASHSCOPE_API_KEY / AI_MODEL 等
