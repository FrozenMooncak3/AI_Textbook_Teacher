'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import AIResponse from '@/components/AIResponse'
import LoadingState from '@/components/LoadingState'
import ExamTopBar from '@/components/ui/ExamTopBar'
import { MCOptionGroup, MCOptionCard } from '@/components/ui/MCOptionCard'
import QuestionNavigator from '@/components/ui/QuestionNavigator'
import FlagButton from '@/components/ui/FlagButton'
import Badge from '@/components/ui/Badge'
import AmberButton from '@/components/ui/AmberButton'
import ContentCard from '@/components/ui/ContentCard'
import ProgressRing from '@/components/ui/ProgressRing'

// --- Types ---

interface TestQuestion {
  id: number
  question_type: 'single_choice' | 'c2_evaluation' | 'calculation' | 'essay'
  question_text: string
  options?: string[]
  order_index: number
}

interface TestHistoryEntry {
  paper_id: number
  attempt_number: number
  total_score: number | null
  pass_rate: number | null
  is_passed: boolean
  created_at: string
}

interface TestResultEntry {
  question_id: number
  question_type: string
  question_text: string
  options?: string[]
  correct_answer: string
  explanation: string
  user_answer: string
  is_correct: boolean
  score: number
  max_score: number
  feedback: string
  error_type: string
  remediation: string
}

interface TestSubmitData {
  paper_id: number
  attempt_number: number
  total_score: number
  max_score: number
  pass_rate: number
  is_passed: boolean
  results: TestResultEntry[]
}

type Stage = 'test_intro' | 'generating' | 'answering' | 'review' | 'submitting' | 'results' | 'error'

const ERROR_TYPE_LABELS: Record<string, string> = {
  blind_spot: '知识盲点',
  procedural: '程序性失误',
  confusion: '概念混淆',
  careless: '粗心错误',
}

const QUESTION_TYPE_LABELS: Record<string, string> = {
  single_choice: '单选题',
  c2_evaluation: 'C2 评估题',
  calculation: '计算题',
  essay: '思考题',
}

