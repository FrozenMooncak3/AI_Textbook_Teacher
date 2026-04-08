'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

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

export default function ActionHub({ bookId }: { bookId: number }) {
  const [data, setData] = useState<DashboardData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRecentTestsOpen, setIsRecentTestsOpen] = useState(false)
  const router = useRouter()

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch(`/api/books/${bookId}/dashboard`)
        const json = await res.json()
        if (json.success) {
          setData(json.data)
        }
      } catch (e) {
        console.error('Failed to fetch dashboard data', e)
      } finally {
        setIsLoading(false)
      }
    }
    fetchData()
  }, [bookId])

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-12 max-w-5xl mx-auto px-6 py-10">
        <div className="h-48 bg-surface-container rounded-xl"></div>
        <div className="grid grid-cols-2 gap-8">
          <div className="h-32 bg-surface-container rounded-xl"></div>
          <div className="h-32 bg-surface-container rounded-xl"></div>
        </div>
        <div className="grid grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="h-40 bg-surface-container rounded-xl"></div>
          ))}
        </div>
      </div>
    )
  }

  if (!data) return null

  const { book, modules, reviewsDue, mistakesSummary, recentTests } = data
  const nextModule = modules.find(m => m.learningStatus !== 'completed')
  const completionRate = book.totalModules > 0 ? Math.round((book.completedModules / book.totalModules) * 100) : 0
  const dashOffset = 440 - (440 * completionRate) / 100

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <span className="bg-emerald-100 text-emerald-800 px-3 py-1 rounded-full text-xs font-bold">已完成</span>
      case 'testing':
        return <span className="bg-orange-100 text-orange-800 px-3 py-1 rounded-full text-xs font-bold">测试中</span>
      case 'qa':
        return <span className="bg-orange-100 text-orange-800 px-3 py-1 rounded-full text-xs font-bold">Q&A中</span>
      case 'reading':
        return <span className="bg-orange-100 text-orange-800 px-3 py-1 rounded-full text-xs font-bold">阅读中</span>
      case 'notes_generated':
        return <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-bold">笔记已生成</span>
      default:
        return <span className="bg-surface-container text-on-surface-variant px-3 py-1 rounded-full text-xs font-bold">未开始</span>
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-10 space-y-12">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-on-surface-variant text-sm font-medium">
        <Link href="/" className="hover:text-primary transition-colors">首页</Link>
        <span className="material-symbols-outlined text-xs">chevron_right</span>
        <span className="text-on-surface font-semibold">{book.title}</span>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-surface-container-low rounded-[40px] p-10 flex flex-col md:flex-row items-center justify-between gap-8 shadow-sm">
        <div className="flex items-center gap-10 z-10 w-full">
          {/* Progress Ring */}
          <div className="relative flex-shrink-0">
            <svg className="w-40 h-40 transform -rotate-90">
              <circle className="text-surface-variant" cx="80" cy="80" fill="transparent" r="70" stroke="currentColor" strokeWidth="12"></circle>
              <circle 
                className="text-primary-fixed-dim transition-all duration-1000 ease-out" 
                cx="80" cy="80" fill="transparent" r="70" stroke="currentColor" 
                strokeDasharray="440" 
                strokeDashoffset={dashOffset} 
                strokeLinecap="round" strokeWidth="12"
              ></circle>
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-black font-headline text-on-surface">{completionRate}%</span>
              <span className="text-[10px] uppercase tracking-widest font-bold text-on-surface-variant">完成度</span>
            </div>
          </div>

          {/* Text Info */}
          <div className="flex-1">
            <span className="text-primary-fixed-dim font-bold tracking-widest text-xs uppercase mb-2 block">学习路径</span>
            <h2 className="text-3xl font-black font-headline text-on-surface mb-3 tracking-tight">
              {nextModule ? `继续学习: ${nextModule.title}` : '全部完成!'}
            </h2>
            <p className="text-on-surface-variant font-medium text-lg">
              {book.completedModules}/{book.totalModules} 模块已完成
            </p>
          </div>

          {/* CTA */}
          {nextModule ? (
            <Link 
              href={`/books/${bookId}/modules/${nextModule.id}`}
              className="amber-glow text-white px-10 py-5 rounded-full font-bold flex items-center gap-3 shadow-xl shadow-orange-700/10 hover:shadow-orange-700/30 transition-all active:scale-95 whitespace-nowrap"
            >
              继续学习
              <span className="material-symbols-outlined">chevron_right</span>
            </Link>
          ) : (
            <button disabled className="bg-surface-dim text-on-surface-variant px-10 py-5 rounded-full font-bold flex items-center gap-3 cursor-not-allowed">
              全部完成!
            </button>
          )}
        </div>
      </section>

      {/* Action Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Card 1: Reviews Due */}
        <div className={`group p-8 rounded-[32px] flex items-center gap-6 border border-transparent transition-all relative overflow-hidden ${reviewsDue.length > 0 ? 'bg-surface-container-low cursor-pointer hover:bg-surface-container' : 'bg-surface-dim opacity-60'}`}>
          <div className="w-16 h-16 bg-tertiary-container/30 rounded-2xl flex items-center justify-center">
            <span className="material-symbols-outlined text-4xl text-tertiary" style={{ fontVariationSettings: "'FILL' 1" }}>history_edu</span>
          </div>
          <div className="flex-1">
            <div className="flex items-baseline gap-2 mb-1">
              <h3 className="text-4xl font-black font-headline text-tertiary">{reviewsDue.length}</h3>
              <span className="text-lg font-bold font-headline text-tertiary/80">个复习待完成</span>
            </div>
            <p className="text-on-surface-variant text-sm font-medium">
              {reviewsDue.length > 0 ? `${reviewsDue.length} 个知识点今天需要复习` : '目前没有待复习的内容'}
            </p>
          </div>
          {reviewsDue.length > 0 && (
            <Link 
              href={`/books/${bookId}/modules/${reviewsDue[0].moduleId}/review?scheduleId=${reviewsDue[0].scheduleId}`}
              className="w-12 h-12 bg-surface-container-lowest rounded-full flex items-center justify-center text-tertiary shadow-sm group-hover:bg-tertiary group-hover:text-on-tertiary transition-all"
            >
              <span className="material-symbols-outlined">arrow_forward</span>
            </Link>
          )}
        </div>

        {/* Card 2: Mistakes */}
        <Link 
          href={`/books/${bookId}/mistakes`}
          className="group bg-error-container/10 p-8 rounded-[32px] flex items-center gap-6 border border-transparent hover:bg-error-container/20 transition-all relative overflow-hidden"
        >
          <div className="w-16 h-16 bg-error-container/40 rounded-2xl flex items-center justify-center">
            <span className="material-symbols-outlined text-4xl text-error" style={{ fontVariationSettings: "'FILL' 1" }}>running_with_errors</span>
          </div>
          <div className="flex-1">
            <div className="flex items-baseline gap-2 mb-1">
              <h3 className="text-4xl font-black font-headline text-error">{mistakesSummary.total}</h3>
              <span className="text-lg font-bold font-headline text-error/80">道错题</span>
            </div>
            <p className="text-on-surface-variant text-sm font-medium">点击进入错题本进行针对性强化</p>
          </div>
          <div className="w-12 h-12 bg-surface-container-lowest rounded-full flex items-center justify-center text-error shadow-sm group-hover:bg-error group-hover:text-on-error transition-all">
            <span className="material-symbols-outlined">arrow_forward</span>
          </div>
        </Link>
      </div>

      {/* Module Grid */}
      <section>
        <div className="flex items-end justify-between mb-8">
          <div>
            <h3 className="text-2xl font-black font-headline tracking-tight">课程大纲</h3>
            <p className="text-on-surface-variant font-medium">按部就班，攻克每一个知识模块</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {modules.map((module) => (
            <div 
              key={module.id} 
              onClick={() => router.push(`/books/${bookId}/modules/${module.id}`)}
              className="bg-surface-container-lowest p-6 rounded-[32px] border border-outline-variant/10 shadow-sm shadow-orange-900/5 group hover:shadow-md transition-all cursor-pointer flex flex-col justify-between min-h-[160px]"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="w-8 h-8 amber-glow text-white rounded-lg flex items-center justify-center font-black font-headline text-sm shadow-sm">
                  {String(module.orderIndex).padStart(2, '0')}
                </div>
                {getStatusBadge(module.learningStatus)}
              </div>
              <div>
                <h4 className="text-lg font-bold font-headline mb-2 line-clamp-2 leading-snug">{module.title}</h4>
                <div className="flex flex-wrap gap-x-4 gap-y-2">
                  {module.qaProgress.total > 0 && (
                    <div className="flex items-center gap-1.5 text-xs font-bold text-on-surface-variant">
                      <span className="material-symbols-outlined text-sm">quiz</span>
                      Q&A: {module.qaProgress.answered}/{module.qaProgress.total}
                    </div>
                  )}
                  {module.testScore !== null && (
                    <div className="flex items-center gap-1.5 text-xs font-bold text-on-surface-variant">
                      <span className="material-symbols-outlined text-sm">assignment_turned_in</span>
                      测试: {module.testScore}分
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Recent Tests */}
      {recentTests.length > 0 && (
        <section className="bg-surface-container-low/50 rounded-[32px] overflow-hidden">
          <button 
            onClick={() => setIsRecentTestsOpen(!isRecentTestsOpen)}
            className="w-full px-8 py-6 flex items-center justify-between hover:bg-surface-container transition-colors"
          >
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-primary">analytics</span>
              <h3 className="text-xl font-black font-headline tracking-tight">最近考试</h3>
            </div>
            <span className={`material-symbols-outlined transition-transform duration-300 ${isRecentTestsOpen ? 'rotate-180' : ''}`}>
              expand_more
            </span>
          </button>
          
          {isRecentTestsOpen && (
            <div className="px-8 pb-8 pt-2 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
              {recentTests.slice(0, 3).map((test, index) => (
                <div key={index} className="flex items-center justify-between bg-surface-container-lowest p-4 rounded-2xl border border-outline-variant/10">
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-on-surface">{test.moduleTitle}</span>
                    <span className="text-[10px] text-on-surface-variant font-medium uppercase tracking-wider">
                      {new Date(test.completedAt).toLocaleDateString('zh-CN')}
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-xl font-black font-headline text-on-surface">{test.score}分</span>
                    <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${test.passed ? 'bg-emerald-100 text-emerald-800' : 'bg-error-container/20 text-error'}`}>
                      {test.passed ? '通过' : '未通过'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  )
}
