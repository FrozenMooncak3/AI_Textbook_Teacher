# 技术架构说明

---

## 系统层次

```
┌─────────────────────────────────────────────┐
│  Presentation Layer（页面层）                 │
│  - 上传页 /upload                            │
│  - 模块地图页 /books/[bookId]                │
│  - 学习页（Q&A + 测试）                      │
└──────────────────┬──────────────────────────┘
                   │
┌──────────────────▼──────────────────────────┐
│  Application Layer（API 路由层）              │
│  - /api/books    书籍上传和管理               │
│  - /api/modules  模块生成和查询               │
│  - /api/qa       Q&A 交互                    │
└──────────────────┬──────────────────────────┘
                   │
┌──────────────────▼──────────────────────────┐
│  Learning Engine Layer（AI 逻辑层）           │
│  - 模块地图生成（Claude API）                 │
│  - 读前指引生成（Claude API）                 │
│  - Q&A 问题生成 + 评估（Claude API）          │
│  - 测试题生成（Claude API）                   │
│  - 复习内容生成（Claude API）                 │
└──────────────────┬──────────────────────────┘
                   │
┌──────────────────▼──────────────────────────┐
│  Data Layer（数据层）                         │
│  - SQLite 本地数据库（better-sqlite3）        │
│  - 文件：data/app.db                         │
└─────────────────────────────────────────────┘
```

## PDF 处理策略

**不在 app 内处理 PDF**。用户使用外部工具 `pdf2txt-chinese` 将 PDF 转为 .txt，再上传到 app。

原因：
- PDF OCR 质量不稳定，外部工具已有成熟方案
- app 专注学习逻辑，不处理文件格式转换
- 降低 MVP 复杂度

## 数据库表结构

```sql
books          -- 教材（id, title, raw_text, created_at）
modules        -- 学习模块（id, book_id, title, summary, order_index, status）
questions      -- 题目（id, module_id, type, prompt, answer_key, explanation）
user_responses -- 用户回答（id, question_id, response_text, score）
mistakes       -- 错题记录（id, module_id, knowledge_point, next_review_date）
review_tasks   -- 复习任务（id, module_id, due_date, status）
```

## AI 调用策略

- 模型：`claude-sonnet-4-6`（平衡性能与成本）
- 长文本处理：分块处理，每次调用不超过 100k tokens
- 流式输出：Q&A 互动时使用 streaming，提升用户体验
