'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import AppSidebar from '@/components/ui/AppSidebar'
import ContentCard from '@/components/ui/ContentCard'
import Breadcrumb from '@/components/ui/Breadcrumb'
import DecorativeBlur from '@/components/ui/DecorativeBlur'
import AmberButton from '@/components/ui/AmberButton'
import ObjectivesList from '@/components/ObjectivesList'

interface KP {
  id: number
  section_name: string
  description: string
}

interface ActivateClientProps {
  moduleId: number
  bookId: number
  moduleTitle: string
  userName: string
  kps: KP[]
}

export default function ActivateClient({
  moduleId,
  bookId,
  moduleTitle,
  userName,
  kps
}: ActivateClientProps) {
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const handleStart = async () => {
    setStarting(true)
    setError(null)

    try {
      const res = await fetch('/api/teaching-sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ moduleId, depth: 'full' })
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `启动失败: HTTP ${res.status}`)
      }

      router.push(`/modules/${moduleId}/teach`)
    } catch (err) {
      setError(err instanceof Error ? err.message : '启动教学会话失败')
      setStarting(false)
    }
  }

  const navItems = [
    { icon: 'home', label: '首页中心', href: '/' },
    { icon: 'cloud_upload', label: '上传教材', href: '/upload' },
    { icon: 'analytics', label: '系统日志', href: '/logs' },
  ]

  const breadcrumbItems = [
    { label: '书籍详情', href: `/books/${bookId}` },
    { label: moduleTitle }
  ]

  return (
    <div className="min-h-screen bg-surface-container-low flex">
      <AppSidebar 
        userName={userName} 
        navItems={navItems}
        bookTitle={moduleTitle}
      />

      <main className="flex-1 ml-72 p-10 relative min-h-screen overflow-hidden">
        <DecorativeBlur position="top-right" />
        <DecorativeBlur position="bottom-left" color="secondary" />

        <div className="max-w-4xl mx-auto relative z-10 space-y-8">
          <Breadcrumb items={breadcrumbItems} />

          {/* Welcome Banner */}
          <ContentCard className="p-8">
            <h1 className="text-3xl font-headline font-bold text-on-surface">准备开始：AI 老师模式教学</h1>
            <p className="text-lg text-on-surface-variant mt-3 leading-relaxed">
              本模块包含 <span className="font-bold text-primary">{kps.length}</span> 个知识点，
              预计需要 <span className="font-bold text-primary">{kps.length * 5} - {kps.length * 7}</span> 分钟进行深度学习。
            </p>
          </ContentCard>

          {/* Objectives List */}
          <div>
            <h2 className="text-xl font-headline font-bold text-on-surface mb-4">学习目标预览</h2>
            <ObjectivesList items={kps.map(kp => ({
              id: String(kp.id),
              title: kp.section_name,
              summary: kp.description
            }))} />
          </div>

          {/* Error Display */}
          {error && (
            <div className="bg-error-container/10 border border-error/20 rounded-xl p-4 text-error text-sm font-medium">
              启动出错：{error}
            </div>
          )}

          {/* Start Button */}
          <div className="flex justify-center pt-4">
            <AmberButton 
              size="lg"
              onClick={handleStart} 
              disabled={starting}
              className="px-12"
            >
              {starting ? '正在启动教学会话...' : '进入 AI 老师模式'}
            </AmberButton>
          </div>
        </div>
      </main>
    </div>
  )
}
