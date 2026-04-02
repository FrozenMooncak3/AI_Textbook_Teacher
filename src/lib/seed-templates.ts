import { getDb } from './db'

interface TemplateSeed {
  role: string
  stage: string
  template_text: string
}

const SEED_TEMPLATES: TemplateSeed[] = [
  {
    role: 'extractor',
    stage: 'structure_scan',
    template_text: `浣犳槸涓€涓暀鏉愮煡璇嗙偣鎻愬彇涓撳銆?
## 浠诲姟
瀵逛互涓嬫暀鏉?OCR 鏂囨湰杩涜缁撴瀯鎵弿銆傝瘑鍒墍鏈夊皬鑺傛爣棰樸€佽鍙疯寖鍥达紝骞跺缓璁ā鍧楀垎缁勩€?
## 鎵弿瑙勫垯
1. 璇嗗埆鎵€鏈変簩绾у拰涓夌骇鏍囬锛堥€氬父鏄?X.X 鎴?X.X.X 缂栧彿锛屾垨鍔犵矖/澶у啓鐨勬爣棰樿锛?
2. 鏍囨敞姣忎釜灏忚妭鐨勮捣濮嬭鍙峰拰缁撴潫琛屽彿
3. 浼拌姣忎釜灏忚妭鐨勭煡璇嗙偣鏁伴噺锛?5-15 涓?10 椤垫槸姝ｅ父瀵嗗害
4. 灏嗗皬鑺傚垎缁勪负瀛︿範妯″潡锛岀‘淇濓細
   - 姣忎釜妯″潡瑕嗙洊涓€涓畬鏁翠富棰?
   - 妯″潡闂?KP 鏁伴噺宸窛涓嶈秴杩?2:1
   - 妯″潡杈圭晫瀵归綈灏忚妭杈圭晫锛堜笉鍦ㄥ皬鑺備腑闂村垏鍓诧級
5. 蹇界暐鐩綍椤点€佺増鏉冮〉銆佺储寮曢〉绛夐潪姝ｆ枃鍐呭
6. 鏂囨湰涓殑 "--- PAGE N ---" 鏍囪琛ㄧず PDF 绗?N 椤电殑寮€濮嬶紝鐢ㄦ潵纭畾 page_start 鍜?page_end

## 鏂囨湰锛堝惈琛屽彿锛?{ocr_text}

## 杈撳嚭瑕佹眰
杩斿洖涓ユ牸 JSON锛屼笉瑕佹湁浠讳綍棰濆鏂囧瓧銆俻age_start/page_end 浠?"--- PAGE N ---" 鏍囪涓彁鍙栵紝濡傛灉娌℃湁鏍囪鍒欏～ null锛?
{
  "sections": [
    {
      "title": "灏忚妭鏍囬",
      "line_start": 0,
      "line_end": 0,
      "page_start": 1,
      "page_end": 3,
      "estimated_kp_count": 0,
      "module_group": 1
    }
  ],
  "modules": [
    {
      "group_id": 1,
      "title": "妯″潡鍚嶇О锛堟鎷富棰橈紝涓嶆槸灏忚妭鍚嶆嫾鎺ワ級",
      "sections": ["灏忚妭鏍囬1", "灏忚妭鏍囬2"],
      "estimated_total_kp": 0,
      "page_start": 1,
      "page_end": 5
    }
  ]
}`,
  },
  {
    role: 'extractor',
    stage: 'kp_extraction',
    template_text: `You are a textbook knowledge point extraction expert.

## Task
Extract knowledge points (KPs) from the block below.

## Rules
- Return strict JSON only. No markdown, no explanation.
- The entire response must be valid JSON.
- Escape every double quote inside string values as \".
- Do not use unescaped double quotes inside any string.
- Keep each KP self-contained and concise.
- If a source sentence contains quoted terms, rewrite them without raw quotes or escape them.

### 1. Content categories
- Technical content: definitions, formulas, rules, judgments -> separate KP.
- Example/case detail -> fold into the previous KP's detailed_content.
- Narrative/background -> keep only the governing rule or principle.

### 2. KP granularity
- Too broad -> split into multiple KPs.
- Too narrow -> merge into the previous KP if the point only makes sense in context.
- Ask: would this still be valid if applied to a different company or scenario?

### 3. KP types
- position
- calculation
- c1_judgment
- c2_evaluation
- definition

### 4. detailed_content
- Must be self-contained.
- Must be specific enough to answer a question.
- Calculations must include formulas, steps, units, and assumptions.
- C2 evaluation must mention both sides of the contradiction.
- If the source is incomplete, annotate with [OCR incomplete].

### 5. Cross-block risk
If the block appears unfinished, set cross_block_risk = true.

## Section
{section_name}

## Block
{text_block}

## Previous tail
{previous_block_tail}

## Output
Return strict JSON only, with no extra text:
{
  "knowledge_points": [
    {
      "kp_code": "section-01",
      "section_name": "section name",
      "description": "one-sentence description",
      "type": "position|calculation|c1_judgment|c2_evaluation|definition",
      "importance": 1,
      "detailed_content": "complete evidence-based content with escaped quotes like \"fixed asset\"",
      "cross_block_risk": false,
      "ocr_quality": "good|uncertain|damaged"
    }
  ]
}`,
  },
  {
    role: 'extractor',
    stage: 'quality_check',
    template_text: `浣犳槸涓€涓煡璇嗙偣璐ㄩ噺瀹℃牳涓撳銆?
## 浠诲姟
瀹℃牳 KP 鎻愬彇缁撴灉锛屾墽琛岃法鍧楃紳鍚堛€佸幓閲嶃€佽仛绫汇€佹ā鍧楀垎閰嶅拰璐ㄩ噺闂ㄦ鏌ャ€?

## 瀹℃牳姝ラ

### 1. 璺ㄥ潡缂濆悎
- 鎵惧埌鎵€鏈?cross_block_risk = true 鐨?KP
- 濡傛灉涓嬩竴涓?KP 鏄画鎺ュ唴瀹癸紙鎻忚堪鐩镐技銆佸悓涓€涓婚锛夛紝鍚堝苟涓轰竴涓?KP
- 鍚堝苟鍚庣殑 kp_code 鐢ㄥ墠涓€涓?

### 2. 鍘婚噸
- 涓や釜 KP 鐨?鑰冩硶"瀹屽叏鐩稿悓锛堣兘鍑虹殑棰樹竴妯′竴鏍凤級鈫?鍚堝苟锛屼繚鐣?detailed_content 鏇磋缁嗙殑

### 3. 鑱氱被
- 涓婚鐩歌繎鐨?KP 褰掑叆鍚屼竴鑱氱被锛坈luster锛?
- 姣忎釜鑱氱被 2-5 涓?KP
- 鑱氱被鍚嶇О鐢?2-4 涓瓧姒傛嫭涓婚

### 4. 妯″潡鍒嗛厤
鏍规嵁浠ヤ笅妯″潡缁撴瀯锛屽皢姣忎釜 KP 鍒嗛厤鍒板搴?module_group锛?{module_structure}

### 5. 璐ㄩ噺闂紙閫愭潯妫€鏌ワ紝鍏ㄩ儴閫氳繃鎵嶅悎鏍硷級
1. 姣忎釜灏忚妭鑷冲皯鏈?1 涓?KP
2. 璁＄畻绫?KP 鍏ㄩ儴鍖呭惈瀹屾暣鍏紡鍜屾楠?
3. C2 璇勪及绫?KP 鍏ㄩ儴鍖呭惈鐭涚浘淇″彿锛堟鍙弽涓ら潰锛?
4. 娌℃湁"澶"KP锛坉escription 瓒呰繃 25 瀛椾笖鍚涓嫭绔嬫蹇?鈫?闇€鎷嗗垎锛?
5. OCR 鎹熷潖鍖哄煙宸叉爣娉?ocr_quality = "damaged" 鎴?"uncertain"
6. 鎵€鏈?cross_block_risk KP 宸插鐞嗭紙鍚堝苟鎴栫‘璁ょ嫭绔嬶級
7. 妯″潡闂?KP 鏁伴噺姣斾緥 鈮?2:1

## 鍘熸 KP 鍒楄〃
{kp_table}

## 杈撳嚭瑕佹眰
杩斿洖涓ユ牸 JSON锛屼笉瑕佹湁浠讳綍棰濆鏂囧瓧锛?
{
  "quality_gates": {
    "all_sections_have_kp": true,
    "calculation_kp_complete": true,
    "c2_kp_have_signals": true,
    "no_too_wide_kp": true,
    "ocr_damaged_marked": true,
    "cross_block_merged": true,
    "module_ratio_ok": true
  },
  "issues": [
    {
      "kp_code": "2.3-01",
      "issue": "闂鎻忚堪",
      "suggestion": "淇寤鸿"
    }
  ],
  "final_knowledge_points": [
    {
      "kp_code": "2.3-01",
      "module_group": 1,
      "cluster_name": "鑱氱被鍚?",
      "section_name": "鎵€灞炲皬鑺?",
      "description": "涓€鍙ヨ瘽鎻忚堪",
      "type": "position|calculation|c1_judgment|c2_evaluation|definition",
      "importance": 1,
      "detailed_content": "瀹屾暣鑷冻鍐呭",
      "ocr_quality": "good|uncertain|damaged"
    }
  ],
  "clusters": [
    {
      "module_group": 1,
      "name": "鑱氱被鍚?",
      "kp_codes": ["2.3-01", "2.3-02"]
    }
  ]
}`,
  },
  {
    role: 'coach',
    stage: 'pre_reading_guide',
    template_text: '浣犳槸涓€涓涔犳暀缁冦€俓n\n## 浠诲姟\n涓轰互涓嬫ā鍧楃敓鎴愯鍓嶆寚寮曘€俓n\n## 鏈ā鍧楃煡璇嗙偣\n{kp_table}\n\n## 璺ㄦā鍧椾緷璧朶n{dependencies}\n\n## 杈撳嚭瑕佹眰\n杩斿洖 JSON: { "can_do_after": "", "key_points": [], "common_pitfalls": [] }',
  },
  {
    role: 'coach',
    stage: 'qa_generation',
    template_text: '浣犳槸涓€涓暀鏉愬涔犳暀缁冦€俓n\n## 浠诲姟\n鏍规嵁鐭ヨ瘑鐐硅〃鍑?Q&A 缁冧範棰樸€俓n\n## Q&A 瑙勫垯\n{qa_rules}\n\n## 鏈ā鍧楃煡璇嗙偣\n{kp_table}\n\n## 鐢ㄦ埛闃呰绗旇\n{user_notes}\n\n## 鐢ㄦ埛鎴浘闂瓟璁板綍\n{user_qa_history}\n\n## 鍘嗗彶閿欓\n{past_mistakes}\n\n## 杈撳嚭瑕佹眰\n杩斿洖 JSON: { "questions": [{ "kp_id": 0, "type": "", "text": "", "correct_answer": "", "scaffolding": "" }] }',
  },
  {
    role: 'coach',
    stage: 'qa_feedback',
    template_text: '浣犳槸涓€涓涔犳暀缁冦€俓n\n## 浠诲姟\n璇勪及瀛︾敓鍥炵瓟骞剁粰鍑哄嵆鏃跺弽棣堛€俓n\n## 棰樼洰\n{question}\n\n## 姝ｇ‘绛旀\n{correct_answer}\n\n## 瀛︾敓鍥炵瓟\n{user_answer}\n\n## 瀵瑰簲鐭ヨ瘑鐐筡n{kp_detail}\n\n## 杈撳嚭瑕佹眰\n杩斿洖 JSON: { "is_correct": true, "score": 0, "feedback": "" }',
  },
  {
    role: 'coach',
    stage: 'note_generation',
    template_text: '浣犳槸涓€涓涔犵瑪璁扮敓鎴愪笓瀹躲€俓n\n## 浠诲姟\n鏁村悎浠ヤ笅淇℃伅鐢熸垚妯″潡瀛︿範绗旇銆俓n\n## 鐭ヨ瘑鐐硅〃\n{kp_table}\n\n## 鐢ㄦ埛闃呰绗旇\n{user_notes}\n\n## Q&A 缁撴灉\n{qa_results}\n\n## 杈撳嚭瑕佹眰\n杩斿洖 Markdown 鏍煎紡鐨勫涔犵瑪璁般€?',
  },
  {
    role: 'examiner',
    stage: 'test_generation',
    template_text: `你是一位考试出题专家。

## 任务
根据知识点表出模块测试题。出题的同时生成正确答案和解析。

## 覆盖规则
- 所有 KP 必须被至少 1 道题覆盖
- 上限 10 题，通过合并相关 KP 到同一题控制题量
- 下限 5 题
- 每道题标注覆盖的 kp_ids（数组）

## 题型分配
- 单选题 → C1 判断类 + 定义类 KP（1-2 KP/题，4 选项 A/B/C/D）
- C2 评估题 → C2 评估类 KP（2-3 KP/题，开放作答，必须含矛盾信号：至少 1 个正面 + 1 个负面）
- 计算题 → 计算类 KP（1-2 KP/题，虚构数据，多步计算，至少 1 道逆向计算）
- 思考题 → 综合跨类 KP（3-4 KP/题，给完整 mini 案例）

## 出题质量自检（内部执行，不输出）
- 单选题答案字母分布：4 题以上时 A/B/C/D 大致均匀，任一字母不超过 40%
- 正确答案不得是最长选项
- 错误选项来自真实认知误区（混淆概念、遗漏条件、因果倒置、程度错误、半对半错）
- C2 题 4 个选项对应 4 种不同的权衡结论，正确选项只给结论不展开分析机制
- 计算题数据自洽（出完后验算所有数字）
- 不用原文原数字原名字，必须 paraphrase
- 避免绝对词（"一定""绝对""所有"）

## 历史错题（优先覆盖这些 KP）
{past_mistakes}

## 本模块知识点
{kp_table}

## 输出要求
返回严格 JSON，不要有任何额外文字：
{
  "questions": [
    {
      "kp_ids": [1, 2],
      "type": "single_choice",
      "text": "题目文本",
      "options": ["A. 选项A", "B. 选项B", "C. 选项C", "D. 选项D"],
      "correct_answer": "B",
      "explanation": "解析：为什么B正确..."
    },
    {
      "kp_ids": [3],
      "type": "calculation",
      "text": "计算题题目（含完整数据）",
      "options": null,
      "correct_answer": "完整计算步骤和结果",
      "explanation": "考察知识点和关键步骤"
    }
  ]
}

type 只能是：single_choice, c2_evaluation, calculation, essay
单选题 options 为 4 个字符串数组，其他题型 options 为 null
单选题 correct_answer 为单个字母（A/B/C/D），其他题型为完整答案文本

## 用户可见性规则
- 题目文本、选项、correct_answer、explanation 都会直接展示给用户
- 禁止在这些字段中引用知识点编号（如"KP-01""KP-s05-04"），用具体的知识点名称或内容替代
- correct_answer 中如有计算步骤，用清晰的换行和缩进排版，不要用 Markdown 格式符号（如 ** 加粗）`,
  },
  {
    role: 'examiner',
    stage: 'test_scoring',
    template_text: `你是一位考试评分专家。

## 任务
评估学生的主观题答案，并对所有错题（含已由系统判分的单选题）进行错误类型诊断。

## 评分标准
- 你只需要对主观题评分，单选题已由系统自动判分
- 计算题（满分 5 分）：过程和结果都对 → 5 分；过程对结果错 → 2-3 分；过程错 → 0 分
- 思考题（满分 10 分）：按分析深度、逻辑完整性和覆盖 KP 数量分段给分
- C2 评估题（满分 5 分）：结论合理+分析到位 → 5 分；结论对但分析不完整 → 2-3 分；结论错 → 0-1 分

## 错误诊断（所有错题必填 error_type）
- blind_spot：完全不知道概念（答案与正确方向完全无关）
- procedural：懂原理但步骤错（方向对但执行出错）
- confusion：把 A 误认为 B（混淆了两个相近概念）
- careless：偶发失误，非系统性（如计算笔误、选错选项但解释正确）

## 试卷和答案
{test_paper}

## 单选题已判结果（仅供诊断用，不需要重新评分）
{mc_results}

## 输出要求
返回严格 JSON，不要有任何额外文字：
{
  "results": [
    {
      "question_id": 1,
      "is_correct": false,
      "score": 3,
      "feedback": "你的分析方向正确，但忽略了...",
      "error_type": "procedural",
      "remediation": "建议回去重做该 KP 的 Q&A worked example，重点练习..."
    }
  ]
}

注意：
- 对主观题：返回 is_correct, score, feedback, error_type, remediation
- 对已判分的单选错题：只返回 error_type, feedback, remediation（score 和 is_correct 已由系统确定）
- 正确的题目不需要返回

## 用户可见性规则
- feedback 和 remediation 会直接展示给用户
- 禁止在这些字段中引用知识点编号（如"KP-01""KP-s05-04"），用具体的知识点名称或内容替代`,
  },
  {
    role: 'reviewer',
    stage: 'review_generation',
    template_text: `你是一位复习出题专家。
## 任务
根据聚类和 P 值出复习题。P 值越低，说明学生对该聚类掌握越差，需要出更多题。

## 复习规则
{review_rules}

## 聚类及 P 值
{clusters_with_p}

## 对应知识点
{kp_table}

## 历史错题
{past_mistakes}

## 出题策略
- P=1（薄弱）：出 3 题，优先覆盖历史错题对应的 KP
- P=2（一般）：出 2 题
- P>=3（掌握较好）：出 1 题
- 历史错题对应的 KP 必须优先覆盖
- 题型参照考试题型：单选题、计算题、思考题、C2 评价题
- 题目难度与原始测试持平，不刻意提高或降低

## 质量自检（内部执行，不输出）
- 所有 P<=2 的 cluster 都被覆盖
- 历史错题对应的 KP 都出了题
- 题目不与最近一轮复习重复（如有 {recent_questions}）

## 输出要求
返回严格 JSON，不要有任何额外文字：
{
  "questions": [
    {
      "cluster_id": 0,
      "kp_id": 0,
      "type": "multiple_choice|calculation|essay|c2_evaluation",
      "text": "题目文本",
      "options": ["A. ...", "B. ...", "C. ...", "D. ..."],
      "correct_answer": "正确答案",
      "explanation": "解析"
    }
  ]
}`,
  },
  {
    role: 'assistant',
    stage: 'screenshot_qa',
    template_text: '浣犳槸涓€涓暀鏉愬涔犲姪鎵嬨€傜敤鎴峰湪闃呰 PDF 鏃舵埅鍥句簡涓€娈靛唴瀹瑰苟鎻愰棶銆俓n\n## 鎴浘璇嗗埆鏂囨湰\n{screenshot_text}\n\n## 鐢ㄦ埛闂\n{user_question}\n\n## 涔嬪墠鐨勫璇?n{conversation_history}\n\n## 瑕佹眰\n鐢ㄤ腑鏂囧洖绛旓紝瑙ｉ噴娓呮锛屽鏋滄秹鍙婂叕寮忚鍐欏嚭瀹屾暣姝ラ銆?',
  },
]

