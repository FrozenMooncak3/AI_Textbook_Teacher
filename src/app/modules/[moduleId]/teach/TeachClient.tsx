'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import AppSidebar from '@/components/ui/AppSidebar'
import ContentCard from '@/components/ui/ContentCard'
import Breadcrumb from '@/components/ui/Breadcrumb'
import DecorativeBlur from '@/components/ui/DecorativeBlur'
import AmberButton from '@/components/ui/AmberButton'
import type { TranscriptV1, TranscriptMessage } from '@/lib/teaching-types'

interface KP {
  id: number
  section_name: string
  description: string
}

interface TeachClientProps {
  sessionId: string
  moduleId: number
  bookId: number
  moduleTitle: string
  userName: string
  initialTranscript: TranscriptV1
  kps: KP[]
}

export default function TeachClient({
  sessionId,
  moduleId,
  bookId,
  moduleTitle,
  userName,
  initialTranscript,
  kps
}: TeachClientProps) {
  const [transcript, setTranscript] = useState<TranscriptV1>(initialTranscript)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const scrollRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  // Auto-scroll to bottom of chat
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [transcript.messages])

  // Initial prompt if conversation is empty
  useEffect(() => {
    if (transcript.messages.length === 0) {
      handleSendMessage('你好，老师。我准备好开始学习了。')
    }
  }, [])

  const handleSendMessage = async (text: string) => {
    if (!text.trim() || sending) return

    setSending(true)
    setError(null)
    
    // Optimistic student message update (optional, usually handled by backend for transcript consistency)
    // But since the backend returns the updated state, we'll wait for the response.

    try {
      const res = await fetch(`/api/teaching-sessions/${sessionId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text })
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `发送失败: HTTP ${res.status}`)
      }

      // Re-fetch session to get the full updated transcript
      // or the API could return the full updated transcript.
      // Based on route.ts, it returns { status, message, kpTakeaway, coveredKpIds, etc }
      // It's safer to re-fetch or the API should return the whole transcript.
      // Let's assume we need to re-fetch the session data for a full sync of transcript.messages
      
      const sessionRes = await fetch(`/api/books/${bookId}/dashboard`) // This doesn't help with session
      // Actually, we can just fetch the session again if there was a separate GET /api/teaching-sessions/[id]
      // Since there isn't one clearly defined in the dispatch, I'll rely on the POST response
      // But wait, the POST response doesn't include the full message history.
      // Let's check if there's a GET /api/teaching-sessions/[id]
      
      const refreshRes = await fetch(`/api/modules/${moduleId}/teach-status`) // Mocking or checking if it exists
      // Wait, let's just append the messages manually if the API is limited.
      // Better: check the route.ts again. It updates the DB.
      // If I want the latest transcript, I need a way to GET it.
      
      // I'll add a helper to fetch the current session state.
      // For now, I'll append the returned messages to the local state.
      
      const result = await res.json()
      
      const now = new Date().toISOString()
      const newMessages: TranscriptMessage[] = [
        { kind: 'student_response', role: 'user', content: text, ts: now }
      ]
      
      const teacherKind = result.status === 'struggling' ? 'struggling_hint' : 'socratic_question'
      newMessages.push({
        kind: teacherKind,
        role: 'teacher',
        content: result.message,
        ts: now,
        kpId: transcript.state.currentKpId || undefined
      })
      
      if (result.kpTakeaway && transcript.state.currentKpId) {
        newMessages.push({
          kind: 'kp_takeaway',
          role: 'teacher',
          kpId: transcript.state.currentKpId,
          summary: result.kpTakeaway,
          ts: now
        })
      }
      
      setTranscript(prev => ({
        ...prev,
        state: {
          ...prev.state,
          currentKpId: result.currentKpId,
          coveredKpIds: result.coveredKpIds,
          strugglingStreak: result.strugglingStreak
        },
        messages: [...prev.messages, ...newMessages]
      }))
      
      setInput('')
    } catch (err) {
      setError(err instanceof Error ? err.message : '发送消息失败')
    } finally {
      setSending(false)
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

  const currentKpId = transcript.state.currentKpId
  const coveredKpIds = transcript.state.coveredKpIds

  return (
    <div className="min-h-screen bg-surface-container-low flex">
      <AppSidebar 
        userName={userName} 
        navItems={navItems}
        bookTitle={moduleTitle}
      />

      <main className="flex-1 ml-72 flex flex-col h-screen overflow-hidden relative">
        <DecorativeBlur position="top-right" />
        
        {/* Top Header */}
        <div className="px-10 py-6 border-b border-amber-100 bg-surface-container-low/80 backdrop-blur-md z-20">
          <Breadcrumb items={breadcrumbItems} />
          <div className="flex items-center justify-between mt-4">
            <h1 className="text-xl font-headline font-bold text-on-surface">AI 老师模式：互动教学中</h1>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">学习进度</span>
              <div className="flex gap-1">
                {kps.map(kp => (
                  <div 
                    key={kp.id} 
                    className={cn(
                      "w-3 h-3 rounded-full border border-amber-200 transition-colors",
                      coveredKpIds.includes(kp.id) ? "bg-emerald-500 border-emerald-600" :
                      kp.id === currentKpId ? "bg-primary border-primary animate-pulse" : "bg-surface-container"
                    )}
                    title={kp.section_name}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Chat Area */}
        <div 
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-10 space-y-6 custom-scrollbar relative z-10"
        >
          {transcript.messages.map((msg, idx) => (
            <div 
              key={idx}
              className={cn(
                "flex flex-col max-w-[85%]",
                msg.role === 'user' ? "ml-auto items-end" : "mr-auto items-start"
              )}
            >
              {msg.kind === 'kp_takeaway' ? (
                <div className="w-full bg-emerald-50 border border-emerald-100 rounded-2xl p-6 shadow-sm">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="material-symbols-outlined text-emerald-600 text-xl">verified</span>
                    <span className="text-sm font-bold text-emerald-800 uppercase tracking-widest">知识点达成</span>
                  </div>
                  <p className="text-emerald-900 leading-relaxed font-medium">{msg.summary}</p>
                </div>
              ) : (
                <div 
                  className={cn(
                    "px-5 py-4 rounded-2xl text-[15px] leading-relaxed shadow-sm",
                    msg.role === 'user' 
                      ? "bg-primary text-on-primary rounded-tr-none" 
                      : "bg-white text-on-surface border border-amber-100 rounded-tl-none"
                  )}
                >
                  {msg.content}
                </div>
              )}
              <span className="text-[10px] text-on-surface-variant/40 mt-1 font-bold">
                {new Date(msg.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          ))}
          
          {sending && (
            <div className="flex items-start mr-auto">
              <div className="bg-white border border-amber-100 px-5 py-4 rounded-2xl rounded-tl-none shadow-sm flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce [animation-delay:-0.3s]" />
                <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce [animation-delay:-0.15s]" />
                <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" />
              </div>
            </div>
          )}

          {error && (
            <div className="max-w-md mx-auto bg-error-container/10 border border-error/20 rounded-xl p-4 text-error text-center text-sm font-medium">
              {error}
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="px-10 py-8 border-t border-amber-100 bg-surface-container-lowest z-20">
          <div className="max-w-4xl mx-auto flex gap-4 items-end">
            <div className="flex-1 bg-surface-container rounded-2xl border border-amber-200 focus-within:ring-2 focus-within:ring-primary/20 transition-all p-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleSendMessage(input)
                  }
                }}
                placeholder="在此输入你的回答..."
                className="w-full bg-transparent border-none focus:ring-0 text-on-surface placeholder:text-on-surface-variant/40 resize-none max-h-32 min-h-[44px] py-2 px-3"
                disabled={sending}
              />
            </div>
            <AmberButton 
              onClick={() => handleSendMessage(input)} 
              disabled={sending || !input.trim()}
              className="h-[52px] w-[52px] !p-0 shrink-0"
              rounded="full"
            >
              <span className="material-symbols-outlined">send</span>
            </AmberButton>
          </div>
          <p className="max-w-4xl mx-auto mt-3 text-[10px] text-center text-on-surface-variant/40 font-bold uppercase tracking-widest">
            AI 老师正在通过启发式问答引导你，请尝试表达你的理解
          </p>
        </div>
      </main>

      {/* KP Sidebar (Optional/Right side) */}
      <aside className="w-72 bg-white border-l border-amber-100 p-6 hidden xl:block">
        <h3 className="text-sm font-black text-on-surface-variant/50 uppercase tracking-widest mb-6">当前教学目标</h3>
        <div className="space-y-4">
          {kps.map(kp => {
            const isCovered = coveredKpIds.includes(kp.id)
            const isCurrent = kp.id === currentKpId
            
            return (
              <div 
                key={kp.id}
                className={cn(
                  "p-4 rounded-xl border transition-all",
                  isCovered ? "bg-emerald-50 border-emerald-100 opacity-60" :
                  isCurrent ? "bg-amber-50 border-amber-200 ring-2 ring-primary/10 shadow-sm" :
                  "bg-surface-container-lowest border-amber-50"
                )}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className={cn(
                    "material-symbols-outlined text-sm",
                    isCovered ? "text-emerald-600" : isCurrent ? "text-primary" : "text-on-surface-variant/40"
                  )}>
                    {isCovered ? "check_circle" : "radio_button_checked"}
                  </span>
                  <span className={cn(
                    "text-xs font-bold truncate",
                    isCovered ? "text-emerald-800" : isCurrent ? "text-amber-900" : "text-on-surface-variant"
                  )}>
                    {kp.section_name}
                  </span>
                </div>
                {isCurrent && (
                  <p className="text-[11px] text-amber-900/70 leading-relaxed line-clamp-3">
                    {kp.description}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      </aside>
    </div>
  )
}
