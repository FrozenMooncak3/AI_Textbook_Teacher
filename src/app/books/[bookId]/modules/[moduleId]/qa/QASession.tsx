'use client'

import { useState, useEffect } from 'react'
import AIResponse from '@/components/AIResponse'
import LoadingState from '@/components/LoadingState'
import SplitPanelLayout from '@/components/SplitPanelLayout'
import FeedbackPanel from '@/components/FeedbackPanel'

// --- Types ---

interface Question {
  id: number
  kp_id: number | null
  question_type: 'worked_example' | 'scaffolded_mc' | 'short_answer' | 'comparison' | string
  question_text: string
  correct_answer: string | null
  scaffolding: string | null
  order_index: number
  options?: string[] // Optional parsed options for MC
}

interface Feedback {
  is_correct: boolean
  score: number
  feedback: string
  user_answer?: string
}

const QUESTION_TYPE_LABELS: Record<string, string> = {
  worked_example: '思路练习',
  scaffolded_mc: '选择题',
  short_answer: '简答题',
  comparison: '对比分析',
}

export default function QASession({
  moduleId,
  moduleTitle,
  bookId,
  bookTitle,
  onComplete,
}: {
  moduleId: number
  moduleTitle: string
  bookId: number
  bookTitle: string
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

  // ── Data Fetching & Resume Logic ──────────────────────────────
  useEffect(() => {
    const initQA = async () => {
      setIsLoading(true)
      try {
        // 1. Load/Generate questions
        const qRes = await fetch(`/api/modules/${moduleId}/generate-questions`, { method: 'POST' })
        const qResult = await qRes.json()
        if (!qResult.success) {
          setError(qResult.error || '无法生成题目')
          setIsLoading(false)
          return
        }
        const fetchedQuestions = qResult.data.questions as Question[]
        
        // MC Option Parsing (if any)
        const processedQuestions = fetchedQuestions.map(q => {
          if (q.question_type === 'scaffolded_mc' && q.scaffolding) {
            // Attempt simple line-based parsing for options if scaffolding looks like a list
            const options = q.scaffolding.split('\n').filter(line => /^[A-D][.．]/.test(line.trim()))
            if (options.length >= 2) return { ...q, options }
          }
          return q
        })
        setQuestions(processedQuestions)

        // 2. Resume progress
        try {
          const rRes = await fetch(`/api/modules/${moduleId}/qa-feedback`)
          const rResult = await rRes.json()
          if (rResult.success && rResult.data.responses) {
            const existingResponses = rResult.data.responses as Record<number, Feedback>
            setResponses(existingResponses)
            
            const firstUnanswered = processedQuestions.findIndex(q => !existingResponses[q.id])
            if (firstUnanswered !== -1) {
              setCurrentIdx(firstUnanswered)
            } else {
              setCurrentIdx(processedQuestions.length - 1)
              setFeedback(existingResponses[processedQuestions[processedQuestions.length - 1].id])
            }
          }
        } catch (e) {
          // Silent fail for resume
        }
      } catch (e) {
        setError('加载失败，请检查网络后重试')
      } finally {
        setIsLoading(false)
      }
    }
    initQA()
  }, [moduleId])

  // ── Actions ──────────────────────────────────────────────────
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
    } catch (e) {
      setError('无法连接服务器，请稍后重试')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleNext = () => {
    setCurrentAnswer('')
    setFeedback(null)
    setCurrentIdx(currentIdx + 1)
  }

  const handleFinalize = () => {
    if (onComplete) onComplete()
  }

  // ── Derivations ──────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-surface">
        <LoadingState label="AI 正在准备你的 Q&A 练习..." />
      </div>
    )
  }

  if (error && questions.length === 0) {
    return (
      <div className="h-screen flex items-center justify-center bg-surface p-6">
        <div className="bg-surface-container-lowest rounded-[32px] border border-error/20 p-12 text-center shadow-xl max-w-md">
          <span className="material-symbols-outlined text-error text-6xl mb-6" style={{ fontVariationSettings: "'FILL' 1" }}>error</span>
          <h3 className="text-2xl font-black text-on-surface mb-4 font-headline">练习准备失败</h3>
          <p className="text-on-surface-variant mb-8 leading-relaxed">{error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="w-full bg-primary text-on-primary font-bold py-4 rounded-full shadow-lg shadow-orange-900/20 active:scale-95 transition-all font-headline"
          >
            重试
          </button>
        </div>
      </div>
    )
  }

  const question = questions[currentIdx]
  const isLastQuestion = currentIdx === questions.length - 1
  const isAnswered = !!responses[question.id]
  const currentFeedback = feedback || responses[question.id]

  // KP Sidebar Logic
  const kpMap = new Map<number, { code: string; name: string; questionIds: number[] }>()
  for (const q of questions) {
    if (q.kp_id) {
      if (!kpMap.has(q.kp_id)) {
        kpMap.set(q.kp_id, { 
          code: `KP${kpMap.size + 1}`, 
          name: `知识点 ${kpMap.size + 1}`, 
          questionIds: [] 
        })
      }
      kpMap.get(q.kp_id)!.questionIds.push(q.id)
    }
  }

  const knowledgePoints = Array.from(kpMap.entries()).map(([kpId, kp]) => {
    const allAnswered = kp.questionIds.every(qId => responses[qId])
    const isCurrent = kp.questionIds.includes(questions[currentIdx]?.id)
    return {
      id: kpId,
      code: kp.code,
      name: kp.name,
      status: allAnswered ? 'done' as const : isCurrent ? 'current' as const : 'pending' as const,
    }
  })

  return (
    <SplitPanelLayout
      breadcrumbs={[
        { label: bookTitle, href: `/books/${bookId}` },
        { label: `${moduleTitle} Q&A` },
      ]}
      knowledgePoints={knowledgePoints}
      onKpClick={() => {}} // Could implement jump-to-kp if needed
      feedbackSlot={
        feedback && (
          <FeedbackPanel
            visible={!!feedback}
            isCorrect={feedback.is_correct}
            score={feedback.score}
            content={feedback.feedback}
            onNext={isLastQuestion ? handleFinalize : handleNext}
            nextLabel={isLastQuestion ? '完成 Q&A' : '下一题'}
          />
        )
      }
      footerSlot={
        !feedback && (
          <div className="flex items-center justify-between max-w-4xl mx-auto">
            <span className="text-sm text-on-surface-variant font-headline font-bold">
              进度 {Object.keys(responses).length}/{questions.length}
            </span>
            <button
              onClick={handleSubmit}
              disabled={!currentAnswer.trim() || isSubmitting || isAnswered}
              className="px-10 py-3.5 amber-glow text-on-primary rounded-full font-bold disabled:opacity-50 disabled:cursor-not-allowed shadow-xl shadow-orange-900/20 font-headline tracking-wide active:scale-95 transition-transform"
            >
              {isSubmitting ? '正在评分...' : '提交回答'}
            </button>
          </div>
        )
      }
    >
      <div className="max-w-4xl mx-auto p-6 lg:p-12 pb-32">
        {/* Question Type & Progress */}
        <div className="flex flex-col gap-6 mb-10">
          <div className="flex items-center justify-between">
            <span className="bg-primary/10 text-primary rounded-full px-4 py-1.5 text-xs font-black font-headline tracking-widest uppercase">
              {QUESTION_TYPE_LABELS[question.question_type] || '知识练习'}
            </span>
            <span className="text-sm font-bold text-on-surface-variant font-headline">
              题目 {currentIdx + 1} / {questions.length}
            </span>
          </div>

          <div className="flex gap-1.5 h-1.5">
            {questions.map((q, i) => {
              const answered = !!responses[q.id]
              const current = i === currentIdx
              return (
                <div 
                  key={q.id}
                  className={`flex-1 rounded-full h-full transition-all duration-500 ${
                    answered ? 'bg-primary-fixed-dim' : current ? 'bg-tertiary-container shadow-[0_0_8px_rgba(254,187,40,0.4)]' : 'bg-surface-variant'
                  }`}
                />
              )
            })}
          </div>
        </div>

        {/* Question Content */}
        <div className="mb-10">
          <div className="text-xl text-on-surface leading-relaxed font-bold font-headline mb-8">
            <AIResponse content={question.question_text} />
          </div>

          {/* MC Options UI (if parsed) */}
          {question.question_type === 'scaffolded_mc' && question.options && (
            <div className="grid gap-4 mb-8">
              {question.options.map((opt, i) => {
                const isSelected = currentAnswer === opt
                return (
                  <div
                    key={i}
                    onClick={() => !isAnswered && !isSubmitting && setCurrentAnswer(opt)}
                    className={`
                      p-5 rounded-2xl border-2 transition-all cursor-pointer flex items-center gap-4
                      ${isSelected ? 'border-primary bg-primary/5 shadow-sm' : 'border-outline-variant/30 hover:border-outline-variant bg-surface-container-lowest'}
                      ${isAnswered ? 'opacity-80 cursor-default' : ''}
                    `}
                  >
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 ${isSelected ? 'border-primary bg-primary' : 'border-outline-variant'}`}>
                      {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                    </div>
                    <span className={`text-base ${isSelected ? 'text-on-surface font-bold' : 'text-on-surface-variant'}`}>{opt}</span>
                  </div>
                )
              })}
            </div>
          )}

          {/* Free Text Input */}
          {(!question.options || question.question_type !== 'scaffolded_mc') && (
            <div className="relative group">
              <textarea 
                value={isAnswered ? currentFeedback?.user_answer || '(已提交)' : currentAnswer}
                onChange={(e) => { setCurrentAnswer(e.target.value); setError(null); }}
                disabled={isAnswered || isSubmitting}
                placeholder="输入你的回答或分析过程..."
                rows={6}
                className="w-full bg-surface-container-lowest border border-outline-variant rounded-[32px] px-8 py-6 text-on-surface text-lg leading-relaxed focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all placeholder:text-on-surface-variant/30 resize-none shadow-sm group-hover:shadow-md disabled:bg-surface-container-low/50 disabled:text-on-surface-variant/70"
              />
              {isAnswered && (
                <div className="absolute top-4 right-6">
                  <span className="material-symbols-outlined text-primary/40 select-none">lock</span>
                </div>
              )}
            </div>
          )}
          
          {error && (
            <div className="mt-4 px-6 py-3 bg-error-container/10 border border-error/20 rounded-2xl flex items-center gap-3 text-error text-sm font-bold animate-in fade-in slide-in-from-top-1">
              <span className="material-symbols-outlined text-lg">error</span>
              {error}
            </div>
          )}
        </div>

        {/* Hint Section (Scaffolding) */}
        {question.scaffolding && !currentFeedback && (
          <div className="bg-tertiary-container/10 border border-tertiary-container/30 rounded-3xl p-8 shadow-sm">
            <div className="flex items-center gap-3 mb-4 text-tertiary">
              <span className="material-symbols-outlined">lightbulb</span>
              <h4 className="font-black font-headline tracking-wide uppercase text-xs">学习启发</h4>
            </div>
            <div className="text-on-surface-variant leading-relaxed italic">
              <AIResponse content={question.scaffolding} />
            </div>
          </div>
        )}

        <div className="mt-12 pt-8 border-t border-outline-variant/10 text-center">
          <p className="text-[10px] text-on-surface-variant/40 font-bold uppercase tracking-[0.2em] font-headline">
            Product Invariant #2: Answered questions cannot be modified
          </p>
        </div>
      </div>
    </SplitPanelLayout>
  )
}
