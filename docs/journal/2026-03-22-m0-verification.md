---
date: 2026-03-22
topic: M0 最终验证 + 截图问 AI 问题发现
tags: [验证, 截图AI, UX, 语言]
---

## M0 验证结果

8/8 项全部通过：
1. App 启动无报错 ✅
2. 19 张表 + sqlite_sequence ✅
3. 11 个 prompt 模板种子化 ✅
4. 上传页面 200 ✅
5. PDF 阅读器渲染正常 ✅
6. OCR 进度条正常更新 ✅
7. 截图 AI 返回有意义的回答 ✅
8. Prompt 模板渲染测试通过 ✅

## 验证中发现的截图问 AI 问题

### 问题 1：自动解释，不等用户提问
- **根因**：`screenshot-ask` API 的 `buildScreenshotPrompt()` 写死了 "Explain the passage"，没有接收 userQuestion 参数
- **后果**：每次截图消耗一次 Claude Vision API 调用（贵），回答的可能不是用户想问的
- **spec 期望**：2.4 节描述的流程是"框选截图 → 助手 AI 回答 → 用户可以追问"，但当前实现跳过了用户提问环节
- **归属**：M5-T1

### 问题 2：中文内容用英文回答
- **根因**：prompt 全部用英文写（"Explain the passage, identify the main concept..."），AI 默认用英文回答
- **归属**：M5-T2

### 问题 3：处理过程无进度反馈
- **现象**：OCR（3-5s）+ Claude API（5-10s）是同步请求，用户只能等
- **归属**：M5-T3

### 问题 4：MD 格式渲染
- **现象**：AI 返回 markdown（表格、标题、加粗），前端可以更好地渲染
- **归属**：M5-T4

## 用户想法

### [idea:parked] 语言模式系统
用户提出：既然内容是中文但 AI 回答英文，也许可以做一个语言模式，自动切换语言，切换时 prompt 全面改成目标语言。未来可能需要多国语言版本。

**评估**：有价值但超出 MVP 范围。MVP 目标用户是中国留学生，短期内只需要中文。prompt 改中文是 M5-T2 的快速修复，完整的语言模式系统放在 MVP 之后。

**处置**：parked，MVP 后再评估。
