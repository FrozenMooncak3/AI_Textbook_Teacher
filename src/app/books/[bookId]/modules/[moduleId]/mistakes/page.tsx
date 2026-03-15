import { notFound } from 'next/navigation'
import { getDb } from '@/lib/db'

interface Module {
  id: number
  title: string
  order_index: number
}

interface Book {
  id: number
  title: string
}

interface Mistake {
  id: number
  knowledge_point: string
  next_review_date: string
  prompt: string
  answer_key: string
  explanation: string
  response_text: string
  score: number | null
  error_type: string | null
}

const REMEDIATION: Record<string, { label: string; advice: string }> = {
  知识盲点: {
    label: '知识盲点',
    advice: '你完全不知道这个概念。建议：回到原文重读对应章节，然后用自己的话把概念写下来，再重做这道题。',
  },
  程序性失误: {
    label: '程序性失误',
    advice: '你懂原理，但执行步骤时出了错。建议：口述完整步骤一遍，找出卡住的那个环节，针对性地做同类题 2-3 道。',
  },
  粗心错误: {
    label: '粗心错误',
    advice: '偶发性失误，非系统性问题。建议：标记这道题，继续前进。下次复习时注意审题细节。',
  },
  概念混淆: {
    label: '概念混淆',
    advice: '你把 A 误认为 B。建议：制作一张对比表，列出两个概念的定义、区别和适用场景，然后针对性地出 2 道区分题。',
  },
}

export default async function MistakesPage({
  params,
}: {
  params: Promise<{ bookId: string; moduleId: string }>
}) {
  const { bookId, moduleId } = await params
  const db = getDb()

  const book = db
    .prepare('SELECT id, title FROM books WHERE id = ?')
    .get(Number(bookId)) as Book | undefined

  if (!book) notFound()

  const module_ = db
    .prepare('SELECT id, title, order_index FROM modules WHERE id = ? AND book_id = ?')
    .get(Number(moduleId), Number(bookId)) as Module | undefined

  if (!module_) notFound()

  const mistakes = db
    .prepare(`
      SELECT
        m.id, m.knowledge_point, m.next_review_date,
        q.prompt, q.answer_key, q.explanation,
        ur.response_text, ur.score, ur.error_type
      FROM mistakes m
      JOIN questions q ON m.question_id = q.id
      LEFT JOIN user_responses ur ON ur.question_id = q.id
      WHERE m.module_id = ?
      ORDER BY m.id DESC
    `)
    .all(Number(moduleId)) as Mistake[]

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-10">
        {/* 面包屑 */}
        <div className="flex items-center gap-2 text-xs text-gray-400 mb-6">
          <a href={`/books/${bookId}`} className="hover:text-gray-600 transition-colors">
            {book.title}
          </a>
          <span>/</span>
          <span className="text-gray-600">模块 {module_.order_index} 错题诊断</span>
        </div>

        <div className="mb-6">
          <h1 className="text-xl font-semibold text-gray-900 mb-1">{module_.title}</h1>
          <p className="text-sm text-gray-500">共 {mistakes.length} 道错题</p>
        </div>

        {mistakes.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center">
            <p className="text-green-600 font-medium mb-1">没有错题记录</p>
            <p className="text-sm text-gray-400">本模块暂无需要补救的题目。</p>
          </div>
        ) : (
          <div className="space-y-4">
            {mistakes.map((m, i) => {
              const remediation = m.error_type ? REMEDIATION[m.error_type] : null
              return (
                <div key={m.id} className="bg-white rounded-xl border border-gray-200 p-5">
                  {/* 题目头部 */}
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs text-gray-400">错题 {i + 1}</span>
                    <div className="flex items-center gap-2">
                      {m.error_type && (
                        <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full">
                          {m.error_type}
                        </span>
                      )}
                      <span className="text-xs text-gray-400">
                        复习日期：{m.next_review_date}
                      </span>
                    </div>
                  </div>

                  {/* 题目 */}
                  <p className="text-sm font-medium text-gray-900 mb-3 whitespace-pre-wrap">
                    {m.prompt}
                  </p>

                  {/* 你的回答 */}
                  {m.response_text && (
                    <div className="bg-gray-50 rounded-lg px-3 py-2 mb-2">
                      <p className="text-xs text-gray-400 mb-0.5">你的回答</p>
                      <p className="text-sm text-gray-700">{m.response_text}</p>
                    </div>
                  )}

                  {/* 参考答案 */}
                  <div className="bg-blue-50 rounded-lg px-3 py-2 mb-3">
                    <p className="text-xs text-blue-500 mb-0.5">参考答案</p>
                    <p className="text-sm text-blue-900 whitespace-pre-wrap">{m.answer_key}</p>
                  </div>

                  {/* 补救建议 */}
                  {remediation && (
                    <div className="bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                      <p className="text-xs font-semibold text-amber-700 mb-1">
                        补救方案 · {remediation.label}
                      </p>
                      <p className="text-sm text-amber-800">{remediation.advice}</p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        <div className="mt-8">
          <a
            href={`/books/${bookId}`}
            className="block w-full text-center bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-lg text-sm transition-colors"
          >
            返回模块地图
          </a>
        </div>
      </div>
    </main>
  )
}
