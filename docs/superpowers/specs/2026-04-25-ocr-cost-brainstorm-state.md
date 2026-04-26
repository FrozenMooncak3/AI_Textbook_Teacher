# OCR + KP 提取成本架构重设 Brainstorm 进行中状态（WIP）

**创建日期**: 2026-04-25
**用途**: compact 防御——记录 brainstorm 进度，避免 session 断档丢失状态
**最终产出**: `docs/superpowers/specs/2026-04-25-ocr-cost-architecture-design.md`
**Brainstorm 入口**: `docs/superpowers/specs/2026-04-25-ocr-cost-brainstorm-prompt.md`

> ⚠️ compact 后恢复时**先读这个文件**，不要从 summary 重建——summary 会丢决策细节和拒选 alternative 的理由。

---

## 触发事件回顾（不可改）

- 2026-04-24 M4.6 T17 hotfix（Vercel `after()` 包裹）上线 → 2026-04-25 book 18（369 页中文教材）真机重传：28s classify + 6 min OCR 全跑通
- KP 提取阶段 Google AI Studio 余额耗尽，错误原文 `Your prepayment credits are depleted. Please go to AI Studio at https://ai.studio/projects to manage your project and billing.`
- 用户原话："OCR要钱？？那岂不是以后每有个人上传pdf都会扣钱？那全把我这当pdf ocr整？"
- 估算成本：50 页 ~3 元 / 369 页 ~8-15 元 / 抖音 100 人引流 一晚 500-1000 元

详见 `docs/journal/2026-04-25-ocr-cost-shock.md` + memory `project_ocr-cost-shock.md`。

---

## 基础设定（不会变 / 硬约束）

1. **中文教材精度** 是产品命根。OCR 出错 = 教学全错。任何方案的精度退化必须有量化证据 + 用户接受
2. **非技术用户**（抖音 / 小红书引流）。不能要求装客户端 / 配 API key / 注册 GCP 账号
3. **教学模式付费墙不动**。已锁的商业护城河（见 memory `project_teaching-mode-paywall.md`），新方案不重画这层
4. **首本不能强制充钱**。流失太严重——用户连体验都没就跑
5. **M4.6 基础设施保护清单**（已修，不动）：
   - T15 Cloud Run OOM 修复（`e0bb0c5`）
   - T16 Cloud Build deploy step 自动化（`f097994`）
   - T17 Vercel `after()` 包裹 fire-and-forget（`d33a79f`）
6. **现有架构契约**（不动）：
   - `POST /api/books/confirm` → `runClassifyAndExtract`（fire-and-forget + after()）
   - `POST /api/ocr/callback` Cloud Run → Vercel 回调（Bearer token + middleware 豁免）
   - `extract-text` / `ocr-pdf` 双轨触发（按 classifier 输出选）
   - KP 提取 = `triggerReadyModulesExtraction`（按 module 触发）
7. **CEO 红线（2026-04-25 用户原话）**：
   - 原话："我主要想看我这个软件能不能正常运营下去，总不能我亏钱做吧"
   - 解读：核心红线 = **break-even**（不烧老板的钱）。OCR + KP 成本必须被以下之一 cover：(a) 订阅收入 (b) 充值 (c) 学校/机构付费 (d) 缓存命中带来的边际成本下降
   - 不属于 A/B/C 任一档（A 太保守 / B-C 接受亏损），介于 A 与 D 之间——更靠近 D（投入产出比说话）但**禁止亏损**
   - "亏损"判断窗口待 D1 lock 时定（首月可亏、年度不可亏？/ 单笔不可亏？）
   - 用户主动指向了 `https://github.com/microsoft/markitdown` 作为"似乎免费"的候选——已 WebFetch 验证：markitdown 对扫描 PDF **不免费**（必须挂 `markitdown-ocr` 插件调 OpenAI Vision 或 Azure Document Intelligence）；只有"文字版 PDF" 路径它能本地解析免费
