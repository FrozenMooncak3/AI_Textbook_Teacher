'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import AppSidebar from '@/components/ui/AppSidebar'
import CourseCard from '@/components/ui/CourseCard'
import FAB from '@/components/ui/FAB'
import ReviewButton from './ReviewButton'

interface Book {
  id: number
  title: string
  created_at: string
  total_modules: number
  completed_modules: number
}

interface User {
  id: number
  email: string
  display_name: string | null
}

export default function HomeContent({
  user,
  books
}: {
  user: User
  books: Book[]
}) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const hasBooks = books.length > 0
  const filteredBooks = books.filter(b => b.title.toLowerCase().includes(search.toLowerCase()))

  const navItems = [
    { icon: 'home', label: '首页中心', href: '/' },
    { icon: 'cloud_upload', label: '上传教材', href: '/upload' },
    { icon: 'analytics', label: '系统日志', href: '/logs' },
  ]

  // Stats from existing data
  const totalModules = books.reduce((sum, b) => sum + b.total_modules, 0)
  const completedModules = books.reduce((sum, b) => sum + b.completed_modules, 0)

  return (
    <div className="min-h-screen bg-surface-container-low">
      <AppSidebar
        userName={user.display_name || user.email}
        navItems={navItems}
      />

      {/* Top bar with search */}
      <header className="fixed top-0 left-72 right-0 h-14 z-40 bg-surface-container-low/80 backdrop-blur-md flex items-center justify-between px-8">
        <div className="relative">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/40 text-base">search</span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索教材..."
            className="w-64 bg-surface-container-lowest border border-outline-variant/10 rounded-full pl-9 pr-4 py-1.5 text-xs text-on-surface placeholder:text-on-surface-variant/30 focus:outline-none hover:border-primary/30 hover:ring-2 hover:ring-primary/10 transition-all"
          />
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold text-on-surface">{user.display_name || user.email}</span>
          <div className="w-8 h-8 rounded-full bg-primary-container flex items-center justify-center text-on-primary text-xs font-bold">
            {(user.display_name || user.email).charAt(0).toUpperCase()}
          </div>
        </div>
      </header>

      <main className="ml-72 pt-14 min-h-screen">
        <div className="p-8 flex gap-8">
          {/* Left Column: Welcome + Books */}
          <div className="flex-1 min-w-0 space-y-8">
            {/* Welcome */}
            <div>
              <h1 className="text-3xl font-headline font-extrabold text-primary leading-tight tracking-tight">
                欢迎回来，{user.display_name || '学习者'}
              </h1>
              <p className="text-on-surface-variant font-medium text-lg mt-1">
                今天想学点什么？
              </p>
            </div>

            {!hasBooks ? (
              /* Empty State */
              <div className="flex items-center justify-center py-16">
                <div className="bg-surface-container-lowest rounded-[32px] border border-outline-variant/10 p-12 text-center shadow-card max-w-lg w-full">
                  <div className="w-20 h-20 rounded-full bg-surface-container-low flex items-center justify-center mx-auto mb-6">
                    <span className="material-symbols-outlined text-5xl text-primary opacity-30">menu_book</span>
                  </div>
                  <h2 className="text-2xl font-black text-on-surface font-headline tracking-tight mb-3">
                    开始你的学习之旅
                  </h2>
                  <p className="text-on-surface-variant mb-8 leading-relaxed">
                    上传你的第一本教材，AI 老师会为你规划学习路径
                  </p>
                  <button
                    onClick={() => router.push('/upload')}
                    className="amber-glow text-white font-black font-headline py-4 px-10 rounded-full shadow-cta active:scale-95 transition-all inline-flex items-center gap-2"
                  >
                    <span>上传教材</span>
                    <span className="material-symbols-outlined">arrow_forward</span>
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* Book Grid Header */}
                <div className="flex justify-between items-end">
                  <h3 className="text-lg font-headline font-bold text-on-surface">正在研读</h3>
                  <span className="text-xs font-bold text-on-surface-variant">{filteredBooks.length} 本教材</span>
                </div>

                {/* Book Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {filteredBooks.map((book, i) => {
                    const progress = book.total_modules > 0 ? Math.round((book.completed_modules / book.total_modules) * 100) : 0
                    const gradients = [
                      'from-[#d4b896] to-[#c4a882]',
                      'from-[#b8c4a0] to-[#a8b490]',
                      'from-[#a8b8c8] to-[#98a8b8]',
                    ]
                    const icons = ['account_balance', 'psychology', 'bar_chart']
                    const daysAgo = Math.floor((Date.now() - new Date(book.created_at).getTime()) / 86400000)
                    const lastStudied = daysAgo === 0 ? '今天学习过' : `${daysAgo} 天前学习`

                    return (
                      <CourseCard
                        key={book.id}
                        title={book.title}
                        progress={progress}
                        onClick={() => router.push(`/books/${book.id}`)}
                        gradient={gradients[i % gradients.length]}
                        icon={icons[i % icons.length]}
                        lastStudied={lastStudied}
                      />
                    )
                  })}
                </div>

                {/* Weekly Insights */}
                <div>
                  <h3 className="text-lg font-headline font-bold text-on-surface mb-4">本周概览</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-[#e6d5b8] p-6 rounded-2xl flex flex-col justify-between min-h-[140px]">
                      <div className="flex justify-between items-start">
                        <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>school</span>
                        <span className="text-[10px] font-bold uppercase text-primary/50 tracking-widest">学习进度</span>
                      </div>
                      <div>
                        <p className="text-3xl font-headline font-extrabold text-on-surface">{completedModules}/{totalModules}</p>
                        <p className="text-xs text-on-surface-variant">模块已完成</p>
                      </div>
                    </div>
                    <div className="bg-[#c3c9a6] p-6 rounded-2xl flex flex-col justify-between min-h-[140px]">
                      <div className="flex justify-between items-start">
                        <span className="material-symbols-outlined text-on-surface/70" style={{ fontVariationSettings: "'FILL' 1" }}>auto_stories</span>
                        <span className="text-[10px] font-bold uppercase text-on-surface/40 tracking-widest">教材数</span>
                      </div>
                      <div>
                        <p className="text-3xl font-headline font-extrabold text-on-surface">{books.length}</p>
                        <p className="text-xs text-on-surface-variant">本在学</p>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Right Column: Review + Stats */}
          {hasBooks && (
            <aside className="w-72 shrink-0 space-y-6">
              {/* Review Banner */}
              <ReviewButton />

              {/* Quick Stats */}
              <div className="bg-surface-container-lowest rounded-2xl p-6 border border-outline-variant/10">
                <h4 className="font-headline font-bold text-on-surface mb-5">学习统计</h4>
                <div className="space-y-5">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="material-symbols-outlined text-primary text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>menu_book</span>
                    </div>
                    <div>
                      <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-wider">教材数量</p>
                      <p className="text-base font-headline font-extrabold">{books.length} 本</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-tertiary-container/20 flex items-center justify-center">
                      <span className="material-symbols-outlined text-tertiary text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                    </div>
                    <div>
                      <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-wider">已完成模块</p>
                      <p className="text-base font-headline font-extrabold">{completedModules} 个</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-secondary-container/20 flex items-center justify-center">
                      <span className="material-symbols-outlined text-secondary text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>trending_up</span>
                    </div>
                    <div>
                      <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-wider">总体进度</p>
                      <p className="text-base font-headline font-extrabold">{totalModules > 0 ? Math.round(completedModules / totalModules * 100) : 0}%</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Recent Activity Timeline */}
              <div className="bg-surface-container-lowest rounded-2xl p-6 border border-outline-variant/10">
                <h4 className="font-headline font-bold text-on-surface mb-6">最近动态</h4>
                <div className="relative pl-6 space-y-6 before:content-[''] before:absolute before:left-0 before:top-2 before:bottom-2 before:w-px before:bg-outline-variant/30">
                  {books.slice(0, 3).map((book, i) => {
                    const daysAgo = Math.floor((Date.now() - new Date(book.created_at).getTime()) / 86400000)
                    const timeLabel = daysAgo === 0 ? '今天' : daysAgo === 1 ? '昨天' : `${daysAgo}天前`
                    const isFirst = i === 0

                    if (book.completed_modules > 0) {
                      return (
                        <div key={`${book.id}-progress`} className="relative">
                          <div className={`absolute -left-[27px] top-1 w-2 h-2 rounded-full ${isFirst ? 'bg-primary' : 'bg-outline-variant'} ring-4 ring-surface-container-lowest`} />
                          <p className={`text-[10px] font-bold mb-1 uppercase tracking-widest ${isFirst ? 'text-primary' : 'text-on-surface-variant'}`}>{timeLabel}</p>
                          <p className="text-sm font-medium text-on-surface leading-tight">
                            完成了《{book.title}》{book.completed_modules} 个模块
                          </p>
                        </div>
                      )
                    }

                    return (
                      <div key={`${book.id}-added`} className="relative">
                        <div className={`absolute -left-[27px] top-1 w-2 h-2 rounded-full ${isFirst ? 'bg-primary' : 'bg-outline-variant'} ring-4 ring-surface-container-lowest`} />
                        <p className={`text-[10px] font-bold mb-1 uppercase tracking-widest ${isFirst ? 'text-primary' : 'text-on-surface-variant'}`}>{timeLabel}</p>
                        <p className="text-sm font-medium text-on-surface leading-tight">
                          添加了《{book.title}》到书架
                        </p>
                      </div>
                    )
                  })}
                </div>
              </div>
            </aside>
          )}
        </div>
      </main>

      <FAB icon="add" onClick={() => router.push('/upload')} label="上传教材" />
    </div>
  )
}
