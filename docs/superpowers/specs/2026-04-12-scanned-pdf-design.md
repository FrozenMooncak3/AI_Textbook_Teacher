---
date: 2026-04-12
topic: 扫描PDF功能升级设计
type: spec
status: resolved
keywords: [scanned-PDF, OCR, classification, progressive-unlock]
---

# 扫描 PDF 功能升级设计

**日期**: 2026-04-12
**状态**: 待 review
**前序**: docs/research/2026-04-11-pdf-processing-research.md（技术调研）
**关联**: docs/superpowers/plans/2026-04-11-mvp-expansion-timeline.md（MVP 扩展时间线第一项）

---

## 1. 目标

将 PDF 处理从"全部 OCR 完才能用"升级为"智能分类 + 渐进式处理 + 秒级可用"。同时支持文字版和扫描版 PDF，生产环境可切换到云 OCR API。

### 非目标

- 不改变学习流程（教学系统是独立的 MVP 扩展项）
- 不改变 PDF 阅读器（react-pdf-viewer 保持不变）
- 不改变截图问 AI 功能（独立管道）

---

## 2. 整体架构

### 新的 PDF 处理管道

```
用户上传 PDF
  ↓
[Step 1] 页面分类（< 1s）
  POST /classify-pdf → 每页标记 text / scanned / mixed
  → 写入 books.page_classifications + text_pages_count / scanned_pages_count
  ↓
[Step 2] 文字页快速提取（秒级）
  POST /extract-text → pymupdf4llm 输出结构化 Markdown
  → text-chunker 分模块（记录 page_range）
  → 写入 raw_text（文字页部分）+ 创建/更新 modules
  → 设置模块 text_status = ready
  ↓ 用户可开始阅读文字就绪的模块
[Step 3] 扫描页 OCR（后台，fire-and-forget）
  POST /ocr-pdf → 只处理 scanned / mixed 页面
  → 每完成一个模块的页面 → 更新 ocr_status = done
  → OCR 文本按页码插入 raw_text
  ↓ 逐模块解锁
[Step 4] KP 提取（逐模块，后台自动触发）
  模块 text_status=ready 或 ocr_status=done → 触发该模块 KP 提取
  → kp_extraction_status = completed → 解锁教学/QA
```

### 与当前管道的对比

| 维度 | 当前 | 改后 |
|------|------|------|
| 处理模式 | 全部 OCR → 全部存 raw_text → 手动触发 KP | 分类 → 文字秒出 → 扫描后台 → 逐模块 KP |
| 文字版 PDF 耗时 | 受 OCR 管道影响 | < 10 秒全部可用 |
| 扫描版 PDF 耗时 | 5-8 分钟（CPU） | 开发: 同前 / 生产: 30 秒-2 分钟 |
| 混合 PDF | 全部走 OCR | 文字页秒出，扫描页后台 |
| 用户等待 | 全部完成才能开始 | 第一个模块秒级可用 |
| 模块解锁 | 全部一起 | 逐步解锁 |

---

## 3. 数据模型变化

### books 表新增（3 列）

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `page_classifications` | JSON (TEXT) | NULL | `[{page: 1, type: "text"}, ...]` |
| `text_pages_count` | INTEGER | 0 | 文字页数量 |
| `scanned_pages_count` | INTEGER | 0 | 扫描页数量 |

### modules 表新增（3 列）

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `text_status` | TEXT | 'pending' | `pending → ready → failed` |
| `ocr_status` | TEXT | 'pending' | `pending → processing → done → skipped → failed` |
| `kp_extraction_status` | TEXT | 'pending' | `pending → processing → completed → failed`（模块级 KP 提取状态） |

### 复用已有字段

- `modules.page_start` / `modules.page_end`（INTEGER，已存在）：记录模块对应的 PDF 页码范围。当前由 kp-extraction-service 写入，本次改为 text-chunker 在 Step 2 分模块时写入
- `books.parse_status`：含义改为整体状态（全部模块 kp_extraction_status=completed 才 done）
- `books.raw_text`：保留，存全书合并文本
- `books.ocr_current_page` / `ocr_total_pages`：保留，扫描页进度

### 迁移策略