8. **用户范围收缩 stance（2026-04-25 用户原话，术语待澄清后 lock）**：
   - 原话："咱们 MVP 就先对扫描版 pdf 或 txt 做，然后大的图片版 OCR 限制大小，之后再慢慢做... 不允许用户上传我这么大的一个 OCR PDF 14.2 的这种... MVP 就先做扫描版吧。不做图片版的。之后再做。我还打算 MVP 之后去众筹呢。我还要宣传。不能卡在这半天出不去了"
   - 解读（最可能 / 待 user clarify 确认）：staged investment——MVP 先上线**不烧钱的部分**（文字版 PDF：pdf-parse 本地提取免费 + TXT 既有路径）；**扫描/图像版 PDF**（需要 OCR）暂时不做或严格限制大小，众筹拿到钱再扩展
   - **术语冲突**：用户原文中"扫描版"和"图片版"出现矛盾用法（"MVP 先做扫描版" + "不做图片版"）。产品/行业术语里两者**等同**（都指 scanned/image-based PDF / 需要 OCR）；最可能的解读是用户把"电子版 / 文字版"误称为"扫描版"——已发问澄清，**未拿到回复前下游决策不能 lock**
   - 关键 framing："**不能卡在这半天出不去了**" + "MVP 之后众筹 + 宣传"——**速度优先** over 功能完整度。这导致整个 brainstorm 范围大幅收缩（见决策 D0）
   - 影响：D4 OCR 选型可能降级或取消（仅留 baseline + 大小限制就够）；调研维度 1 可能从 🔴 降为 🟢；维度 2-4 保留

---

## 调研

**3 维度并行（维度 1 + 维度 4 砍，维度 5 新增）。2026-04-25 完成。**

| # | 维度 | 档 | 输出 | 核心结论（1-2 句） |
|---|---|---|---|---|
| 1 | ~~中文 OCR 横评~~ | ❌ 砍 | — | D0 收缩使 MVP 不做 OCR 选型，留 M5+ 众筹后重启 |
| 2 | **KP 提取 LLM 选型** | 🔴 | [2026-04-25-kp-llm-zh.md](../../research/2026-04-25-kp-llm-zh.md) | **首选 DeepSeek V3.2**（单本 ~0.93 元 miss / 0.64 元 hit，国内直连）+ **备选 Qwen3-Max 国内站**（单本 0.50 元，1M 上下文 + 阿里云 SLA + 无 EOL）。排除 R1/Yi/Qwen-Turbo。**关键发现**：用户当前 Gemini Pro 实际可能跨过 200K 边界 → 单本 ~11 元而非 ~6.7 元。 |
| 3 | **架构层省钱 / 缓存** | 🟡 | [2026-04-25-cost-arch-optimization.md](../../research/2026-04-25-cost-arch-optimization.md) | **PDF MD5 全书级 + 半全局共享**（命中率保守 20-25%）+ **provider 自动 prompt cache**（同书第二次 75-90% off）+ chunking overlap 维持 50-100 token。章节级缓存延后 M5+。**有效成本 ≈ 单本 × 0.775**。 |
| 4 | ~~商业模式 / 用户层防御~~ | ❌ 砍 | — | D0 已锁邮箱收集 + 上传额度方向，复杂商业模式留 M5+ |
| 5 | **用户画像 + PPT 可行性** | 🔴 | [2026-04-25-user-persona-ppt.md](../../research/2026-04-25-user-persona-ppt.md) | **强 YES 扩 D0 → +.pptx**。留学生 PPT 占资料 40% / 国内大学生 PPT 占 45%（合计抖音引流 50-55%）。NotebookLM 已标配 PPTX。python-pptx 纯 XML + UTF-8 + 0 LLM 成本 + 0.5-1 工作日。拒 .ppt 旧格式 + 拒嵌入图片 OCR。100 页约束改"≤200 张幻灯片"补充。**关键发现**：考研（388 万）持续下滑且材料是扫描 PDF（D0 拒），K12 同样扫描——MVP 实际不服务这两群。 |

**调研合计**：3 文件 / S+A+B = 14+11+9 = 34 源 / 中位数 60 min/维度 / URL 可达性已验。

**对下游决策的影响（按依赖更新）**：
- **D0 修订建议**（强烈）：MVP 接受类型 = TXT + 文字版 PDF + **.pptx**（非 .ppt 旧格式）
- **D5 候选池收敛**：DeepSeek V3.2（首选）+ Qwen3-Max 国内站（备选）+ Gemini 2.5 Flash（鸡蛋分篮 fallback）
- **D6 推荐方案**：PDF MD5 全书级缓存 + 半全局命中（社交化展示"已为 N 同学解析过"）+ KP 数据共享（笔记不共享，CLAUDE.md 不变量保留）
- **D1 / D2 / D7 仍待用户输入**（CEO 决策）

---

## 已拍死的决策（不再讨论）

### 决策 D5：KP + 教学免费档统一 DeepSeek V3.2，付费档保 Sonnet 不动（2026-04-25 lock）

**lock 触发**：调研维度 2 完成（`docs/research/2026-04-25-kp-llm-zh.md`，S=5/A=4/B=1）→ 用户 2026-04-25 回 "先这样吧，到时再测试" 确认（"到时再测试" 指实施时跑 KP + 教学回归测试，不重开决策）。

