'use client'

import { useState, useEffect } from 'react'

// --- Types ---

interface Question {
  id: number
  kp_id: number | null
  question_type: 'worked_example' | 'scaffolded_mc' | 'short_answer' | 'comparison' | string
  question_text: string
  correct_answer: string | null
  scaffolding: string | null
  order_index: number
}

interface Feedback {
  is_correct: boolean
  score: number
  feedback: string
}

const LoadingSpinner = () => (
  <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
)

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
  const [questions, setQuestions] = useState<Question[]>([])
  const [currentIdx, setCurrentIdx] = useState(0)
  const [currentAnswer, setCurrentAnswer] = useState('')
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isGeneratingNotes, setIsGeneratingNotes] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // ── 加载/生成题目 ─────────────────────────────────────────
  useEffect(() => {
    const initQA = async () => {
      setIsLoading(true)
      try {
        const res = await fetch(`/api/modules/${moduleId}/generate-questions`, { method: 'POST' })
        const result = await res.json()
        if (result.success) {
          setQuestions(result.data.questions)
        } else {
          setError(result.error || '无法生成题目')
        }
      } catch {
        setError('加载失败，请检查网络后重试')
      } finally {
        setIsLoading(false)
      }
    }
    initQA()
  }, [moduleId])

  // ── 提交当前题目 ──────────────────────────────────────────
  const handleSubmit = async () => {
    if (!currentAnswer.trim() || isSubmitting) return
    setIsSubmitting(true)
    setError(null)
    try {
      const question = questions[currentIdx]
      const res = await fetch(`/api/modules/${moduleId}/qa-feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionId: question.id, userAnswer: currentAnswer.trim() }),
      })
      const result = await res.json()
      if (result.success) {
        setFeedback(result.data)
      } else {
        setError(result.error || '评分失败')
      }
    } catch {
      setError('无法连接服务器，请稍后重试')
    } finally {
      setIsSubmitting(false)
    }
  }

  // ── 下一题 ──────────────────────────────────────────────
  const handleNext = () => {
    setCurrentAnswer('')
    setFeedback(null)
    setCurrentIdx(currentIdx + 1)
  }

  // ── 生成笔记并完成 ──────────────────────────────────────────
  const handleFinalize = async () => {
    setIsGeneratingNotes(true)
    try {
      const res = await fetch(`/api/modules/${moduleId}/generate-notes`, { method: 'POST' })
      const result = await res.json()
      if (result.success && onComplete) {
        onComplete()
      } else {
        setError(result.error || '无法生成笔记')
      }
    } catch {
      setError('生成笔记失败')
    } finally {
      setIsGeneratingNotes(false)
    }
  }

  // ── 渲染状态处理 ───────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-sm">
        <div className="flex justify-center mb-6">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
        <h3 className="text-xl font-bold text-slate-900 mb-2">AI 正在根据你的笔记出题...</h3>
        <p className="text-slate-500">这通常需要 10-20 秒，请稍候</p>
      </div>
    )
  }

  if (error && questions.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-red-100 p-12 text-center">
        <div className="text-4xl mb-4">⚠️</div>
        <h3 className="text-xl font-bold text-slate-900 mb-4">出题失败</h3>
        <p className="text-red-600 mb-8">{error}</p>
        <button 
          onClick={() => window.location.reload()}
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-xl transition-all"
        >
          重试
        </button>
      </div>
    )
  }

  const question = questions[currentIdx]
  const isLast = currentIdx === questions.length - 1
  const progress = Math.round(((currentIdx) / questions.length) * 100)

  return (
    <div className="space-y-6">
      {/* Header & Progress */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Q&A Phase</span>
            <h2 className="text-xl font-bold text-slate-900">{moduleTitle}</h2>
          </div>
          <div className="text-right">
            <span className="text-sm font-bold text-blue-600">{currentIdx + 1}</span>
            <span className="text-sm text-slate-400"> / {questions.length}</span>
          </div>
        </div>
        <div className="w-full bg-slate-100 rounded-full h-2">
          <div 
            className="bg-blue-600 h-2 rounded-full transition-all duration-500 shadow-sm shadow-blue-200"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Question Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs bg-slate-200 text-slate-600 px-2 py-0.5 rounded font-bold uppercase tracking-tight">
              {question.question_type.replace('_', ' ')}
            </span>
            {question.question_type === 'worked_example' && (
              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded font-bold">范例学习</span>
            )}
          </div>
        </div>
        
        <div className="p-8">
          <p className="text-lg text-slate-900 leading-relaxed font-medium mb-6">
            {question.question_text}
          </p>

          {/* Scaffolding Hint */}
          {question.scaffolding && !feedback && (
            <details className="mb-6 group">
              <summary className="text-sm text-blue-600 font-bold cursor-pointer hover:text-blue-700 list-none flex items-center gap-1">
                <svg className="w-4 h-4 transition-transform group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="19 9l-7 7-7-7" />
                </svg>
                需要一点提示吗？
              </summary>
              <div className="mt-3 p-4 bg-blue-50 rounded-xl text-sm text-blue-800 leading-relaxed border border-blue-100">
                {question.scaffolding}
              </div>
            </details>
          )}

          {/* Answer Input */}
          <div className="space-y-4">
            <textarea 
              value={currentAnswer}
              onChange={(e) => { setCurrentAnswer(e.target.value); setError(null); }}
              disabled={!!feedback || isSubmitting}
              placeholder="输入你的回答或分析过程..."
              rows={4}
              className="w-full border border-slate-200 rounded-2xl px-5 py-4 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all placeholder:text-slate-300 resize-none bg-slate-50/30 disabled:bg-slate-50 disabled:text-slate-500"
            />
            
            {error && (
              <p className="text-xs text-red-600 flex items-center gap-1">
                <span>⚠️</span> {error}
              </p>
            )}

            {!feedback ? (
              <button 
                onClick={handleSubmit}
                disabled={!currentAnswer.trim() || isSubmitting}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold py-4 rounded-xl shadow-lg shadow-blue-200 transition-all flex items-center justify-center gap-3"
              >
                {isSubmitting ? <LoadingSpinner /> : null}
                {isSubmitting ? '评分中...' : '提交回答'}
              </button>
            ) : null}
          </div>
        </div>

        {/* Instant Feedback Area */}
        {feedback && (
          <div className={`p-8 border-t ${feedback.is_correct ? 'bg-emerald-50/30 border-emerald-100' : 'bg-amber-50/30 border-amber-100'}`}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold ${feedback.is_correct ? 'bg-emerald-500' : 'bg-amber-500'}`}>
                  {feedback.is_correct ? '✓' : '!'}
                </div>
                <div>
                  <h4 className={`font-bold ${feedback.is_correct ? 'text-emerald-900' : 'text-amber-900'}`}>
                    {feedback.is_correct ? '正确' : '还可以改进'}
                  </h4>
                  <p className="text-xs text-slate-400">评分：{Math.round(feedback.score * 100)} / 100</p>
                </div>
              </div>
            </div>
            
            <div className="text-sm text-slate-700 leading-relaxed mb-6 whitespace-pre-wrap">
              {feedback.feedback}
            </div>

            {/* Navigation */}
            {!isLast ? (
              <button 
                onClick={handleNext}
                className="w-full bg-white hover:bg-slate-50 text-slate-900 border border-slate-200 font-bold py-4 rounded-xl transition-all flex items-center justify-center gap-2"
              >
                下一题
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </button>
            ) : (
              <button 
                onClick={handleFinalize}
                disabled={isGeneratingNotes}
                className="w-full bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-bold py-4 rounded-xl shadow-lg transition-all flex items-center justify-center gap-3"
              >
                {isGeneratingNotes ? <LoadingSpinner /> : null}
                {isGeneratingNotes ? '正在生成总结笔记...' : '全部完成，生成学习笔记'}
              </button>
            )}
          </div>
        )}
      </div>

      <p className="text-center text-xs text-slate-400 font-medium">
        产品不变量 #2：已答题目不可修改
      </p>
    </div>
  )
}
