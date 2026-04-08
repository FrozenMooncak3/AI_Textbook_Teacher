'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import AIResponse from '@/components/AIResponse'
import LoadingState from '@/components/LoadingState'
import SplitPanelLayout from '@/components/SplitPanelLayout'
import FeedbackPanel from '@/components/FeedbackPanel'

// --- Types ---

interface Question {
  id: number
  type: 'single_choice' | 'calculation' | 'essay' | 'c2_evaluation' | string
  text: string
  options: string[] | null
}

interface Feedback {
  is_correct: boolean
  score: number
  ai_feedback: string
  correct_answer?: string
  explanation?: string
  has_next: boolean
  next_question: Question | null
}

interface ClusterResult {
  name: string
  correct: number
  total: number
}

interface Summary {
  total_questions: number
  correct_count: number
  accuracy: number
  clusters: ClusterResult[]
}

interface NextReview {
  round: number
  due_date: string
}

type Phase = 'generating' | 'answering' | 'feedback' | 'complete' | 'error'

const QUESTION_TYPE_LABELS: Record<string, string> = {
  single_choice: '单选题',
  c2_evaluation: 'C2 评估题',
  calculation: '计算题',
  essay: '思考题',
}

export default function ReviewSession({
  bookId,
  moduleId,
  scheduleId,
  bookTitle,
  moduleTitle,
}: {
  bookId: number
  moduleId: number
  scheduleId: number
  bookTitle: string
  moduleTitle: string
}) {
  const router = useRouter()
  const [phase, setPhase] = useState<Phase>('generating')
  const [question, setQuestion] = useState<Question | null>(null)
  const [totalQuestions, setTotalQuestions] = useState(0)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [userAnswer, setUserAnswer] = useState('')
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [summary, setSummary] = useState<Summary | null>(null)
  const [nextReview, setNextReview] = useState<NextReview | null>(null)
  
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // ── 开始复习 (Generate) ───────────────────────────────────
  const startReview = useCallback(async () => {
    setPhase('generating')
    setError(null)
    try {
      const res = await fetch(`/api/review/${scheduleId}/generate`, { method: 'POST' })
      const result = await res.json()
      if (result.success) {
        setTotalQuestions(result.data.total_questions)
        setCurrentIndex(result.data.current_index)
        setQuestion(result.data.question)
        setPhase('answering')
      } else {
        setError(result.error || '无法开始复习会话')
        setPhase('error')
      }
    } catch {
      setError('网络连接失败，请重试')
      setPhase('error')
    }
  }, [scheduleId])

  useEffect(() => {
    startReview()
  }, [startReview])

  // ── 提交回答 (Respond) ───────────────────────────────────
  const handleSubmit = async () => {
    if (!userAnswer.trim() || isSubmitting || !question) return
    setIsSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`/api/review/${scheduleId}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          question_id: question.id, 
          user_answer: userAnswer.trim() 
        }),
      })
      const result = await res.json()
      if (result.success) {
        setFeedback(result.data)
        setPhase('feedback')
      } else {
        setError(result.error || '提交回答失败')
      }
    } catch {
      setError('网络连接失败，请重试')
    } finally {
      setIsSubmitting(false)
    }
  }

  // ── 下一题 ──────────────────────────────────────────────
  const handleNext = () => {
    if (!feedback) return
    
    if (feedback.has_next && feedback.next_question) {
      setQuestion(feedback.next_question)
      setCurrentIndex(prev => prev + 1)
      setUserAnswer('')
      setFeedback(null)
      setPhase('answering')
    } else {
      finalizeReview()
    }
  }

  // ── 完成复习 (Complete) ───────────────────────────────────
  const finalizeReview = async () => {
    setPhase('generating') // Use as loading state
    setError(null)
    try {
      const res = await fetch(`/api/review/${scheduleId}/complete`, { method: 'POST' })
      const result = await res.json()
      if (result.success) {
        setSummary(result.data.summary)
        setNextReview(result.data.next_review)
        setPhase('complete')
      } else {
        setError(result.error || '无法完成复习会话')
        setPhase('error')
      }
    } catch {
      setError('网络连接失败，请重试')
      setPhase('error')
    }
  }

  // ── KP Sidebar Derivation ───────────────────────────────────
  // Since review session structure doesn't easily map to KPs, show simple progress
  const progressKnowledgePoints = Array.from({ length: totalQuestions || 5 }).map((_, i) => ({
    id: i,
    code: `Q${i + 1}`,
    name: `复习题目 ${i + 1}`,
    status: (i < currentIndex - 1) ? 'done' as const : (i === currentIndex - 1) ? 'current' as const : 'pending' as const
  }))

  const breadcrumbs = [
    { label: bookTitle, href: `/books/${bookId}` },
    { label: `${moduleTitle} 巩固复习` },
  ]

  // ── 渲染逻辑 ───────────────────────────────────────────────

  if (phase === 'error') {
    return (
      <div className="min-h-screen bg-surface-container-low flex items-center justify-center p-6">
        <div className="bg-surface-container-lowest rounded-[32px] border border-error/20 p-12 text-center shadow-xl max-w-md w-full">
          <div className="w-20 h-20 bg-error-container/10 text-error rounded-full flex items-center justify-center mx-auto mb-8 text-4xl shadow-sm">
            <span className="material-symbols-outlined text-4xl" style={{ fontVariationSettings: "'FILL' 1" }}>error</span>
          </div>
          <h3 className="text-2xl font-black text-on-surface mb-4 font-headline tracking-tight">复习异常</h3>
          <p className="text-on-surface-variant mb-10 leading-relaxed font-medium">{error}</p>
          <button
            onClick={startReview}
            className="w-full amber-glow text-on-primary font-bold py-4 rounded-full shadow-lg shadow-orange-900/10 active:scale-95 transition-all"
          >
            重试
          </button>
        </div>
      </div>
    )
  }

  return (
    <SplitPanelLayout
      breadcrumbs={breadcrumbs}
      knowledgePoints={progressKnowledgePoints}
      feedbackSlot={
        feedback && (
          <FeedbackPanel
            visible={!!feedback}
            isCorrect={feedback.is_correct}
            score={Math.round(feedback.score * 100)}
            content={[
              feedback.ai_feedback,
              feedback.correct_answer ? `\n\n**正确答案：** ${feedback.correct_answer}` : '',
              feedback.explanation ? `\n\n**解析：** ${feedback.explanation}` : ''
            ].join('')}
            onNext={handleNext}
            nextLabel={feedback.has_next ? '下一题' : '查看复习报告'}
          />
        )
      }
      footerSlot={
        phase === 'answering' && (
          <div className="flex items-center justify-between max-w-4xl mx-auto">
            <span className="text-sm text-on-surface-variant font-headline font-bold">
              进度 {currentIndex}/{totalQuestions}
            </span>
            <button
              onClick={handleSubmit}
              disabled={!userAnswer.trim() || isSubmitting}
              className="px-10 py-3.5 amber-glow text-on-primary rounded-full font-bold disabled:opacity-50 disabled:cursor-not-allowed shadow-xl shadow-orange-900/20 font-headline tracking-wide active:scale-95 transition-transform"
            >
              {isSubmitting ? '正在评分...' : '提交回答'}
            </button>
          </div>
        )
      }
    >
      <div className="max-w-4xl mx-auto p-6 lg:p-12 pb-32">
        {phase === 'generating' ? (
          <div className="flex-1 flex items-center justify-center min-h-[400px]">
            <LoadingState label="AI 正在为你加载复习内容..." />
          </div>
        ) : phase === 'complete' && summary ? (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="text-center mb-12">
              <div className="w-24 h-24 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-8 shadow-sm">
                <span className="material-symbols-outlined text-5xl" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
              </div>
              <h2 className="text-4xl font-black text-on-surface font-headline tracking-tight mb-4">复习任务已完成</h2>
              <p className="text-on-surface-variant text-lg font-medium">做得好！你已经完成了本次知识点的巩固。</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
              <div className="bg-surface-container-lowest p-8 rounded-[32px] border border-outline-variant/10 text-center shadow-sm">
                <p className="text-[10px] font-black text-on-surface-variant/50 uppercase tracking-[0.2em] mb-3">本次正确率</p>
                <p className="text-5xl font-black text-primary font-headline tracking-tighter">{Math.round(summary.accuracy * 100)}%</p>
              </div>
              <div className="bg-surface-container-lowest p-8 rounded-[32px] border border-outline-variant/10 text-center shadow-sm">
                <p className="text-[10px] font-black text-on-surface-variant/50 uppercase tracking-[0.2em] mb-3">答对题目</p>
                <p className="text-5xl font-black text-on-surface font-headline tracking-tighter">{summary.correct_count} / {summary.total_questions}</p>
              </div>
            </div>

            <div className="bg-surface-container-lowest rounded-[32px] border border-outline-variant/10 p-8 md:p-10 mb-12 shadow-sm">
              <h3 className="text-xs font-black text-on-surface-variant font-headline uppercase tracking-[0.2em] mb-8 flex items-center gap-3">
                <span className="material-symbols-outlined text-primary">analytics</span>
                知识集群掌握情况
              </h3>
              <div className="space-y-6">
                {summary.clusters.map(c => (
                  <div key={c.name}>
                    <div className="flex justify-between items-end mb-2">
                      <span className="text-sm font-bold text-on-surface">{c.name}</span>
                      <span className="text-xs font-black font-headline text-on-surface-variant">{c.correct} / {c.total}</span>
                    </div>
                    <div className="w-full h-2.5 bg-surface-container rounded-full overflow-hidden shadow-inner">
                      <div 
                        className="h-full bg-primary-fixed-dim rounded-full transition-all duration-1000 ease-out" 
                        style={{ width: `${(c.correct / c.total) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {nextReview && (
              <div className="bg-tertiary-container/10 border border-tertiary-container/30 rounded-3xl p-8 mb-12 flex gap-5 items-center">
                <div className="w-12 h-12 bg-tertiary-container rounded-full flex items-center justify-center shrink-0 text-tertiary shadow-sm">
                  <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>event_repeat</span>
                </div>
                <div>
                  <p className="text-on-tertiary-container font-medium leading-relaxed">
                    下一次复习将在 <span className="font-black font-headline">第 {nextReview.round} 轮</span> 进行。
                  </p>
                  <p className="text-on-tertiary-container/60 text-xs font-bold uppercase tracking-widest mt-1">
                    计划日期：{nextReview.due_date}
                  </p>
                </div>
              </div>
            )}

            <button 
              onClick={() => router.push(`/books/${bookId}`)}
              className="w-full amber-glow text-on-primary font-black font-headline text-lg py-5 rounded-full shadow-xl shadow-orange-900/20 active:scale-95 transition-all"
            >
              返回教材中心
            </button>
          </div>
        ) : question ? (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Question Header */}
            <div className="flex flex-col gap-6 mb-10">
              <div className="flex items-center justify-between">
                <span className="bg-primary/10 text-primary rounded-full px-4 py-1.5 text-xs font-black font-headline tracking-widest uppercase">
                  {QUESTION_TYPE_LABELS[question.type] || '知识巩固'}
                </span>
                <span className="text-sm font-bold text-on-surface-variant font-headline">
                  题目 {currentIndex} / {totalQuestions}
                </span>
              </div>

              <div className="flex gap-1.5 h-1.5">
                {Array.from({ length: totalQuestions }).map((_, i) => (
                  <div 
                    key={i}
                    className={`flex-1 rounded-full h-full transition-all duration-500 ${
                      (i + 1 < currentIndex) ? 'bg-primary-fixed-dim' : (i + 1 === currentIndex) ? 'bg-tertiary-container shadow-[0_0_8px_rgba(254,187,40,0.4)]' : 'bg-surface-variant'
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Question Content */}
            <div className="bg-surface-container-lowest rounded-[32px] p-8 md:p-12 border border-outline-variant/10 shadow-sm mb-10">
              <div className="text-xl text-on-surface md:text-2xl leading-relaxed font-bold font-headline mb-12">
                <AIResponse content={question.text} />
              </div>

              {/* Answer Area */}
              {question.type === 'single_choice' && question.options ? (
                <div className="grid gap-4">
                  {question.options.map((opt) => {
                    const optId = opt.charAt(0).toUpperCase()
                    const isSelected = userAnswer === optId
                    return (
                      <button
                        key={opt}
                        onClick={() => !feedback && setUserAnswer(optId)}
                        disabled={!!feedback || isSubmitting}
                        className={`group w-full flex items-center gap-5 p-6 rounded-2xl transition-all text-left border-2 ${
                          isSelected 
                            ? 'bg-secondary-container/20 border-primary shadow-sm' 
                            : 'bg-surface-container-low border-transparent hover:border-outline-variant/30 hover:bg-surface-container'
                        } ${feedback ? 'cursor-default' : 'cursor-pointer'}`}
                      >
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black font-headline transition-colors shrink-0 ${
                          isSelected 
                            ? 'bg-primary text-on-primary' 
                            : 'bg-surface-container-lowest border border-outline-variant text-on-surface-variant group-hover:border-primary group-hover:text-primary'
                        }`}>
                          {isSelected && !feedback ? (
                            <span className="material-symbols-outlined text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                          ) : (
                            optId
                          )}
                        </div>
                        <span className={`text-lg ${isSelected ? 'text-on-surface font-bold' : 'text-on-surface-variant font-medium'}`}>
                          {opt.substring(opt.indexOf('.') + 1).trim() || opt}
                        </span>
                      </button>
                    )
                  })}
                </div>
              ) : (
                <div className="group relative">
                  <textarea 
                    value={userAnswer}
                    onChange={(e) => setUserAnswer(e.target.value)}
                    disabled={!!feedback || isSubmitting}
                    placeholder="在此输入你的分析或回答..."
                    rows={6}
                    className="w-full bg-surface-container-low/50 border border-outline-variant/10 rounded-[32px] px-8 py-6 text-on-surface text-lg leading-relaxed focus:bg-surface-container-lowest focus:border-primary focus:ring-4 focus:ring-primary/5 outline-none transition-all placeholder:text-on-surface-variant/30 resize-none shadow-inner disabled:bg-surface-container-low/30 disabled:text-on-surface-variant/70"
                  />
                  {feedback && (
                    <div className="absolute top-4 right-6">
                      <span className="material-symbols-outlined text-primary/40 select-none">lock</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {error && (
              <div className="mb-10 p-6 bg-error-container/10 border border-error/20 rounded-[32px] flex items-center gap-4 text-error animate-in fade-in slide-in-from-top-2">
                <span className="material-symbols-outlined">error</span>
                <p className="font-bold">{error}</p>
              </div>
            )}

            <div className="mt-12 pt-8 border-t border-outline-variant/10 text-center">
              <p className="text-[10px] text-on-surface-variant/40 font-bold uppercase tracking-[0.2em] font-headline">
                Product Invariant #2: Answered questions cannot be modified
              </p>
            </div>
          </div>
        ) : null}
      </div>
    </SplitPanelLayout>
  )
}
