'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import AppSidebar from '@/components/ui/AppSidebar'
import HeroCard from '@/components/ui/HeroCard'
import ContentCard from '@/components/ui/ContentCard'
import StatusBadge from '@/components/ui/StatusBadge'
import Breadcrumb from '@/components/ui/Breadcrumb'
import ProgressBar from '@/components/ui/ProgressBar'
import DecorativeBlur from '@/components/ui/DecorativeBlur'
import BookTOC from '@/components/BookTOC'
import ModeSwitchDialog from '@/components/ModeSwitch/ModeSwitchDialog'
import CacheHitBadge from '@/components/book/CacheHitBadge'

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

interface ModuleStatus {
  id: number
  textStatus: string
  ocrStatus: string
  kpStatus: string
}

interface ModuleStatusApiRow {
  id: number
  textStatus: string
  ocrStatus: string
  kpStatus: string
}

export default function ActionHub({ 
  bookId, 
  userName,
  learningMode,
  bookMeta
}: { 
  bookId: number
  userName: string 
  learningMode: 'teaching' | 'full'
  bookMeta: { kpCount: number; subject?: string; scanQuality?: 'good' | 'fair' | 'poor' }
}) {
  const [data, setData] = useState<DashboardData | null>(null)
  const [moduleStatuses, setModuleStatuses] = useState<Record<number, ModuleStatus>>({})
  const [cacheHitCount, setCacheHitCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [isRecentTestsOpen, setIsRecentTestsOpen] = useState(false)
  
  // New states for M4 Task 16
  const [dialogOpen, setDialogOpen] = useState(false)
  const [guideMode, setGuideMode] = useState(false)
  const [currentMode, setCurrentMode] = useState<'teaching' | 'full'>(learningMode)
  const [tocCollapsed, setTocCollapsed] = useState(false)
  
  const router = useRouter()

  useEffect(() => {
    async function fetchData() {
      try {
        const [dashRes, statusRes, cacheRes] = await Promise.all([
          fetch(`/api/books/${bookId}/dashboard`),
          fetch(`/api/books/${bookId}/module-status`),
          fetch(`/api/books/${bookId}/status`)
        ])

        const dashJson = await dashRes.json()
        if (dashJson.success) {
          setData(dashJson.data)
        }

        if (statusRes.ok) {
          const statusJson = await statusRes.json()
          const statuses: Record<number, ModuleStatus> = {}
          statusJson.data.modules.forEach((m: ModuleStatusApiRow) => {
            statuses[m.id] = {
              id: m.id,
              textStatus: m.textStatus,
              ocrStatus: m.ocrStatus,
              kpStatus: m.kpStatus
            }
          })
          setModuleStatuses(statuses)
        }

        if (cacheRes.ok) {
          const cacheJson = await cacheRes.json()
          if (typeof cacheJson.data?.cacheHitCount === 'number') {
            setCacheHitCount(cacheJson.data.cacheHitCount)
          }
        }
      } catch {
        // Silently handle — LoadingState already covers error display
      } finally {
        setIsLoading(false)
      }
    }
    fetchData()
  }, [bookId])

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[400px]">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  if (!data) return null

  const { book, modules, reviewsDue, mistakesSummary, recentTests } = data
  const nextModule = modules.find(m => m.learningStatus !== 'completed')
  const completionRate = book.totalModules > 0 ? Math.round((book.completedModules / book.totalModules) * 100) : 0

  const navItems = [
    { icon: 'home', label: '首页中心', href: '/' },
    { icon: 'cloud_upload', label: '上传教材', href: '/upload' },
    { icon: 'analytics', label: '系统日志', href: '/logs' },
  ]

  const breadcrumbItems = [
    { label: '首页', href: '/' },
    { label: book.title },
  ]

  const findRecommendedUnstartedModuleId = (modules: DashboardData['modules']) => {
    // Logic: first 'unstarted' module in orderIndex
    const sorted = [...modules].sort((a, b) => a.orderIndex - b.orderIndex)
    const recommended = sorted.find(m => m.learningStatus === 'unstarted')
    return recommended ? String(recommended.id) : undefined
  }

  const handleModuleClick = async (moduleId: string) => {
    if (!guideMode) {
      router.push(`/books/${bookId}/modules/${moduleId}`)
      return
    }

    // Guide mode: reset and start
    try {
      const res = await fetch(`/api/books/${bookId}/modules/${moduleId}/reset-and-start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      })
      const data = await res.json()
      if (!res.ok) {
        console.error('reset-and-start failed', data)
        return
      }
      router.push(data.redirectUrl || `/modules/${moduleId}/activate`)
    } catch (e) {
      console.error('reset-and-start error', e)
    }
  }

  return (
    <div className="min-h-screen bg-surface-container-low flex">
      <AppSidebar 
        userName={userName} 
        navItems={navItems}
        bookTitle={book.title}
      />

      <main className="flex-1 ml-72 p-10 relative min-h-screen overflow-hidden">
        <DecorativeBlur position="top-right" />
        <DecorativeBlur position="bottom-left" color="secondary" />

        <div className="flex gap-6 relative z-10 max-w-[1400px] mx-auto">
          {/* BookTOC */}
          <BookTOC
            modules={modules.map(m => ({
              id: String(m.id),
              name: m.title,
              learningStatus: m.learningStatus
            }))}
            collapsed={tocCollapsed}
            onToggleCollapse={() => setTocCollapsed(c => !c)}
            guideMode={guideMode}
            recommendedModuleId={guideMode ? findRecommendedUnstartedModuleId(modules) : undefined}
            onModuleClick={handleModuleClick}
          />

          <div className="flex-1 min-w-0 space-y-12">
            <CacheHitBadge hitCount={cacheHitCount} />
            {/* Breadcrumb & Mode Switch */}
            <div className="space-y-4">
              <Breadcrumb items={breadcrumbItems} />
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-100 border border-amber-200 text-sm font-bold text-amber-900">
                    <span className="material-symbols-outlined text-sm">
                      {currentMode === 'teaching' ? 'school' : 'person'}
                    </span>
                    当前模式：{currentMode === 'teaching' ? 'AI 老师模式' : '自主学习模式'}
                  </span>
                  {guideMode && (
                    <span className="text-xs font-bold text-primary flex items-center gap-1 animate-pulse">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                      引导中
                    </span>
                  )}
                </div>
                <button
                  onClick={() => setDialogOpen(true)}
                  className="px-4 py-2 rounded-full border border-amber-300 text-sm font-bold text-amber-900 hover:bg-amber-50 transition-colors inline-flex items-center gap-2"
                >
                  <span className="material-symbols-outlined text-sm text-primary">swap_horiz</span>
                  切换学习模式
                </button>
              </div>
            </div>

            {/* Hero Section */}
            <HeroCard
              progress={completionRate}
              currentModule={nextModule ? nextModule.title : '全部模块已完成'}
              reviewsDue={reviewsDue.length}
              mistakesCount={mistakesSummary.total}
              onContinue={() => {
                if (nextModule) {
                  handleModuleClick(String(nextModule.id))
                }
              }}
              onReview={() => {
                if (reviewsDue.length > 0) {
                  router.push(`/books/${bookId}/modules/${reviewsDue[0].moduleId}/review?scheduleId=${reviewsDue[0].scheduleId}`)
                }
              }}
              onMistakes={() => router.push(`/books/${bookId}/mistakes`)}
            />

            {/* Module Grid */}
            <section>
              <div className="flex items-end justify-between mb-8">
                <div>
                  <h3 className="text-2xl font-black font-headline tracking-tight">课程大纲</h3>
                  <p className="text-on-surface-variant font-medium">按部就班，攻克每一个知识模块</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {modules.map((module) => {
                  const status = moduleStatuses[module.id]
                  
                  let badgeStatus: 'completed' | 'in-progress' | 'not-started' | 'locked' | 'processing' | 'readable' = 'not-started'
                  let isClickable = true

                  if (status) {
                    if (status.kpStatus === 'completed') {
                      if (module.learningStatus === 'completed') {
                        badgeStatus = 'completed'
                      } else if (module.qaProgress.answered > 0) {
                        badgeStatus = 'in-progress'
                      } else {
                        badgeStatus = 'not-started'
                      }
                    } else if (status.textStatus === 'ready') {
                      badgeStatus = 'readable'
                    } else if (status.ocrStatus === 'processing') {
                      badgeStatus = 'processing'
                      isClickable = false
                    } else if (status.textStatus === 'pending') {
                      badgeStatus = 'locked'
                      isClickable = false
                    }
                  } else {
                    // Fallback to legacy logic
                    badgeStatus = module.learningStatus === 'completed' ? 'completed' :
                                  module.learningStatus === 'unstarted' ? 'not-started' : 'in-progress'
                  }

                  return (
                    <ContentCard
                      key={module.id}
                      className={`
                        p-6 transition-all flex flex-col justify-between min-h-[180px]
                        ${isClickable ? 'cursor-pointer hover:shadow-md' : 'opacity-60 cursor-not-allowed'}
                      `}
                      onClick={() => isClickable && handleModuleClick(String(module.id))}
                    >
                      <div className="flex justify-between items-start mb-4">
                        <div className={`
                          w-8 h-8 rounded-lg flex items-center justify-center font-black font-headline text-sm shadow-sm
                          ${isClickable ? 'amber-glow text-white' : 'bg-surface-container text-on-surface-variant/40'}
                        `}>
                          {String(module.orderIndex).padStart(2, '0')}
                        </div>
                        <StatusBadge status={badgeStatus} />
                      </div>
                      <div>
                        <h4 className="text-lg font-bold font-headline mb-3 line-clamp-2 leading-snug">{module.title}</h4>
                        <div className="space-y-3">
                          {module.qaProgress.total > 0 && (
                            <ProgressBar 
                              value={(module.qaProgress.answered / module.qaProgress.total) * 100} 
                              className="h-1"
                            />
                          )}
                          <div className="flex items-center gap-3 text-[10px] font-black text-on-surface-variant/50 uppercase tracking-widest">
                            {module.testScore !== null && (
                              <span className="flex items-center gap-1">
                                <span className="material-symbols-outlined text-xs">assignment_turned_in</span>
                                测试: {module.testScore}分
                              </span>
                            )}
                            <span>Q&A: {module.qaProgress.answered}/{module.qaProgress.total}</span>
                          </div>
                        </div>
                      </div>
                    </ContentCard>
                  )
                })}
              </div>
            </section>

            {/* Recent Tests */}
            {recentTests.length > 0 && (
              <section className="bg-surface-container-lowest rounded-[32px] border border-outline-variant/10 overflow-hidden shadow-sm">
                <button 
                  onClick={() => setIsRecentTestsOpen(!isRecentTestsOpen)}
                  className="w-full px-8 py-6 flex items-center justify-between hover:bg-surface-container-low transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>analytics</span>
                    <h3 className="text-xl font-black font-headline tracking-tight">最近考试记录</h3>
                  </div>
                  <span className={`material-symbols-outlined transition-transform duration-300 ${isRecentTestsOpen ? 'rotate-180' : ''}`}>
                    expand_more
                  </span>
                </button>
                
                {isRecentTestsOpen && (
                  <div className="px-8 pb-8 pt-2 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                    {recentTests.slice(0, 3).map((test, index) => (
                      <div key={index} className="flex items-center justify-between bg-surface-container-low/50 p-5 rounded-2xl border border-outline-variant/5">
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-on-surface">{test.moduleTitle}</span>
                          <span className="text-[10px] text-on-surface-variant font-black uppercase tracking-widest mt-1">
                            {new Date(test.completedAt).toLocaleDateString('zh-CN')}
                          </span>
                        </div>
                        <div className="flex items-center gap-6">
                          <div className="text-right">
                            <span className="text-2xl font-black font-headline text-on-surface">{test.score}</span>
                            <span className="text-xs text-on-surface-variant/50 ml-1">分</span>
                          </div>
                          <StatusBadge status={test.passed ? 'completed' : 'not-started'} className="min-w-[80px] text-center" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}
          </div>
        </div>
      </main>

      <ModeSwitchDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        bookId={bookId}
        currentMode={currentMode}
        bookMeta={bookMeta}
        onSwitchComplete={(newMode) => {
          setCurrentMode(newMode)
          setGuideMode(true)
        }}
      />
    </div>
  )
}
