# 系统架构

> 两层信息：系统总图（有什么）+ 接口契约（怎么接在一起）。
> 里程碑结束时必须更新，session 开始时必须读取。

---

## 系统总图

### 页面

```
/ (首页：书目列表)
├── /upload (上传 PDF)
├── /logs (系统日志)
└── /books/[bookId]
    ├── / (书详情)
    ├── /reader (PDF 阅读器 + 截图问 AI)
    ├── /module-map (模块地图)
    └── /modules/[moduleId]
        ├── / (模块学习：指引→阅读→QA→笔记)
        ├── /qa (QA session)
        ├── /test (测试 session)
        └── /mistakes (错题页)
```

### API 组

```
books/              — list/create
books/[bookId]/     — extract, status, pdf, module-map(+confirm/regenerate), screenshot-ask, notes, highlights, toc
modules/            — list
modules/[moduleId]/ — status, guide, generate-questions, qa-feedback, questions, reading-notes,
                      generate-notes, evaluate, test/generate, test/submit, test/, mistakes
qa/[questionId]/    — respond
conversations/      — messages
logs/               — 系统日志
```

### DB 表（19 张）

| 分类 | 表 |
|------|----|
| 用户数据 | books, modules, conversations, messages, highlights, reading_notes, module_notes |
| 学习数据 | knowledge_points, clusters, qa_questions, qa_responses |
| 测试数据 | test_papers, test_questions, test_responses, mistakes |
| 复习数据 | review_schedule, review_records |
| 系统数据 | prompt_templates, logs |

### AI 角色（5 个）

| 角色 | 职责 |
|------|------|
| 提取器 (extractor) | KP 提取 + 模块地图 |
| 教练 (coach) | 读前指引 + QA 出题 + 反馈 + 笔记生成 |
| 考官 (examiner) | 测试出题 + 评分 + 错题诊断 |
| 复习官 (reviewer) | 复习出题 + 评分 + P 值更新 |
| 助手 (assistant) | 截图问 AI |

### 学习状态流

```
unstarted → reading → qa → notes_generated → testing → completed
```

---

## 接口契约

### 提取 → 学习

- KP 提取完成后写入 knowledge_points，同时创建 clusters 并关联 kp.cluster_id
- modules.kp_count 和 cluster_count 在提取时设置
- 教练出题依赖 knowledge_points.type 做题型映射：
  calculation → worked_example，其他 → scaffolded_mc/short_answer/comparison

### 学习 → 测试

- QA 全部完成 → 生成笔记 → learning_status='notes_generated' → 可进入测试
- 考官出题读 knowledge_points（同一张表、同一个 kp_id 体系）
- 考官读取 mistakes 表 is_resolved=0 的记录，优先覆盖对应 KP

### 测试 → 复习

- 测试通过（≥80%）时：设 learning_status='completed' + 创建 review_schedule（round=1, due=today+3天）+ 按 cluster 更新 P 值
- P 值更新规则：cluster 内全对 → consecutive_correct+1（连对≥2 则 P+1，上限 5）；有错 → consecutive_correct=0, P-1（下限 1）
- 复习调度在 review_schedule 表（module 级），clusters 表不存储调度日期

### 错题流转

- mistakes 表 source 字段支持 'test'|'qa'|'review' 三个来源
- 当前只有 test/submit 写入（source='test'），qa 和 review 来源未实现
- mistakes.kp_id 关联 knowledge_points，用于出题时优先覆盖

### prompt 模板

- seed-templates.ts 种子化：extractor×3, coach×4, examiner×2, reviewer×1, assistant×1
- extractor 模板是乱码 UTF-8，但功能正常（创建时就是这样写的）
- examiner 模板已用正常中文重写（M3）
- reviewer 模板已用正常中文重写（M3.5），含 P 值出题策略和 {recent_questions} 去重占位符
