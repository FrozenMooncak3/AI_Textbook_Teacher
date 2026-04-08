'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import AIResponse from '@/components/AIResponse'
import LoadingState from '@/components/LoadingState'

interface NotesData {
  noteId: number
  content: string
}

const LoadingSpinner = () => (
  <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
)

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
          setError(result.error || '无法加载学习笔记')
        }
      } catch {
        setError('加载失败，请检查网络')
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
      setError('操作失败，请重试')
    } finally {
      setIsFinishing(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-full flex items-center justify-center">
        <LoadingState label="AI 正在为你整理学习笔记..." />
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white rounded-2xl border border-red-100 p-12 text-center">
        <div className="text-4xl mb-4">⚠️</div>
        <h3 className="text-xl font-bold text-slate-900 mb-4">生成笔记失败</h3>
        <p className="text-red-600 mb-8">{error}</p>
        <button 
          onClick={() => window.location.reload()}
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-xl transition-all"
        >
          重试
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Note Header */}
      <div className="bg-slate-900 rounded-2xl p-8 text-white shadow-xl shadow-slate-200 overflow-hidden relative">
        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
          <svg className="w-32 h-32" fill="currentColor" viewBox="0 0 24 24">
            <path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        </div>
        <span className="text-xs font-bold text-blue-400 uppercase tracking-[0.2em] mb-2 block">AI Study Notes</span>
        <h2 className="text-2xl font-bold mb-4">学习总结与沉淀</h2>
        <p className="text-slate-400 text-sm leading-relaxed max-w-md">
          这是根据你本模块的学习表现自动生成的笔记。你可以将其作为复习的主要参考资料。
        </p>
      </div>

      {/* Note Content */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-8 md:p-12">
          <AIResponse content={notes?.content || ''} />
        </div>
        
        <div className="px-8 py-6 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-slate-400 italic">
            提示：这些笔记已自动保存到你的学习档案中。
          </p>
          <button 
            onClick={handleFinish}
            disabled={isFinishing}
            className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold py-3 px-10 rounded-xl shadow-lg shadow-blue-200 transition-all flex items-center justify-center gap-2"
          >
            {isFinishing ? <LoadingSpinner /> : null}
            {isFinishing ? '正在完成...' : '完成本模块学习'}
            {!isFinishing && (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