**已锁的事项**：

| 位置 | 之前 | 改成 |
|---|---|---|
| `AI_MODEL` env (KP 提取) | `google:gemini-2.5-pro` | **`deepseek:deepseek-chat`**（V3.2）|
| `teacherModelMap.free` (`src/lib/teacher-model.ts:6`) | `google:gemini-2.5-flash-lite` | **`deepseek:deepseek-chat`** |
| `teacherModelMap.premium` (`src/lib/teacher-model.ts:7`) | `anthropic:claude-sonnet-4-6` | **保持不变**（教学护城河） |
| Fallback 紧急灾备 | 无 | `qwen:qwen3-max` (国内站 DashScope) → `google:gemini-2.5-flash`（需重新充值才能激活）|

**单本估价**（基线 100 页 × 800 token/页输入 + 4 模块 × 4K 输出）：
- KP 提取：DeepSeek V3.2 ~0.93 元 (cache miss) / ~0.64 元 (cache hit)
- 教学免费档：DeepSeek V3.2 单本 0.3 元 × full depth × 100 用户 = ~28 元
- 教学付费档：Sonnet 4.6 单本 1.04 美元 × 100 用户 = ~750 元（独立 Anthropic billing，不动）

**5 问表格**（CLAUDE.md 强约束）：

| Q | 答 |
|---|---|
| 它是什么 | 把 Gemini 从 KP + 免费档教学全下线，统一 DeepSeek V3.2；付费档 Sonnet 不动 |
| 现在的代价 | 1-2 工作日 dispatch（OpenAI 兼容 SDK 适配 / `AI_MODEL` 改 / `teacher-model.ts` 改 / JSON 重试 + Qwen 兜底 / 跑 ≥3 本 KP 回归 + 教学回归测试） |
| 给我们带来什么 | KP 单本 ~7 元 → ~0.7 元（10 倍降本）+ Google AI Studio 账户彻底关停 + 一家 provider 简化运维 + 国内用户教学免翻墙 |
| 关闭哪些未来门 | DeepSeek 64K 上下文（vs Gemini 1M）→ chunk 上限要压；2026-07-24 deepseek-chat EOL → M5+ 迁 V4 |
| 选错后果 | KP 质量回归（中文教材精度命根）→ 跑回归测试发现就 fallback 到 Qwen3-Max；教学质量回归（次要，免费档容忍度高）|
| 可逆性 | 🟡 中等（env 切换 30 分钟回 Gemini Flash，但需重新充值 Google 账户）|

**拒选 alternatives**（不再讨论）：
- ~~Gemini 充值 50 元继续用~~（拒因：每月仍烧 / 100 用户照样耗尽 / 治标不治本）
- ~~只换 KP 的 Gemini，免费档教学留 Gemini Flash-Lite~~（拒因：Google AI Studio 账户仍要充值才解锁；多账户管理；为省 7 元/100 用户不值）
- ~~DeepSeek R1（reasoner）~~（拒因：贵 3 倍但 KP 抽取非推理任务，CoT 浪费成本）
- ~~Yi-Lightning~~（拒因：16K 上下文是结构性硬伤，跑不了 textbook chunk）
- ~~Qwen-Turbo~~（拒因：小模型 KP 漏抽风险高，未做 A/B 验证不能上）

**实施依赖**（Plan 阶段输入）：
- `src/lib/ai.ts` 加 DeepSeek provider（OpenAI compat baseURL）
- `src/lib/teacher-model.ts` 改 free tier
- `src/lib/services/kp-extraction-service.ts` JSON 失败一次重试 + Qwen 兜底链
- 环境变量：`DEEPSEEK_API_KEY` (Vercel + Cloud Run secrets) / `AI_MODEL=deepseek:deepseek-chat` / `AI_MODEL_FALLBACK=qwen:qwen3-max`
- chunk 上限：原 Gemini 1M 宽边界改成 50K input + 10K output + 4K overhead（DeepSeek 64K 内）
- 回归测试 fixture：≥3 本不同领域中文教材 KP diff 对比 + 人工抽查 10 KP

---

### 决策 D6：PDF MD5 全书级缓存 + 半全局共享 + provider auto cache（2026-04-25 lock）

**lock 触发**：调研维度 3 完成（`docs/research/2026-04-25-cost-arch-optimization.md`，S=4/A=3/B=2）→ 用户 2026-04-25 回 "先这样吧" 确认。

**已锁的事项**：

