'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { use } from 'react'
import AppSidebar from '@/components/ui/AppSidebar'
import ContentCard from '@/components/ui/ContentCard'
import AmberButton from '@/components/ui/AmberButton'
import DecorativeBlur from '@/components/ui/DecorativeBlur'

interface ModuleStatus {
  id: number
  orderIndex: number
  title: string
  kpExtractionStatus: 'pending' | 'processing' | 'completed' | 'failed'
  ready: boolean
}

interface BookStatus {
  bookId: number
  uploadStatus: 'pending' | 'confirmed'
  parseStatus: 'pending' | 'processing' | 'completed' | 'failed'
  kpExtractionStatus: 'pending' | 'processing' | 'completed' | 'failed'
  modules: ModuleStatus[]
  progressPct: number
  firstModuleReady: boolean
}

interface BookMeta {
  title: string
}

function getStatusText(s: BookStatus | null): string {
  if (!s) return '正在初始化...'
  if (s.uploadStatus === 'pending') return '等待上传确认...'
  if (s.parseStatus === 'pending') return '等待解析图书内容...'
  if (s.parseStatus === 'processing') return '正在深度解析图书，请稍候...'
  if (s.parseStatus === 'completed' && s.kpExtractionStatus !== 'completed') {
    return '图书解析完成，正在智能提取知识点...'
  }
  if (s.kpExtractionStatus === 'completed') return '图书已准备就绪，开启学习之旅吧！'
  return '正在处理中...'
}

export default function PreparingPage({ params }: { params: Promise<{ bookId: string }> }) {
  const { bookId } = use(params)
  const bookIdNum = Number(bookId)
  const router = useRouter()

  const [bookMeta, setBookMeta] = useState<BookMeta | null>(null)
  const [status, setStatus] = useState<BookStatus | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [userName, setUserName] = useState('加载中...')
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Fetch user display name
  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.json())
      .then(d => {
        if (d.data?.display_name || d.data?.email) {
          setUserName(d.data.display_name || d.data.email)
        }
      })
      .catch(() => {})
  }, [])

  // Fetch book title once
  useEffect(() => {
    fetch(`/api/books/${bookIdNum}`)
      .then(r => r.json())
      .then(d => {
        if (d.data?.title) setBookMeta({ title: d.data.title })
      })
      .catch(() => {})
  }, [bookIdNum])

  // Polling logic
  useEffect(() => {
    async function poll() {
      try {
        const res = await fetch(`/api/books/${bookIdNum}/status`)
        if (!res.ok) {
          if (res.status === 404) {
            setError('找不到该图书信息，请返回图书库重试。')
            if (pollRef.current) clearInterval(pollRef.current)
          }
          return
        }
        const json = await res.json()
        const s = json.data as BookStatus
        setStatus(s)
        
        if (s.parseStatus === 'failed' || s.kpExtractionStatus === 'failed') {
          setError('图书处理遇到了一点问题，请尝试重新上传。')
          if (pollRef.current) clearInterval(pollRef.current)
        }
      } catch {
        // Keep polling on transient network errors
      }
    }

    poll()
    pollRef.current = setInterval(poll, 2000)

    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [bookIdNum])

  const firstReady = status?.firstModuleReady ?? false
  const allReady = status?.kpExtractionStatus === 'completed'

  const buttonLabel = allReady
    ? '开始学习'
    : firstReady
      ? '第一章已就绪，抢先阅读'
      : '图书准备中...'

  const navItems = [
    { icon: 'home', label: '我的书架', href: '/' },
    { icon: 'cloud_upload', label: '上传图书', href: '/upload' },
    { icon: 'analytics', label: '学习记录', href: '/logs' },
  ]

  return (
    <div className="min-h-screen bg-surface-container-low">
      <AppSidebar userName={userName} navItems={navItems} />
      
      <main className="ml-72 p-10 relative min-h-screen flex items-center justify-center overflow-hidden">
        <DecorativeBlur position="top-right" />
        <DecorativeBlur position="bottom-left" color="secondary" />

        <div className="max-w-2xl w-full relative z-10 space-y-8">
          <header className="text-center space-y-2">
            <h1 className="text-3xl font-black text-on-surface font-headline tracking-tight">
              {bookMeta?.title ?? '正在加载图书...'}
            </h1>
            <p className="text-on-surface-variant font-medium">
              正在为您准备专属 AI 学习助手
            </p>
          </header>

          {error ? (
            <ContentCard className="p-8 text-center space-y-6">
              <div className="w-16 h-16 bg-error/10 text-error rounded-2xl flex items-center justify-center mx-auto">
                <span className="material-symbols-outlined text-3xl">error</span>
              </div>
              <p className="text-sm font-bold text-on-surface">{error}</p>
              <AmberButton onClick={() => router.push('/')} fullWidth>
                回到书架
              </AmberButton>
            </ContentCard>
          ) : (
            <>
              {/* Progress Bar Section */}
              <div className="space-y-3">
                <div className="w-full bg-surface-container rounded-full h-3 overflow-hidden shadow-inner">
                  <div
                    className="bg-primary h-full transition-all duration-500 ease-out shadow-lg"
                    style={{ width: `${status?.progressPct ?? 0}%` }}
                  />
                </div>
                <p className="text-sm text-on-surface-variant text-center font-bold">
                  {getStatusText(status)} ({status?.progressPct ?? 0}%)
                </p>
              </div>

              {/* Module List / Skeleton */}
              <div className="grid grid-cols-1 gap-3">
                {(status?.modules.length ? status.modules : Array.from({ length: 5 }).map((_, i) => null)).map((m, idx) => {
                  const isReal = m !== null
                  const ready = isReal && m.ready
                  
                  return (
                    <div
                      key={isReal ? m.id : `skel-${idx}`}
                      className={cn(
                        "h-16 rounded-2xl p-4 flex items-center gap-4 transition-all duration-500",
                        ready 
                          ? "bg-surface shadow-md border border-outline-variant/20" 
                          : "bg-surface-container/50 animate-pulse"
                      )}
                    >
                      {ready ? (
                        <>
                          <div className="w-10 h-10 bg-primary/10 text-primary rounded-xl flex items-center justify-center font-bold">
                            {m.orderIndex + 1}
                          </div>
                          <span className="text-sm font-bold text-on-surface flex-1 truncate">
                            {m.title}
                          </span>
                          <span className="material-symbols-outlined text-primary font-bold">
                            check_circle
                          </span>
                        </>
                      ) : (
                        <div className="w-full flex items-center gap-4 opacity-20">
                           <div className="w-10 h-10 bg-on-surface-variant/20 rounded-xl" />
                           <div className="h-4 bg-on-surface-variant/20 rounded w-1/3" />
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Action Button */}
              <div className="pt-4">
                <AmberButton
                  fullWidth
                  size="lg"
                  disabled={!firstReady}
                  onClick={() => router.replace(`/books/${bookIdNum}/reader`)}
                >
                  {buttonLabel}
                </AmberButton>
                {!firstReady && !error && (
                  <p className="text-xs text-on-surface-variant text-center mt-4 animate-bounce">
                    ☕ 稍等片刻，知识正在通过 AI 注入中...
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  )
}

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ')
}