- schema.sql 中 CREATE TABLE 包含所有新列（新环境直接建表）
- **已有环境需要 ALTER TABLE 迁移脚本**（initDb 的 CREATE TABLE IF NOT EXISTS 不会给已有表加列）：
  ```sql
  ALTER TABLE books ADD COLUMN IF NOT EXISTS page_classifications TEXT DEFAULT NULL;
  ALTER TABLE books ADD COLUMN IF NOT EXISTS text_pages_count INTEGER DEFAULT 0;
  ALTER TABLE books ADD COLUMN IF NOT EXISTS scanned_pages_count INTEGER DEFAULT 0;
  ALTER TABLE modules ADD COLUMN IF NOT EXISTS text_status TEXT DEFAULT 'ready';
  ALTER TABLE modules ADD COLUMN IF NOT EXISTS ocr_status TEXT DEFAULT 'done';
  ALTER TABLE modules ADD COLUMN IF NOT EXISTS kp_extraction_status TEXT DEFAULT 'completed';
  ```
  - 已有书的默认值：`text_status = 'ready'`，`ocr_status = 'done'`，`kp_extraction_status = 'completed'`（已完成的数据向后兼容）
  - 迁移脚本在 initDb() 中 CREATE TABLE 之后执行（幂等）

---

## 4. OCR 服务改造 (scripts/ocr_server.py)

### 4.1 新增依赖

- `pymupdf4llm`：PyMuPDF 的 Markdown 输出层
- `google-cloud-documentai`（可选，生产环境）

### 4.2 新增端点：POST /classify-pdf

**输入**: `{ pdf_path, book_id }`

**逻辑**:
```python
def classify_page(page):
    text = page.get_text().strip()
    char_count = len(text)
    images = page.get_images()
    page_area = page.rect.width * page.rect.height
    # 计算图片覆盖率
    image_coverage = calculate_image_coverage(page, images)
    
    if char_count > 50 and image_coverage < 0.5:
        return "text"
    elif char_count < 10 and image_coverage > 0.7:
        return "scanned"
    else:
        return "mixed"
```

**输出**: `{ pages: [{page: 1, type: "text"}, ...], text_count: N, scanned_count: M }`

**副作用**: 写入 `books.page_classifications`、`text_pages_count`、`scanned_pages_count`

### 4.3 新增端点：POST /extract-text

**输入**: `{ pdf_path, book_id }`

**逻辑**:
1. 用 pymupdf4llm 提取所有 text 类型页面 → 结构化 Markdown
2. 写入 `books.raw_text`（文字页部分，带 `--- PAGE N ---` 标记）
3. 返回提取的文本

**输出**: `{ text: "...", page_count: N }`

### 4.4 改造端点：POST /ocr-pdf

**变化**:
- 读取 `books.page_classifications`，只处理 `scanned` 和 `mixed` 类型页面
- 跳过 `text` 类型页面
- 每完成一页，检查该页所属模块的全部扫描页是否完成 → 如完成则更新 `modules.ocr_status = done`
- OCR 文本按页码插入 `raw_text` 的对应位置

### 4.5 OCR Provider 抽象

```python
OCR_PROVIDER = os.environ.get("OCR_PROVIDER", "paddle")

def ocr_page(page_image):
    if OCR_PROVIDER == "paddle":
        return paddle_ocr(page_image)
    elif OCR_PROVIDER == "google":
        return google_document_ai(page_image)
```

**环境变量**:
- `OCR_PROVIDER`：`paddle`（默认）| `google`
- `GOOGLE_CLOUD_PROJECT_ID`：Google Cloud 项目 ID（google 模式需要）
- `GOOGLE_APPLICATION_CREDENTIALS`：Google 服务账号密钥路径（google 模式需要）

---

## 5. 后端 API 改造

### 5.1 POST /api/books（上传路由改造）

**当前**: 保存文件 → fire-and-forget /ocr-pdf

**改后**:
```
保存文件
  → 同步调用 /classify-pdf（< 1s）
  → 同步调用 /extract-text（秒级）
  → 调用 text-chunker 分模块 + 创建 modules 记录（写入 page_start/page_end + text_status）
  → 如有扫描页 → fire-and-forget /ocr-pdf（只处理扫描页）
  → 如无扫描页 → 直接设 parse_status = done
  → 返回 book 信息
```

### 5.2 新增 GET /api/books/[bookId]/module-status

**用途**: 前端 ProcessingPoller 轮询模块级状态

