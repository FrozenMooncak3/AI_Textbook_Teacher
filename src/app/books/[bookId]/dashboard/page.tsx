'use client'

import { useState, useEffect, use } from 'react'
import Link from 'next/link'
import AIResponse from '@/components/AIResponse'

interface DashboardData {
  book: {
    id: number
    title: string
    totalModules: number
    completedModules: number
  }
  modules: {
    id: number
    title: string
    orderIndex: number
    learningStatus: string
    qaProgress: {
      total: number
      answered: number
    }
    testScore: number | null
    testPassed: boolean | null
  }[]
  reviewsDue: {
    scheduleId: number
    moduleId: number
    moduleTitle: string
    dueDate: string
    round: number
    isOverdue: boolean
  }[]
  recentTests: {
    moduleId: number
    moduleTitle: string
    score: number
    passed: boolean
    completedAt: string
  }[]
  mistakesSummary: {
    total: number
    byType: Record<string, number>
  }
}

const STATUS_ICONS: Record<string, string> = {
  completed: '✅',
  testing: '📝',
  qa: '💬',
  reading: '📖',
  notes_generated: '📓',
  unstarted: '⚪',
}

const ERROR_TYPE_LABELS: Record<string, string> = {
  blind_spot: '知识盲点',
  procedural: '程序性失误',
  confusion: '概念混淆',
  careless: '粗心错误',
}

