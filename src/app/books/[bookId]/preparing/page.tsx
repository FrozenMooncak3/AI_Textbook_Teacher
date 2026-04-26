'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { use } from 'react'
import AppSidebar from '@/components/ui/AppSidebar'
import ContentCard from '@/components/ui/ContentCard'
import AmberButton from '@/components/ui/AmberButton'
import DecorativeBlur from '@/components/ui/DecorativeBlur'
import CacheHitBadge from '@/components/book/CacheHitBadge'

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
  cacheHit: boolean
  cacheHitCount: number
}

function statusText(s: BookStatus | null): string {
  if (!s) return '正在为你准备这本书...'
  if (s.uploadStatus === 'pending') return '上传中...'
  if (s.parseStatus === 'pending') return '开始处理...'
  if (s.parseStatus === 'processing') return '正在识别页面内容...'
  if (s.parseStatus === 'completed' && s.kpExtractionStatus !== 'completed') {
    return '正在提取知识点...'
  }
  if (s.kpExtractionStatus === 'completed') return '全部准备完成！'
  return '正在为你准备这本书...'
}

export default function PreparingPage({ params }: { params: Promise<{ bookId: string }> }) {
  const { bookId } = use(params)
  const bookIdNum = Number(bookId)
  const router = useRouter()

  const [status, setStatus] = useState<BookStatus | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [userName, setUserName] = useState('用户')
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

  // Polling logic
  useEffect(() => {
    async function poll() {
      try {
        const res = await fetch(`/api/books/${bookIdNum}/status`)
        if (!res.ok) {
          if (res.status === 404) {
            setError('书不存在或无权访问')
            if (pollRef.current) clearInterval(pollRef.current)
          }
          return
        }
        const json = await res.json()
        const s = json.data as BookStatus
        setStatus(s)
        
        if (s.parseStatus === 'failed' || s.kpExtractionStatus === 'failed') {
          setError('处理出错，请删除书重新上传')
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
    ? '开始阅读 →'
    : firstReady
      ? '开始阅读第一模块 →'
      : '准备中...'

  const navItems = [
    { icon: 'home', label: '首页中心', href: '/' },
    { icon: 'cloud_upload', label: '上传教材', href: '/upload' },
    { icon: 'analytics', label: '系统日志', href: '/logs' },
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
              正在准备的书
            </h1>
            <p className="text-on-surface-variant font-medium">
              正在为你准备这本书
            </p>
          </header>

          {error ? (
            <ContentCard className="p-8 text-center space-y-6">
              <div className="w-16 h-16 bg-error/10 text-error rounded-2xl flex items-center justify-center mx-auto">
                <span className="material-symbols-outlined text-3xl">error</span>
              </div>
              <p className="text-sm font-bold text-on-surface">{error}</p>
              <AmberButton onClick={() => router.push('/')} fullWidth>
                前往书架
              </AmberButton>
            </ContentCard>
          ) : (
            <>
              {status && <CacheHitBadge hitCount={status.cacheHitCount} />}
              {/* Progress Bar Section */}
              <div className="space-y-3">
                <div className="w-full bg-surface-container rounded-full h-3 overflow-hidden shadow-inner">
                  <div
                    className="bg-primary h-full transition-all duration-500 ease-out shadow-lg"
                    style={{ width: `${status?.progressPct ?? 0}%` }}
                  />
                </div>
                <p className="text-sm text-on-surface-variant text-center font-bold">
                  {statusText(status)} · {status?.progressPct ?? 0}%
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
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  )
}

function cn(...inputs: Array<string | false | null | undefined>): string {
  return inputs.filter(Boolean).join(' ')
}
