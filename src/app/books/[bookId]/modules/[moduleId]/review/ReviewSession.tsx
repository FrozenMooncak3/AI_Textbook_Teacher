'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import AIResponse from '@/components/AIResponse'
import LoadingState from '@/components/LoadingState'
import SplitPanel from '@/components/ui/SplitPanel'
import KnowledgePointList from '@/components/ui/KnowledgePointList'
import GlassHeader from '@/components/ui/GlassHeader'
import SegmentedProgress from '@/components/ui/SegmentedProgress'
import FeedbackPanel from '@/components/ui/FeedbackPanel'
import { MCOptionGroup, MCOptionCard } from '@/components/ui/MCOptionCard'
import AmberButton from '@/components/ui/AmberButton'
import Breadcrumb from '@/components/ui/Breadcrumb'
import ContentCard from '@/components/ui/ContentCard'
import MasteryBars from '@/components/ui/MasteryBars'

// --- Types ---

interface Question {
  id: number
  type: 'single_choice' | 'calculation' | 'essay' | 'c2_evaluation' | string
  text: string
  options: string[] | null
  kp_name?: string
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
    setPhase('generating') 
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
  const progressKPData = Array.from({ length: totalQuestions || 5 }).map((_, i) => ({
    name: question?.id && (i + 1 === currentIndex) ? (question.kp_name || `复习题目 ${i + 1}`) : `复习题目 ${i + 1}`,
    status: (i + 1 < currentIndex) ? 'done' as const : (i + 1 === currentIndex) ? 'active' as const : 'pending' as const
  }))

  const questionSegments = Array.from({ length: totalQuestions || 5 }).map((_, i) => {
    if (i + 1 === currentIndex && !feedback) return { status: 'current' as const }
    if (i + 1 < currentIndex) return { status: 'answered' as const }
    return { status: 'unanswered' as const }
  })

  if (phase === 'error') {
    return (
      <div className="min-h-screen bg-surface-container-low flex items-center justify-center p-6">
        <ContentCard className="p-12 text-center max-w-md w-full border-error/20 shadow-xl">
          <div className="w-20 h-20 bg-error-container/10 text-error rounded-full flex items-center justify-center mx-auto mb-8 text-4xl shadow-sm">
            <span className="material-symbols-outlined text-4xl">error</span>
          </div>
          <h3 className="text-2xl font-black text-on-surface mb-4 font-headline tracking-tight">复习异常</h3>
          <p className="text-on-surface-variant mb-10 leading-relaxed font-medium">{error}</p>
          <AmberButton onClick={startReview} fullWidth>重试</AmberButton>
        </ContentCard>
      </div>
    )
  }

