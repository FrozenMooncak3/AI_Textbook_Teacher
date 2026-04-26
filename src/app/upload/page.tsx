'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import AppSidebar from '@/components/ui/AppSidebar'
import ContentCard from '@/components/ui/ContentCard'
import TextInput from '@/components/ui/TextInput'
import AmberButton from '@/components/ui/AmberButton'
import LoadingState from '@/components/LoadingState'
import DecorativeBlur from '@/components/ui/DecorativeBlur'
import Breadcrumb from '@/components/ui/Breadcrumb'
import ScanPdfRejectionModal, { type RejectReason } from '@/components/upload/ScanPdfRejectionModal'
import QuotaIndicator from '@/components/upload/QuotaIndicator'

type UploadStatus =
  | { kind: 'idle' }
  | { kind: 'signing' }
  | { kind: 'uploading'; pct: number; loadedBytes: number; totalBytes: number }
  | { kind: 'confirming' }
  | { kind: 'redirecting' }
  | { kind: 'error'; message: string; retryTo: 'idle' | 'books' }
  | { kind: 'rejected'; rejectReason: RejectReason; bookFilename: string; bookSizeBytes: number }

function getFileKind(filename: string): 'pdf' | 'pptx' | 'txt' | 'other' {
  const lower = filename.toLowerCase()
  if (lower.endsWith('.pdf')) return 'pdf'
  if (lower.endsWith('.pptx')) return 'pptx'
  if (lower.endsWith('.txt')) return 'txt'
  return 'other'
}

function getContentType(fileKind: 'pdf' | 'pptx'): string {
  return fileKind === 'pdf'
    ? 'application/pdf'
    : 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
}

