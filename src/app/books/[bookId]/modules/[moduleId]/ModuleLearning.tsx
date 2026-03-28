'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import QASession from './qa/QASession'
import NotesDisplay from './NotesDisplay'

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
  <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
)

export default function ModuleLearning({
  module,
  bookRawText,
  bookId,
}: {
  module: Module
  bookRawText: string
  bookId: number
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
          // silently fail, we'll try again if they refresh
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
        setError(result.error || 'Failed to generate questions')
      }
    } catch {
      setError('Connection failed. Please try again.')
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

  // ── 渲染视图 ──────────────────────────────────────────────
  if (status === 'unstarted' || status === 'reading') {
    return (
      <ReadingPhase 
        module={module} 
        bookRawText={bookRawText} 
        onDone={handleStartQA}
        isGenerating={isTransitioning}
        error={error}
      />
    )
  }

  if (status === 'qa') {
    return (
      <QASession 
        moduleId={module.id} 
        moduleTitle={module.title} 
        bookId={bookId} 
        onComplete={handleCompleteNotes}
      />
    )
  }

  if (status === 'notes_generated') {
    return (
      <NotesDisplay 
        moduleId={module.id} 
        bookId={bookId} 
        onComplete={handleFinalComplete}
      />
    )
  }

  if (status === 'completed') {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center shadow-sm">
        <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6 text-3xl">✓</div>
        <h2 className="text-2xl font-bold text-slate-900 mb-2">恭喜完成！</h2>
        <p className="text-slate-600 mb-8">你已经完成了模块《{module.title}》的学习。</p>
        <button 
          onClick={() => router.push(`/books/${bookId}/module-map`)}
          className="w-full sm:w-auto bg-slate-900 hover:bg-slate-800 text-white font-bold py-3 px-10 rounded-xl transition-all"
        >
          返回模块地图
        </button>
      </div>
    )
  }

  return null
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
      } catch { /* ignore guide load failures */ }
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
          // Join multiple notes into one text area content for simplicity
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
    <div className="space-y-6">
      {/* Guide Banner */}
      {guide && (
        <div className="bg-white rounded-2xl border border-blue-100 overflow-hidden shadow-sm shadow-blue-50">
          <button 
            onClick={() => setIsGuideOpen(!isGuideOpen)}
            className="w-full px-6 py-4 flex items-center justify-between bg-blue-50/50 hover:bg-blue-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <span className="text-xl">💡</span>
              <span className="font-bold text-blue-900">读前指引：本模块学习目标</span>
            </div>
            <svg 
              className={`w-5 h-5 text-blue-400 transition-transform ${isGuideOpen ? 'rotate-180' : ''}`} 
              fill="none" viewBox="0 0 24 24" stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="19 9l-7 7-7-7" />
            </svg>
          </button>
          
          {isGuideOpen && (
            <div className="p-6 space-y-6">
              <div>
                <p className="text-xs font-bold text-blue-500 uppercase tracking-widest mb-2">学完能做什么</p>
                <p className="text-slate-700 leading-relaxed">{guide.goal}</p>
              </div>
              
              <div className="grid sm:grid-cols-2 gap-6">
                <div>
                  <p className="text-xs font-bold text-emerald-500 uppercase tracking-widest mb-3">核心重点</p>
                  <ul className="space-y-2">
                    {guide.focus_points.map((p, i) => (
                      <li key={i} className="flex gap-2 text-sm text-slate-600">
                        <span className="text-emerald-400 font-bold shrink-0">·</span>
                        {p}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-xs font-bold text-amber-500 uppercase tracking-widest mb-3">容易混淆</p>
                  <ul className="space-y-2">
                    {guide.common_mistakes.map((p, i) => (
                      <li key={i} className="flex gap-2 text-sm text-slate-600">
                        <span className="text-amber-400 font-bold shrink-0">!</span>
                        {p}
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
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <h3 className="font-bold text-slate-900 flex items-center gap-2">
            <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            教材原文
          </h3>
          <span className="text-[10px] bg-slate-200 text-slate-500 px-1.5 py-0.5 rounded font-bold uppercase tracking-tighter">Read Carefully</span>
        </div>
        <div className="p-8 max-h-[50vh] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-200">
          <pre className="text-sm text-slate-700 leading-loose whitespace-pre-wrap font-sans">
            {bookRawText}
          </pre>
        </div>
      </div>

      {/* Notes Area */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-slate-900 flex items-center gap-2">
            <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            阅读笔记
          </h3>
          {isSaving && <div className="text-[10px] text-slate-400 animate-pulse">正在保存...</div>}
        </div>
        <textarea 
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={handleSaveNotes}
          placeholder="在这里记录你的思考、疑问或重点..."
          rows={4}
          className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all placeholder:text-slate-300 resize-none bg-slate-50/30"
        />
        <p className="text-[10px] text-slate-400 mt-2 flex items-center gap-1">
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          笔记将用于辅助 AI 出题，让练习更具针对性
        </p>
      </div>

      {/* CTA */}
      <div className="pt-4">
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-100 text-red-600 text-xs rounded-xl flex items-center gap-2">
            <span>⚠️</span> {error}
          </div>
        )}
        <button 
          onClick={onDone}
          disabled={isGenerating}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold py-4 rounded-2xl shadow-lg shadow-blue-200 transition-all flex items-center justify-center gap-3 transform active:scale-[0.99]"
        >
          {isGenerating ? (
            <>
              <LoadingSpinner />
              <span>AI 正在分析知识点并出题...</span>
            </>
          ) : (
            <>
              <span>我读完了，进入 Q&A 练习</span>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </>
          )}
        </button>
      </div>
    </div>
  )
}
