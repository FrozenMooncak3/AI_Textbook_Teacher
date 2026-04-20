'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import AppSidebar from '@/components/ui/AppSidebar'
import ContentCard from '@/components/ui/ContentCard'
import Breadcrumb from '@/components/ui/Breadcrumb'
import DecorativeBlur from '@/components/ui/DecorativeBlur'
import AmberButton from '@/components/ui/AmberButton'

interface KP {
  id: number
  section_name: string
}

interface TeachingCompleteClientProps {
  moduleId: number
  bookId: number
  moduleTitle: string
  userName: string
  kps: KP[]
}

export default function TeachingCompleteClient({
  moduleId,
  bookId,
  moduleTitle,
  userName,
  kps
}: TeachingCompleteClientProps) {
  const router = useRouter()
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleStart = async () => {
    if (starting) return
    setStarting(true)
    setError(null)
    try {
      const res = await fetch(`/api/modules/${moduleId}/start-qa`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `启动失败: HTTP ${res.status}`)
      }
      // Ignore response.redirectUrl (stale per architecture tech debt);
      // use canonical QA route
      router.push(`/books/${bookId}/modules/${moduleId}/qa`)
    } catch (err) {
      setError(err instanceof Error ? err.message : '启动 Q&A 失败')
      setStarting(false)
    }
  }

  const navItems = [
    { icon: 'home', label: '首页中心', href: '/' },
    { icon: 'cloud_upload', label: '上传教材', href: '/upload' },
    { icon: 'analytics', label: '系统日志', href: '/logs' }
  ]

  const breadcrumbItems = [
    { label: '书籍详情', href: `/books/${bookId}` },
    { label: moduleTitle }
  ]

  return (
    <div className="min-h-screen bg-surface-container-low flex">
      <AppSidebar userName={userName} navItems={navItems} bookTitle={moduleTitle} />

      <main className="flex-1 ml-72 p-10 relative min-h-screen overflow-hidden">
        <DecorativeBlur position="top-right" />

        <div className="max-w-3xl mx-auto relative z-10">
          <Breadcrumb items={breadcrumbItems} />

          {/* Celebration hero */}
          <ContentCard className="mt-6 p-10 text-center bg-gradient-to-br from-amber-50 to-surface-container-lowest border-amber-200">
            <div className="text-5xl mb-4">🎉</div>
            <h1 className="text-3xl font-headline font-black text-on-surface">教学已完成</h1>
            <p className="mt-3 text-on-surface-variant leading-relaxed">
              恭喜！你已经完成了由 AI 老师引导的所有 <span className="font-bold text-primary">{kps.length}</span> 个知识点。
            </p>
          </ContentCard>

          {/* KP recap list */}
          <ContentCard className="mt-6 p-8">
            <h2 className="text-xs font-black text-on-surface-variant/50 uppercase tracking-widest mb-5">知识点达成回顾</h2>
            <ul className="space-y-3">
              {kps.map(kp => (
                <li key={kp.id} className="flex items-start gap-3">
                  <span className="material-symbols-outlined text-emerald-600 text-xl shrink-0 mt-0.5">check_circle</span>
                  <span className="text-on-surface leading-relaxed">{kp.section_name}</span>
                </li>
              ))}
            </ul>
          </ContentCard>

          {/* Transition text */}
          <ContentCard className="mt-6 p-6 bg-amber-50/50 border-amber-100">
            <p className="text-sm text-on-surface-variant leading-relaxed">
              接下来将进入<span className="font-bold text-on-surface">Q&amp;A 阶段</span>。在这个阶段，我们将通过几道针对性的练习题来进一步巩固你的掌握程度。
            </p>
          </ContentCard>

          {/* CTA */}
          <div className="mt-8 flex flex-col items-center gap-3">
            <AmberButton
              onClick={handleStart}
              disabled={starting}
              size="lg"
              className="min-w-[240px]"
            >
              {starting ? '准备开启 Q&A...' : '进入 Q&A 阶段 →'}
            </AmberButton>
            {error && (
              <p className="text-error text-sm font-medium">{error}</p>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