**返回**:
```json
{
  "data": {
    "bookId": "xxx",
    "parseStatus": "processing",
    "modules": [
      {
        "id": "m1",
        "name": "第1章",
        "textStatus": "ready",
        "ocrStatus": "done",
        "kpStatus": "completed",
        "ocrProgress": null
      },
      {
        "id": "m2",
        "name": "第2章",
        "textStatus": "ready",
        "ocrStatus": "processing",
        "kpStatus": "pending",
        "ocrProgress": { "current": 3, "total": 8 }
      }
    ]
  }
}
```

### 5.3 KP 提取改造（kp-extraction-service）

**当前**: 接收全书 raw_text → text-chunker 分块 → 逐块提取 → merger 合并。`writeResultsToDB` 先 DELETE FROM modules WHERE book_id 再重建。

**改后**: 
- 模块级触发：当模块的文字就绪（text_status=ready 且无扫描页，或 ocr_status=done）→ 自动触发该模块的 KP 提取
- text-chunker 已在 Step 2 完成分块并创建 modules 记录，KP 提取直接使用模块对应的文本块
- kp-merger 逻辑不变（处理单模块内的多 chunk 合并）
- **关键改造：writeResultsToDB 必须从"全量 DELETE + 重建"改为"按模块 UPSERT"**。否则提取 Module 2 时会删掉 Module 1 的数据。具体：只 DELETE/INSERT 目标模块的 knowledge_points 和 clusters，不动其他模块。
- 更新模块的 `kp_extraction_status = completed`（新增列）

### 5.4 extract 路由门控修改

**当前**: `GET/POST /api/books/[bookId]/extract` 有门控 `if (book.parse_status !== 'done') throw 409`

**改后**: 
- 移除 `parse_status === 'done'` 门控
- 新增检查：目标模块的 `text_status === 'ready'` 或 `ocr_status === 'done'`（模块级就绪判断）
- 支持参数 `moduleId`：指定提取单个模块（渐进式），不传则提取所有就绪模块

### 5.5 text-chunker 改造

**当前**: 输入全书文本 → 输出 chunks 数组

**改后**: 
- 输出增加每个 chunk 的 `pageStart` / `pageEnd`（对应 modules 已有的 `page_start` / `page_end` 列）
- 利用 `--- PAGE N ---` 标记确定页码
- pymupdf4llm 输出的 Markdown 标题（`#`）让标题检测更可靠，可简化现有正则
- 创建 modules 记录时直接写入 `page_start`、`page_end`、`text_status = 'ready'`

---

## 6. 前端改造

### 6.1 ProcessingPoller 改造

**当前**: 轮询 `GET /api/books/[bookId]/status` → 显示 OCR 进度条

**改后**: 轮询 `GET /api/books/[bookId]/module-status` → 显示模块级进度

**显示逻辑**:
- 全部模块 kpStatus=completed → 隐藏 Poller
- 有模块在处理中 → 显示模块级进度列表
- 纯文字 PDF → Poller 几秒后自动消失（全部就绪）

### 6.2 模块地图 (Action Hub) 状态显示

| 模块状态 | UI 表现 |
|---------|---------|
| text_status=ready, kpStatus=completed | ✅ 可进入学习（当前行为） |
| text_status=ready, kpStatus=pending/processing | 📖 可阅读原文，KP 提取中 |
| ocr_status=processing | 🔄 OCR 处理中 (X/Y 页) |
| text_status=pending | 🔒 等待处理 |

### 6.3 StatusBadge 扩展

当前 StatusBadge 有 4 种状态（completed / in-progress / not-started / locked）。新增对处理中模块的状态显示：
- `processing`：OCR/KP 处理中（新增，使用 neutral 变体 + 动画）
- `readable`：可阅读但不可学习（新增，使用 primary 变体）

---

## 7. Docker Compose 变化

### ocr 容器

- 新增 pymupdf4llm 依赖（`pip install pymupdf4llm`）
- 可选：google-cloud-documentai（生产环境 Dockerfile 变体或条件安装）

### 新增环境变量

```yaml
ocr:
  environment:
    - OCR_PROVIDER=${OCR_PROVIDER:-paddle}
    - GOOGLE_CLOUD_PROJECT_ID=${GOOGLE_CLOUD_PROJECT_ID:-}
    - GOOGLE_APPLICATION_CREDENTIALS=${GOOGLE_APPLICATION_CREDENTIALS:-}
```

