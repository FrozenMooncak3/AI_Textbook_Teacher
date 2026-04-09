'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import AIResponse from '@/components/AIResponse'
import LoadingState from '@/components/LoadingState'
import ContentCard from '@/components/ui/ContentCard'
import Badge from '@/components/ui/Badge'
import AmberButton from '@/components/ui/AmberButton'

interface NotesData {
  noteId: number
  content: string
}

export default function NotesDisplay({
  moduleId,
  bookId,
  onComplete,
}: {
  moduleId: number
  bookId: number
  onComplete?: () => void
}) {
  const router = useRouter()
  const [notes, setNotes] = useState<NotesData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isFinishing, setIsFinishing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchNotes = async () => {
      setIsLoading(true)
      try {
        const res = await fetch(`/api/modules/${moduleId}/generate-notes`, { method: 'POST' })
        const result = await res.json()
        if (result.success) {
          setNotes(result.data)
        } else {
          setError(result.error || '生成模块笔记失败')
        }
      } catch {
        setError('网络请求失败')
      } finally {
        setIsLoading(false)
      }
    }
    fetchNotes()
  }, [moduleId])

  const handleFinish = async () => {
    setIsFinishing(true)
    try {
      const res = await fetch(`/api/modules/${moduleId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ learning_status: 'completed' }),
      })
      if (res.ok) {
        if (onComplete) onComplete()
        router.push(`/books/${bookId}`)
      }
    } catch {
      setError('更新状态失败')
    } finally {
      setIsFinishing(false)
    }
  }

  if (isLoading) {
    return (
      <div className="py-20 flex justify-center">
        <LoadingState label="AI 正在为你准备模块学习笔记..." />
      </div>
    )
  }

  if (error) {
    return (
      <ContentCard className="p-12 text-center border-error/20">
        <div className="text-4xl mb-4 text-error">
          <span className="material-symbols-outlined text-5xl">error</span>
        </div>
        <h3 className="text-xl font-bold text-on-surface mb-4">生成笔记出错</h3>
        <p className="text-error mb-8">{error}</p>
        <AmberButton onClick={() => window.location.reload()}>重试</AmberButton>
      </ContentCard>
    )
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      {/* Note Header */}
      <div className="amber-glow rounded-[32px] p-10 text-white shadow-xl shadow-orange-900/10 overflow-hidden relative group">
        <div className="absolute top-0 right-0 p-10 opacity-10 pointer-events-none group-hover:scale-110 transition-transform duration-700">
          <span className="material-symbols-outlined text-[120px]">auto_awesome</span>
        </div>
        <Badge variant="primary" className="bg-white/20 text-white border-none mb-4">AI STUDY NOTES</Badge>
        <h2 className="text-3xl font-black font-headline mb-4 tracking-tight">核心知识点精要</h2>
        <p className="text-white/80 text-lg font-medium leading-relaxed max-w-xl">
          这些笔记是根据你的 Q&A 表现以及教材原文自动生成的，<br />
          包含了本模块最关键的定义、逻辑和常见误区。
        </p>
      </div>

      {/* Note Content */}
      <ContentCard className="p-0 overflow-hidden">
        <div className="p-8 md:p-12">
          <AIResponse content={notes?.content || ''} />
        </div>

        <div className="px-8 py-8 bg-surface-container-low/30 border-t border-outline-variant/10 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3 text-on-surface-variant/60 italic text-sm font-medium">
            <span className="material-symbols-outlined text-sm">info</span>
            <span>读完笔记后，本模块的学习就正式完成了。加油！</span>
          </div>
          <AmberButton
            onClick={handleFinish}
            disabled={isFinishing}
            size="lg"
            className="w-full md:w-auto"
          >
            {isFinishing ? '正在完成...' : '全部完成，返回教材首页'}
          </AmberButton>
        </div>
      </ContentCard>
    </div>
  )
}
