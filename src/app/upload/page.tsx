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

type UploadStatus = 'idle' | 'uploading' | 'redirecting'

export default function UploadPage() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [title, setTitle] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState('')
  const [status, setStatus] = useState<UploadStatus>('idle')
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

    setStatus('uploading')
    setError('')

    const formData = new FormData()
    formData.append('file', file)
    formData.append('title', title.trim())

    try {
      const res = await fetch('/api/books', { method: 'POST', body: formData })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? '上传失败，请重试')
        setStatus('idle')
        return
      }

      setStatus('redirecting')
      router.push(`/books/${data.bookId}/reader`)
    } catch {
      setError('网络请求失败')
      setStatus('idle')
    }
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
            {status !== 'idle' ? (
              <div className="py-10 text-center space-y-6">
                <LoadingState 
                  label={status === 'uploading' ? '正在上传并识别内容...' : '准备就绪，正在跳转...'} 
                />
                {status === 'uploading' && isPdf && (
                  <p className="text-xs text-primary font-medium bg-primary/5 rounded-xl p-4 leading-relaxed">
                    温馨提示：PDF 文件需要进行 OCR 文字识别，<br />
                    大文件可能需要 1-2 分钟，请不要关闭页面。
                  </p>
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