1. **PDF MD5 全书级缓存**（粒度）：MVP 仅做全书级；章节级 / 段落级延后 M5+
2. **半全局共享**（隔离）：`kp_cache` 表不存 `user_id`；`books` 表保留用户隔离（书架）；KP 数据共享 = 教材客观知识点 + 不暴露上传者身份
3. **Provider auto cache**（独立轨）：DeepSeek 90% off / Qwen ~90% off / Gemini 75% off（系统 prompt 不刷新）
4. **TTL = 永久**（教材不变；版权问题手动清除特定 row）
5. **新表 `kp_cache`** + `books.file_md5` 列扩展（schema 详见 spec §6.2）
6. **社交信号 UI**：显示 "✓ 已为 N 个同学解析过这本书"（正向利用，类似 GitHub stars）

**5 问表格**：

| Q | 答 |
|---|---|
| 它是什么 | 同书第二人传 → 直接复用前人 KP 结果；模型自带 prompt cache 双重打折 |
| 现在的代价 | 1 工作日（新表 / books 加列 / 命中查询 / 命中率监控字段） |
| 给我们带来什么 | 命中率 20-25% × 90% off → 月度 KP 总开销再省 22% + UI 社交信号 |
| 关闭哪些未来门 | 章节级 / 段落级延后 M5+；版权风险需手动管理 |
| 选错后果 | 命中率不达预期（<10%）→ 不损失，brainstorm 重启升粒度 |
| 可逆性 | 🟢 容易（关 cache 查询走全量计费） |

**拒选 alternatives**（不再讨论）：
- ~~纯用户隔离~~（拒因：命中率几乎 0%，缓存白做）
- ~~纯全局公开（暴露上传者身份）~~（拒因：隐私风险 + 违反 CLAUDE.md 用户隔离不变量）
- ~~章节级缓存 MVP 上~~（拒因：边界识别 NLP 复杂度高 / 命中收益不明 / 等数据再决定）
- ~~不做 PDF MD5 缓存~~（拒因：放弃 22% 月度成本节省，划不来）

**实施依赖**（Plan 阶段输入）：
- `src/lib/schema.sql` 新增 `kp_cache` 表 + `books.file_md5` + `books.cache_hit` 列
- `src/lib/services/kp-extraction-service.ts` 命中先查 cache；miss 时写 cache
- `src/app/api/uploads/presign/route.ts` 上传时算 file_md5（client side or server side）
- UI：在书页面 / 上传后顶部显示"已为 N 同学解析"社交标签
- 命中率监控：admin dashboard / 7-30-90 天对比

---

### 决策 D0：MVP 范围切割（2026-04-25 lock）

**lock 触发**：用户原话 "MVP 就先对扫描版 PDF 或 TXT 做... 不允许用户上传我这么大的一个 OCR PDF 14.2 的这种... MVP 就先做扫描版吧。不做图片版的。之后再做。我还打算 MVP 之后去众筹呢" → 用户 2026-04-25 回 "yes" 确认术语澄清（"扫描版"实际想表达"文字版"，"图片版"才是行业的扫描版）→ 用户 2026-04-25 回 "我都全 OK" 确认具体值。

**已锁的事项**：

| 项 | 锁定值 |
|---|---|
| 接受文件类型 | TXT + **文字版 PDF** + **`.pptx`**（python-pptx 本地解析，0 OCR/LLM 解析成本）；**`.ppt` 旧格式拒绝**（提示用户另存为 .pptx）；PPT 嵌入图片 OCR **不做**（与 D0 拒扫描 PDF 一致）。维度 5 调研锁定 2026-04-25。 |
| 文件大小上限 | **≤10 MB** |
| 页数上限（PDF）| **≤100 页** |
| 张数上限（PPT）| **≤200 张幻灯片**（30 张 PPT ≈ 1200 词 ≈ 2-3 页等效，200 张是宽松上限）|
| 扫描 PDF 判定 | 现有 classifier（image-page-ratio 阈值）— 检测到则前端拦截 |
| 拒绝 UX | 前端弹窗，文案："📚 检测到这是扫描版 PDF（图像式）。我们目前还在打磨大型扫描书的识别能力，**留下邮箱**，开放第一时间通知你 + 众筹支持者享受**早鸟解锁特权**。〔输入邮箱〕〔我先用电子版试试〕" |
| 邮箱收集 | 拒绝弹窗 CTA 自动加入 **launch list**（众筹早鸟池 + 抖音 / 小红书引流硬通货） |
| 后续解锁条件 | 众筹后 / 订阅付费用户 / 一定使用量后（具体值 M5+ 决定） |

**5 问表格**（CLAUDE.md 强约束）：

