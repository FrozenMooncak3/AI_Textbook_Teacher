'use client'

import { useState, useEffect } from 'react'
import AIResponse from '@/components/AIResponse'
import LoadingState from '@/components/LoadingState'
import SplitPanel from '@/components/ui/SplitPanel'
import KnowledgePointList from '@/components/ui/KnowledgePointList'
import GlassHeader from '@/components/ui/GlassHeader'
import SegmentedProgress from '@/components/ui/SegmentedProgress'
import FeedbackPanel from '@/components/ui/FeedbackPanel'
import Breadcrumb from '@/components/ui/Breadcrumb'
import Badge from '@/components/ui/Badge'
import { MCOptionGroup, MCOptionCard } from '@/components/ui/MCOptionCard'
import AmberButton from '@/components/ui/AmberButton'
import ChatBubble from '@/components/ui/ChatBubble'

// --- Types ---

interface Question {
  id: number
  kp_id: number | null
  kp_name?: string
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
        const qRes = await fetch(`/api/modules/${moduleId}/generate-questions`, { method: 'POST' })
        const qResult = await qRes.json()
        if (!qResult.success) {
          setError(qResult.error || '无法生成题目')
          setIsLoading(false)
          return
        }
        const fetchedQuestions = qResult.data.questions as Question[]
        