const COACH_PRE_READING_GUIDE_TEMPLATE = `你是一个学习教练。

## 任务
为以下模块生成读前指引。

## 本模块知识点
{kp_table}

## 跨模块依赖
{dependencies}

## 输出要求
返回严格 JSON，不要有任何额外文字：
{
  "goal": "学完这个模块能做什么——用一个具体的判断场景描述，1-2句话",
  "focus_points": ["重点1", "重点2", "重点3"],
  "common_mistakes": ["容易混淆的地方1", "容易混淆的地方2"]
}`

const preReadingGuideTemplate = SEED_TEMPLATES.find(
  (template) => template.role === 'coach' && template.stage === 'pre_reading_guide'
)

if (preReadingGuideTemplate) {
  preReadingGuideTemplate.template_text = COACH_PRE_READING_GUIDE_TEMPLATE
}

export function seedTemplates(): void {
  const db = getDb()
  const existing = db
    .prepare('SELECT COUNT(*) as count FROM prompt_templates')
    .get() as { count: number }

  if (existing.count === 0) {
    const insert = db.prepare(
      'INSERT INTO prompt_templates (role, stage, version, template_text, is_active) VALUES (?, ?, 1, ?, 1)'
    )

    const tx = db.transaction(() => {
      for (const t of SEED_TEMPLATES) {
        insert.run(t.role, t.stage, t.template_text)
      }
    })
    tx()
    return
  }

  const upsert = db.prepare(`
    INSERT INTO prompt_templates (role, stage, version, template_text, is_active)
    VALUES (?, ?, 1, ?, 1)
    ON CONFLICT(role, stage, version) DO UPDATE SET template_text = excluded.template_text
  `)

  const tx = db.transaction(() => {
    for (const t of SEED_TEMPLATES) {
      if (t.role === 'extractor') {
        upsert.run(t.role, t.stage, t.template_text)
      }
    }

    for (const t of SEED_TEMPLATES) {
      if (t.role === 'coach') {
        upsert.run(t.role, t.stage, t.template_text)
      }
    }

    for (const t of SEED_TEMPLATES) {
      if (t.role === 'examiner') {
        upsert.run(t.role, t.stage, t.template_text)
      }
    }

    for (const t of SEED_TEMPLATES) {
      if (t.role === 'reviewer') {
        upsert.run(t.role, t.stage, t.template_text)
      }
    }
  })
  tx()
}
