'use client'

import { useState, useEffect } from 'react'

interface Question {
  id: number
  prompt: string
  answer_key: string
  explanation: string
}

interface Evaluation {
  id: number
  prompt: string
  answer_key: string
  explanation: string
  response_text: string
  score: number
  error_type: string | null
  feedback: string
}

type Stage = 'loading' | 'answering' | 'evaluating' | 'results' | 'error'

export default function QASession({
  moduleId,
  moduleTitle,
  bookId,
  onComplete,
}: {
  moduleId: number
  moduleTitle: string
  bookId: number
  onComplete?: () => void
}) {
  const [stage, setStage] = useState<Stage>('loading')
  const [questions, setQuestions] = useState<Question[]>([])
  const [currentIdx, setCurrentIdx] = useState(0)
  const [answers, setAnswers] = useState<Record<number, string>>({}) // questionId → answer
  const [currentAnswer, setCurrentAnswer] = useState('')
  const [evaluations, setEvaluations] = useState<Evaluation[]>([])
  const [errorMsg, setErrorMsg] = useState('')

  // 加载题目
  useEffect(() => {
    fetch(`/api/modules/${moduleId}/questions`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) { setErrorMsg(data.error); setStage('error'); return }
        setQuestions(data.questions)
        setStage('answering')
      })
      .catch(() => { setErrorMsg('加载题目失败，请刷新重试'); setStage('error') })
  }, [moduleId])

  async function handleNext() {
    if (!currentAnswer.trim()) return

    const question = questions[currentIdx]

    // 保存回答
    const res = await fetch(`/api/qa/${question.id}/respond`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ response_text: currentAnswer.trim() }),
    })
    if (!res.ok) {
      const data = await res.json()
      setErrorMsg(data.error ?? '保存失败')
      return
    }

    const newAnswers = { ...answers, [question.id]: currentAnswer.trim() }
    setAnswers(newAnswers)
    setCurrentAnswer('')

    const isLast = currentIdx === questions.length - 1
    if (isLast) {
      // 全部答完，开始评分
      setStage('evaluating')
      const evalRes = await fetch(`/api/modules/${moduleId}/evaluate`, { method: 'POST' })
      const evalData = await evalRes.json()
      if (!evalRes.ok) { setErrorMsg(evalData.error ?? '评分失败'); setStage('error'); return }
      setEvaluations(evalData.evaluations)
      setStage('results')
    } else {
      setCurrentIdx(currentIdx + 1)
    }
  }

  // ── 加载中 ───────────────────────────────────────────────
  if (stage === 'loading') {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center">
        <p className="text-sm text-gray-500">AI 正在出题，请稍候...</p>
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

  // ── AI 评分中 ─────────────────────────────────────────────
  if (stage === 'evaluating') {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center">
        <p className="text-sm text-gray-500">AI 正在逐题评分，请稍候...</p>
      </div>
    )
  }

  // ── 评分结果 ──────────────────────────────────────────────
  if (stage === 'results') {
    const totalScore = evaluations.reduce((s, e) => s + (e.score ?? 0), 0)
    const maxScore = evaluations.length * 10
    const pct = Math.round((totalScore / maxScore) * 100)

    return (
      <div>
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-1">{moduleTitle} — Q&A 结果</h2>
          <div className="flex items-center gap-3 mt-3">
            <span className={`text-2xl font-bold ${pct >= 80 ? 'text-green-600' : 'text-amber-600'}`}>
              {pct}%
            </span>
            <span className="text-sm text-gray-400">
              {totalScore} / {maxScore} 分
            </span>
          </div>
        </div>

        <div className="space-y-4 mb-8">
          {evaluations.map((ev, i) => (
            <div key={ev.id} className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-start justify-between gap-4 mb-3">
                <p className="text-xs font-medium text-gray-400">第 {i + 1} 题</p>
                <span className={`text-sm font-bold ${ev.score >= 8 ? 'text-green-600' : ev.score >= 5 ? 'text-amber-600' : 'text-red-500'}`}>
                  {ev.score} / 10
                </span>
              </div>

              <p className="text-sm font-medium text-gray-900 mb-3">{ev.prompt}</p>

              <div className="bg-gray-50 rounded-lg px-3 py-2 mb-3">
                <p className="text-xs text-gray-400 mb-1">你的回答</p>
                <p className="text-sm text-gray-700">{ev.response_text}</p>
              </div>

              <div className="bg-blue-50 rounded-lg px-3 py-2 mb-3">
                <p className="text-xs text-blue-500 mb-1">AI 评价</p>
                <p className="text-sm text-blue-900">{ev.feedback}</p>
              </div>

              {ev.error_type && (
                <div className="bg-amber-50 rounded-lg px-3 py-2 mb-3">
                  <p className="text-xs text-amber-600 mb-1">错误类型</p>
                  <p className="text-sm text-amber-800">{ev.error_type}</p>
                </div>
              )}

              <div className="border-t border-gray-100 pt-3 mt-3">
                <p className="text-xs text-gray-400 mb-1">参考答案</p>
                <p className="text-sm text-gray-600">{ev.answer_key}</p>
              </div>
            </div>
          ))}
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
  const question = questions[currentIdx]
  const progress = `${currentIdx + 1} / ${questions.length}`

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-gray-900">{moduleTitle}</h2>
        <span className="text-sm text-gray-400">{progress}</span>
      </div>

      {/* 进度条 */}
      <div className="w-full bg-gray-100 rounded-full h-1.5 mb-8">
        <div
          className="bg-blue-500 h-1.5 rounded-full transition-all"
          style={{ width: `${((currentIdx) / questions.length) * 100}%` }}
        />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-4">
        <p className="text-xs text-gray-400 mb-2">第 {currentIdx + 1} 题</p>
        <p className="text-sm text-gray-900 leading-relaxed whitespace-pre-wrap">{question.prompt}</p>
      </div>

      {errorMsg && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-3">{errorMsg}</p>
      )}

      <textarea
        value={currentAnswer}
        onChange={(e) => { setCurrentAnswer(e.target.value); setErrorMsg('') }}
        placeholder="在这里输入你的回答..."
        rows={5}
        className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none mb-4"
      />

      <button
        onClick={handleNext}
        disabled={!currentAnswer.trim()}
        className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-200 text-white font-medium py-2.5 rounded-lg text-sm transition-colors"
      >
        {currentIdx === questions.length - 1 ? '提交全部，查看评分' : '下一题 →'}
      </button>

      <p className="text-xs text-center text-gray-400 mt-3">已答题目不可修改</p>
    </div>
  )
}
