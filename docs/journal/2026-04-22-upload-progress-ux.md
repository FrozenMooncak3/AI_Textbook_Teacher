# 上传 progress UX 脱节（前端 10% 假卡 vs 后端真 OK）

**日期：** 2026-04-22
**分类：** 交互 / UX
**Tier：** T2（独立里程碑评估）
**状态：** parked

---

## 现象

M4.6 OCR hotfix 上线后 live test（book 13，14.9MB 《手把手教你读财报》369 页），用户报告：

> "又卡在百分之 10 了"

但后端 DB 状态（`.ccb/m4.6-poll.log`）显示**完全正常**：

```
11:25:05  upload=confirmed  parse=processing  ocr=0/0       ← R2 上传已完成
11:25:50  upload=confirmed  parse=processing  ocr=369/369   ← classify-pdf 已返回，modules 行已建
11:26:12  (稳定)            parse=processing  ocr=369/369
```

上传已完成、classify-pdf 已返回 369 页分类、modules 行已建，后台在跑 369 页的 OCR（5-10 分钟预期）——用户看到的"卡在 10%"是前端 UI 阶段性显示的僵化，不是真 hang。

---

## 根因猜测

前端 progress bar 可能只接入了 R2 上传阶段的 XHR onprogress（占总进度 10%），到了后端异步 OCR（占 80%）和 KP 抽取（占 10%）阶段没有信号源可对接，于是进度条定格在 10% 直到最终 `parse_status=done`。

**具体候选断点**（需读码确认）：
- `src/components/Upload*.tsx` / `src/app/upload/page.tsx` ：是否只监听 XHR.upload.onprogress
- `src/components/ProcessingPoller.tsx`（M5.5 加过）：是否只在书详情页轮询 `parse_status`，不在上传页轮询
- 上传页和"处理中"页是否衔接断了（上传 100% → 立即跳转 → 新页面重新显示）
- 是否有独立"OCR 进度"展示（按 `scanned_pages_count / ocr_total_pages` 算百分比）

---

## 为什么重要

1. **用户体感 = 产品真相**：不管后端多正常，UI 显示"卡在 10%" 用户就认为 hang 了，会手动刷新 / 重传 / 放弃 / 给差评。
2. **M4.6 hotfix 的诊断价值被 UI 抹掉**：M4.6 真修好了的事（classify-pdf 不再 4-6 分钟 hang），用户看不见；反而误以为修没修好都一样。
3. **`feedback_ux-user-signal.md` memory 明确规定**：用户的 progress bar / loading / status 请求 = 产品信号，默认实现，不能以 "MVP 最小" 搪塞。

---

## 修复方向（任选组合，独立里程碑再拍板）

| 方向 | 手段 | 代价 |
|------|------|------|
| A. 真进度接入 | ProcessingPoller 扩展到上传页，按 `scanned_pages_count/ocr_total_pages` 展示实时 OCR 百分比 | 1-2 天，前端 + API 轻改 |
| B. 分阶段文案 | "10% 上传中→25% 解析中→80% 识别中→100% 完成" 配合状态机 | 半天，纯前端 |
| C. SSE / WebSocket 推送 | 后端 OCR 每完成 N 页 push 一个事件 | 2-3 天，需后端新端点 |
| D. 友好等待话术 | "正在识别 369 页，约 5-10 分钟" 配合旋转图标 + 时间估计 | 2 小时，最低成本 |

**推荐优先级**：D（立即止血）+ A（真进度，正解）。C 是性能优化，B 是权宜。

---

## 后续

- 本想法**不进 M4.6**（M4.6 只修 OCR fetch hang 的 backend 部分）
- 归入独立 UX 里程碑或 MVP 收尾前单独一个 "上传/处理 UX 打磨" 小里程碑
- 需要时由 brainstorming skill 重新评估 scope
