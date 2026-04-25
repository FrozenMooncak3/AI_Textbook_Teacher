---
date: 2026-04-25
type: strategic-rethink
status: open
keywords: [OCR, cost, Gemini, Vision-API, KP-extraction, scaling, business-model, paywall, Douyin, M4.6-closeout]
---

# OCR + KP 成本冲击 — 必须重新设计成本架构

## 触发事件（2026-04-24 → 2026-04-25 跨日）

- M4.6 T17 hotfix（Vercel `after()` 包裹 fire-and-forget）2026-04-24 上线，commit `d33a79f`
- 用户真机重传 book 18（369 页《手把手教你读财报》）
- **管线表现**：成功！28 秒 classify + 6 分钟 OCR 跑完 369 页 + 进入 KP 提取阶段——T17 fix 完美生效
- **失败点**：KP extraction 失败，错误原文：`Your prepayment credits are depleted. Please go to AI Studio at https://ai.studio/projects to manage your project and billing.`
- 用户反应（原文）：「OCR要钱？？那岂不是以后每有个人上传pdf都会扣钱？那全把我这当pdf ocr整？」

## 估算的当前成本（粗算）

| 书 | OCR (Vision) | KP 提取 (Gemini Pro) | 单本合计 |
|---|---|---|---|
| 50 页 | ~1 元 | ~1-2 元 | **2-3 元** |
| 100 页 | ~1 元 | ~2-3 元 | **3-5 元** |
| 369 页（实测）| ~3-5 元 | ~3-10 元 | **8-15 元** |

**抖音 / 小红书引流 100 人每人传 200 页书**：500-1000 元 / 一晚上 → 账户见底 → 全站宕机

## 为什么这是战略级问题（不是普通 hotfix）

1. **MVP 出现新阻塞**：上量动作（抖音 / 小红书引流）必须等成本可控
2. **现有付费墙位置不对**：`project_teaching-mode-paywall` memory 表明教学模式是商业护城河，意味着 OCR + KP 是"免费 MVP"——但免费 MVP 的真金白银每本都从老板账户扣
3. **滥用面**：免费中文 PDF 知识点提取 = 天然 OCR 站子诱饵，邀请码只挡路人不挡有码用户狂传
4. **决策不可逆度**：OCR 选型一旦上量难换（用户教育成本 + 数据迁移 + UI 适配）→ 必须 brainstorm + 调研后再选

## 可能的 brainstorm 方向（待 next session 调研）

### A. OCR 端
- 自托管 PaddleOCR / Surya / 国产开源（CPU 跑或 GPU 自买）
- 中国云服务的 OCR 价格（阿里 / 腾讯 / 百度 / 讯飞 / 字节）
- 用户侧 OCR（浏览器内 WASM Tesseract）—— 把成本转给用户算力
- 混合方案：本地 OCR + 云端兜底

### B. KP 提取端（更贵的部分）
- 换 Gemini 2.5 Flash（精度 vs 价格 tradeoff）
- 换国产开源大模型（Qwen / DeepSeek / GLM 自托管）
- 缓存：相同 PDF MD5 复用历史结果（避免重复扣费）
- 章节级 batch 而非全书 chunking（减少调用次数）
- 用户侧 chunking 决策（让用户选要不要全本提取）

### C. 用户侧防御
- 邀请码稀缺度（已有但不够）
- 每账号免费上传额度（如每月 3 本）
- 上传按页数预扣余额制
- 信用积分 + 邀请新人换额度
- 学校 / 机构付费授权

### D. 商业模式
- 当前规划："免费 MVP（OCR+KP）+ 教学模式付费墙"——但免费部分烧钱
- 替代："上传额度免费 + 教学模式订阅 + 超额上传按量付费"
- 极端："首本免费体验 + 充值制" —— 接受流失换 sustainability

## 当前留下的 stuck artifacts

- **book 18**：parse_status 应已 'error'（KP extraction failed at 14:04:25Z），DB 行尚未清理。下次 brainstorm 决策后一并 cleanup
- **book 16, 17**：之前 hang 的，依然在 DB（M4.6 T17 文档段已标记待 cleanup）
- **T17 文档 commit `9a76458`**：本地未 push（GitHub 网络断了），下次有网时一把推

## 已落地不动的 M4.6 成果（保护清单）

- T15 Cloud Run OOM 修复（`e0bb0c5`）
- T16 Cloud Build deploy step 自动化（`f097994`）
- T17 Vercel `after()` 包裹（`d33a79f`）
- T17 文档 commit（`9a76458`，本地）
- 这些都是 **基础设施真 bug 的真修复**，新成本架构不动它们

## 给下一个 session 的指引

读 `docs/superpowers/specs/2026-04-25-ocr-cost-brainstorm-prompt.md` 直接进 brainstorming + research-before-decision 流程。
