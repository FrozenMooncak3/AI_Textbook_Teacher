'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import AppSidebar from '@/components/ui/AppSidebar'
import ContentCard from '@/components/ui/ContentCard'
import Breadcrumb from '@/components/ui/Breadcrumb'
import DecorativeBlur from '@/components/ui/DecorativeBlur'
import AmberButton from '@/components/ui/AmberButton'
import ChatBubble from '@/components/ui/ChatBubble'
import ProgressBar from '@/components/ui/ProgressBar'

interface Cluster {
  id: number
  name: string
  kp_ids: number[]
}

type ChatMessage =
  | { kind: 'student'; content: string; ts: string }
  | { kind: 'teacher'; content: string; ts: string }
  | { kind: 'takeaway'; content: string; ts: string }

interface TeachClientProps {
  moduleId: number
  bookId: number
  moduleTitle: string
  learningStatus: string
  userName: string
}

const COMPLETED_STATUSES = ['taught', 'qa_in_progress', 'qa', 'notes_generated', 'testing', 'completed']

export default function TeachClient({ 
  moduleId, 
  bookId, 
  moduleTitle, 
  learningStatus, 
  userName 
}: TeachClientProps) {
  const router = useRouter()
  const [clusters, setClusters] = useState<Cluster[]>([])
  const [currentClusterIndex, setCurrentClusterIndex] = useState(0)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [coveredKpIds, setCoveredKpIds] = useState<number[]>([])
  const [inputValue, setInputValue] = useState('')
  const [lastInput, setLastInput] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [struggFrozen, setStruggFrozen] = useState(false)
  const [completing, setCompleting] = useState(false)
  const [initializing, setInitializing] = useState(true)
  const [initError, setInitError] = useState<string | null>(null)
  
  const scrollRef = useRef<HTMLDivElement>(null)
  const hasInitialized = useRef(false)

  const isReadOnly = COMPLETED_STATUSES.includes(learningStatus)

  // Auto-scroll to bottom of chat
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  // Initialization: Fetch clusters and create first session
  useEffect(() => {
    if (isReadOnly || hasInitialized.current) {
      setInitializing(false)
      return
    }

    let cancelled = false
    hasInitialized.current = true

    async function initialize() {
      try {
        // 1. Fetch clusters
        const clustersRes = await fetch(`/api/modules/${moduleId}/clusters`)
        if (!clustersRes.ok) throw new Error('获取知识点簇失败')
        const clustersData = await clustersRes.json()
        if (cancelled) return
        
        if (!clustersData.clusters || clustersData.clusters.length === 0) {
          throw new Error('当前模块暂无学习内容')
        }
        setClusters(clustersData.clusters)

        // 2. Create new session for cluster[0]
        const sessionRes = await fetch('/api/teaching-sessions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            moduleId,
            clusterId: clustersData.clusters[0].id,
            depth: 'full'
          })
        })
        if (!sessionRes.ok) throw new Error('创建教学会话失败')
        const sessionData = await sessionRes.json()
        if (cancelled) return
        setSessionId(sessionData.sessionId)

        // 3. Intro message
        const firstCluster = clustersData.clusters[0]
        setMessages([{
          kind: 'teacher',
          content: `你好！准备好开始学习了吗？我们先从【${firstCluster.name}】开始。这个知识簇包含了 ${firstCluster.kp_ids.length} 个重点内容。请尝试用自己的话解释一下你对这个主题的初步理解，或者问我任何相关的问题。`,
          ts: new Date().toISOString()
        }])
      } catch (err) {
        if (cancelled) return
        setInitError(err instanceof Error ? err.message : '教学中心初始化失败')
      } finally {
        if (!cancelled) setInitializing(false)
      }
    }

    initialize()
    return () => { cancelled = true }
  }, [moduleId, isReadOnly])

  const handleSend = async (textOverride?: string) => {
    const text = (textOverride ?? inputValue).trim()
    if (!text || !sessionId || sending || struggFrozen || completing || isReadOnly) return

    setSending(true)
    setError(null)
    setLastInput(text)
    if (!textOverride) setInputValue('')

    const now = new Date().toISOString()
    // Optimistic student message
    setMessages(prev => [...prev, { kind: 'student', content: text, ts: now }])

    try {
      const res = await fetch(`/api/teaching-sessions/${sessionId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text })
      })

      // 409 STRUGGLING_FROZEN
      if (res.status === 409) {
        setStruggFrozen(true)
        setMessages(prev => [...prev, { 
          kind: 'teacher', 
          content: 'AI 老师发现你可能在这个知识点上遇到了较大困难，为了避免过度疲劳，建议你先回到原文重新阅读。',
          ts: new Date().toISOString()
        }])
        return
      }

      // 429/503 retryable
      if (res.status === 429 || res.status === 503) {
        setError('AI 老师暂时响应不过来，请稍后重试或点击重新发送。')
        setMessages(prev => prev.slice(0, -1))
        return
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `请求失败: HTTP ${res.status}`)
      }

      const data = await res.json()
      setCoveredKpIds(data.coveredKpIds)

      // Append teacher message
      setMessages(prev => [...prev, { 
        kind: 'teacher', 
        content: data.message,
        ts: new Date().toISOString()
      }])

      // Handle KP Advance
      if (data.status === 'ready_to_advance' && data.kpTakeaway) {
        setMessages(prev => [...prev, { 
          kind: 'takeaway', 
          content: data.kpTakeaway,
          ts: new Date().toISOString()
        }])

        // Check cluster completion
        const currentCluster = clusters[currentClusterIndex]
        const clusterDone = currentCluster.kp_ids.every(id => data.coveredKpIds.includes(id))

        if (clusterDone) {
          if (currentClusterIndex + 1 < clusters.length) {
            // Move to next cluster
            const nextIndex = currentClusterIndex + 1
            const nextCluster = clusters[nextIndex]
            
            const nextSessionRes = await fetch('/api/teaching-sessions', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ moduleId, clusterId: nextCluster.id, depth: 'full' })
            })
            
            if (!nextSessionRes.ok) {
              setError('切换知识点簇失败，请刷新页面重试')
              return
            }
            
            const nextSessionData = await nextSessionRes.json()
            setSessionId(nextSessionData.sessionId)
            setCurrentClusterIndex(nextIndex)
            
            setMessages(prev => [...prev, {
              kind: 'teacher',
              content: `太棒了！我们已经完成了当前部分的学习。接下来开始学习新的内容：【${nextCluster.name}】。这部分包含 ${nextCluster.kp_ids.length} 个知识点，让我们继续吧！`,
              ts: new Date().toISOString()
            }])
          } else {
            // Module complete
            setCompleting(true)
            const patchRes = await fetch(`/api/modules/${moduleId}/status`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ learning_status: 'taught' })
            })
            
            if (!patchRes.ok) {
              setError('更新学习状态失败，但你已经完成了所有内容')
              setCompleting(false)
              return
            }
            router.push(`/modules/${moduleId}/teaching-complete`)
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '发送消息失败')
      setMessages(prev => prev.slice(0, -1))
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

  const totalKpCount = clusters.reduce((sum, c) => sum + c.kp_ids.length, 0)
  const progressPct = totalKpCount === 0 ? 0 : (coveredKpIds.length / totalKpCount) * 100

  if (initializing) {
    return (
      <div className="min-h-screen bg-surface-container-low flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-on-surface-variant font-bold animate-pulse">正在初始化教学中心...</p>
        </div>
      </div>
    )
  }

  if (initError) {
    return (
      <div className="min-h-screen bg-surface-container-low flex items-center justify-center p-6">
        <ContentCard className="max-w-md w-full p-8 text-center">
          <span className="material-symbols-outlined text-error text-5xl mb-4">error</span>
          <h2 className="text-xl font-bold text-on-surface mb-2">初始化失败</h2>
          <p className="text-on-surface-variant mb-6">{initError}</p>
          <AmberButton onClick={() => window.location.reload()} fullWidth>重新加载</AmberButton>
        </ContentCard>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface-container-low flex">
      <AppSidebar 
        userName={userName} 
        navItems={navItems}
        bookTitle={moduleTitle}
      />

      <main className="flex-1 ml-72 flex flex-col h-screen overflow-hidden relative">
        <DecorativeBlur position="top-right" />
        
        {/* Header with Progress */}
        <div className="px-10 py-6 border-b border-amber-100 bg-surface-container-low/80 backdrop-blur-md z-20">
          <div className="max-w-4xl mx-auto">
            <Breadcrumb items={breadcrumbItems} />
            
            <div className="mt-4 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h1 className="text-xl font-headline font-bold text-on-surface">
                  {isReadOnly ? '教学记录回顾' : 'AI 老师互动教学'}
                </h1>
                <span className="text-xs font-black text-on-surface-variant/50 uppercase tracking-widest">
                  {coveredKpIds.length} / {totalKpCount} 知识点已达成
                </span>
              </div>
              <ProgressBar value={progressPct} color="primary" className="h-2.5 shadow-sm" />
            </div>
          </div>
        </div>

        {/* Messages List */}
        <div 
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-10 space-y-6 custom-scrollbar relative z-10"
        >
          <div className="max-w-4xl mx-auto space-y-6">
            {isReadOnly && (
              <ContentCard className="p-8 text-center bg-amber-50/50 border-amber-200">
                <h2 className="text-2xl font-headline font-bold text-on-surface">教学已完成</h2>
                <p className="text-on-surface-variant mt-3 leading-relaxed">
                  你已经完成了本模块的所有教学互动。AI 老师已经把重点整理在笔记中，你可以前往模块中心查看。
                </p>
                <div className="mt-6 flex justify-center">
                  <AmberButton onClick={() => router.push(`/books/${bookId}/modules/${moduleId}`)}>
                    回到模块中心
                  </AmberButton>
                </div>
              </ContentCard>
            )}

            {messages.map((m, i) => (
              <div 
                key={i}
                className={cn(
                  "flex flex-col max-w-[85%]",
                  m.kind === 'student' ? "ml-auto items-end" : "mr-auto items-start"
                )}
              >
                {m.kind === 'takeaway' ? (
                  <ContentCard className="bg-emerald-50/80 border-emerald-200 p-6 shadow-sm w-full">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="material-symbols-outlined text-emerald-600">stars</span>
                      <span className="text-xs font-black text-emerald-800 uppercase tracking-widest">关键进展：知识点掌握</span>
                    </div>
                    <p className="text-emerald-900 leading-relaxed font-medium">{m.content}</p>
                  </ContentCard>
                ) : (
                  <ChatBubble role={m.kind === 'student' ? 'user' : 'ai'}>
                    <p className="text-[15px] leading-relaxed whitespace-pre-wrap">{m.content}</p>
                  </ChatBubble>
                )}
                <span className="text-[10px] text-on-surface-variant/30 mt-1 font-bold">
                  {new Date(m.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}
            
            {sending && (
              <div className="flex items-start mr-auto">
                <div className="bg-white/50 border border-amber-100 px-5 py-4 rounded-2xl rounded-tl-none flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce [animation-delay:-0.3s]" />
                  <div className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce [animation-delay:-0.15s]" />
                  <div className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce" />
                </div>
              </div>
            )}

            {struggFrozen && (
              <div className="bg-amber-100 border border-amber-200 rounded-2xl p-6 shadow-sm">
                <div className="flex items-start gap-4">
                  <span className="material-symbols-outlined text-amber-600 mt-0.5">warning</span>
                  <div>
                    <h3 className="font-bold text-amber-900">陷入瓶颈？没关系！</h3>
                    <p className="text-sm text-amber-900/80 mt-1 leading-relaxed">
                      AI 老师发现这个概念确实有点挑战。建议先停下来，回到原文对应位置再读一遍，或者查看学习笔记，这能帮你建立更稳固的基础。
                    </p>
                    <a 
                      href={`/books/${bookId}/reader`} 
                      className="inline-flex items-center gap-1 mt-4 text-sm font-bold text-primary hover:underline"
                    >
                      前往阅读原文 <span className="material-symbols-outlined text-xs">open_in_new</span>
                    </a>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Input Area */}
        {!isReadOnly && (
          <div className="px-10 py-8 border-t border-amber-100 bg-surface-container-lowest z-20 shadow-up">
            <div className="max-w-4xl mx-auto">
              <div className="flex gap-4 items-end">
                <div className="flex-1 bg-surface-container rounded-2xl border border-amber-200 focus-within:ring-2 focus-within:ring-primary/20 transition-all p-2">
                  <textarea
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        handleSend()
                      }
                    }}
                    placeholder={struggFrozen ? '当前状态暂不可发送消息' : '在此输入你的回答，与老师互动...'}
                    className="w-full bg-transparent border-none focus:ring-0 text-on-surface placeholder:text-on-surface-variant/30 resize-none max-h-32 min-h-[44px] py-2 px-3 text-[15px]"
                    disabled={sending || struggFrozen || completing}
                    rows={1}
                  />
                </div>
                <AmberButton 
                  onClick={() => handleSend()} 
                  disabled={sending || struggFrozen || completing || !inputValue.trim()}
                  className="h-[52px] w-[52px] !p-0 shrink-0"
                  rounded="full"
                >
                  <span className="material-symbols-outlined">send</span>
                </AmberButton>
              </div>

              {error && (
                <div className="mt-3 bg-error-container/10 border border-error/20 rounded-xl p-3 text-error text-xs flex items-center justify-between">
                  <span>{error}</span>
                  <button onClick={() => handleSend(lastInput)} className="underline font-bold px-2 py-1 hover:bg-error/5 rounded transition-colors">
                    重新发送
                  </button>
                </div>
              )}

              <div className="mt-4 flex justify-center">
                <a href={`/books/${bookId}/reader`} className="text-[11px] font-black text-on-surface-variant/40 hover:text-primary transition-colors uppercase tracking-widest flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">menu_book</span>
                  查阅原文
                </a>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Cluster Sidebar (Right) */}
      {!isReadOnly && (
        <aside className="w-80 bg-white border-l border-amber-100 p-8 hidden xl:flex flex-col">
          <h3 className="text-[10px] font-black text-on-surface-variant/50 uppercase tracking-widest mb-6">当前教学目标簇</h3>
          <div className="flex-1 overflow-y-auto custom-scrollbar space-y-4 pr-2">
            {clusters.map((c, idx) => {
              const isCurrent = idx === currentClusterIndex
              const isPast = idx < currentClusterIndex
              const clusterKpsCovered = c.kp_ids.filter(id => coveredKpIds.includes(id)).length
              
              return (
                <div 
                  key={c.id}
                  className={cn(
                    "p-5 rounded-2xl border transition-all",
                    isCurrent ? "bg-amber-50 border-amber-300 ring-2 ring-primary/5 shadow-sm" :
                    isPast ? "bg-emerald-50/30 border-emerald-100 opacity-60" :
                    "bg-surface-container-lowest border-amber-50"
                  )}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className={cn(
                      "text-xs font-bold truncate",
                      isCurrent ? "text-amber-900" : isPast ? "text-emerald-800" : "text-on-surface-variant"
                    )}>
                      {c.name}
                    </span>
                    <span className="text-[10px] font-black opacity-30">
                      {clusterKpsCovered} / {c.kp_ids.length}
                    </span>
                  </div>
                  <div className="h-1 w-full bg-surface-container rounded-full overflow-hidden">
                    <div 
                      className={cn(
                        "h-full rounded-full transition-all duration-1000",
                        isPast ? "bg-emerald-500" : "bg-primary"
                      )}
                      style={{ width: `${(clusterKpsCovered / c.kp_ids.length) * 100}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </aside>
      )}
    </div>
  )
}