| Q | 答 |
|---|---|
| 它是什么 | MVP 阶段只接受不需要 OCR 的 PDF + TXT；扫描 PDF 拒绝 + 邮箱收集 |
| 现在的代价 | 前端校验几行 + classifier 阈值调整 + 邮箱表单（半天 dispatch） |
| 给我们带来什么 | 单本 OCR 成本归零；扫描限制 → 邮箱池（众筹早鸟 / 抖音引流硬通货） |
| 关闭哪些未来门 | 短期不服务"扫纸质书"用户（但这正是众筹后要解锁的卖点） |
| 选错后果 | 太严流失"想试试"用户；太松又烧 OCR 钱 |
| 可逆性 | 🟢 容易（改 1 个数字立刻调） |

**拒选 alternatives**（不再讨论）：
- ~~MVP 接受所有 PDF + 限大小~~（拒因：14.2MB 也在烧钱区，CEO 红线 break-even 不允许）
- ~~MVP 接受扫描 PDF + 自托管 OCR~~（拒因：增加 brainstorm 范围 + 上线时间，违反"不能卡在这"速度优先 stance）
- ~~纯拒绝弹窗，不收邮箱~~（拒因：浪费"扫描 PDF 用户群"营销资产；众筹 / 抖音引流缺 launch list）

**实施依赖**（Plan 阶段输入）：
- `src/app/api/uploads/presign/route.ts` 加 contentType + size validate
- `src/app/api/books/confirm/route.ts` 加 page-count + image-ratio 校验，拒绝时返回 4xx + 邮箱收集 redirect
- 前端 `/upload` 加文件大小 / 类型 client-side 校验
- 新增 `email_collection_list` 表 + `POST /api/email-collection/scan-pdf-waitlist` 端点
- classifier image-page-ratio 阈值待调整（M4.6 现有逻辑读 src/lib/classify-pdf.ts）
- 拒绝弹窗 UI：新增 `<ScanPdfRejectionModal>`（Amber Companion 设计语言）

---

### 决策 D1：单本 1.5 元 / 月度 500 元成本上限（2026-04-25 lock）

**lock 触发**：CEO 三决策 panel（D1 / D2 / D7）→ 用户 2026-04-25 回 "同意" 全部确认推荐值。

**已锁的事项**：

| 项 | 锁定值 | 实现位置 |
|---|---|---|
| 单本上限 | **1.5 元**（DeepSeek 单本 0.93 × 1.6 buffer）| `MONTHLY_BUDGET_PER_BOOK` env + KP 服务调用前 estimate |
| 月度上限 | **500 元**（覆盖 100 用户首本免费 + 25% 缓存命中假设）| `MONTHLY_BUDGET_TOTAL` env + cost meter 累计 |
| 触顶动作 | 拦新上传（已上传老用户继续可用）+ 邮件告警老板 | upload presign 拦 + alert hook |
| 监控周期 | 月初 1 号自动 reset | cron job / scheduled fn |

**5 问表格**：

| Q | 答 |
|---|---|
| 它是什么 | 系统级"刹车"——单本超 1.5 元 / 月度超 500 元自动拦截 |
| 现在的代价 | 1 工作日（env 变量 + cost meter 累加 + 邮件告警链 + presign 拦截） |
| 给我们带来什么 | 不被超大教材或恶意用户瞬间烧光预算；可以放心去抖音引流 |
| 关闭哪些未来门 | 偶尔的超大教材（>500 页）会被拒绝 |
| 选错后果 | 太松 → 月底爆预算；太紧 → 正常用户被误伤；改 env 秒切 |
| 可逆性 | 🟢 容易（环境变量） |

**拒选 alternatives**（不再讨论）：
- ~~不设上限，看月底实际花了多少~~（拒因：CEO 红线 break-even，无防御一夜 burn 1000+ 元不可接受）
- ~~按用户加 budget gate~~（拒因：MVP 用户少 + 邀请码已限流，per-user budget 复杂度收益不匹配）

**实施依赖**（Plan 阶段输入）：
- env: `MONTHLY_BUDGET_PER_BOOK=1.5` / `MONTHLY_BUDGET_TOTAL=500` / `BUDGET_ALERT_EMAIL=zs2911@nyu.edu`
- 新增 `monthly_cost_meter` 表 + `cost_log` 表（每次 KP / 教学调用记录单本成本）
- `src/lib/services/kp-extraction-service.ts` 调用前 + 后 hook 写 cost_log
- 触顶拦截：`POST /api/uploads/presign` 启动时查 monthly_total，超 500 → 4xx + 友好提示

---

### 决策 D2：第一阶段 100 用户 / 2 周窗口（2026-04-25 lock）

**lock 触发**：同 D1（CEO 三决策 panel）。

**已锁的事项**：