export default function DashboardPage({ params }: { params: Promise<{ bookId: string }> }) {
  const { bookId } = use(params)
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchDashboard() {
      try {
        const res = await fetch(`/api/books/${bookId}/dashboard`)
        const json = await res.json()
        if (json.success) {
          setData(json.data)
        } else {
          setError(json.error || 'Failed to load dashboard')
        }
      } catch (err) {
        setError('Failed to fetch dashboard data')
      } finally {
        setLoading(false)
      }
    }
    fetchDashboard()
  }, [bookId])

  if (loading) {
    return (
      <div className="min-h-full bg-gray-50 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-full bg-gray-50 flex flex-col items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-red-100 text-center max-w-sm w-full">
          <div className="text-red-500 text-4xl mb-4">⚠️</div>
          <p className="text-gray-900 font-medium mb-4">{error || 'Dashboard not found'}</p>
          <Link href="/" className="text-blue-600 hover:underline text-sm font-medium">返回主页</Link>
        </div>
      </div>
    )
  }

  const completionRate = Math.round((data.book.completedModules / data.book.totalModules) * 100)

  return (
    <main className="min-h-full bg-gray-50 pb-20">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header & Progress Bar */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div>
              <Link href={`/books/${bookId}`} className="text-xs text-gray-400 hover:text-blue-600 transition-colors uppercase tracking-widest font-bold">
                &larr; 返回目录
              </Link>
              <h1 className="text-2xl font-bold text-gray-900 mt-1">{data.book.title}</h1>
            </div>
            <div className="text-right">
              <span className="text-3xl font-black text-blue-600">{completionRate}%</span>
              <span className="text-gray-400 text-sm ml-2 font-medium">已完成</span>
            </div>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden shadow-inner">
            <div 
              className="bg-blue-600 h-full rounded-full transition-all duration-1000 shadow-sm"
              style={{ width: `${completionRate}%` }}
            />
          </div>
          <div className="flex justify-between mt-2 text-[10px] font-bold text-gray-400 uppercase tracking-tighter">
            <span>开始学习</span>
            <span>{data.book.completedModules} / {data.book.totalModules} 模块已通关</span>
            <span>精通</span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Section 1: Learning Path / Modules */}
          <section className="bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col h-full">
            <div className="px-6 py-4 border-b border-gray-50 flex items-center justify-between">
              <h2 className="text-sm font-black text-gray-900 uppercase tracking-widest flex items-center gap-2">
                <span className="w-2 h-4 bg-blue-600 rounded-full"></span>
                我的学习路径
              </h2>
              <span className="text-[10px] text-gray-400 font-bold px-2 py-0.5 bg-gray-50 rounded">MODULES</span>
            </div>
            <div className="p-4 flex-1 overflow-auto max-h-[500px] space-y-2">
              {data.modules.map((m) => (
                <Link 
                  key={m.id}
                  href={`/books/${bookId}/modules/${m.id}`}
                  className="flex items-center justify-between p-3 rounded-xl border border-gray-100 hover:border-blue-200 hover:bg-blue-50/30 transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl shrink-0 grayscale group-hover:grayscale-0 transition-all">{STATUS_ICONS[m.learningStatus] || '⚪'}</span>
                    <div>
                      <p className="text-sm font-bold text-gray-800 line-clamp-1">{m.title}</p>
                      <p className="text-[10px] text-gray-400 font-medium">
                        {m.learningStatus === 'qa' ? `Q&A 进度: ${m.qaProgress.answered}/${m.qaProgress.total}` : 
                         m.learningStatus === 'completed' ? `测试得分: ${m.testScore}` : 
                         m.learningStatus.replace('_', ' ')}
                      </p>
                    </div>
                  </div>
                  <div className="w-6 h-6 rounded-full bg-gray-50 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-colors">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </Link>
              ))}
            </div>
          </section>

          {/* Section 2: Review Schedule */}
          <section className="bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col h-full">
            <div className="px-6 py-4 border-b border-gray-50 flex items-center justify-between">
              <h2 className="text-sm font-black text-gray-900 uppercase tracking-widest flex items-center gap-2">
                <span className="w-2 h-4 bg-amber-500 rounded-full"></span>
                复习日程表
              </h2>
              <span className="text-[10px] text-gray-400 font-bold px-2 py-0.5 bg-gray-50 rounded">REVIEWS</span>
            </div>
            <div className="p-4 flex-1 overflow-auto max-h-[500px]">
              {data.reviewsDue.length === 0 ? (
                <div className="h-40 flex flex-col items-center justify-center text-center">
                  <span className="text-2xl mb-2">🏖️</span>
                  <p className="text-xs text-gray-400 font-medium">目前没有待复习的内容</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {data.reviewsDue.map((r) => (
                    <Link 
                      key={r.scheduleId}
                      href={`/books/${bookId}/modules/${r.moduleId}/review?scheduleId=${r.scheduleId}`}
                      className={`block p-4 rounded-xl border transition-all ${
                        r.isOverdue 
                        ? 'border-red-100 bg-red-50 hover:bg-red-100' 
                        : 'border-amber-100 bg-amber-50/50 hover:bg-amber-100/50'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest ${
                          r.isOverdue ? 'bg-red-200 text-red-700' : 'bg-amber-200 text-amber-700'
                        }`}>
                          {r.isOverdue ? '已过期' : `Round ${r.round}`}
                        </span>
                        <span className="text-[10px] text-gray-400 font-bold">{r.dueDate}</span>
                      </div>
                      <p className="text-sm font-bold text-gray-800">{r.moduleTitle}</p>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* Section 3: Recent Test Results */}
          <section className="bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col h-full">
            <div className="px-6 py-4 border-b border-gray-50 flex items-center justify-between">
              <h2 className="text-sm font-black text-gray-900 uppercase tracking-widest flex items-center gap-2">
                <span className="w-2 h-4 bg-emerald-500 rounded-full"></span>
                最近考试成绩
              </h2>
              <span className="text-[10px] text-gray-400 font-bold px-2 py-0.5 bg-gray-50 rounded">TESTS</span>
            </div>
            <div className="p-4 flex-1 overflow-auto max-h-[500px]">
              {data.recentTests.length === 0 ? (
                <div className="h-40 flex flex-col items-center justify-center text-center">
                  <span className="text-2xl mb-2">🎓</span>
                  <p className="text-xs text-gray-400 font-medium">还没有考试记录</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {data.recentTests.map((t, idx) => (
                    <div key={idx} className="flex items-center justify-between p-4 rounded-xl border border-gray-50 bg-gray-50/30">
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-gray-800 truncate">{t.moduleTitle}</p>
                        <p className="text-[10px] text-gray-400 font-medium">{t.completedAt.slice(0, 16).replace('T', ' ')}</p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <div className="text-right">
                          <p className="text-lg font-black text-gray-900 leading-none">{t.score}</p>
                          <p className="text-[10px] text-gray-400 font-bold">SCORE</p>
                        </div>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                          t.passed ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                        }`}>
                          {t.passed ? 'P' : 'F'}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* Section 4: Mistakes Summary */}
          <section className="bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col h-full">
            <div className="px-6 py-4 border-b border-gray-50 flex items-center justify-between">
              <h2 className="text-sm font-black text-gray-900 uppercase tracking-widest flex items-center gap-2">
                <span className="w-2 h-4 bg-red-600 rounded-full"></span>
                错题本统计
              </h2>
              <span className="text-[10px] text-gray-400 font-bold px-2 py-0.5 bg-gray-50 rounded">MISTAKES</span>
            </div>
            <div className="p-6 flex-1 flex flex-col justify-center">
              <div className="text-center mb-8">
                <p className="text-5xl font-black text-gray-900">{data.mistakesSummary.total}</p>
                <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mt-1">待修复的错题</p>
              </div>
              
              <div className="grid grid-cols-2 gap-4 mb-8">
                {Object.entries(data.mistakesSummary.byType).map(([type, count]) => (
                  <div key={type} className="p-3 rounded-xl border border-gray-50 bg-gray-50/50">
                    <p className="text-xs text-gray-400 font-bold uppercase tracking-tighter mb-1">{ERROR_TYPE_LABELS[type] || type}</p>
                    <p className="text-lg font-black text-gray-800">{count}</p>
                  </div>
                ))}
              </div>

              <Link 
                href={`/books/${bookId}/mistakes`}
                className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-4 rounded-xl text-center shadow-lg shadow-red-100 transition-all flex items-center justify-center gap-2"
              >
                <span>进入错题诊断</span>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </Link>
            </div>
          </section>
        </div>
      </div>
    </main>
  )
}
