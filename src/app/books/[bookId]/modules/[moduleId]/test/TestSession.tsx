'use client'

import { useState, useEffect } from 'react'

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

interface TestStatusData {
  learning_status: string
  in_progress_paper_id: number | null
  history: TestHistoryEntry[]
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

type Stage = 'test_intro' | 'generating' | 'answering' | 'submitting' | 'results' | 'error'

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
  const [stage, setStage] = useState<Stage>('test_intro')
  const [history, setHistory] = useState<TestHistoryEntry[]>(initialHistory)
  const [paperId, setPaperId] = useState<number | null>(inProgressPaperId)
  const [questions, setQuestions] = useState<TestQuestion[]>([])
  const [answers, setAnswers] = useState<Record<number, string>>({})
  const [submitResult, setSubmitResult] = useState<TestSubmitData | null>(null)
  const [errorMsg, setErrorMsg] = useState('')

  // 检查是否最近 3 次测试都失败了
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
      setStage('answering')
    } catch (err) {
      setErrorMsg('网络请求失败')
      setStage('error')
    }
  }

  async function handleSubmit() {
    // 检查是否有未答题目
    const unanswered = questions.some((q) => !answers[q.id]?.trim())
    if (unanswered) {
      alert('请回答完所有题目后再提交')
      return
    }

    setStage('submitting')
    try {
      const answerList = questions.map((q) => ({
        question_id: q.id,
        user_answer: answers[q.id],
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
      
      // 提交成功后，刷新历史记录
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

  // ── 1. 引导页 ──────────────────────────────────────────────
  if (stage === 'test_intro') {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-8">
        <h2 className="text-xl font-semibold text-slate-900 mb-2">{moduleTitle} — 测试</h2>
        
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 my-6">
          <p className="text-sm text-blue-800 font-medium mb-1">💡 软提醒：建议隔天再做</p>
          <p className="text-xs text-blue-700">
            间隔效应让记忆更牢固。如果你刚读完笔记，睡一觉再考效果更好。
          </p>
        </div>

        {consecutiveFails && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
            <p className="text-sm text-amber-800 font-medium mb-1">⚠️ 复习建议</p>
            <p className="text-xs text-amber-700">
              最近三次测试均未过关，建议回到 Q&A 重新训练薄弱知识点，再来尝试。
            </p>
          </div>
        )}

        <div className="bg-slate-50 rounded-xl p-5 mb-8">
          <p className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-3">测试规则</p>
          <ul className="text-sm text-slate-600 space-y-2">
            <li className="flex items-center gap-2">
              <span className="w-1 h-1 bg-slate-400 rounded-full" />
              <span>禁止查看笔记或 Q&A 记录（盲测）</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="w-1 h-1 bg-slate-400 rounded-full" />
              <span className="font-medium text-slate-900">过关线：总分 80%</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="w-1 h-1 bg-slate-400 rounded-full" />
              <span>包含单选题与 AI 评分的主观题</span>
            </li>
          </ul>
        </div>

        <div className="flex flex-col gap-3">
          <button
            onClick={() => startTest(hasFailures && !paperId)}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-xl transition-colors"
          >
            {paperId ? '继续当前测试' : hasFailures ? '重新测试' : '开始测试'}
          </button>
          <a
            href={`/books/${bookId}`}
            className="w-full text-center border border-slate-300 text-slate-700 font-medium py-3 px-6 rounded-xl hover:bg-slate-50 transition-colors"
          >
            明天再来
          </a>
        </div>
      </div>
    )
  }

  // ── 2. 加载中 / 提交中 ──────────────────────────────────────
  if (stage === 'generating' || stage === 'submitting') {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-12 flex flex-col items-center justify-center text-center">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4" />
        <h3 className="text-lg font-semibold text-slate-900 mb-1">
          {stage === 'generating' ? 'AI 正在为你生成试卷...' : 'AI 正在评分诊断...'}
        </h3>
        <p className="text-sm text-slate-500">
          {stage === 'generating' ? '这将基于你的薄弱知识点定制题目' : '深度分析错误原因并给出补救建议'}
        </p>
      </div>
    )
  }

  // ── 3. 错误状态 ──────────────────────────────────────────────
  if (stage === 'error') {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center">
        <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <p className="text-slate-900 font-medium mb-4">{errorMsg}</p>
        <button
          onClick={() => setStage('test_intro')}
          className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium py-2 px-6 rounded-lg transition-colors"
        >
          返回重试
        </button>
      </div>
    )
  }

  // ── 4. 答题界面 ──────────────────────────────────────────────
  if (stage === 'answering') {
    const answeredCount = questions.filter((q) => answers[q.id]?.trim()).length

    return (
      <div className="space-y-6">
        <div className="bg-white rounded-xl border border-slate-200 p-4 sticky top-4 z-10 shadow-sm flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-slate-900">进度</span>
            <div className="w-32 h-2 bg-slate-100 rounded-full overflow-hidden">
              <div 
                className="h-full bg-blue-600 transition-all duration-300"
                style={{ width: `${(answeredCount / questions.length) * 100}%` }}
              />
            </div>
            <span className="text-xs font-medium text-slate-500">{answeredCount} / {questions.length}</span>
          </div>
          <button
            onClick={handleSubmit}
            disabled={answeredCount < questions.length}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold py-2 px-4 rounded-lg transition-colors"
          >
            提交试卷
          </button>
        </div>

        <div className="space-y-6 pb-12">
          {questions.map((q, idx) => (
            <div key={q.id} className="bg-white rounded-xl border border-slate-200 p-6">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Question {idx + 1}</span>
                <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded-md font-bold">
                  {QUESTION_TYPE_LABELS[q.question_type]}
                </span>
              </div>
              
              <p className="text-slate-900 font-medium mb-6 leading-relaxed whitespace-pre-wrap">
                {q.question_text}
              </p>

              {q.question_type === 'single_choice' && q.options ? (
                <div className="space-y-3">
                  {q.options.map((opt) => {
                    const letter = opt.trim().charAt(0)
                    const isSelected = answers[q.id] === letter
                    return (
                      <label
                        key={opt}
                        className={`flex items-start gap-3 p-4 rounded-xl border transition-all cursor-pointer ${
                          isSelected ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        <input
                          type="radio"
                          name={`q-${q.id}`}
                          value={letter}
                          checked={isSelected}
                          onChange={() => setAnswers({ ...answers, [q.id]: letter })}
                          className="mt-1 sr-only"
                        />
                        <div className={`w-5 h-5 rounded-full border flex items-center justify-center flex-shrink-0 mt-0.5 ${
                          isSelected ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300'
                        }`}>
                          {isSelected && <div className="w-2 h-2 bg-white rounded-full" />}
                        </div>
                        <span className={`text-sm ${isSelected ? 'text-blue-900 font-medium' : 'text-slate-700'}`}>
                          {opt}
                        </span>
                      </label>
                    )
                  })}
                </div>
              ) : (
                <textarea
                  value={answers[q.id] ?? ''}
                  onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
                  placeholder="在此输入你的回答..."
                  className="w-full min-h-[120px] p-4 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none text-sm leading-relaxed"
                />
              )}
            </div>
          ))}
        </div>
      </div>
    )
  }

  // ── 5. 结果展示 ──────────────────────────────────────────────
  if (stage === 'results' && submitResult) {
    const { total_score, max_score, pass_rate, is_passed, results } = submitResult

    return (
      <div className="space-y-8 pb-12">
        <div className={`rounded-2xl border p-8 text-center ${
          is_passed ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
        }`}>
          <div className="mb-4">
            <span className={`inline-flex items-center px-4 py-1.5 rounded-full text-sm font-bold uppercase tracking-wider ${
              is_passed ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
            }`}>
              {is_passed ? 'Test Passed' : 'Test Failed'}
            </span>
          </div>
          
          <div className="flex items-center justify-center gap-2 mb-2">
            <span className="text-4xl font-black text-slate-900">{total_score}</span>
            <span className="text-xl text-slate-400 font-medium">/ {max_score}</span>
          </div>

          <div className="mb-6">
            <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 max-w-[200px] mx-auto">
              <span>Pass Line</span>
              <span>80%</span>
            </div>
            <div className="w-full max-w-[200px] mx-auto h-2 bg-slate-200 rounded-full overflow-hidden">
              <div 
                className={`h-full transition-all duration-1000 ${is_passed ? 'bg-green-500' : 'bg-red-500'}`}
                style={{ width: `${Math.min(100, pass_rate)}%` }}
              />
            </div>
          </div>

          {!is_passed && (
            <p className="text-sm text-red-700 font-medium mb-6">
              未达到 80% 过关线。查看下方错题诊断并补救。
            </p>
          )}

          <div className="flex gap-4 max-w-sm mx-auto">
            {!is_passed && (
              <button
                onClick={() => startTest(true)}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-xl transition-colors"
              >
                重新测试
              </button>
            )}
            <a
              href={`/books/${bookId}`}
              className="flex-1 bg-white border border-slate-300 text-slate-700 font-bold py-3 px-6 rounded-xl hover:bg-slate-50 transition-colors"
            >
              返回地图
            </a>
          </div>
        </div>

        <div className="space-y-6">
          <h3 className="text-lg font-bold text-slate-900 px-2">逐题反馈</h3>
          {results.map((r, idx) => (
            <div key={r.question_id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <div className={`px-6 py-3 flex items-center justify-between ${
                r.is_correct ? 'bg-green-50/50 border-b border-green-100' : 'bg-red-50/50 border-b border-red-100'
              }`}>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-slate-400 uppercase">Q{idx + 1}</span>
                  <span className="text-xs font-bold text-slate-600">{QUESTION_TYPE_LABELS[r.question_type]}</span>
                </div>
                <div className="flex items-center gap-2">
                  {!r.is_correct && r.error_type && (
                    <span className="text-[10px] px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full font-bold">
                      {ERROR_TYPE_LABELS[r.error_type]}
                    </span>
                  )}
                  <span className={`text-sm font-bold ${r.is_correct ? 'text-green-600' : 'text-red-600'}`}>
                    {r.score} / {r.max_score}
                  </span>
                </div>
              </div>

              <div className="p-6 space-y-4">
                <p className="text-slate-900 font-medium text-sm leading-relaxed">{r.question_text}</p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Your Answer</span>
                    <div className={`p-3 rounded-xl border text-sm ${
                      r.is_correct ? 'border-green-200 bg-green-50 text-green-900' : 'border-red-200 bg-red-50 text-red-900'
                    }`}>
                      {r.user_answer || '(空)'}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Correct Answer</span>
                    <div className="p-3 rounded-xl border border-blue-200 bg-blue-50 text-blue-900 text-sm">
                      {r.correct_answer}
                    </div>
                  </div>
                </div>

                <div className="space-y-2 pt-2">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Explanation & Feedback</span>
                  <div className="bg-slate-50 rounded-xl p-4 text-sm text-slate-700 leading-relaxed border border-slate-100">
                    {r.explanation}
                    <div className="mt-3 pt-3 border-t border-slate-200 text-blue-700 font-medium">
                      AI 评价：{r.feedback}
                    </div>
                  </div>
                </div>

                {!r.is_correct && r.remediation && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                    <span className="text-[10px] font-black text-amber-700 uppercase tracking-widest block mb-1">Remediation Advice</span>
                    <p className="text-sm text-amber-800 leading-relaxed">{r.remediation}</p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return null
}