| 项 | 锁定值 |
|---|---|
| 第一阶段目标 | **100 用户 / 2 周** |
| 来源逻辑 | 抖音/小红书爆款一条 30-50 真实下载 × 2 周分批 3-4 条 = 日均 7 用户 × 14 天 ≈ 98 用户 |
| 单用户预期上传次数 | 首本免费（D7）+ 邀请码 1 本，2 本上限 → 100 用户 × 2 = 200 本上传 |
| 缓存假设 | 25% 命中率 → 实际 LLM 调用 ≈ 150 本 |
| 月度成本估算 | 150 本 × 0.93 元 ≈ 140 元 KP（远低于 D1 月度 500 元上限）+ 教学免费档单用户 ~3 元 × 100 ≈ 300 元，合计 ≈ 440 元 |

**5 问表格**：

| Q | 答 |
|---|---|
| 它是什么 | 第一波抖音/小红书引流目标：100 用户 / 2 周 |
| 现在的代价 | 0（数字而已，但影响 D1 月度预算 + 营销文案） |
| 给我们带来什么 | 营销节奏 + 邀请码发放 + 缓存命中率验证一个明确目标 |
| 关闭哪些未来门 | 设小了不敢扩量；设大了 20 人会失败焦虑 |
| 选错后果 | 调整最容易（看第一周数据再调）|
| 可逆性 | 🟢 极易（营销节奏）|

**拒选 alternatives**（不再讨论）：
- ~~500 用户 / 1 月~~（拒因：D1 月度 500 元上限不够覆盖；50 元/用户预算太紧）
- ~~50 用户 / 1 月~~（拒因：太保守；投流成本不划算）

**实施依赖**（Plan 阶段输入）：
- 营销文案：抖音/小红书 3-4 条爆款节奏（M5+ 营销启动时定）
- 邀请码：100 个新邀请码生成（M5+ 营销启动前发）
- 数据看板：每日新用户数 / 每日 KP 调用数 / 缓存命中率（M5+ 上线后）

---

### 决策 D7：首本免费 + 邀请码 +1 本 / 1 小时 1 本速率 / >5 本月度告警（2026-04-25 lock）

**lock 触发**：同 D1（CEO 三决策 panel）。

**已锁的事项**：

| 项 | 锁定值 |
|---|---|
| 新用户额度 | **首本免费**（让用户完整体验产品）|
| 邀请码额度 | **+1 本免费**（邀请码注册即生效，朋友互相邀请杠杆）|
| 第 3 本起 | **付费墙 M5+ 启用**（MVP 不做付费墙，看转化数据再启用）|
| 速率限制 | **每用户 1 小时最多上传 1 本**（防滥用 + 给 OCR 链路喘息）|
| 异常告警 | 单用户月度 >5 本上传 → 邮件通知老板 |
| 学校/机构付费 | M5+ 再做（MVP 不做）|

**5 问表格**：

| Q | 答 |
|---|---|
| 它是什么 | MVP 上传额度：首本免费 + 邀请 +1 本 + 1 小时速率 + >5 本告警 |
| 现在的代价 | 1-2 工作日（账户额度字段 + 邀请码扩额 + per-user rate-limit + 异常 alert） |
| 给我们带来什么 | 控制单人燃烧成本上限 + 邀请好友扩额（增长杠杆） + 滥用早期发现 |
| 关闭哪些未来门 | 太严用户走人；太松一人 10 本烧光 |
| 选错后果 | ⚠️ 中等可逆——已发邀请码不能撤回；调整需通知用户 |
| 可逆性 | 🟡 中等（额度字段 + 邀请码已发后调整需通知）|

**拒选 alternatives**（不再讨论）：
- ~~每月 N 本免费（subscription 式）~~（拒因：MVP 不做订阅；单本免费 + 邀请扩额更简单）
- ~~不设速率限制~~（拒因：CEO 红线 + 防恶意 / 异常用户）
- ~~充值制（按页/按本）~~（拒因：M5+ 再做；MVP 阶段付费转化未验证）

**实施依赖**（Plan 阶段输入）：
- `users` 表加列 `book_quota_remaining INT DEFAULT 1` + `invite_code_used TEXT NULL`
- 新表 `book_uploads_log`（user_id / book_id / created_at）→ 1 小时 rate-limit query 用
- `POST /api/uploads/presign` 拦截：(a) `book_quota_remaining <= 0` (b) `recent uploads in 1hr ≥ 1`
- 邀请码注册 hook：使用邀请码 → `book_quota_remaining += 1`
- `POST /api/auth/signup` 邀请码字段可选（已实现 in M2，扩展 quota +1 逻辑）
- 月度告警 cron：每日扫 `book_uploads_log`，过去 30 天 user_id × 上传数 > 5 → 邮件 alert

