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

type UploadStatus =
  | { kind: 'idle' }
  | { kind: 'signing' }
  | { kind: 'uploading'; pct: number; loadedBytes: number; totalBytes: number }
  | { kind: 'confirming' }
  | { kind: 'redirecting' }
  | { kind: 'error'; message: string; retryTo: 'idle' | 'books' }

export default function UploadPage() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [title, setTitle] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState('')
  const [status, setStatus] = useState<UploadStatus>({ kind: 'idle' })
  const [userName, setUserName] = useState('用户')

  useEffect(() => {
    // Optional: fetch user info to populate sidebar
    fetch('/api/auth/me')
      .then(res => res.json())
      .then(data => {
        if (data.success) setUserName(data.data.display_name || data.data.email)
      })
      .catch(() => {})
  }, [])

  const isPdf = file?.name.toLowerCase().endsWith('.pdf') ?? false

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
    if (!title.trim()) { setError('请输入教材标题'); return }
    setError('')

    const isPdfFile = file.name.toLowerCase().endsWith('.pdf')

    if (!isPdfFile) {
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
            message: data.error ?? '上传失败，请重试',
            retryTo: 'idle',
          })
          return
        }
        setStatus({ kind: 'redirecting' })
        router.push(`/books/${data.bookId}/reader`)
      } catch {
        setStatus({ kind: 'error', message: '网络请求失败', retryTo: 'idle' })
      }
      return
    }

    // PDF branch: presign -> XHR PUT -> confirm
    if (file.size > 50 * 1024 * 1024) {
      setError('文件过大，请上传小于 50MB 的文件')
      return
    }

    try {
      // Step 1: signing
      setStatus({ kind: 'signing' })
      const presignRes = await fetch('/api/uploads/presign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: file.name,
          size: file.size,
          contentType: 'application/pdf',
        }),
      })
      const presignJson = await presignRes.json()
      if (!presignRes.ok) {
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
        xhr.setRequestHeader('Content-Type', 'application/pdf')
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
          else if (xhr.status === 403) reject(new Error('上传权限校验失败，请刷新重试'))
          else reject(new Error(`上传失败 (HTTP ${xhr.status})`))
        }
        xhr.onerror = () => reject(new Error('上传网络错误，请检查网络连接'))
        xhr.ontimeout = () => reject(new Error('上传网络超时，请检查网络连接'))
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
      if (confirmRes.status === 409 && confirmJson.code === 'PROCESSING_FAILED') {
        setStatus({
          kind: 'error',
          message: confirmJson.error ?? '上传成功但处理失败，请稍后前往首页查看',
          retryTo: 'books',
        })
        return
      }
      if (!confirmRes.ok) {
        setStatus({
          kind: 'error',
          message: confirmJson.error ?? '确认上传失败',
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
      router.push('/books')
      return
    }
    setStatus({ kind: 'idle' })
    setError('')
  }

  const navItems = [
    { icon: 'home', label: '首页中心', href: '/' },
    { icon: 'cloud_upload', label: '上传教材', href: '/upload' },
    { icon: 'analytics', label: '系统日志', href: '/logs' },
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
            <p className="text-on-surface-variant font-medium">支持 PDF 或 TXT 格式，AI 将自动分析知识点</p>
          </header>

          <ContentCard className="p-8 md:p-12">
            {status.kind !== 'idle' ? (
              <div className="py-10 text-center space-y-6">
                {status.kind === 'signing' && (
                  <LoadingState label="正在准备上传凭证..." />
                )}
                {status.kind === 'uploading' && (
                  <div className="space-y-4">
                    <LoadingState label={`正在上传教材 ${status.pct}%`} />
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
                  <LoadingState label="文件已上传，正在初步解析..." />
                )}
                {status.kind === 'redirecting' && (
                  <LoadingState label="准备就绪，正在跳转中心..." />
                )}
                {status.kind === 'error' && (
                  <div className="space-y-4">
                    <div className="bg-error/10 text-error p-4 rounded-xl text-sm font-bold flex items-center justify-center gap-3">
                      <span className="material-symbols-outlined text-lg">error</span>
                      {status.message}
                    </div>
                    <AmberButton onClick={handleRetry} fullWidth>
                      {status.retryTo === 'books' ? '回到书籍中心' : '返回重试'}
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
                      <p className="text-sm font-bold text-on-surface-variant">点击或拖拽文件到这里</p>
                      <p className="text-[10px] font-black text-on-surface-variant/20 uppercase tracking-widest">PDF / TXT</p>
                    </div>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.txt"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                </div>

                <TextInput 
                  label="教材标题" 
                  value={title} 
                  onChange={setTitle} 
                  placeholder="给这本教材起个名字，如：宏观经济学" 
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
                  开始智能学习 →
                </AmberButton>
              </form>
            )}
          </ContentCard>
        </div>
      </main>
    </div>
  )
}
