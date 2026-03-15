'use client'

import { useState, useEffect } from 'react'

interface Question {
  id: number
  prompt: string
  answer_key: string
  explanation: string
}

interface TestResult {
  id: number
  prompt: string
  answer_key: string
  response_text: string
  score: number
  error_type: string | null
  feedback: string
}

type Stage = 'reminder' | 'loading' | 'answering' | 'submitting' | 'results' | 'error'

const isMC = (q: Question) => /^[ABCD]$/.test(q.answer_key.trim())

export default function TestSession({
  moduleId,
  moduleTitle,
  bookId,
  alreadyPassed,
}: {
  moduleId: number
  moduleTitle: string
  bookId: number
  alreadyPassed: boolean
}) {
  const [stage, setStage] = useState<Stage>(alreadyPassed ? 'results' : 'reminder')
  const [questions, setQuestions] = useState<Question[]>([])
  const [answers, setAnswers] = useState<Record<number, string>>({})
  const [results, setResults] = useState<TestResult[]>([])
  const [passed, setPassed] = useState(false)
  const [mcRate, setMcRate] = useState(0)
  const [errorMsg, setErrorMsg] = useState('')

  async function loadQuestions() {
    setStage('loading')
    const res = await fetch(`/api/modules/${moduleId}/test-questions`)
    const data = await res.json()
    if (!res.ok) { setErrorMsg(data.error ?? '加载失败'); setStage('error'); return }
    setQuestions(data.questions)
    setStage('answering')
  }

  async function handleSubmit() {
    // 检查全部已答
    const unanswered = questions.filter((q) => !answers[q.id]?.trim())
    if (unanswered.length > 0) {
      setErrorMsg(`还有 ${unanswered.length} 道题未作答`)
      return
    }

    setStage('submitting')
    const answerList = questions.map((q) => ({
      question_id: q.id,
      response_text: answers[q.id] ?? '',
    }))

    const res = await fetch(`/api/modules/${moduleId}/test-evaluate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answers: answerList }),
    })
    const data = await res.json()
    if (!res.ok) { setErrorMsg(data.error ?? '评分失败'); setStage('error'); return }

    setResults(data.results)
    setPassed(data.passed)
    setMcRate(data.mc_rate)
    setStage('results')
  }

  // 已过关时重新加载结果
  useEffect(() => {
    if (alreadyPassed && stage === 'results') {
      fetch(`/api/modules/${moduleId}/test-questions`)
        .then((r) => r.json())
        .then((data) => setQuestions(data.questions))
    }
  }, [alreadyPassed, moduleId, stage])

  // ── 软性提醒 ──────────────────────────────────────────────
  if (stage === 'reminder') {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 p-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">{moduleTitle} — 模块测试</h2>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 my-6">
          <p className="text-sm text-amber-800 font-medium mb-1">建议隔夜再做</p>
          <p className="text-xs text-amber-700">
            间隔效应表明，睡一觉后再测试，记忆会更牢固。如果刚刚完成 Q&A，建议明天再来。
          </p>
        </div>
        <div className="bg-gray-50 rounded-xl p-4 mb-6 text-xs text-gray-600 space-y-1">
          <p className="font-medium text-gray-700 mb-2">测试须知</p>
          <p>• 独立作答，不得查看笔记和 Q&A 记录</p>
          <p>• 单选题正确率 ≥ 80% 才算过关</p>
          <p>• 未过关须补救后重新测试</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={loadQuestions}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-lg text-sm transition-colors"
          >
            现在做
          </button>
          <a
            href={`/books/${bookId}`}
            className="flex-1 text-center border border-gray-300 hover:bg-gray-50 text-gray-700 font-medium py-2.5 rounded-lg text-sm transition-colors"
          >
            明天再来
          </a>
        </div>
      </div>
    )
  }

  // ── 加载 / 提交中 ─────────────────────────────────────────
  if (stage === 'loading' || stage === 'submitting') {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center">
        <p className="text-sm text-gray-500">
          {stage === 'loading' ? 'AI 正在出题，请稍候...' : 'AI 正在评分，请稍候...'}
        </p>
      </div>
    )
  }

  // ── 错误 ─────────────────────────────────────────────────
  if (stage === 'error') {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center">
        <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{errorMsg}</p>
      </div>
    )
  }

  // ── 测试结果 ──────────────────────────────────────────────
  if (stage === 'results') {
    const totalScore = results.reduce((s, r) => s + r.score, 0)
    const maxScore = results.reduce((s, q) => {
      const question = questions.find((qu) => qu.id === q.id)
      if (!question) return s + 5
      return s + (isMC(question) ? 5 : question.prompt.includes('计算') ? 5 : 10)
    }, 0)

    return (
      <div>
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-3">{moduleTitle} — 测试结果</h2>
          <div className={`rounded-xl p-4 ${passed ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-lg font-bold ${passed ? 'text-green-700' : 'text-red-700'}`}>
                  {passed ? '过关' : '未过关'}
                </p>
                <p className={`text-xs mt-0.5 ${passed ? 'text-green-600' : 'text-red-600'}`}>
                  单选题正确率 {mcRate}%（过关线 80%）
                </p>
              </div>
              <p className="text-2xl font-bold text-gray-700">
                {totalScore}<span className="text-sm text-gray-400"> / {maxScore}</span>
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-4 mb-8">
          {results.map((r, i) => {
            const question = questions.find((q) => q.id === r.id)
            const mc = question ? isMC(question) : false
            const maxPts = mc ? 5 : (r.prompt.includes('计算') ? 5 : 10)

            return (
              <div key={r.id} className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-gray-400">第 {i + 1} 题 · {mc ? '单选题' : r.prompt.includes('计算') ? '计算题' : '思考题'}</span>
                  <span className={`text-sm font-bold ${r.score === maxPts ? 'text-green-600' : r.score > 0 ? 'text-amber-600' : 'text-red-500'}`}>
                    {r.score} / {maxPts}
                  </span>
                </div>

                <p className="text-sm text-gray-900 mb-3 whitespace-pre-wrap">{r.prompt}</p>

                <div className="bg-gray-50 rounded-lg px-3 py-2 mb-2">
                  <p className="text-xs text-gray-400 mb-0.5">你的回答</p>
                  <p className="text-sm text-gray-700">{r.response_text}</p>
                </div>

                {r.score < maxPts && (
                  <div className="bg-blue-50 rounded-lg px-3 py-2 mb-2">
                    <p className="text-xs text-blue-500 mb-0.5">AI 评价</p>
                    <p className="text-sm text-blue-900">{r.feedback}</p>
                  </div>
                )}

                {r.error_type && (
                  <div className="bg-amber-50 rounded-lg px-3 py-2 mb-2">
                    <p className="text-xs text-amber-600 mb-0.5">错误类型</p>
                    <p className="text-sm text-amber-800">{r.error_type}</p>
                  </div>
                )}

                {r.score < maxPts && (
                  <div className="border-t border-gray-100 pt-2 mt-2">
                    <p className="text-xs text-gray-400 mb-0.5">参考答案</p>
                    <p className="text-sm text-gray-600 whitespace-pre-wrap">{r.answer_key}</p>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <a
          href={`/books/${bookId}`}
          className="block w-full text-center bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-lg text-sm transition-colors"
        >
          返回模块地图
        </a>
      </div>
    )
  }

  // ── 答题中 ────────────────────────────────────────────────
  const mcQs = questions.filter(isMC)
  const openQs = questions.filter((q) => !isMC(q))

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-lg font-semibold text-gray-900">{moduleTitle} — 测试</h2>
        <span className="text-xs text-gray-400">{questions.length} 题</span>
      </div>
      <p className="text-xs text-gray-400 mb-8">独立作答，不得查看笔记和 Q&A 记录</p>

      {/* 单选题 */}
      {mcQs.length > 0 && (
        <div className="mb-8">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
            单选题（每题 5 分）
          </p>
          <div className="space-y-4">
            {mcQs.map((q, i) => {
              // 从 prompt 中解析选项（格式：题干\n\nA. ...\nB. ...\nC. ...\nD. ...）
              const lines = q.prompt.split('\n')
              const questionText = lines.slice(0, lines.findIndex((l) => l.startsWith('A.'))).join('\n').trim()
              const optionLines = lines.filter((l) => /^[ABCD]\./.test(l))

              return (
                <div key={q.id} className="bg-white rounded-xl border border-gray-200 p-5">
                  <p className="text-xs text-gray-400 mb-2">第 {i + 1} 题</p>
                  <p className="text-sm text-gray-900 mb-4">{questionText}</p>
                  <div className="space-y-2">
                    {optionLines.map((opt) => {
                      const letter = opt[0]
                      return (
                        <label
                          key={letter}
                          className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                            answers[q.id] === letter
                              ? 'border-blue-500 bg-blue-50'
                              : 'border-gray-200 hover:bg-gray-50'
                          }`}
                        >
                          <input
                            type="radio"
                            name={`q_${q.id}`}
                            value={letter}
                            checked={answers[q.id] === letter}
                            onChange={() => setAnswers({ ...answers, [q.id]: letter })}
                            className="mt-0.5 accent-blue-600"
                          />
                          <span className="text-sm text-gray-700">{opt}</span>
                        </label>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* 计算题 + 思考题 */}
      {openQs.length > 0 && (
        <div className="mb-8">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
            计算题 / 思考题
          </p>
          <div className="space-y-4">
            {openQs.map((q, i) => (
              <div key={q.id} className="bg-white rounded-xl border border-gray-200 p-5">
                <p className="text-xs text-gray-400 mb-2">第 {mcQs.length + i + 1} 题</p>
                <p className="text-sm text-gray-900 mb-4 whitespace-pre-wrap">{q.prompt}</p>
                <textarea
                  value={answers[q.id] ?? ''}
                  onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
                  placeholder="在这里输入你的答案..."
                  rows={4}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {errorMsg && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-4">{errorMsg}</p>
      )}

      <button
        onClick={handleSubmit}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-lg text-sm transition-colors"
      >
        提交测试
      </button>
    </div>
  )
}
