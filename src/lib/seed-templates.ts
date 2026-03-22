import { getDb } from './db.ts'

interface TemplateSeed {
  role: string
  stage: string
  template_text: string
}

const SEED_TEMPLATES: TemplateSeed[] = [
  {
    role: 'extractor',
    stage: 'structure_scan',
    template_text:
      '你是一个教材知识点提取专家。\n\n## 任务\n对以下教材文本进行结构扫描，识别小节标题和页码范围。\n\n## 文本\n{ocr_text}\n\n## 输出要求\n返回 JSON: { "sections": [{ "title": "", "line_start": 0, "line_end": 0, "estimated_kp_count": 0 }] }',
  },
  {
    role: 'extractor',
    stage: 'kp_extraction',
    template_text:
      '你是一个教材知识点提取专家。\n\n## 任务\n从以下文本块中提取知识点。\n\n## 提取规则\n{extraction_rules}\n\n## 文本块\n{text_block}\n\n## 已提取的 KP（上下文）\n{existing_kps}\n\n## 输出要求\n返回 JSON: { "knowledge_points": [{ "kp_code": "", "section_name": "", "description": "", "type": "", "importance": 1, "detailed_content": "", "cross_block_risk": false }] }',
  },
  {
    role: 'extractor',
    stage: 'quality_check',
    template_text:
      '你是一个知识点质量审核专家。\n\n## 任务\n检查以下 KP 表的质量。\n\n## KP 表\n{kp_table}\n\n## 质量门标准\n{quality_gates}\n\n## 输出要求\n返回 JSON: { "passed": true, "issues": [] }',
  },
  {
    role: 'coach',
    stage: 'pre_reading_guide',
    template_text:
      '你是一个学习教练。\n\n## 任务\n为以下模块生成读前指引。\n\n## 本模块知识点\n{kp_table}\n\n## 跨模块依赖\n{dependencies}\n\n## 输出要求\n返回 JSON: { "can_do_after": "", "key_points": [], "common_pitfalls": [] }',
  },
  {
    role: 'coach',
    stage: 'qa_generation',
    template_text:
      '你是一个教材学习教练。\n\n## 任务\n根据知识点表出 Q&A 练习题。\n\n## Q&A 规则\n{qa_rules}\n\n## 本模块知识点\n{kp_table}\n\n## 用户阅读笔记\n{user_notes}\n\n## 用户截图问答记录\n{user_qa_history}\n\n## 历史错题\n{past_mistakes}\n\n## 输出要求\n返回 JSON: { "questions": [{ "kp_id": 0, "type": "", "text": "", "correct_answer": "", "scaffolding": "" }] }',
  },
  {
    role: 'coach',
    stage: 'qa_feedback',
    template_text:
      '你是一个学习教练。\n\n## 任务\n评估学生回答并给出即时反馈。\n\n## 题目\n{question}\n\n## 正确答案\n{correct_answer}\n\n## 学生回答\n{user_answer}\n\n## 对应知识点\n{kp_detail}\n\n## 输出要求\n返回 JSON: { "is_correct": true, "score": 0, "feedback": "" }',
  },
  {
    role: 'coach',
    stage: 'note_generation',
    template_text:
      '你是一个学习笔记生成专家。\n\n## 任务\n整合以下信息生成模块学习笔记。\n\n## 知识点表\n{kp_table}\n\n## 用户阅读笔记\n{user_notes}\n\n## Q&A 结果\n{qa_results}\n\n## 输出要求\n返回 Markdown 格式的学习笔记。',
  },
  {
    role: 'examiner',
    stage: 'test_generation',
    template_text:
      '你是一个考试出题专家。\n\n## 任务\n根据知识点表出模块测试题。\n\n## 测试规则\n{test_rules}\n\n## 本模块知识点\n{kp_table}\n\n## 历史错题\n{past_mistakes}\n\n## 输出要求\n返回 JSON: { "questions": [{ "kp_id": 0, "type": "", "text": "", "options": [], "correct_answer": "", "explanation": "" }] }',
  },
  {
    role: 'examiner',
    stage: 'test_scoring',
    template_text:
      '你是一个考试评分专家。\n\n## 任务\n评估学生测试答案。\n\n## 试卷\n{test_paper}\n\n## 学生答案\n{user_answers}\n\n## 输出要求\n返回 JSON: { "results": [{ "question_id": 0, "is_correct": true, "score": 0, "feedback": "", "error_type": null }], "total_score": 0, "pass_rate": 0, "is_passed": true }',
  },
  {
    role: 'reviewer',
    stage: 'review_generation',
    template_text:
      '你是一个复习出题专家。\n\n## 任务\n根据聚类和 P 值出复习题。\n\n## 复习规则\n{review_rules}\n\n## 聚类及 P 值\n{clusters_with_p}\n\n## 对应知识点\n{kp_table}\n\n## 历史错题\n{past_mistakes}\n\n## 输出要求\n返回 JSON: { "questions": [{ "cluster_id": 0, "kp_id": 0, "type": "", "text": "", "options": [], "correct_answer": "", "explanation": "" }] }',
  },
  {
    role: 'assistant',
    stage: 'screenshot_qa',
    template_text:
      '你是一个教材学习助手。用户在阅读 PDF 时截图了一段内容并提问。\n\n## 截图识别文本\n{screenshot_text}\n\n## 用户问题\n{user_question}\n\n## 之前的对话\n{conversation_history}\n\n## 要求\n用中文回答，解释清楚，如果涉及公式请写出完整步骤。',
  },
]

export function seedTemplates(): void {
  const db = getDb()
  const existing = db
    .prepare('SELECT COUNT(*) as count FROM prompt_templates')
    .get() as { count: number }
  if (existing.count > 0) return

  const insert = db.prepare(
    'INSERT INTO prompt_templates (role, stage, version, template_text, is_active) VALUES (?, ?, 1, ?, 1)'
  )

  const tx = db.transaction(() => {
    for (const t of SEED_TEMPLATES) {
      insert.run(t.role, t.stage, t.template_text)
    }
  })
  tx()
}
