'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import QASession from './qa/QASession'
import NotesDisplay from './NotesDisplay'
import AIResponse from '@/components/AIResponse'
import LoadingState from '@/components/LoadingState'
import AppSidebar from '@/components/ui/AppSidebar'
import Breadcrumb from '@/components/ui/Breadcrumb'
import ContentCard from '@/components/ui/ContentCard'
import StatusBadge from '@/components/ui/StatusBadge'
import ProgressBar from '@/components/ui/ProgressBar'
import AmberButton from '@/components/ui/AmberButton'
import DecorativeBlur from '@/components/ui/DecorativeBlur'

// --- Types ---

type LearningStatus = 'unstarted' | 'reading' | 'qa' | 'notes_generated' | 'testing' | 'completed'

interface Module {
  id: number
  book_id: number
  title: string
  summary: string
  order_index: number
  kp_count: number
  learning_status: string
}

interface Guide {
  goal: string
  focus_points: string[]
  common_mistakes: string[]
}

interface ReadingNote {
  id: number
  content: string
  page_number?: number
}

export default function ModuleLearning({
  module,
  bookRawText,
  bookId,
  bookTitle,
  userName,
}: {
  module: Module
  bookRawText: string
  bookId: number
  bookTitle: string
  userName: string
}) {
  const router = useRouter()
  const [status, setStatus] = useState<LearningStatus>(module.learning_status as LearningStatus)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // ── 状态初始化 ───────────────────────────────────────────
  useEffect(() => {
    if (status === 'unstarted') {
      const transitionToReading = async () => {
        try {
          const res = await fetch(`/api/modules/${module.id}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ learning_status: 'reading' }),
          })
          if (res.ok) {
            setStatus('reading')
          }
        } catch {
          // silently fail
        }
      }
      transitionToReading()
    }
  }, [status, module.id])

  // ── 阶段切换逻辑 ──────────────────────────────────────────
  const handleStartQA = async () => {
    setIsTransitioning(true)
    setError(null)
    try {
      const res = await fetch(`/api/modules/${module.id}/generate-questions`, { method: 'POST' })
      const result = await res.json()
      if (result.success) {
        setStatus('qa')
      } else {
        setError(result.error || '无法生成 Q&A 题目')
      }
    } catch {
      setError('无法连接服务器，请重试。')
    } finally {
      setIsTransitioning(false)
    }
  }

  const handleCompleteNotes = () => {
    setStatus('notes_generated')
  }

  const handleFinalComplete = () => {
    setStatus('completed')
  }

  const navItems = [
    { icon: 'home', label: '首页中心', href: '/' },
    { icon: 'cloud_upload', label: '上传教材', href: '/upload' },
    { icon: 'analytics', label: '系统日志', href: '/logs' },
  ]

  const breadcrumbs = [
    { label: '首页', href: '/' },
    { label: bookTitle, href: `/books/${bookId}` },
    { label: `${module.title} 学习` },
  ]

  // ── QA stage: QASession handles its own layout ──────
  if (status === 'qa') {
    return (
      <QASession 
        moduleId={module.id} 
        moduleTitle={module.title} 
        bookId={bookId}
        bookTitle={bookTitle}
        onComplete={handleCompleteNotes}
      />
    )
  }

  // ── Testing stage: Redirect to test page ──────
  if (status === 'testing') {
    router.push(`/books/${bookId}/modules/${module.id}/test`)
    return (
      <div className="h-screen flex items-center justify-center bg-surface-container-low">
        <LoadingState label="正在前往测试页面..." />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface-container-low">
      <AppSidebar 
        userName={userName} 
        navItems={navItems}
        bookTitle={bookTitle}
      />

      <main className="ml-72 p-10 relative min-h-screen">
        <DecorativeBlur position="top-right" />
        <DecorativeBlur position="bottom-left" color="secondary" />

        <div className="max-w-4xl mx-auto relative z-10 space-y-10">
          <header className="flex items-center justify-between">
            <Breadcrumb items={breadcrumbs} />
            <StatusBadge status={status === 'unstarted' ? 'not-started' : status} />
          </header>

          {isTransitioning ? (
            <div className="py-20 flex justify-center">
              <LoadingState label="AI 正在准备下一步学习内容..." />
            </div>
          ) : (
            <div className="space-y-10">
              {error && (
                <ContentCard className="border-error/20 p-6 flex items-center gap-4 text-error font-medium animate-in fade-in slide-in-from-top-2">
                  <span className="material-symbols-outlined">error</span>
                  <span>{error}</span>
                  <button onClick={() => window.location.reload()} className="ml-auto underline">重试</button>
                </ContentCard>
              )}

              {(status === 'unstarted' || status === 'reading') && (
                <ReadingPhase 
                  module={module} 
                  bookRawText={bookRawText} 
                  onDone={handleStartQA}
                  isGenerating={isTransitioning}
                />
              )}

              {status === 'notes_generated' && (
                <NotesDisplay 
                  moduleId={module.id} 
                  bookId={bookId} 
                  onComplete={handleFinalComplete}
                />
              )}

              {status === 'completed' && (
                <ContentCard className="p-16 text-center space-y-8">
                  <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto text-4xl shadow-sm">
                    <span className="material-symbols-outlined text-4xl" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                  </div>
                  <h2 className="text-3xl font-black text-on-surface font-headline tracking-tight">恭喜完成模块学习！</h2>
                  <p className="text-on-surface-variant font-medium text-lg">你已经成功完成了《{module.title}》的所有学习环节。</p>
                  <AmberButton onClick={() => router.push(`/books/${bookId}`)} size="lg">返回教材首页</AmberButton>
                </ContentCard>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

// ── Reading Phase Component ───────────────────────────────────

function ReadingPhase({ 
  module, 
  bookRawText, 
  onDone,
  isGenerating
}: { 
  module: Module
  bookRawText: string 
  onDone: () => void
  isGenerating: boolean
}) {
  const [guide, setGuide] = useState<Guide | null>(null)
  const [isGuideOpen, setIsGuideOpen] = useState(true)
  const [notes, setNotes] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    const fetchGuide = async () => {
      try {
        const res = await fetch(`/api/modules/${module.id}/guide`, { method: 'POST' })
        const data = await res.json()
        if (data.guide) setGuide(data.guide)
      } catch { /* ignore */ }
    }
    fetchGuide()
  }, [module.id])

  useEffect(() => {
    const fetchNotes = async () => {
      try {
        const res = await fetch(`/api/modules/${module.id}/reading-notes`)
        const result = await res.json()
        if (result.success && result.data.notes.length > 0) {
          setNotes(result.data.notes.map((n: ReadingNote) => n.content).join('\n\n'))
        }
      } catch { /* ignore */ }
    }
    fetchNotes()
  }, [module.id])

  const handleSaveNotes = async () => {
    if (!notes.trim()) return
    setIsSaving(true)
    try {
      const res = await fetch(`/api/modules/${module.id}/reading-notes`)
      const result = await res.json()
      if (result.success && result.data.notes.length > 0) {
        for (const note of result.data.notes) {
          await fetch(`/api/modules/${module.id}/reading-notes?noteId=${note.id}`, { method: 'DELETE' })
        }
      }
      await fetch(`/api/modules/${module.id}/reading-notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: notes }),
      })
    } catch { /* ignore */ }
    finally { setIsSaving(false) }
  }

  return (
    <div className="space-y-10">
      {guide && (
        <ContentCard className="p-0 overflow-hidden shadow-sm">
          <button 
            onClick={() => setIsGuideOpen(!isGuideOpen)}
            className="w-full px-8 py-5 flex items-center justify-between bg-primary/5 hover:bg-primary/10 transition-colors"
          >
            <div className="flex items-center gap-4 text-primary">
              <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>lightbulb</span>
              <span className="font-black font-headline tracking-wide uppercase text-xs">读前指引：学习目标</span>
            </div>
            <span className={`material-symbols-outlined transition-transform ${isGuideOpen ? 'rotate-180' : ''}`}>expand_more</span>
          </button>
          
          {isGuideOpen && (
            <div className="p-8 space-y-8 animate-in slide-in-from-top-2 duration-300">
              <div>
                <p className="text-[10px] font-black text-on-surface-variant uppercase tracking-[0.2em] mb-4">学完能做什么</p>
                <div className="text-on-surface text-lg leading-relaxed font-medium"><AIResponse content={guide.goal} /></div>
              </div>
              
              <div className="grid sm:grid-cols-2 gap-8 pt-8 border-t border-outline-variant/10">
                <div>
                  <p className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.2em] mb-4">核心重点</p>
                  <ul className="space-y-3">
                    {guide.focus_points.map((p, i) => (
                      <li key={i} className="flex gap-3 text-sm text-on-surface-variant font-medium">
                        <span className="text-emerald-500 font-black shrink-0">·</span>
                        <AIResponse content={p} />
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-[10px] font-black text-primary uppercase tracking-[0.2em] mb-4">容易混淆</p>
                  <ul className="space-y-3">
                    {guide.common_mistakes.map((p, i) => (
                      <li key={i} className="flex gap-3 text-sm text-on-surface-variant font-medium">
                        <span className="text-primary font-black shrink-0">!</span>
                        <AIResponse content={p} />
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}
        </ContentCard>
      )}

      <ContentCard className="p-0 overflow-hidden">
        <div className="px-8 py-5 border-b border-outline-variant/10 flex items-center justify-between bg-surface-container-low/30">
          <h3 className="font-black font-headline text-on-surface flex items-center gap-3">
            <span className="material-symbols-outlined text-on-surface-variant/40">menu_book</span>
            教材原文
          </h3>
        </div>
        <div className="p-8 max-h-[60vh] overflow-y-auto custom-scrollbar">
          <pre className="text-base text-on-surface leading-loose whitespace-pre-wrap font-body">{bookRawText}</pre>
        </div>
      </ContentCard>

      <ContentCard className="p-8">
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-black font-headline text-on-surface flex items-center gap-3">
            <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>edit_note</span>
            阅读笔记
          </h3>
          {isSaving && <div className="text-[10px] text-primary font-bold animate-pulse uppercase tracking-widest">保存中...</div>}
        </div>
        <textarea 
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={handleSaveNotes}
          placeholder="在这里记录你的思考、疑问或重点..."
          rows={5}
          className="w-full bg-surface-container-low/30 border border-outline-variant/10 rounded-2xl px-6 py-5 text-on-surface focus:outline-none focus:ring-4 focus:ring-primary/5 focus:bg-surface-container-lowest transition-all placeholder:text-on-surface-variant/30 resize-none shadow-inner"
        />
      </ContentCard>

      <div className="pt-6">
        <AmberButton 
          onClick={onDone} 
          disabled={isGenerating} 
          fullWidth 
          size="lg"
          className="py-6"
        >
          {isGenerating ? 'AI 正在分析知识点并出题...' : '我读完了，进入 Q&A 练习'}
        </AmberButton>
      </div>
    </div>
  )
}
