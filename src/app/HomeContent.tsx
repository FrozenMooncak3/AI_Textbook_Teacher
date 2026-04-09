'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import AppSidebar from '@/components/ui/AppSidebar'
import CourseCard from '@/components/ui/CourseCard'
import FAB from '@/components/ui/FAB'
import DecorativeBlur from '@/components/ui/DecorativeBlur'
import HeroCard from '@/components/ui/HeroCard'
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
  const hasBooks = books.length > 0

  const navItems = [
    { icon: 'home', label: '首页中心', href: '/' },
    { icon: 'cloud_upload', label: '上传教材', href: '/upload' },
    { icon: 'analytics', label: '系统日志', href: '/logs' },
  ]

  return (
    <div className="min-h-screen bg-surface-container-low">
      <AppSidebar 
        userName={user.display_name || user.email} 
        navItems={navItems} 
      />
      
      <main className="ml-72 p-10 relative min-h-screen overflow-hidden">
        <DecorativeBlur position="top-right" />
        <DecorativeBlur position="bottom-left" color="secondary" />

        <div className="max-w-5xl mx-auto relative z-10">
          {/* Header */}
          <div className="mb-10">
            <h1 className="text-3xl font-black text-on-surface font-headline tracking-tight">
              AI 教材精学老师
            </h1>
            <p className="text-on-surface-variant font-medium mt-1">
              欢迎回来，{user.display_name || user.email}
            </p>
          </div>

          <div className="mb-10">
            <ReviewButton />
          </div>

          {!hasBooks ? (
            /* Empty State */
            <div className="flex items-center justify-center py-20">
              <div className="bg-surface-container-lowest rounded-[40px] border border-outline-variant/10 p-12 md:p-20 text-center shadow-card max-w-2xl w-full">
                <div className="w-24 h-24 rounded-full bg-surface-container-low flex items-center justify-center mx-auto mb-8">
                  <span className="material-symbols-outlined text-6xl text-primary opacity-30">menu_book</span>
                </div>
                <h2 className="text-3xl font-black text-on-surface font-headline tracking-tight mb-4">
                  开始你的学习之旅
                </h2>
                <p className="text-on-surface-variant font-medium text-lg mb-10 leading-relaxed">
                  上传你的第一本教材，AI 老师会为你规划学习路径，<br />通过 Q&A 和复习帮你真正学透知识点。
                </p>
                <button 
                  onClick={() => router.push('/upload')}
                  className="amber-glow text-white font-black font-headline text-lg py-5 px-12 rounded-full shadow-cta active:scale-95 transition-all inline-flex items-center gap-3"
                >
                  <span>上传教材</span>
                  <span className="material-symbols-outlined">arrow_forward</span>
                </button>
              </div>
            </div>
          ) : books.length === 1 ? (
            /* Single Book Hero */
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
              {books.map((book) => {
                const progress = book.total_modules > 0 ? Math.round((book.completed_modules / book.total_modules) * 100) : 0
                
                return (
                  <HeroCard
                    key={book.id}
                    progress={progress}
                    currentModule={book.title}
                    reviewsDue={0} 
                    mistakesCount={0}
                    onContinue={() => router.push(`/books/${book.id}`)}
                    onReview={() => router.push(`/books/${book.id}`)}
                    onMistakes={() => router.push(`/books/${book.id}/mistakes`)}
                  />
                )
              })}
            </div>
          ) : (
            /* Multi Book Grid */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
              {books.map((book) => {
                const progress = book.total_modules > 0 ? Math.round((book.completed_modules / book.total_modules) * 100) : 0
                
                return (
                  <CourseCard
                    key={book.id}
                    title={book.title}
                    progress={progress}
                    onClick={() => router.push(`/books/${book.id}`)}
                    gradient="from-amber-500 to-orange-600"
                    badges={[{ label: '教材', color: 'bg-primary' }]}
                  />
                )
              })}
            </div>
          )}
        </div>

        <FAB icon="add" onClick={() => router.push('/upload')} label="上传教材" />
      </main>
    </div>
  )
}