---

## 当前进度

- ✅ 决策 0：触发事件 + 硬约束 + 基础设定（已锁）
- ✅ **用户立场（2026-04-25）**：核心红线 = break-even；MVP 范围收缩到"文字版 PDF + TXT"
- ✅ **D0：MVP 范围切割**（2026-04-25 lock）：≤10 MB / ≤100 页 / 仅 TXT + 文字版 PDF / 拒绝 UX 含邮箱收集 + 众筹早鸟
- ✅ **D0 PPT 扩展**（2026-04-25 lock）：D0 接受类型加 `.pptx`（拒 .ppt 旧格式）+ ≤200 张幻灯片 + PPT 嵌入图片 OCR 不做
- ✅ **3 维度调研完成**（2026-04-25）：维度 2 KP LLM 🔴 + 维度 3 缓存 🟡 + 维度 5 用户画像 🔴
- ✅ **D5：KP + 教学免费档统一 DeepSeek V3.2**（2026-04-25 lock）：付费档 Sonnet 不动，Qwen3-Max 备选，Gemini 全下线
- ✅ **D6：PDF MD5 全书级缓存 + 半全局共享 + provider auto cache**（2026-04-25 lock）
- ✅ **D1：单本 1.5 元 / 月度 500 元成本上限**（2026-04-25 lock）
- ✅ **D2：第一阶段 100 用户 / 2 周窗口**（2026-04-25 lock）
- ✅ **D7：首本免费 + 邀请码 +1 本 / 1 小时速率 / >5 本月度告警**（2026-04-25 lock）
- ✅ **Spec round 1 review 完成**（2026-04-25）：reviewer 找 3🔴 + 4🟠 + 2🟡，全部已修（详见下方 round 1 corrections trail）
- 🚀 **下一步**：spec round 2 review（验收修复） → user review → writing-plans
- ❌ **已砍 / 推迟**：D4（OCR 选型）+ 维度 1（中文 OCR 横评）+ 维度 4（复杂商业模式调研）— MVP 阶段不再需要，留 M5+

---

## Spec Review Round 1 Corrections（2026-04-25，回填）

reviewer 拉真实代码 + architecture.md + WIP 交叉审查，发现 9 个问题。spec 直接修，不重开决策。