  if (phase === 'complete' && summary) {
    const masteryData = summary.clusters.map(c => ({
      label: c.name,
      count: c.correct,
      percentage: Math.round((c.correct / c.total) * 100),
      color: (c.correct / c.total) > 0.8 ? 'emerald' as const : (c.correct / c.total) > 0.4 ? 'blue' as const : 'orange' as const
    }))

    return (
      <div className="min-h-screen bg-surface-container-low p-8 md:p-12 overflow-y-auto">
        <div className="max-w-3xl mx-auto space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="text-center">
            <div className="w-24 h-24 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-8 shadow-sm">
              <span className="material-symbols-outlined text-5xl" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
            </div>
            <h2 className="text-4xl font-black text-on-surface font-headline tracking-tight mb-4">复习任务已完成</h2>
            <p className="text-on-surface-variant text-lg font-medium">做得好！你已经完成了本次知识点的巩固。</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <ContentCard className="p-8 text-center">
              <p className="text-[10px] font-black text-on-surface-variant/50 uppercase tracking-[0.2em] mb-3">本次正确率</p>
              <p className="text-5xl font-black text-primary font-headline tracking-tighter">{Math.round(summary.accuracy * 100)}%</p>
            </ContentCard>
            <ContentCard className="p-8 text-center">
              <p className="text-[10px] font-black text-on-surface-variant/50 uppercase tracking-[0.2em] mb-3">答对题目</p>
              <p className="text-5xl font-black text-on-surface font-headline tracking-tighter">{summary.correct_count} / {summary.total_questions}</p>
            </ContentCard>
          </div>

          <MasteryBars data={masteryData} />

          {nextReview && (
            <div className="bg-tertiary-container/10 border border-tertiary-container/30 rounded-3xl p-8 flex gap-5 items-center">
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

          <AmberButton onClick={() => router.push(`/books/${bookId}`)} fullWidth size="lg">返回教材中心</AmberButton>
        </div>
      </div>
    )
  }

  return (
    <SplitPanel
      sidebar={
        <div className="flex flex-col h-full">
          <div className="p-6 border-b border-outline-variant/10">
            <h2 className="font-headline font-bold text-on-surface truncate">{moduleTitle}</h2>
            <p className="text-xs text-on-surface-variant mt-1 uppercase tracking-widest">巩固复习进度</p>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            <KnowledgePointList items={progressKPData} activeColor="orange" />
          </div>
        </div>
      }
      content={
        <div className="flex flex-col h-full">
          <GlassHeader className="px-8 py-4">
            <div className="flex items-center justify-between mb-4">
              <Breadcrumb items={[
                { label: bookTitle, href: `/books/${bookId}` },
                { label: `${moduleTitle} 复习` },
              ]} />
              <Badge variant="warning">{question ? (QUESTION_TYPE_LABELS[question.type] || '复习题') : '加载中'}</Badge>
            </div>
            <SegmentedProgress segments={questionSegments} />
          </GlassHeader>

          <div className="flex-1 overflow-y-auto p-8 lg:p-12 pb-40 space-y-10">
            {phase === 'generating' ? (
              <div className="flex items-center justify-center min-h-[300px]">
                <LoadingState label="AI 正在加载题目..." />
              </div>
            ) : question && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-10">
                <div className="text-xl text-on-surface font-bold leading-relaxed font-headline max-w-2xl">
                  <AIResponse content={question.text} />
                </div>

                {question.type === 'single_choice' && question.options ? (
                  <MCOptionGroup 
                    value={userAnswer} 
                    onValueChange={(val) => !feedback && !isSubmitting && setUserAnswer(val)}
                    disabled={!!feedback || isSubmitting}
                    className="max-w-2xl"
                  >
                    {question.options.map((opt, i) => {
                      const letter = opt.trim().charAt(0).toUpperCase()
                      return (
                        <MCOptionCard 
                          key={i} 
                          value={letter} 
                          label={letter} 
                          text={opt.substring(opt.indexOf('.') + 1).trim() || opt} 
                        />
                      )
                    })}
                  </MCOptionGroup>
                ) : (
                  <textarea
                    value={userAnswer}
                    onChange={(e) => setUserAnswer(e.target.value)}
                    disabled={!!feedback || isSubmitting}
                    placeholder="输入你的回答或分析过程..."
                    rows={6}
                    className="w-full max-w-2xl bg-surface-container-low border border-outline-variant/10 rounded-2xl px-8 py-6 text-on-surface text-lg leading-relaxed focus:outline-none focus:ring-4 focus:ring-primary/5 focus:bg-surface-bright transition-all placeholder:text-on-surface-variant/30 resize-none shadow-sm"
                  />
                )}
              </div>
            )}
          </div>

          {!feedback && phase === 'answering' && (
            <footer className="absolute bottom-0 left-0 w-full bg-white/80 backdrop-blur-md border-t border-outline-variant/10 p-6 flex items-center justify-between z-20">
              <span className="text-sm font-bold text-on-surface-variant">
                进度 {currentIndex} / {totalQuestions}
              </span>
              <AmberButton 
                onClick={handleSubmit} 
                disabled={!userAnswer.trim() || isSubmitting}
              >
                {isSubmitting ? '正在评分...' : '提交回答'}
              </AmberButton>
            </footer>
          )}
        </div>
      }
      feedbackSlot={
        feedback && (
          <FeedbackPanel
            isCorrect={feedback.is_correct}
            explanation={[
              feedback.ai_feedback,
              feedback.correct_answer ? `\n\n**正确答案：** ${feedback.correct_answer}` : '',
              feedback.explanation ? `\n\n**解析：** ${feedback.explanation}` : ''
            ].join('')}
            onNext={handleNext}
            nextLabel={feedback.has_next ? '下一题' : '查看报告'}
            variant="review"
          />
        )
      }
    />
  )
}
