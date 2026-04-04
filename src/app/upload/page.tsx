'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'

type UploadStatus = 'idle' | 'uploading' | 'redirecting'

export default function UploadPage() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [title, setTitle] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState('')
  const [status, setStatus] = useState<UploadStatus>('idle')

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
    if (!file) { setError('请选择文件'); return }
    if (!title.trim()) { setError('请填写教材名称'); return }

    setStatus('uploading')
    setError('')

    const formData = new FormData()
    formData.append('file', file)
    formData.append('title', title.trim())

    const res = await fetch('/api/books', { method: 'POST', body: formData })
    const data = await res.json()

    if (!res.ok) {
      setError(data.error ?? '上传失败，请重试')
      setStatus('idle')
      return
    }

    setStatus('redirecting')
    router.push(`/books/${data.bookId}/reader`)
  }

  // 上传中 / 跳转中：替换整个表单，显示等待面板
  if (status !== 'idle') {
    return (
      <main className="min-h-full bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 w-full max-w-md p-8">
          <div className="text-center py-4">
            <div className="flex justify-center mb-5">
              <div className="w-10 h-10 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>

            {status === 'uploading' ? (
              <>
                <p className="text-sm font-medium text-gray-800 mb-1">正在上传文件...</p>
                <p className="text-xs text-gray-500 mb-3">{file?.name}</p>
                {isPdf && (
                  <p className="text-xs text-blue-700 bg-blue-50 rounded-lg px-3 py-2">
                    PDF 上传完成后将自动进行文字识别（OCR）<br />
                    大文件需要几分钟，请不要关闭页面
                  </p>
                )}
              </>
            ) : (
              <p className="text-sm font-medium text-gray-800">上传成功，正在打开阅读器...</p>
            )}
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-full bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 w-full max-w-md p-8">
        <h1 className="text-2xl font-semibold text-gray-900 mb-2">上传教材</h1>
        <p className="text-sm text-gray-500 mb-8">支持 PDF 和 TXT 格式</p>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* 文件选择区 */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors"
          >
            {file ? (
              <div>
                <p className="text-sm font-medium text-gray-800">{file.name}</p>
                <p className="text-xs text-gray-400 mt-1">
                  {(file.size / 1024).toFixed(0)} KB · 点击更换
                </p>
              </div>
            ) : (
              <div>
                <p className="text-sm text-gray-500">点击选择文件</p>
                <p className="text-xs text-gray-400 mt-1">PDF / TXT</p>
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

          {/* 教材名称 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              教材名称
            </label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="例如：高中生物必修一"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* PDF 预告提示：选了 PDF 就提前告知 OCR */}
          {isPdf && (
            <p className="text-xs text-blue-600 bg-blue-50 rounded-lg px-3 py-2">
              PDF 上传后将自动识别文字（OCR），大文件需要几分钟
            </p>
          )}

          {/* 错误提示 */}
          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}

          {/* 提交按钮 */}
          <button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-lg text-sm transition-colors"
          >
            开始学习
          </button>
        </form>
      </div>
    </main>
  )
}