| # | 严重度 | 问题 | 修复位置 |
|---|---|---|---|
| 1 | 🔴 | KP cache 设计为全书级但代码是模块级触发，数据流不通 | spec §6.2 加"读写时序"段，明示 confirm 路由算 MD5→hit 跳过全管线/miss 走正常流程；写入时机=所有 modules 完成时聚合 |
| 2 | 🔴 | spec 写 `/api/auth/signup` 但实际项目用 `/api/auth/register` | spec §9.2 / §附录 B / §附录 C 全部 signup→register（替换 4 处）|
| 3 | 🔴 | D5 5问"现在的代价"低估——`src/lib/ai.ts:63` ProviderModelId 类型只识别 anthropic/google/openai，DeepSeek/Qwen 必须先在 ai.ts 注册 provider adapter | spec §5.4 加"首次启用前置工作"段，工程量从 1 工作日 → 1.5 工作日 |
| 4 | 🟠 | §9.3 漏教学路由 cost_log 写入（教学免费档 DeepSeek 也需计入月度 meter）| spec §9.3 加 `POST /api/teaching-sessions/[sessionId]/messages` 一行，明示免费档计入 / 付费档独立 Anthropic billing 不计入 |
| 5 | 🟠 | `getTeacherModel(tier, override)` override 优先于 tier，付费档用户可能被路由到非 Sonnet（护城河漏）| spec §5.5 加"优先级修正"段，要求 tier='premium' 永远返回 Sonnet（override 仅对 free 生效），代码改 4-6 行 |
| 6 | 🟠 | rate-limit / quota 时序竞态：spec 说 presign 时拦截，但用户拿 URL 后不一定真上传 | spec §7.4 明示：book_uploads_log 写入时机=confirm 成功后（不在 presign 时）；quota 减扣同事务；MVP 失败不自动 refund |
| 7 | 🟠 | §6.1 "DeepSeek 90% off" 数学错（$0.07/$0.27=26%，74% off 才对）| spec §6.1 改为"~74% off"，DeepSeek 官方 [pricing-details-usd](https://api-docs.deepseek.com/quick_start/pricing-details-usd) 数据核实；Qwen "~90% off" 软化为"待实测" |
| 8 | 🟡 | §附录 B architecture.md 同步章节漏错误处理 | 附录 B 加"§错误处理 / 重试层"+ "§教学护城河层" 两条 |
| 9 | 🟡 | §13.2 #3 "UTC vs 北京时区" 与 §11.4 已 hardcode UTC 0:00 daily 矛盾 | §13.2 #3 关闭并 lock 北京时区月初 cutoff（cron `0 16 1 * *` UTC = 北京 1 号 0:00）；§2.2 / §11.4 同步 |

**新增未决问题**（不阻塞 brainstorm，进入 plan 阶段）：
- #5 DeepSeek/Qwen provider adapter 路径（`@ai-sdk/deepseek` 官方 SDK vs `createOpenAI` baseURL OpenAI compat）— writing-plans 阶段验证一次集成

**5 问表格 D5 行更新**：现在的代价 1-2 工作日 → 1.5 工作日（含 ai.ts provider adapter 首次工作）— spec §14 暂未更新表格（影响 minor，plan 阶段会重新刷）。

---

## 5 问表格速览（CLAUDE.md 强约束 — 决策 lock 时填）

| 决策 | 它是什么 | 现在的代价 | 给我们带来什么 | 关闭哪些未来门 | 选错后果 | 可逆性 |
|---|---|---|---|---|---|---|
| **D0 MVP 范围切割**（2026-04-25 lock）| TXT + 文字版 PDF + .pptx / ≤10MB / ≤100 页 / ≤200 张 / 拒绝时收邮箱 | 半天 dispatch | OCR 成本归零 + 邮箱池营销资产 + 留学生主战场覆盖 | 短期不服务"扫纸质书"+ 不做 .ppt 旧格式 | 太严流失 / 太松烧钱 | 🟢 容易（改数字 / 白名单）|
| **D1 单本 1.5 / 月 500 元上限**（2026-04-25 lock）| 系统级"刹车"——超额自动拦 + 邮件告警 | 1 工作日 | break-even 防御 / 抖音引流可放心扩 | 偶尔超大教材会被拒 | 改 env 秒切 | 🟢 容易（环境变量）|
| **D2 100 用户 / 2 周**（2026-04-25 lock）| 第一阶段抖音/小红书引流目标 | 0（数字）| 营销节奏 + 邀请码发放 + 缓存命中率验证 | 设大设小都不致命 | 看第一周数据调 | 🟢 极易（营销节奏）|
| ❌ D3 免费付费边界 | — 砍 — | — | — | — | — | — |
| ❌ D4 OCR 选型 | — 砍 — | — | — | — | — | — |
| **D5 KP 模型**（2026-04-25 lock）| Gemini 全下线 → DeepSeek V3.2 + Qwen3-Max 备 + Sonnet 付费档不动 | 1-2 工作日 | 单本 7 元 → 0.7 元（10x 降本）+ Google 账户关停 | DeepSeek 64K 上下文 + 2026-07-24 EOL | 中文质量回归 → 跑回归测试 fallback Qwen | 🟡 中等（env 30min 切回，需 Google 充值激活） |
| **D6 缓存**（2026-04-25 lock）| PDF MD5 全书级 + 半全局共享 + provider auto cache | 1 工作日 | 命中率 20-25% × 90% off → 月度再省 22% + 社交信号 | 章节级延后 M5+ | 命中率不达预期 → brainstorm 升粒度 | 🟢 容易（关 cache 查询）|
| **D7 上传额度 + 流控**（2026-04-25 lock）| 首本免费 + 邀请 +1 / 1 小时 1 本 / >5 本告警 | 1-2 工作日 | 单人燃烧上限 + 邀请杠杆 + 异常早发现 | 已发邀请码不能撤回 | 调整需通知用户 | 🟡 中等（额度 + 邀请码已发后调整需通知）|

---

## 最终产出

1. **本 WIP 文件** → 全决策 lock 后转入正式 spec（同时保留作决策 trail，由用户决定是否归档）
2. **正式 spec** → `docs/superpowers/specs/2026-04-25-ocr-cost-architecture-design.md`（按 BS-1 7a 同步初始化 skeleton；7b 每决策 lock 即追加 engineering 章节）
3. **research 文件** → `docs/research/2026-04-25-*.md` × 4 维度（S 级源 ≥3）
4. **MEMORY pointer** → `OCR Cost Brainstorm WIP`（指向本 WIP 文件，brainstorm 完成后删除 + audit log 同步）
5. **stuck artifacts cleanup**（brainstorm 完成后再做）：book 16/17/18 DB 行 + commit `9a76458` push + M4.6 milestone-audit
6. **下游链** → spec → writing-plans → task-execution
