# Scanned PDF 里程碑审计 (2026-04-12)

**类型**：audit
**状态**：resolved
**里程碑**：Scanned PDF Processing Upgrade

---

## 变更范围

- **commits**：fd257f5 → 67dfe8a（含 T1–T9 + 3 次 Advisory 清理，共 13 次提交）
- **src/scripts 改动**：16 个文件（2778 insertions, 212 deletions）
- **涉及类别**：DB schema / API 端点 / 工具库 / 前端组件 / OCR 脚本

未涉及的类别（跳过审计）：页面路由、AI 角色、学习状态流。

---

## 审计对照表

| 类别 | architecture.md 描述 | 代码实际 | 结果 |
|------|---------------------|----------|------|
| DB schema | books 新增 `page_classifications`, `text_pages_count`, `scanned_pages_count`；modules 新增 `text_status`, `ocr_status`, `kp_extraction_status` | schema.sql 完全一致（含 ALTER migration） | ✅ |
| API 端点 | books/[bookId]/ extract(+?moduleId=N), module-status | route.ts 确认 `searchParams.get('moduleId')` 分支 + module-status GET 返回契约字段齐全 | ✅ |
| kp-extraction-service | extractKPs / extractModule / triggerReadyModulesExtraction / getModuleText / syncBookKpStatus | 5 个 export 全部在代码中 | ✅ |
| text-chunker | chunkText + pageStart/pageEnd 跟踪 | chunkText 唯一 export，签名匹配 | ✅ |
| OCR 服务端点 | /classify-pdf, /extract-text, /ocr-pdf, /ocr | ocr_server.py 4 个路由齐全 | ✅ |
| OCR Provider 抽象 | PaddleOCR 默认，接口可换 | 代码中 `if OCR_PROVIDER == "google"` 分支存在 | ✅ |
| StatusBadge 6 状态 | completed/in-progress/not-started/locked/processing/readable | 代码枚举完全一致 | ✅ |
| ProcessingPoller 行为 | 4s 轮询 module-status + router.refresh | setInterval 4000 + fetch /module-status + router.refresh() 确认 | ✅ |
| ActionHub 三元组决策 | kpStatus → textStatus → ocrStatus 优先级 | 代码 line 192-206 逻辑匹配 | ✅ |
| 书级汇总 syncBookKpStatus | 所有 completed→completed；有 processing→processing；有 failed 无 processing→failed | 代码实现一致 | ✅ |

---

## 发现的 gap（已修复）

### gap 1：部署架构环境变量清单缺 OCR_PROVIDER

**问题**：architecture.md「部署架构（M6）」只列了 5 个环境变量（DATABASE_URL, ANTHROPIC_API_KEY, AI_MODEL, OCR_SERVER_HOST, OCR_SERVER_PORT），没提 T4 引入的 `OCR_PROVIDER` / `GOOGLE_CLOUD_PROJECT_ID` / `GOOGLE_APPLICATION_CREDENTIALS`。

**影响**：下个里程碑是云部署，环境变量是核心 checklist，漏一个就会在部署时踩坑。

**修复**：拆成 App / OCR 两组分别列出，补齐 3 个缺失变量。

### gap 2：OCR 通信描述仅列 /ocr-pdf 一个端点

**问题**：原文 `app → http://.../ocr-pdf`，但现在 app 会调 4 个端点（classify, extract-text, ocr-pdf, ocr）。

**修复**：改为 `/{classify-pdf,extract-text,ocr-pdf,ocr}`。

### gap 3：副产品字段未在架构文档标注

**问题**：`books.text_pages_count` / `scanned_pages_count` 由 OCR 写入但 TypeScript 代码从不消费，容易在下次架构讨论时被当作"死字段"误删。

**修复**：在「部署架构」section 加一行说明，标注「当前未被 TS 消费，云上可用于成本监控」。

---

## ⚠️ 新增标记（下个里程碑「云部署」brainstorm 入口）

写入 architecture.md「部署架构」section 末尾：

> ⚠️ 上云部署约束：
> - OCR server 内存需求 ≥ 1GB；首次启动需下载模型（冷启动慢）
> - uploads volume 共享依赖：若 app 与 ocr 跨主机部署，PDF 传递方式需重设计（URL / 对象存储 / 流式上传）
> - OCR server 当前无认证，Docker 内网可用；暴露到公网必须加 auth 或放 VPC 内
> - DATABASE_URL 被 app 和 ocr 两侧直连，Neon pooler 连接数限制需考虑

---

## ⚠️ 原有标记（不变）

architecture.md line 146 的 `screenshot-ask 路由 prompt 英文化（M6）`——与本里程碑无关，保留。

---

## Advisory 残留（可接受）

里程碑累计 11 条 Advisory，其中 2 条已通过清理任务修复（277738d 统一 error.message 提取，40f895b 删 useRef 无用 import），剩余 9 条经人工评估确认为 by-design 或可接受的设计权衡，不单独追修。详见 changelog 2026-04-12 条目。

---

## 下个里程碑注意事项

- **云部署**（基础设施里程碑）将直接使用本里程碑标的 ⚠️ 作为讨论起点
- 教学系统 brainstorm WIP 保留在 `docs/superpowers/specs/2026-04-12-teaching-system-brainstorm-state.md`，决策 3–9 未完成，待云部署结束后恢复
- 学习状态流（architecture.md line 87-91）本里程碑未改；教学系统里程碑将改（决策 3 正在讨论）
