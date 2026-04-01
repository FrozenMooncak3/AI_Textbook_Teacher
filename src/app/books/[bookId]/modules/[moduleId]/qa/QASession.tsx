'use client'

import { useState, useEffect } from 'react'
import MarkdownRenderer from '@/components/MarkdownRenderer'

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
  user_answer?: string // Existing answer for resume
}

const LoadingSpinner = () => (
  <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
)

export default function QASession({
  moduleId,
  moduleTitle,
  onComplete,
}: {
  moduleId: number
  moduleTitle: string
  onComplete?: () => void
}) {
  const [questions, setQuestions] = useState<Question[]>([])
  const [responses, setResponses] = useState<Record<number, Feedback>>({})
  const [currentIdx, setCurrentIdx] = useState(0)
  const [currentAnswer, setCurrentAnswer] = useState('')
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // ── 加载/生成题目 + 恢复进度 ─────────────────────────────────
  useEffect(() => {
    const initQA = async () => {
      setIsLoading(true)
      try {
        // 1. 加载题目
        const qRes = await fetch(`/api/modules/${moduleId}/generate-questions`, { method: 'POST' })
        const qResult = await qRes.json()
        if (!qResult.success) {
          setError(qResult.error || '无法生成题目')
          setIsLoading(false)
          return
        }
        const fetchedQuestions = qResult.data.questions as Question[]
        setQuestions(fetchedQuestions)

        // 2. Fix I2: 尝试获取已有的回答以恢复进度
        // 注意：由于后端 GET 接口可能在 Codex 的修复中新增，我们尝试调用
        try {
          const rRes = await fetch(`/api/modules/${moduleId}/qa-feedback`)
          const rResult = await rRes.json()
          if (rResult.success && rResult.data.responses) {
            const existingResponses = rResult.data.responses as Record<number, Feedback>
            setResponses(existingResponses)
            
            // 找到第一个未回答的题目索引
            const firstUnanswered = fetchedQuestions.findIndex(q => !existingResponses[q.id])
            if (firstUnanswered !== -1) {
              setCurrentIdx(firstUnanswered)
            } else {
              // 全部已答完，直接到最后
              setCurrentIdx(fetchedQuestions.length - 1)
              setFeedback(existingResponses[fetchedQuestions[fetchedQuestions.length - 1].id])
            }
          }
        } catch {
          // 如果接口不存在或失败，静默失败，从第 0 题开始
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
        const newFeedback = result.data
        setFeedback(newFeedback)
        setResponses(prev => ({ ...prev, [question.id]: newFeedback }))
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

  // ── 完成并继续 ──────────────────────────────────────────
  const handleFinalize = () => {
    // Fix I3: 移除重复的 generate-notes 调用，由父组件 NotesDisplay 负责
    if (onComplete) onComplete()
  }

  // ── 渲染状态处理 ───────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-sm">
        <div className="flex justify-center mb-6">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
        <h3 className="text-xl font-bold text-slate-900 mb-2">AI 正在准备你的 Q&A 练习...</h3>
        <p className="text-slate-500">正在同步学习进度</p>
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
  const isAnswered = !!responses[question.id]
  const currentFeedback = feedback || responses[question.id]

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
          {question.scaffolding && !currentFeedback && (
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
              value={isAnswered ? responses[question.id].user_answer || '(已提交)' : currentAnswer}
              onChange={(e) => { setCurrentAnswer(e.target.value); setError(null); }}
              disabled={isAnswered || isSubmitting}
              placeholder="输入你的回答或分析过程..."
              rows={4}
              className="w-full border border-slate-200 rounded-2xl px-5 py-4 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all placeholder:text-slate-300 resize-none bg-slate-50/30 disabled:bg-slate-50 disabled:text-slate-500"
            />
            
            {error && (
              <p className="text-xs text-red-600 flex items-center gap-1">
                <span>⚠️</span> {error}
              </p>
            )}

            {!isAnswered ? (
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
        {currentFeedback && (
          <div className={`p-8 border-t ${currentFeedback.is_correct ? 'bg-emerald-50/30 border-emerald-100' : 'bg-amber-50/30 border-amber-100'}`}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold ${currentFeedback.is_correct ? 'bg-emerald-500' : 'bg-amber-500'}`}>
                  {currentFeedback.is_correct ? '✓' : '!'}
                </div>
                <div>
                  <h4 className={`font-bold ${currentFeedback.is_correct ? 'text-emerald-900' : 'text-amber-900'}`}>
                    {currentFeedback.is_correct ? '正确' : '还可以改进'}
                  </h4>
                  <p className="text-xs text-slate-400">评分：{Math.round(currentFeedback.score * 100)} / 100</p>
                </div>
              </div>
            </div>
            
            <div className="text-sm text-slate-700 leading-relaxed mb-6">
              <MarkdownRenderer content={currentFeedback.feedback} />
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
                className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-4 rounded-xl shadow-lg transition-all flex items-center justify-center gap-3"
              >
                全部完成，生成学习笔记
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
