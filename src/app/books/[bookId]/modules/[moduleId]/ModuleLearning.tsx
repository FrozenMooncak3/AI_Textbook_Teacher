'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import QASession from './qa/QASession'
import NotesDisplay from './NotesDisplay'
import AIResponse from '@/components/AIResponse'
import SplitPanelLayout from '@/components/SplitPanelLayout'
import LoadingState from '@/components/LoadingState'

// --- Types ---

type LearningStatus = 'unstarted' | 'reading' | 'qa' | 'notes_generated' | 'completed'

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

// --- Components ---

const LoadingSpinner = () => (
  <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
)

export default function ModuleLearning({
  module,
  bookRawText,
  bookId,
  bookTitle,
}: {
  module: Module
  bookRawText: string
  bookId: number
  bookTitle: string
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

  // ── QA stage: QASession has its own SplitPanelLayout, render directly ──────
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

  // ── KP Sidebar Derivation ───────────────────────────────────
  const kpStatus = (status === 'notes_generated' || status === 'completed') 
      ? 'done' as const 
      : 'pending' as const

  const knowledgePoints = Array.from({ length: module.kp_count || 5 }).map((_, i) => ({
    id: i,
    code: `KP ${module.order_index}.${i + 1}`,
    name: `知识点 ${i + 1}`,
    status: kpStatus
  }))

  const breadcrumbs = [
    { label: bookTitle, href: `/books/${bookId}` },
    { label: `${module.title} 学习` },
  ]

  // ── 渲染视图 ──────────────────────────────────────────────
  return (
    <SplitPanelLayout
      breadcrumbs={breadcrumbs}
      knowledgePoints={knowledgePoints}
    >
      {isTransitioning ? (
        <div className="flex-1 flex items-center justify-center p-12">
          <LoadingState label="AI 正在为你准备下一步学习内容..." />
        </div>
      ) : (
        <div className="max-w-4xl mx-auto p-6 lg:p-12">
          {error && (
            <div className="mb-8 p-6 bg-error-container/10 border border-error/20 rounded-[32px] text-center shadow-sm">
              <span className="material-symbols-outlined text-error text-4xl mb-3" style={{ fontVariationSettings: "'FILL' 1" }}>error</span>
              <p className="text-lg font-bold text-error font-headline">{error}</p>
              <button 
                onClick={() => window.location.reload()}
                className="mt-4 px-8 py-2 bg-primary text-on-primary rounded-full font-bold shadow-lg shadow-orange-900/10 active:scale-95 transition-all"
              >
                重试
              </button>
            </div>
          )}

          {/* Learning Status Router */}
          {(status === 'unstarted' || status === 'reading') && (
            <ReadingPhase 
              module={module} 
              bookRawText={bookRawText} 
              onDone={handleStartQA}
              isGenerating={isTransitioning}
              error={error}
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
            <div className="bg-surface-container-lowest rounded-[32px] border border-outline-variant/10 p-12 text-center shadow-xl">
              <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-8 text-4xl shadow-sm">
                <span className="material-symbols-outlined text-4xl" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
              </div>
              <h2 className="text-3xl font-black text-on-surface mb-4 font-headline tracking-tight">恭喜完成模块学习！</h2>
              <p className="text-on-surface-variant mb-10 font-medium text-lg">你已经成功完成了《{module.title}》的所有学习环节。</p>
              <button 
                onClick={() => router.push(`/books/${bookId}`)}
                className="w-full sm:w-auto amber-glow text-on-primary font-bold py-4 px-12 rounded-full shadow-xl shadow-orange-900/10 transition-all font-headline tracking-wide active:scale-95"
              >
                返回教材首页
              </button>
            </div>
          )}
        </div>
      )}
    </SplitPanelLayout>
  )
}

// ── Reading Phase Component ───────────────────────────────────

function ReadingPhase({ 
  module, 
  bookRawText, 
  onDone,
  isGenerating,
  error
}: { 
  module: Module
  bookRawText: string 
  onDone: () => void
  isGenerating: boolean
  error: string | null
}) {
  const [guide, setGuide] = useState<Guide | null>(null)
  const [isGuideOpen, setIsGuideOpen] = useState(true)
  const [notes, setNotes] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  // Load guide asynchronously
  useEffect(() => {
    const fetchGuide = async () => {
      try {
        const res = await fetch(`/api/modules/${module.id}/guide`, { method: 'POST' })
        const data = await res.json()
        if (data.guide) {
          setGuide(data.guide)
        }
      } catch { /* ignore */ }
    }
    fetchGuide()
  }, [module.id])

  // Load reading notes
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
          await fetch(`/api/modules/${module.id}/reading-notes?noteId=${note.id}`, {
            method: 'DELETE'
          })
        }
      }

      await fetch(`/api/modules/${module.id}/reading-notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: notes }),
      })
    } catch { /* ignore */ }
    finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-8 pb-12">
      {/* Guide Banner */}
      {guide && (
        <div className="bg-surface-container-lowest rounded-[32px] border border-primary/10 overflow-hidden shadow-sm shadow-orange-900/5">
          <button 
            onClick={() => setIsGuideOpen(!isGuideOpen)}
            className="w-full px-8 py-5 flex items-center justify-between bg-primary/5 hover:bg-primary/10 transition-colors"
          >
            <div className="flex items-center gap-4 text-primary">
              <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>lightbulb</span>
              <span className="font-black font-headline tracking-wide uppercase text-xs">读前指引：本模块学习目标</span>
            </div>
            <span className={`material-symbols-outlined text-primary/40 transition-transform ${isGuideOpen ? 'rotate-180' : ''}`}>
              expand_more
            </span>
          </button>
          
          {isGuideOpen && (
            <div className="p-8 space-y-8">
              <div>
                <p className="text-[10px] font-black text-on-surface-variant uppercase tracking-[0.2em] mb-4">学完能做什么</p>
                <div className="text-on-surface text-lg leading-relaxed font-medium">
                  <AIResponse content={guide.goal} />
                </div>
              </div>
              
              <div className="grid sm:grid-cols-2 gap-8 pt-4 border-t border-outline-variant/10">
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
        </div>
      )}

      {/* Reading Area */}
      <div className="bg-surface-container-lowest rounded-[32px] border border-outline-variant/10 overflow-hidden shadow-sm">
        <div className="px-8 py-5 border-b border-outline-variant/10 flex items-center justify-between bg-surface-container-low/30">
          <h3 className="font-black font-headline text-on-surface flex items-center gap-3">
            <span className="material-symbols-outlined text-on-surface-variant/40">menu_book</span>
            教材原文
          </h3>
          <span className="text-[10px] bg-surface-container-high text-on-surface-variant px-3 py-1 rounded-full font-black uppercase tracking-[0.1em]">Deep Learning</span>
        </div>
        <div className="p-8 max-h-[60vh] overflow-y-auto custom-scrollbar">
          <pre className="text-base text-on-surface leading-loose whitespace-pre-wrap font-body">
            {bookRawText}
          </pre>
        </div>
      </div>

      {/* Notes Area */}
      <div className="bg-surface-container-lowest rounded-[32px] border border-outline-variant/10 p-8 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-black font-headline text-on-surface flex items-center gap-3">
            <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>edit_note</span>
            阅读笔记
          </h3>
          {isSaving && <div className="text-[10px] text-primary font-bold animate-pulse uppercase tracking-widest">Saving...</div>}
        </div>
        <textarea 
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={handleSaveNotes}
          placeholder="在这里记录你的思考、疑问或重点..."
          rows={5}
          className="w-full bg-surface-container-low/30 border border-outline-variant/10 rounded-2xl px-6 py-5 text-on-surface focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary/20 transition-all placeholder:text-on-surface-variant/30 resize-none"
        />
        <div className="mt-4 flex items-center gap-2 text-[10px] text-on-surface-variant/50 font-bold uppercase tracking-widest">
          <span className="material-symbols-outlined text-xs">info</span>
          笔记将用于辅助 AI 出题，让练习更具针对性
        </div>
      </div>

      {/* CTA */}
      <div className="pt-6">
        <button 
          onClick={onDone}
          disabled={isGenerating}
          className="w-full amber-glow text-on-primary font-black font-headline text-lg py-5 rounded-full shadow-xl shadow-orange-900/20 transition-all flex items-center justify-center gap-4 transform active:scale-[0.98] disabled:opacity-50"
        >
          {isGenerating ? (
            <>
              <LoadingSpinner />
              <span>AI 正在分析知识点并出题...</span>
            </>
          ) : (
            <>
              <span>我读完了，进入 Q&A 练习</span>
              <span className="material-symbols-outlined">chevron_right</span>
            </>
          )}
        </button>
      </div>
    </div>
  )
}