export default function UploadPage() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [title, setTitle] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState('')
  const [status, setStatus] = useState<UploadStatus>({ kind: 'idle' })
  const [userName, setUserName] = useState('加载中...')
  const [quota, setQuota] = useState<{ remaining: number; total: number } | null>(null)

  useEffect(() => {
    fetch('/api/auth/me')
      .then(res => res.json())
      .then(data => {
        const user = data.data
        if (!user) return
        if (user.display_name) setUserName(user.display_name)
        if (typeof user.book_quota_remaining === 'number' && typeof user.book_quota_total === 'number') {
          setQuota({ remaining: user.book_quota_remaining, total: user.book_quota_total })
        }
      })
      .catch(() => {})
  }, [])

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0]
    if (!selected) return
    setFile(selected)
    setError('')
    if (!title) {
      const name = selected.name.replace(/\.[^.]+$/, '')
      setTitle(name)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!file) { setError('请先选择一个文件'); return }
    if (!title.trim()) { setError('请输入教材名称'); return }
    setError('')

    const fileKind = getFileKind(file.name)

    if (fileKind === 'other') {
      setError('抱歉，目前仅支持 PDF / TXT / PPTX 格式的教材')
      return
    }

    if (fileKind === 'txt') {
      // TXT branch: keep legacy POST /api/books flow
      setStatus({ kind: 'signing' })
      const formData = new FormData()
      formData.append('file', file)
      formData.append('title', title.trim())
      try {
        const res = await fetch('/api/books', { method: 'POST', body: formData })
        const data = await res.json()
        if (!res.ok) {
          setStatus({
            kind: 'error',
            message: data.error ?? '文件上传失败',
            retryTo: 'idle',
          })
          return
        }
        setStatus({ kind: 'redirecting' })
        router.push(`/books/${data.bookId}/reader`)
      } catch {
        setStatus({ kind: 'error', message: '网络异常，请检查连接', retryTo: 'idle' })
      }
      return
    }

    // PDF or PPTX branch: presign -> XHR PUT -> confirm
    // spec D0 lock: max 10 MB for MVP
    if (file.size > 10 * 1024 * 1024) {
      setStatus({
        kind: 'rejected',
        rejectReason: 'too_large',
        bookFilename: file.name,
        bookSizeBytes: file.size,
      })
      return
    }

    const contentType = getContentType(fileKind)

    try {
      // Step 1: signing
      setStatus({ kind: 'signing' })
      const presignRes = await fetch('/api/uploads/presign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: file.name,
          size: file.size,
          contentType,
        }),
      })
      
      const presignJson = await presignRes.json()
      if (!presignRes.ok) {
        if (presignJson.rejectReason) {
          setStatus({
            kind: 'rejected',
            rejectReason: presignJson.rejectReason as RejectReason,
            bookFilename: file.name,
            bookSizeBytes: file.size,
          })
          return
        }
        setStatus({
          kind: 'error',
          message: presignJson.error ?? '获取上传凭证失败',
          retryTo: 'idle',
        })
        return
      }
      const { bookId, uploadUrl } = presignJson.data as {
        bookId: number
        uploadUrl: string
      }

      // Step 2: XHR PUT with progress
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.open('PUT', uploadUrl)
        xhr.setRequestHeader('Content-Type', contentType)
        xhr.upload.onprogress = (ev) => {
          if (!ev.lengthComputable) return
          setStatus({
            kind: 'uploading',
            pct: Math.round((ev.loaded / ev.total) * 100),
            loadedBytes: ev.loaded,
            totalBytes: ev.total,
          })
        }
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve()
          else if (xhr.status === 403) reject(new Error('上传权限校验失败，请重试'))
          else reject(new Error(`上传失败 (HTTP ${xhr.status})`))
        }
        xhr.onerror = () => reject(new Error('上传过程中断，请检查网络后重试'))
        xhr.ontimeout = () => reject(new Error('上传请求超时，请检查网络后重试'))
        xhr.send(file)
      })

      // Step 3: confirming
      setStatus({ kind: 'confirming' })
      const confirmRes = await fetch('/api/books/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookId, title: title.trim() }),
      })
      
      const confirmJson = await confirmRes.json()
      if (!confirmRes.ok && confirmJson.rejectReason) {
        setStatus({
          kind: 'rejected',
          rejectReason: confirmJson.rejectReason as RejectReason,
          bookFilename: file.name,
          bookSizeBytes: file.size,
        })
        return
      }

      if (confirmRes.status === 409 && confirmJson.code === 'PROCESSING_FAILED') {
        setStatus({
          kind: 'error',
          message: confirmJson.error ?? '上传成功但处理失败，请稍后在书架查看',
          retryTo: 'books',
        })
        return
      }
      if (!confirmRes.ok) {
        setStatus({
          kind: 'error',
          message: confirmJson.error ?? '确认上传结果失败',
          retryTo: 'idle',
        })
        return
      }

      // Step 4: redirect to preparing page
      setStatus({ kind: 'redirecting' })
      router.push(`/books/${bookId}/preparing`)
    } catch (err) {
      setStatus({
        kind: 'error',
        message: err instanceof Error ? err.message : '上传失败',
        retryTo: 'idle',
      })
    }
  }

  function handleRetry() {
    if (status.kind === 'error' && status.retryTo === 'books') {
      router.push('/')
      return
    }
    setStatus({ kind: 'idle' })
    setError('')
  }

  const navItems = [
    { icon: 'home', label: '我的书架', href: '/' },
    { icon: 'cloud_upload', label: '上传教材', href: '/upload' },
    { icon: 'analytics', label: '学习记录', href: '/logs' },
  ]

  return (
    <div className="min-h-screen bg-surface-container-low">
      <AppSidebar
        userName={userName}
        navItems={navItems}
      />

      <main className="ml-72 p-10 relative min-h-screen flex items-center justify-center">
        <DecorativeBlur position="top-right" />
        <DecorativeBlur position="bottom-left" color="secondary" />

        <div className="max-w-xl w-full relative z-10">
          <header className="mb-10 text-center">
            <h1 className="text-3xl font-black text-on-surface font-headline tracking-tight mb-2">上传新教材</h1>
            <p className="text-on-surface-variant font-medium">支持 PDF / TXT / PPTX 格式（上限 10 MB），AI 老师将为您定制学习路径</p>
          </header>

          {quota && <QuotaIndicator remaining={quota.remaining} total={quota.total} />}

          <ContentCard className="p-8 md:p-12">
            {status.kind !== 'idle' && status.kind !== 'rejected' ? (
              <div className="py-10 text-center space-y-6">
                {status.kind === 'signing' && (
                  <LoadingState label="准备上传中..." />
                )}
                {status.kind === 'uploading' && (
                  <div className="space-y-4">
                    <LoadingState label={`正在上传 ${status.pct}%`} />
                    <div className="w-full bg-surface-container-low rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-primary h-2 transition-all duration-200"
                        style={{ width: `${status.pct}%` }}
                      />
                    </div>
                    <p className="text-xs text-on-surface-variant">
                      {(status.loadedBytes / 1024 / 1024).toFixed(1)} / {(status.totalBytes / 1024 / 1024).toFixed(1)} MB
                    </p>
                  </div>
                )}
                {status.kind === 'confirming' && (
                  <LoadingState label="上传完成，正在启动 AI 解析..." />
                )}
                {status.kind === 'redirecting' && (
                  <LoadingState label="即将进入准备页面..." />
                )}
                {status.kind === 'error' && (
                  <div className="space-y-4">
                    <div className="bg-error/10 text-error p-4 rounded-xl text-sm font-bold flex items-center justify-center gap-3">
                      <span className="material-symbols-outlined text-lg">error</span>
                      {status.message}
                    </div>
                    <AmberButton onClick={handleRetry} fullWidth>
                      {status.retryTo === 'books' ? '回到书架' : '重新尝试'}
                    </AmberButton>
                  </div>
                )}
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-8">
                {/* File Drop Zone */}
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-outline-variant/30 rounded-3xl p-10 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all group"
                >
                  {file ? (
                    <div className="space-y-2">
                      <div className="w-16 h-16 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                        <span className="material-symbols-outlined text-3xl">description</span>
                      </div>
                      <p className="text-sm font-bold text-on-surface">{file.name}</p>
                      <p className="text-[10px] font-black text-on-surface-variant/40 uppercase tracking-widest">
                        {(file.size / (1024 * 1024)).toFixed(2)} MB
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="w-16 h-16 bg-surface-container-low text-on-surface-variant/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <span className="material-symbols-outlined text-3xl">upload_file</span>
                      </div>
                      <p className="text-sm font-bold text-on-surface-variant">点击或将教材拖拽至此上传</p>
                      <p className="text-[10px] font-black text-on-surface-variant/20 uppercase tracking-widest">PDF / TXT / PPTX</p>
                    </div>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.txt,.pptx"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                </div>

                <TextInput
                  label="教材名称"
                  value={title}
                  onChange={setTitle}
                  placeholder="给您的教材起个名字"
                />

                {error && (
                  <div className="bg-error/10 text-error p-4 rounded-xl text-sm font-bold flex items-center gap-3 animate-in shake-in duration-300">
                    <span className="material-symbols-outlined text-lg">error</span>
                    {error}
                  </div>
                )}

                <AmberButton
                  type="submit"
                  fullWidth
                  size="lg"
                  disabled={!file || !title.trim()}
                >
                  开始解析教材
                </AmberButton>
              </form>
            )}
          </ContentCard>
        </div>
      </main>

      <ScanPdfRejectionModal
        open={status.kind === 'rejected'}
        onClose={() => setStatus({ kind: 'idle' })}
        rejectReason={status.kind === 'rejected' ? status.rejectReason : 'unsupported_type'}
        bookFilename={status.kind === 'rejected' ? status.bookFilename : undefined}
        bookSizeBytes={status.kind === 'rejected' ? status.bookSizeBytes : undefined}
      />
    </div>
  )
}
