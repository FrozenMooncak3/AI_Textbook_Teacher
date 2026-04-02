'use client'

import { useState, useEffect } from 'react'
import MarkdownRenderer from '@/components/MarkdownRenderer'
import Link from 'next/link'

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
  has_next: boolean
  next_question: Question | null
}

interface Cluster {
  name: string
  correct: number
  total: number
}

interface Summary {
  total_questions: number
  correct_count: number
  accuracy: number
  clusters: Cluster[]
}

interface NextReview {
  round: number
  due_date: string
}

type Phase = 'intro' | 'answering' | 'feedback' | 'complete'

const LoadingSpinner = () => (
  <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
)

export default function ReviewSession({
  bookId,
  moduleId,
  scheduleId,
}: {
  bookId: number
  moduleId: number
  scheduleId: number
}) {
  const [phase, setPhase] = useState<Phase>('intro')
  const [question, setQuestion] = useState<Question | null>(null)
  const [totalQuestions, setTotalQuestions] = useState(0)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [userAnswer, setUserAnswer] = useState('')
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [summary, setSummary] = useState<Summary | null>(null)
  const [nextReview, setNextReview] = useState<NextReview | null>(null)
  
  const [isLoading, setIsLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // ── 开始复习 (Generate) ───────────────────────────────────
  const startReview = async () => {
    setIsLoading(true)
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
      }
    } catch {
      setError('网络连接失败，请重试')
    } finally {
      setIsLoading(false)
    }
  }

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
    setIsLoading(true)
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
      }
    } catch {
      setError('网络连接失败，请重试')
    } finally {
      setIsLoading(false)
    }
  }

  // ── 渲染逻辑 ───────────────────────────────────────────────

  if (phase === 'intro') {
    return (
      <div className="max-w-2xl mx-auto mt-10 p-8 bg-white rounded-2xl border border-slate-200 shadow-sm text-center">
        <h2 className="text-2xl font-bold text-slate-900 mb-4">准备好开始复习了吗？</h2>
        <p className="text-slate-600 mb-8 leading-relaxed">
          我们将根据你的学习进度，为你准备一系列针对性的练习题。请认真思考并回答每一个问题，系统将为你提供即时的 AI 反馈。
        </p>
        <button 
          onClick={startReview}
          disabled={isLoading}
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-10 rounded-xl transition-all shadow-lg shadow-blue-100 disabled:opacity-50 flex items-center justify-center gap-3 mx-auto"
        >
          {isLoading ? <LoadingSpinner /> : null}
          开始本次复习
        </button>
        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
      </div>
    )
  }

  if (phase === 'complete' && summary) {
    return (
      <div className="max-w-2xl mx-auto mt-10 p-10 bg-white rounded-2xl border border-slate-200 shadow-sm">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-emerald-50 rounded-full mb-6">
            <span className="text-4xl">🎉</span>
          </div>
          <h2 className="text-3xl font-bold text-slate-900 mb-2">复习任务已完成</h2>
          <p className="text-slate-500">做得好！你已经完成了本次知识点的巩固。</p>
        </div>

        <div className="grid grid-cols-2 gap-6 mb-10">
          <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 text-center">
            <p className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-1">本次正确率</p>
            <p className="text-4xl font-black text-blue-600">{Math.round(summary.accuracy * 100)}%</p>
          </div>
          <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 text-center">
            <p className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-1">答对题目</p>
            <p className="text-4xl font-black text-slate-900">{summary.correct_count} / {summary.total_questions}</p>
          </div>
        </div>

        <div className="space-y-4 mb-10">
          <h3 className="font-bold text-slate-900 flex items-center gap-2">
            <svg className="w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            知识集群掌握情况
          </h3>
          <div className="grid gap-3">
            {summary.clusters.map(c => (
              <div key={c.name} className="flex items-center justify-between p-4 bg-white border border-slate-100 rounded-xl">
                <span className="font-medium text-slate-700">{c.name}</span>
                <div className="flex items-center gap-3">
                  <div className="w-32 bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div 
                      className="bg-blue-500 h-full rounded-full" 
                      style={{ width: `${(c.correct / c.total) * 100}%` }}
                    />
                  </div>
                  <span className="text-sm font-bold text-slate-500 w-10 text-right">{c.correct}/{c.total}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {nextReview && (
          <div className="p-6 bg-amber-50 rounded-2xl border border-amber-100 mb-10">
            <p className="text-amber-900 font-medium">
              下一次复习将在 <span className="font-bold">第 {nextReview.round} 轮</span> 进行（计划日期：{nextReview.due_date}）。
            </p>
          </div>
        )}

        <Link 
          href="/"
          className="block w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-4 rounded-xl text-center transition-all shadow-lg"
        >
          返回我的学习主页
        </Link>
      </div>
    )
  }

  if (isLoading || !question) {
    return (
      <div className="max-w-2xl mx-auto mt-20 text-center">
        <div className="inline-block w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-6"></div>
        <p className="text-slate-500 font-medium">AI 正在加载你的复习内容...</p>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 mt-6 pb-20">
      {/* Header & Progress */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Review Session</span>
            <h2 className="text-xl font-bold text-slate-900">巩固练习</h2>
          </div>
          <div className="text-right">
            <span className="text-sm font-bold text-blue-600">第 {currentIndex} 题</span>
            <span className="text-sm text-slate-400"> / 共 {totalQuestions} 题</span>
          </div>
        </div>
        <div className="w-full bg-slate-100 rounded-full h-2">
          <div 
            className="bg-blue-600 h-2 rounded-full transition-all duration-500 shadow-sm shadow-blue-200"
            style={{ width: `${(currentIndex / totalQuestions) * 100}%` }}
          />
        </div>
      </div>

      {/* Question Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 bg-slate-50/50 border-b border-slate-100">
          <span className="text-xs bg-slate-200 text-slate-600 px-2 py-0.5 rounded font-bold uppercase tracking-tight">
            {question.type.replace('_', ' ')}
          </span>
        </div>
        
        <div className="p-8">
          <div className="text-lg text-slate-900 leading-relaxed font-medium mb-8">
            <MarkdownRenderer content={question.text} />
          </div>

          {/* Answer Area */}
          <div className="space-y-6">
            {question.type === 'single_choice' && question.options ? (
              <div className="grid gap-3">
                {question.options.map((opt) => {
                  const optId = opt.charAt(0) // Extract A, B, C, D
                  const isSelected = userAnswer === optId
                  return (
                    <button
                      key={opt}
                      onClick={() => !feedback && setUserAnswer(optId)}
                      disabled={!!feedback || isSubmitting}
                      className={`text-left p-4 rounded-xl border-2 transition-all flex items-center gap-4 ${
                        isSelected 
                          ? 'border-blue-500 bg-blue-50 text-blue-900' 
                          : 'border-slate-100 bg-slate-50/50 text-slate-700 hover:border-slate-200'
                      } ${feedback ? 'cursor-default opacity-80' : 'cursor-pointer'}`}
                    >
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center font-bold text-xs ${
                        isSelected ? 'border-blue-500 bg-blue-500 text-white' : 'border-slate-300'
                      }`}>
                        {optId}
                      </div>
                      <span className="font-medium">{opt}</span>
                    </button>
                  )
                })}
              </div>
            ) : (
              <textarea 
                value={userAnswer}
                onChange={(e) => setUserAnswer(e.target.value)}
                disabled={!!feedback || isSubmitting}
                placeholder="在此输入你的分析或回答..."
                rows={6}
                className="w-full border border-slate-200 rounded-2xl px-5 py-4 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all placeholder:text-slate-300 resize-none bg-slate-50/30 disabled:bg-slate-50 disabled:text-slate-500"
              />
            )}
            
            {error && (
              <p className="text-sm text-red-600 flex items-center gap-1">
                <span>⚠️</span> {error}
              </p>
            )}

            {!feedback && (
              <button 
                onClick={handleSubmit}
                disabled={!userAnswer.trim() || isSubmitting}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold py-4 rounded-xl shadow-lg shadow-blue-200 transition-all flex items-center justify-center gap-3"
              >
                {isSubmitting ? <LoadingSpinner /> : null}
                {isSubmitting ? 'AI 正在评分...' : '提交回答'}
              </button>
            )}
          </div>
        </div>

        {/* Feedback Area */}
        {feedback && (
          <div className={`p-8 border-t ${feedback.is_correct ? 'bg-emerald-50/30 border-emerald-100' : 'bg-amber-50/30 border-amber-100'}`}>
            <div className="flex items-center gap-3 mb-4">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold ${feedback.is_correct ? 'bg-emerald-500' : 'bg-amber-500'}`}>
                {feedback.is_correct ? '✓' : '!'}
              </div>
              <div>
                <h4 className={`font-bold ${feedback.is_correct ? 'text-emerald-900' : 'text-amber-900'}`}>
                  {feedback.is_correct ? '正确' : '回答不完整或存在错误'}
                </h4>
                <p className="text-xs text-slate-400">评分：{Math.round(feedback.score * 100)} / 100</p>
              </div>
            </div>
            
            <div className="text-sm text-slate-700 leading-relaxed mb-8">
              <MarkdownRenderer content={feedback.ai_feedback} />
            </div>

            <button 
              onClick={handleNext}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-4 rounded-xl transition-all flex items-center justify-center gap-2"
            >
              {feedback.has_next ? '下一题' : '查看复习报告'}
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </button>
          </div>
        )}
      </div>

      <p className="text-center text-xs text-slate-400 font-medium">
        产品不变量 #2：已答题目不可修改
      </p>
    </div>
  )
}