        const processedQuestions = fetchedQuestions.map(q => {
          if (q.question_type === 'scaffolded_mc' && q.scaffolding) {
            const options = q.scaffolding.split('\n').filter(line => /^[A-D][.．]/.test(line.trim()))
            if (options.length >= 2) return { ...q, options }
          }
          return q
        })
        setQuestions(processedQuestions)

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

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-surface-container-low">
        <LoadingState label="AI 正在准备你的 Q&A 练习..." />
      </div>
    )
  }

  if (error && questions.length === 0) {
    return (
      <div className="h-screen flex items-center justify-center bg-surface-container-low p-6">
        <div className="bg-surface-container-lowest rounded-[32px] border border-error/20 p-12 text-center shadow-xl max-w-md">
          <span className="material-symbols-outlined text-error text-6xl mb-6" style={{ fontVariationSettings: "'FILL' 1" }}>error</span>
          <h3 className="text-2xl font-black text-on-surface mb-4 font-headline">练习准备失败</h3>
          <p className="text-on-surface-variant mb-8 leading-relaxed">{error}</p>
          <AmberButton onClick={() => window.location.reload()} fullWidth>重试</AmberButton>
        </div>
      </div>
    )
  }

  const question = questions[currentIdx]
  const isLastQuestion = currentIdx === questions.length - 1
  const isAnswered = !!responses[question.id]
  const currentFeedback = feedback || responses[question.id]

  // KP Sidebar Logic
  const kpMap = new Map<number, { name: string; questionIds: number[] }>()
  for (const q of questions) {
    const kpId = q.kp_id || 0
    if (!kpMap.has(kpId)) {
      kpMap.set(kpId, { 
        name: q.kp_name || `知识点 ${kpMap.size + 1}`, 
        questionIds: [] 
      })
    }
    kpMap.get(kpId)!.questionIds.push(q.id)
  }

  const kpData = Array.from(kpMap.entries()).map(([kpId, kp]) => {
    const allAnswered = kp.questionIds.every(qId => responses[qId])
    const isCurrent = kp.questionIds.includes(questions[currentIdx]?.id)
    return {
      name: kp.name,
      status: allAnswered ? 'done' as const : isCurrent ? 'active' as const : 'pending' as const,
    }
  })

  const questionSegments = questions.map((q, i) => {
    const resp = responses[q.id]
    if (i === currentIdx && !resp) return { status: 'current' as const }
    if (!resp) return { status: 'unanswered' as const }
    return { status: resp.is_correct ? 'correct' as const : 'incorrect' as const }
  })

  return (
    <SplitPanel
      sidebar={
        <div className="flex flex-col h-full">
          <div className="p-6 border-b border-outline-variant/10">
            <h2 className="font-headline font-bold text-on-surface truncate">{moduleTitle}</h2>
            <p className="text-xs text-on-surface-variant mt-1">Q&A 知识练习</p>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            <KnowledgePointList 
              items={kpData} 
              activeColor="blue" 
              onItemClick={() => {}} 
            />
          </div>
        </div>
      }
      content={
        <div className="flex flex-col h-full">
          <GlassHeader className="px-8 py-4">
            <div className="flex items-center justify-between mb-4">
              <Breadcrumb items={[
                { label: bookTitle, href: `/books/${bookId}` },
                { label: `${moduleTitle} Q&A` },
              ]} />
              <Badge variant="primary">{QUESTION_TYPE_LABELS[question.question_type] || '知识练习'}</Badge>
            </div>
            <SegmentedProgress segments={questionSegments} />
          </GlassHeader>

          <div className="flex-1 overflow-y-auto p-8 lg:p-12 pb-40 space-y-10">
            {/* Question */}
            <ChatBubble role="ai">
              <div className="text-lg font-bold font-headline mb-4">
                <AIResponse content={question.question_text} />
              </div>
            </ChatBubble>

            {/* Answer Input */}
            {question.question_type === 'scaffolded_mc' && question.options ? (
              <MCOptionGroup 
                value={isAnswered ? currentFeedback?.user_answer || '' : currentAnswer} 
                onValueChange={(val) => !isAnswered && !isSubmitting && setCurrentAnswer(val)}
                disabled={isAnswered || isSubmitting}
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
              <div className="relative group max-w-2xl">
                <textarea
                  value={isAnswered ? currentFeedback?.user_answer || '(已提交)' : currentAnswer}
                  onChange={(e) => { setCurrentAnswer(e.target.value); setError(null); }}
                  disabled={isAnswered || isSubmitting}
                  placeholder="输入你的回答或分析过程..."
                  rows={6}
                  className="w-full bg-surface-container-low border border-outline-variant/10 rounded-2xl px-8 py-6 text-on-surface text-lg leading-relaxed focus:outline-none focus:ring-4 focus:ring-primary/5 focus:bg-surface-bright transition-all placeholder:text-on-surface-variant/30 resize-none shadow-sm"
                />
              </div>
            )}

            {/* Scaffolding / Hint */}
            {question.scaffolding && !currentFeedback && (
              <div className="animate-in fade-in duration-700">
                <ChatBubble role="ai">
                  <div className="flex items-center gap-2 mb-2 text-primary opacity-70">
                    <span className="material-symbols-outlined text-sm">lightbulb</span>
                    <span className="text-[10px] font-black uppercase tracking-widest">学习启发</span>
                  </div>
                  <div className="italic text-on-surface-variant">
                    <AIResponse content={question.scaffolding} />
                  </div>
                </ChatBubble>
              </div>
            )}

            {error && (
              <div className="bg-error/10 text-error p-4 rounded-xl text-sm font-medium animate-in fade-in slide-in-from-top-1">
                {error}
              </div>
            )}
          </div>

          {!feedback && (
            <footer className="absolute bottom-0 left-0 w-full bg-white/80 backdrop-blur-md border-t border-outline-variant/10 p-6 flex items-center justify-between z-20">
              <span className="text-sm font-bold text-on-surface-variant">
                进度 {Object.keys(responses).length} / {questions.length}
              </span>
              <AmberButton 
                onClick={handleSubmit} 
                disabled={!currentAnswer.trim() || isSubmitting || isAnswered}
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
            explanation={feedback.feedback}
            onNext={isLastQuestion ? handleFinalize : handleNext}
            nextLabel={isLastQuestion ? '完成 Q&A' : '下一题'}
            variant="qa"
          />
        )
      }
    />
  )
}
