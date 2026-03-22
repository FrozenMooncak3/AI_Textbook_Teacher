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
      '浣犳槸涓€涓暀鏉愮煡璇嗙偣鎻愬彇涓撳銆俓n\n## 浠诲姟\n瀵逛互涓嬫暀鏉愭枃鏈繘琛岀粨鏋勬壂鎻忥紝璇嗗埆灏忚妭鏍囬鍜岄〉鐮佽寖鍥淬€俓n\n## 鏂囨湰\n{ocr_text}\n\n## 杈撳嚭瑕佹眰\n杩斿洖 JSON: { "sections": [{ "title": "", "line_start": 0, "line_end": 0, "estimated_kp_count": 0 }] }',
  },
  {
    role: 'extractor',
    stage: 'kp_extraction',
    template_text:
      '浣犳槸涓€涓暀鏉愮煡璇嗙偣鎻愬彇涓撳銆俓n\n## 浠诲姟\n浠庝互涓嬫枃鏈潡涓彁鍙栫煡璇嗙偣銆俓n\n## 鎻愬彇瑙勫垯\n{extraction_rules}\n\n## 鏂囨湰鍧梊n{text_block}\n\n## 宸叉彁鍙栫殑 KP锛堜笂涓嬫枃锛塡n{existing_kps}\n\n## 杈撳嚭瑕佹眰\n杩斿洖 JSON: { "knowledge_points": [{ "kp_code": "", "section_name": "", "description": "", "type": "", "importance": 1, "detailed_content": "", "cross_block_risk": false }] }',
  },
  {
    role: 'extractor',
    stage: 'quality_check',
    template_text:
      '浣犳槸涓€涓煡璇嗙偣璐ㄩ噺瀹℃牳涓撳銆俓n\n## 浠诲姟\n妫€鏌ヤ互涓?KP 琛ㄧ殑璐ㄩ噺銆俓n\n## KP 琛╘n{kp_table}\n\n## 璐ㄩ噺闂ㄦ爣鍑哱n{quality_gates}\n\n## 杈撳嚭瑕佹眰\n杩斿洖 JSON: { "passed": true, "issues": [] }',
  },
  {
    role: 'coach',
    stage: 'pre_reading_guide',
    template_text:
      '浣犳槸涓€涓涔犳暀缁冦€俓n\n## 浠诲姟\n涓轰互涓嬫ā鍧楃敓鎴愯鍓嶆寚寮曘€俓n\n## 鏈ā鍧楃煡璇嗙偣\n{kp_table}\n\n## 璺ㄦā鍧椾緷璧朶n{dependencies}\n\n## 杈撳嚭瑕佹眰\n杩斿洖 JSON: { "can_do_after": "", "key_points": [], "common_pitfalls": [] }',
  },
  {
    role: 'coach',
    stage: 'qa_generation',
    template_text:
      '浣犳槸涓€涓暀鏉愬涔犳暀缁冦€俓n\n## 浠诲姟\n鏍规嵁鐭ヨ瘑鐐硅〃鍑?Q&A 缁冧範棰樸€俓n\n## Q&A 瑙勫垯\n{qa_rules}\n\n## 鏈ā鍧楃煡璇嗙偣\n{kp_table}\n\n## 鐢ㄦ埛闃呰绗旇\n{user_notes}\n\n## 鐢ㄦ埛鎴浘闂瓟璁板綍\n{user_qa_history}\n\n## 鍘嗗彶閿欓\n{past_mistakes}\n\n## 杈撳嚭瑕佹眰\n杩斿洖 JSON: { "questions": [{ "kp_id": 0, "type": "", "text": "", "correct_answer": "", "scaffolding": "" }] }',
  },
  {
    role: 'coach',
    stage: 'qa_feedback',
    template_text:
      '浣犳槸涓€涓涔犳暀缁冦€俓n\n## 浠诲姟\n璇勪及瀛︾敓鍥炵瓟骞剁粰鍑哄嵆鏃跺弽棣堛€俓n\n## 棰樼洰\n{question}\n\n## 姝ｇ‘绛旀\n{correct_answer}\n\n## 瀛︾敓鍥炵瓟\n{user_answer}\n\n## 瀵瑰簲鐭ヨ瘑鐐筡n{kp_detail}\n\n## 杈撳嚭瑕佹眰\n杩斿洖 JSON: { "is_correct": true, "score": 0, "feedback": "" }',
  },
  {
    role: 'coach',
    stage: 'note_generation',
    template_text:
      '浣犳槸涓€涓涔犵瑪璁扮敓鎴愪笓瀹躲€俓n\n## 浠诲姟\n鏁村悎浠ヤ笅淇℃伅鐢熸垚妯″潡瀛︿範绗旇銆俓n\n## 鐭ヨ瘑鐐硅〃\n{kp_table}\n\n## 鐢ㄦ埛闃呰绗旇\n{user_notes}\n\n## Q&A 缁撴灉\n{qa_results}\n\n## 杈撳嚭瑕佹眰\n杩斿洖 Markdown 鏍煎紡鐨勫涔犵瑪璁般€?',
  },
  {
    role: 'examiner',
    stage: 'test_generation',
    template_text:
      '浣犳槸涓€涓€冭瘯鍑洪涓撳銆俓n\n## 浠诲姟\n鏍规嵁鐭ヨ瘑鐐硅〃鍑烘ā鍧楁祴璇曢銆俓n\n## 娴嬭瘯瑙勫垯\n{test_rules}\n\n## 鏈ā鍧楃煡璇嗙偣\n{kp_table}\n\n## 鍘嗗彶閿欓\n{past_mistakes}\n\n## 杈撳嚭瑕佹眰\n杩斿洖 JSON: { "questions": [{ "kp_id": 0, "type": "", "text": "", "options": [], "correct_answer": "", "explanation": "" }] }',
  },
  {
    role: 'examiner',
    stage: 'test_scoring',
    template_text:
      '浣犳槸涓€涓€冭瘯璇勫垎涓撳銆俓n\n## 浠诲姟\n璇勪及瀛︾敓娴嬭瘯绛旀銆俓n\n## 璇曞嵎\n{test_paper}\n\n## 瀛︾敓绛旀\n{user_answers}\n\n## 杈撳嚭瑕佹眰\n杩斿洖 JSON: { "results": [{ "question_id": 0, "is_correct": true, "score": 0, "feedback": "", "error_type": null }], "total_score": 0, "pass_rate": 0, "is_passed": true }',
  },
  {
    role: 'reviewer',
    stage: 'review_generation',
    template_text:
      '浣犳槸涓€涓涔犲嚭棰樹笓瀹躲€俓n\n## 浠诲姟\n鏍规嵁鑱氱被鍜?P 鍊煎嚭澶嶄範棰樸€俓n\n## 澶嶄範瑙勫垯\n{review_rules}\n\n## 鑱氱被鍙?P 鍊糪n{clusters_with_p}\n\n## 瀵瑰簲鐭ヨ瘑鐐筡n{kp_table}\n\n## 鍘嗗彶閿欓\n{past_mistakes}\n\n## 杈撳嚭瑕佹眰\n杩斿洖 JSON: { "questions": [{ "cluster_id": 0, "kp_id": 0, "type": "", "text": "", "options": [], "correct_answer": "", "explanation": "" }] }',
  },
  {
    role: 'assistant',
    stage: 'screenshot_qa',
    template_text:
      '浣犳槸涓€涓暀鏉愬涔犲姪鎵嬨€傜敤鎴峰湪闃呰 PDF 鏃舵埅鍥句簡涓€娈靛唴瀹瑰苟鎻愰棶銆俓n\n## 鎴浘璇嗗埆鏂囨湰\n{screenshot_text}\n\n## 鐢ㄦ埛闂\n{user_question}\n\n## 涔嬪墠鐨勫璇漒n{conversation_history}\n\n## 瑕佹眰\n鐢ㄤ腑鏂囧洖绛旓紝瑙ｉ噴娓呮锛屽鏋滄秹鍙婂叕寮忚鍐欏嚭瀹屾暣姝ラ銆?',
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