export default function TestSession({
  moduleId,
  moduleTitle,
  bookId,
  learningStatus,
  initialHistory = [],
  inProgressPaperId = null,
}: {
  moduleId: number
  moduleTitle: string
  bookId: number
  learningStatus: string
  initialHistory?: TestHistoryEntry[]
  inProgressPaperId?: number | null
}) {
  const router = useRouter()
  const [stage, setStage] = useState<Stage>('test_intro')
  const [history, setHistory] = useState<TestHistoryEntry[]>(initialHistory)
  const [paperId, setPaperId] = useState<number | null>(inProgressPaperId)
  const [questions, setQuestions] = useState<TestQuestion[]>([])
  const [answers, setAnswers] = useState<Record<number, string>>({})
  const [flags, setFlags] = useState<Set<number>>(new Set())
  const [currentIndex, setCurrentIndex] = useState(0)
  const [submitResult, setSubmitResult] = useState<TestSubmitData | null>(null)
  const [errorMsg, setErrorMsg] = useState('')

  // ── Persistence ─────────────────────────────────────────────
  
  const saveToLocal = useCallback((currentAnswers: Record<number, string>, currentFlags: Set<number>) => {
    if (!paperId) return
    localStorage.setItem(`test_${paperId}_answers`, JSON.stringify(currentAnswers))
    localStorage.setItem(`test_${paperId}_flags`, JSON.stringify(Array.from(currentFlags)))
  }, [paperId])

  const restoreFromLocal = useCallback(() => {
    if (!paperId) return
    const savedAnswers = localStorage.getItem(`test_${paperId}_answers`)
    const savedFlags = localStorage.getItem(`test_${paperId}_flags`)
    
    if (savedAnswers) {
      try {
        setAnswers(JSON.parse(savedAnswers))
      } catch (e) {
        // silently ignore malformed JSON
      }
    }
    
    if (savedFlags) {
      try {
        setFlags(new Set(JSON.parse(savedFlags)))
      } catch (e) {
        // silently ignore malformed JSON
      }
    }
  }, [paperId])

  useEffect(() => {
    if (stage === 'answering' && paperId) {
      restoreFromLocal()
    }
  }, [stage, paperId, restoreFromLocal])

  const updateAnswer = (questionId: number, value: string) => {
    const newAnswers = { ...answers, [questionId]: value }
    setAnswers(newAnswers)
    saveToLocal(newAnswers, flags)
  }

  const toggleFlag = (questionId: number) => {
    const newFlags = new Set(flags)
    if (newFlags.has(questionId)) {
      newFlags.delete(questionId)
    } else {
      newFlags.add(questionId)
    }
    setFlags(newFlags)
    saveToLocal(answers, newFlags)
  }

  // ── Logic ───────────────────────────────────────────────────

  const consecutiveFails = history
    .slice(0, 3)
    .filter((h) => h.total_score !== null && !h.is_passed).length === 3 && history.length >= 3

  const hasFailures = history.some((h) => h.total_score !== null && !h.is_passed)

  async function startTest(retake = false) {
    setStage('generating')
    try {
      const res = await fetch(`/api/modules/${moduleId}/test/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ retake }),
      })
      const { success, data, error } = await res.json()
      if (!success) {
        setErrorMsg(error || '生成试卷失败')
        setStage('error')
        return
      }

      setPaperId(data.paper_id)
      setQuestions(data.questions)
      setAnswers({})
      setFlags(new Set())
      setCurrentIndex(0)
      setStage('answering')
    } catch (err) {
      setErrorMsg('网络请求失败')
      setStage('error')
    }
  }

  async function handleSubmit() {
    setStage('submitting')
    try {
      const answerList = questions.map((q) => ({
        question_id: q.id,
        user_answer: answers[q.id] || '',
      }))

      const res = await fetch(`/api/modules/${moduleId}/test/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paper_id: paperId,
          answers: answerList,
        }),
      })
      const { success, data, error } = await res.json()
      if (!success) {
        setErrorMsg(error || '提交评分失败')
        setStage('error')
        return
      }

      setSubmitResult(data)
      setStage('results')
      
      if (paperId) {
        localStorage.removeItem(`test_${paperId}_answers`)
        localStorage.removeItem(`test_${paperId}_flags`)
      }

      const statusRes = await fetch(`/api/modules/${moduleId}/test`)
      const statusData = await statusRes.json()
      if (statusData.success) {
        setHistory(statusData.data.history)
      }
    } catch (err) {
      setErrorMsg('提交请求失败')
      setStage('error')
    }
  }

  const handleExit = () => {
    if (stage === 'answering' || stage === 'review') {
      if (confirm('确定要退出测试吗？你的进度将保存在本地。')) {
        router.push(`/books/${bookId}`)
      }
    } else {
      router.push(`/books/${bookId}`)
    }
  }

  // ── Rendering ───────────────────────────────────────────────

  if (stage === 'test_intro') {
    return (
      <div className="min-h-screen bg-surface-container-low flex items-center justify-center p-6">
        <ContentCard className="p-8 md:p-12 max-w-xl w-full">
          <div className="flex flex-col items-center text-center mb-10">
            <div className="w-20 h-20 amber-glow rounded-3xl flex items-center justify-center mb-6 shadow-lg shadow-orange-900/20 text-white">
              <span className="material-symbols-outlined text-4xl">quiz</span>
            </div>
            <h2 className="text-3xl font-black text-on-surface font-headline tracking-tight mb-2">
              {moduleTitle}
            </h2>
            <p className="text-on-surface-variant font-medium text-sm uppercase tracking-widest">结课测评</p>
          </div>
          
          <div className="bg-primary/5 border border-primary/10 rounded-2xl p-6 mb-8">
            <div className="flex items-center gap-3 mb-3 text-primary">
              <span className="material-symbols-outlined text-xl">lightbulb</span>
              <p className="text-sm font-black font-headline tracking-wide uppercase">温馨提示</p>
            </div>
            <p className="text-sm text-on-surface-variant leading-relaxed">
              建议在学习完笔记后，间隔一定时间（如 24 小时）再进行测试。间隔效应能帮助你发现真正的知识盲点并加固记忆。
            </p>
          </div>

          {consecutiveFails && (
            <div className="bg-error-container/10 border border-error/20 rounded-2xl p-6 mb-8">
              <div className="flex items-center gap-3 mb-2 text-error">
                <span className="material-symbols-outlined text-xl">warning</span>
                <p className="text-sm font-black font-headline tracking-wide uppercase">复习建议</p>
              </div>
              <p className="text-sm text-error/80 font-medium">
                最近三次测试均未过关。这意味着基础概念尚不牢固，建议回到 Q&A 重新训练后再来挑战。
              </p>
            </div>
          )}

          <div className="space-y-4 mb-10">
            <div className="flex items-center justify-between p-4 bg-surface-container-low rounded-xl">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-on-surface-variant">check_circle</span>
                <span className="text-sm font-bold text-on-surface">过关要求</span>
              </div>
              <span className="text-sm font-black text-primary font-headline">总分 80%</span>
            </div>
            <div className="flex items-center justify-between p-4 bg-surface-container-low rounded-xl">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-on-surface-variant">timer_off</span>
                <span className="text-sm font-bold text-on-surface">测评模式</span>
              </div>
              <span className="text-sm font-black text-on-surface-variant font-headline">禁止查看笔记</span>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <AmberButton
              onClick={() => startTest(hasFailures && !paperId)}
              fullWidth
              size="lg"
            >
              {paperId ? '继续当前测评' : hasFailures ? '重新开始测评' : '立即开始测评'}
            </AmberButton>
            <button
              onClick={handleExit}
              className="w-full text-on-surface-variant font-bold py-3 hover:text-on-surface transition-colors"
            >
              以后再来
            </button>
          </div>
        </ContentCard>
      </div>
    )
  }

  if (stage === 'generating' || stage === 'submitting') {
    return (
      <div className="min-h-screen bg-surface-container-low flex flex-col items-center justify-center p-6">
        <LoadingState 
          label={stage === 'generating' ? 'AI 正在为你生成试卷...' : 'AI 正在评分诊断...'} 
        />
      </div>
    )
  }

  if (stage === 'error') {
    return (
      <div className="min-h-screen bg-surface-container-low flex items-center justify-center p-6">
        <ContentCard className="p-12 text-center max-w-md w-full border-error/20">
          <div className="w-20 h-20 bg-error-container/10 text-error rounded-full flex items-center justify-center mx-auto mb-8 text-4xl shadow-sm">
            <span className="material-symbols-outlined text-4xl" style={{ fontVariationSettings: "'FILL' 1" }}>error</span>
          </div>
          <h3 className="text-2xl font-black text-on-surface mb-4 font-headline tracking-tight">操作失败</h3>
          <p className="text-on-surface-variant mb-10 leading-relaxed font-medium">{errorMsg}</p>
          <AmberButton onClick={() => setStage('test_intro')} fullWidth>返回重试</AmberButton>
        </ContentCard>
      </div>
    )
  }

  if (stage === 'answering') {
    const currentQuestion = questions[currentIndex]
    if (!currentQuestion) return null

    const segments = questions.map((q, i) => {
      if (i === currentIndex) return { status: 'current' as const }
      if (flags.has(q.id)) return { status: 'flagged' as const } // Note: SegmentedProgress might not have 'flagged', but instructions said 'answered'
      if (answers[q.id]?.trim()) return { status: 'answered' as const }
      return { status: 'unanswered' as const }
    })

    const navigatorQuestions = questions.map((q, i) => {
      if (i === currentIndex) return { status: 'current' as const }
      if (flags.has(q.id)) return { status: 'flagged' as const }
      if (answers[q.id]?.trim()) return { status: 'answered' as const }
      return { status: 'unanswered' as const }
    })

    return (
      <div className="min-h-screen bg-surface-container-low flex flex-col">
        <ExamTopBar 
          moduleTitle={moduleTitle}
          currentQuestion={currentIndex + 1}
          totalQuestions={questions.length}
          segments={segments.map(s => s.status === 'flagged' ? { ...s, status: 'current' } : s)} // Map flagged to current/answered for top bar
          onExit={handleExit}
        />

        <main className="pt-32 pb-40 px-6 overflow-y-auto">
          <div className="max-w-3xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <ContentCard className="p-8 md:p-12 relative">
              <div className="flex justify-between items-center mb-10">
                <Badge variant="info">{QUESTION_TYPE_LABELS[currentQuestion.question_type]}</Badge>
                <FlagButton 
                  flagged={flags.has(currentQuestion.id)} 
                  onClick={() => toggleFlag(currentQuestion.id)} 
                />
              </div>

              <div className="text-on-surface text-xl md:text-2xl font-bold leading-relaxed font-headline mb-12">
                <AIResponse content={currentQuestion.question_text} />
              </div>

              {currentQuestion.question_type === 'single_choice' && currentQuestion.options ? (
                <MCOptionGroup
                  value={answers[currentQuestion.id] || ''}
                  onValueChange={(val) => updateAnswer(currentQuestion.id, val)}
                >
                  {currentQuestion.options.map((opt) => {
                    const letter = opt.trim().charAt(0).toUpperCase()
                    return (
                      <MCOptionCard 
                        key={opt}
                        value={letter}
                        label={letter}
                        text={opt.substring(opt.indexOf('.') + 1).trim() || opt}
                      />
                    )
                  })}
                </MCOptionGroup>
              ) : (
                <div className="group relative">
                  <textarea
                    value={answers[currentQuestion.id] ?? ''}
                    onChange={(e) => updateAnswer(currentQuestion.id, e.target.value)}
                    placeholder="请输入你的回答分析过程..."
                    className="w-full min-h-[240px] p-8 rounded-[32px] bg-surface-container-low border border-outline-variant/10 focus:bg-surface-container-lowest focus:border-primary focus:ring-4 focus:ring-primary/5 outline-none text-lg leading-relaxed font-body transition-all placeholder:text-on-surface-variant/30 shadow-inner"
                  />
                  <div className="absolute bottom-6 right-8 text-[10px] font-black text-on-surface-variant/20 uppercase tracking-widest pointer-events-none group-focus-within:opacity-0 transition-opacity">
                    主观题作答区
                  </div>
                </div>
              )}
            </ContentCard>
          </div>
        </main>

        <QuestionNavigator 
          questions={navigatorQuestions} 
          onSelect={setCurrentIndex}
          onPrev={() => currentIndex > 0 && setCurrentIndex(currentIndex - 1)}
          onNext={() => currentIndex < questions.length - 1 ? setCurrentIndex(currentIndex + 1) : setStage('review')}
        />
      </div>
    )
  }

  if (stage === 'review') {
    const unansweredIndices = questions
      .map((q, i) => (!answers[q.id]?.trim() ? i : -1))
      .filter((i) => i !== -1)
    
    const flaggedIndices = questions
      .map((q, i) => (flags.has(q.id) ? i : -1))
      .filter((i) => i !== -1)

    const isComplete = unansweredIndices.length === 0 && flaggedIndices.length === 0

    return (
      <div className="min-h-screen bg-surface-container-low flex flex-col py-20 px-6">
        <div className="max-w-2xl mx-auto w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-black text-on-surface font-headline tracking-tight mb-4">检查你的答案</h2>
            <div className="flex items-center justify-center gap-6">
              <div className="flex flex-col items-center">
                <span className="text-2xl font-black text-on-surface font-headline">{Object.keys(answers).length} / {questions.length}</span>
                <span className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest opacity-50">已回答题目</span>
              </div>
              <div className="w-px h-8 bg-outline-variant/20" />
              <div className="flex flex-col items-center">
                <span className="text-2xl font-black text-tertiary font-headline">{flags.size}</span>
                <span className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest opacity-50">标记复查</span>
              </div>
            </div>
          </div>

          <div className="space-y-6 mb-12">
            {unansweredIndices.length > 0 && (
              <div className="bg-error-container/5 border border-error/10 rounded-3xl p-8">
                <h3 className="text-sm font-black text-error font-headline uppercase tracking-widest mb-6 flex items-center gap-2">
                  <span className="material-symbols-outlined text-lg">pending_actions</span>
                  未答题目 ({unansweredIndices.length})
                </h3>
                <div className="flex flex-wrap gap-3">
                  {unansweredIndices.map((idx) => (
                    <button
                      key={idx}
                      onClick={() => { setCurrentIndex(idx); setStage('answering'); }}
                      className="w-12 h-12 rounded-full bg-surface-container-lowest border border-error/20 flex items-center justify-center font-black font-headline text-error hover:bg-error hover:text-white transition-all active:scale-90"
                    >
                      {idx + 1}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {flaggedIndices.length > 0 && (
              <div className="bg-tertiary-container/10 border border-tertiary-container/30 rounded-3xl p-8">
                <h3 className="text-sm font-black text-tertiary font-headline uppercase tracking-widest mb-6 flex items-center gap-2">
                  <span className="material-symbols-outlined text-lg">flag</span>
                  需复查题目 ({flaggedIndices.length})
                </h3>
                <div className="flex flex-wrap gap-3">
                  {flaggedIndices.map((idx) => (
                    <button
                      key={idx}
                      onClick={() => { setCurrentIndex(idx); setStage('answering'); }}
                      className="w-12 h-12 rounded-full bg-tertiary-container text-on-tertiary-container flex items-center justify-center font-black font-headline hover:bg-tertiary hover:text-white transition-all active:scale-90 shadow-sm"
                    >
                      {idx + 1}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {isComplete && (
              <div className="bg-emerald-50 border border-emerald-100 rounded-3xl p-10 text-center">
                <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6 text-3xl">
                  <span className="material-symbols-outlined text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
                </div>
                <h3 className="text-xl font-bold text-emerald-900 mb-2">准备就绪!</h3>
                <p className="text-emerald-700 font-medium">你已经完成了所有题目且没有待复查项。现在可以提交试卷了。</p>
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-4">
            <button
              onClick={() => setStage('answering')}
              className="flex-1 bg-surface-container-lowest border border-outline-variant text-on-surface font-black font-headline py-4 rounded-full hover:bg-surface-container transition-all active:scale-95 shadow-sm"
            >
              返回检查
            </button>
            <AmberButton onClick={handleSubmit} size="lg">确认交卷</AmberButton>
          </div>
        </div>
      </div>
    )
  }

  if (stage === 'results' && submitResult) {
    const { total_score, max_score, pass_rate, is_passed, results } = submitResult

    return (
      <div className="max-w-4xl mx-auto p-6 md:p-12 pb-24 space-y-12">
        <ContentCard className={cn(
          "p-10 md:p-16 text-center shadow-xl border-t-8",
          is_passed ? "border-emerald-500 bg-emerald-50/20" : "border-error bg-red-50/20"
        )}>
          <div className="mb-8">
            <Badge variant={is_passed ? "success" : "error"}>
              {is_passed ? '考试通过' : '测试未通过'}
            </Badge>
          </div>
          
          <div className="flex justify-center mb-8">
            <ProgressRing value={pass_rate} label="通过率" className="w-48 h-48" />
          </div>

          <div className="flex items-center justify-center gap-3 mb-10">
            <span className="text-7xl font-black text-on-surface font-headline tracking-tighter">{total_score}</span>
            <span className="text-2xl text-on-surface-variant font-bold opacity-30 mt-6">/ {max_score}</span>
          </div>

          {!is_passed && (
            <p className="text-lg text-error font-bold mb-10 max-w-sm mx-auto leading-snug">
              遗憾未达到过关线。别灰心，AI 已经为你生成了针对性的补救建议。
            </p>
          )}

          <div className="flex flex-col sm:flex-row gap-4 max-w-md mx-auto">
            {!is_passed && (
              <AmberButton onClick={() => startTest(true)} fullWidth>重新测试</AmberButton>
            )}
            <button
              onClick={() => router.push(`/books/${bookId}`)}
              className="flex-1 bg-surface-container-lowest border-2 border-outline-variant/30 text-on-surface font-black font-headline py-4 px-8 rounded-full hover:bg-surface-container transition-all active:scale-95"
            >
              返回教材
            </button>
          </div>
        </ContentCard>

        <div className="space-y-10">
          <div className="flex items-center gap-4 px-4">
            <div className="h-px flex-1 bg-outline-variant/20" />
            <h3 className="text-sm font-black text-on-surface-variant font-headline uppercase tracking-[0.3em]">详细解析报告</h3>
            <div className="h-px flex-1 bg-outline-variant/20" />
          </div>

          {results.map((r, idx) => (
            <ContentCard key={r.question_id} className="overflow-hidden p-0">
              <div className={cn(
                "px-8 py-5 flex items-center justify-between border-b",
                r.is_correct ? "bg-emerald-50/30 border-emerald-100" : "bg-error-container/5 border-error/10"
              )}>
                <div className="flex items-center gap-4">
                  <div className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center font-black font-headline text-sm",
                    r.is_correct ? "bg-emerald-100 text-emerald-700" : "bg-error-container/20 text-error"
                  )}>
                    {idx + 1}
                  </div>
                  <span className="text-xs font-black text-on-surface-variant font-headline uppercase tracking-widest">
                    {QUESTION_TYPE_LABELS[r.question_type] || r.question_type}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  {!r.is_correct && r.error_type && (
                    <Badge variant="warning">{ERROR_TYPE_LABELS[r.error_type] || r.error_type}</Badge>
                  )}
                  <span className={cn(
                    "text-lg font-black font-headline",
                    r.is_correct ? "text-emerald-600" : "text-error"
                  )}>
                    {r.score} <span className="text-xs opacity-30 font-medium">/ {r.max_score}</span>
                  </span>
                </div>
              </div>

              <div className="p-8 md:p-10 space-y-8">
                <div className="text-on-surface font-bold text-lg leading-relaxed">
                  <AIResponse content={r.question_text} />
                </div>
                
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-[10px] font-black text-on-surface-variant/40 uppercase tracking-widest">
                      <span className="material-symbols-outlined text-sm">person</span>
                      你的回答
                    </div>
                    <div className={cn(
                      "p-6 rounded-2xl border text-sm font-medium leading-loose min-h-[100px]",
                      r.is_correct ? "border-emerald-100 bg-emerald-50/20 text-emerald-900" : "border-error/10 bg-error-container/5 text-on-surface"
                    )}>
                      {r.user_answer || '(未作答)'}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-[10px] font-black text-emerald-600/60 uppercase tracking-widest">
                      <span className="material-symbols-outlined text-sm">check_circle</span>
                      标准答案
                    </div>
                    <div className="p-6 bg-emerald-50/40 border border-emerald-100 rounded-2xl text-sm font-bold text-emerald-900 leading-loose min-h-[100px]">
                      <AIResponse content={r.correct_answer || '无标准答案'} />
                    </div>
                  </div>
                </div>

                <div className="bg-surface-container-low/50 rounded-3xl p-8 border border-outline-variant/10">
                  <div className="flex items-center gap-3 mb-4 text-on-surface-variant">
                    <span className="material-symbols-outlined text-xl">auto_awesome</span>
                    <h4 className="text-xs font-black font-headline uppercase tracking-[0.2em]">AI 深度诊断</h4>
                  </div>
                  <div className="prose prose-sm max-w-none text-on-surface-variant leading-relaxed">
                    <AIResponse content={r.explanation} />
                    {r.feedback && (
                      <div className="mt-6 pt-6 border-t border-outline-variant/10">
                        <div className="text-[10px] font-black text-primary uppercase tracking-widest mb-3">针对性反馈</div>
                        <AIResponse content={r.feedback} />
                      </div>
                    )}
                  </div>
                </div>

                {!r.is_correct && r.remediation && (
                  <div className="bg-tertiary-container/10 border border-tertiary-container/20 rounded-3xl p-8 flex gap-5 items-start">
                    <div className="w-10 h-10 bg-tertiary-container rounded-full flex items-center justify-center shrink-0 text-tertiary">
                      <span className="material-symbols-outlined text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>healing</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-black text-tertiary uppercase tracking-widest block mb-2">补救性学习建议</span>
                      <div className="text-on-tertiary-container font-medium text-sm leading-relaxed italic">
                        <AIResponse content={r.remediation} />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </ContentCard>
          ))}
        </div>
      </div>
    )
  }

  return null
}
