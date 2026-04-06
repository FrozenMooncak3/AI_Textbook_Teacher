import { NextRequest, NextResponse } from 'next/server'
import { generateText } from 'ai'
import { getModel, timeout } from '@/lib/ai'
import { insert, query, queryOne } from '@/lib/db'
import { logAction } from '@/lib/log'

interface Module {
  id: number
  book_id: number
  title: string
  summary: string
  kp_count: number
}

interface Book {
  raw_text: string | null
  title: string
}

interface LegacyQuestionRow {
  id: number
  module_id: number
  question_text: string
  correct_answer: string | null
  explanation: string | null
}

function toLegacyShape(question: LegacyQuestionRow) {
  return {
    id: question.id,
    module_id: question.module_id,
    type: 'qa',
    prompt: question.question_text,
    answer_key: question.correct_answer ?? '',
    explanation: question.explanation ?? '',
  }
}

// GET /api/modules/[moduleId]/questions - 获取题目，若无则先生成
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ moduleId: string }> }
) {
  const { moduleId } = await params
  const moduleNumericId = Number(moduleId)

  const module_ = await queryOne<Module>(
    'SELECT id, book_id, title, summary, kp_count FROM modules WHERE id = $1',
    [moduleNumericId]
  )

  if (!module_) {
    return NextResponse.json({ error: '模块不存在' }, { status: 404 })
  }

  const existing = await query<LegacyQuestionRow>(
    `
      SELECT id, module_id, question_text, correct_answer, NULL::text AS explanation
      FROM qa_questions
      WHERE module_id = $1
      ORDER BY order_index ASC
    `,
    [moduleNumericId]
  )

  if (existing.length > 0) {
    return NextResponse.json({ questions: existing.map(toLegacyShape) })
  }

  const book = await queryOne<Book>(
    'SELECT raw_text, title FROM books WHERE id = $1',
    [module_.book_id]
  )

  if (!book) {
    return NextResponse.json({ error: '教材不存在' }, { status: 404 })
  }

  if (!book.raw_text?.trim()) {
    return NextResponse.json({ error: '教材原文为空，无法生成题目' }, { status: 409 })
  }

  const bookText = book.raw_text.slice(0, 100000)
  const questionCount = Math.max(3, Math.round(module_.kp_count * 0.8))

  const prompt = `你是一位专业的学习设计师，请为以下教材模块出 Q&A 练习题。
教材：${book.title}
模块：${module_.title}
模块概述：${module_.summary}
知识点数量：${module_.kp_count} 个
教材原文：${bookText}

请出 ${questionCount} 道 Q&A 练习题，要求：
1. 覆盖位置类、计算类、C1判断类、C2评估类、定义类等不同知识点类型
2. 计算类题目须先给范例（展示完整计算过程），再给渐进题（提供新数据让学生套用步骤）
3. C2评估类题目须包含至少1个正面信号和1个负面信号
4. 题目难度递进，从基础概念到综合应用

请以严格 JSON 格式返回，不要有任何额外文字：
{
  "questions": [
    {
      "prompt": "题目内容",
      "answer_key": "参考答案",
      "explanation": "解析"
    }
  ]
}`

  const { text } = await generateText({
    model: getModel(),
    maxOutputTokens: 8192,
    prompt,
    abortSignal: AbortSignal.timeout(timeout),
  })

  let parsed: { questions: Array<{ prompt: string; answer_key: string; explanation: string }> }
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('未找到 JSON')
    }

    parsed = JSON.parse(jsonMatch[0]) as {
      questions: Array<{ prompt: string; answer_key: string; explanation: string }>
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await logAction('QA出题解析失败', `err=${message} ||| tail=${text.slice(-300)}`, 'error')
    return NextResponse.json({ error: 'Claude 返回内容无法解析' }, { status: 500 })
  }

  for (const [index, question] of parsed.questions.entries()) {
    await insert(
      `
        INSERT INTO qa_questions (
          module_id,
          kp_id,
          question_type,
          question_text,
          correct_answer,
          scaffolding,
          order_index,
          is_review
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, 0)
      `,
      [
        moduleNumericId,
        null,
        'short_answer',
        question.prompt,
        question.answer_key,
        question.explanation,
        index + 1,
      ]
    )
  }

  const questions = await query<LegacyQuestionRow>(
    `
      SELECT id, module_id, question_text, correct_answer, scaffolding AS explanation
      FROM qa_questions
      WHERE module_id = $1
      ORDER BY order_index ASC
    `,
    [moduleNumericId]
  )

  return NextResponse.json({ questions: questions.map(toLegacyShape) })
}