---

## 8. 边界情况

| 情况 | 处理 |
|------|------|
| 全文字 PDF | classify → extract-text → KP 提取。全程 < 10 秒。不调 /ocr-pdf |
| 全扫描 PDF | classify → extract-text 输出空 → /ocr-pdf 处理全部页 → 逐模块解锁 |
| 混合 PDF | 文字页秒出 → 扫描页后台 → 用户先学文字模块 |
| OCR 某页失败 | 记录失败页，继续处理其他页。模块 ocr_status = failed 如全部页都失败 |
| pymupdf4llm 提取质量差 | 回退到 raw get_text()（检查输出是否为空或异常短） |
| 超大 PDF (500+页) | 分类 < 1s。文字提取秒级。OCR 后台逐页，渐进解锁 |
| 已有书（迁移） | 新字段用默认值，不重新处理 |
| 上传重复 PDF | 和当前行为一致（创建新 book 记录） |
| 无文字无图片的空白页 | image_coverage < 0.7 且 char_count < 10 → 归入 mixed，但 OCR 后无内容则忽略 |

---

## 9. 变更清单

| 文件 | 改动 | 执行者 |
|------|------|--------|
| `scripts/ocr_server.py` | 新增 /classify-pdf、/extract-text 端点；改造 /ocr-pdf（只处理扫描页）；OCR provider 抽象；pymupdf4llm 集成 | Codex |
| `src/lib/schema.sql` | books 表 +3 列，modules 表 +3 列，新增 ALTER TABLE 迁移块 | Codex |
| `src/lib/text-chunker.ts` | 输出增加 pageStart/pageEnd；利用 Markdown 标题简化检测 | Codex |
| `src/lib/services/kp-extraction-service.ts` | writeResultsToDB 改为按模块 UPSERT（不再全量 DELETE）；模块级触发；更新 modules.kp_extraction_status | Codex |
| `src/lib/kp-merger.ts` | 适配模块级提取（输入从全书 chunks 改为单模块 chunks） | Codex |
| `src/app/api/books/route.ts` | 上传流程改造：classify → extract → 创建 modules → 条件 OCR | Codex |
| `src/app/api/books/[bookId]/extract/route.ts` | 移除 parse_status=done 门控，支持 moduleId 参数，模块级就绪检查 | Codex |
| `src/app/api/books/[bookId]/module-status/route.ts` | 新增模块级状态 API | Codex |
| `src/app/api/books/[bookId]/status/route.ts` | 保留兼容，但返回值增加 modules 摘要或标记为 deprecated | Codex |
| `src/components/ProcessingPoller.tsx`（或等效） | 改为轮询 module-status，显示模块级进度 | Gemini |
| `src/app/books/[bookId]/page.tsx` | 模块地图增加处理中状态显示（processing/readable） | Gemini |
| `src/components/ui/StatusBadge.tsx` | 新增 processing / readable 状态（当前 4 种 → 6 种） | Gemini |
| `Dockerfile.ocr`（项目根目录） | 新增 pymupdf4llm + 可选 google-cloud-documentai 依赖 | Codex |
| `docker-compose.yml` | 新增 OCR_PROVIDER 等环境变量 | Codex |
| `docs/architecture.md` | 更新 PDF 处理管道、新增字段、新 API、模块状态流 | Claude |
| `docs/changelog.md` | 记录本次变更 | Claude |

---

## 10. 风险

| 风险 | 概率 | 影响 | 缓解 |
|------|------|------|------|
| pymupdf4llm 对中文 PDF 输出质量差 | 中 | 中 | 回退到 get_text()，加质量检查 |
| 模块级 KP 提取与全书提取结果不一致 | 低 | 中 | 保留 kp-merger 去重逻辑 |
| Google Document AI 中文准确率低于预期 | 低 | 低 | 可切回 PaddleOCR（环境变量） |
| 渐进式处理的前端状态管理复杂 | 中 | 中 | ProcessingPoller 统一管理，模块状态枚举明确 |
| text-chunker page_start/page_end 映射不准 | 中 | 中 | 用 PAGE 标记精确定位，测试覆盖 |
| writeResultsToDB 改造引入回归 | 中 | 高 | 改造前写测试覆盖现有行为，再改为按模块 UPSERT |

---

**最后更新**: 2026-04-12
