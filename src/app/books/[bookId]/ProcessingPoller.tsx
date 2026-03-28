'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function ProcessingPoller({ bookId }: { bookId: number }) {
  const router = useRouter()

  useEffect(() => {
    const interval = setInterval(async () => {
      const res = await fetch(`/api/books/${bookId}/status`)
      if (!res.ok) return
      const data = await res.json()
      if (data.parse_status === 'done') {
        clearInterval(interval)
        router.refresh()
      } else if (data.parse_status === 'error') {
        clearInterval(interval)
        router.refresh()
      }
    }, 4000) // 每 4 秒轮询一次

    return () => clearInterval(interval)
  }, [bookId, router])

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
      <div className="flex justify-center mb-4">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
      <p className="text-sm font-medium text-gray-800 mb-1">正在识别 PDF 文字内容</p>
      <p className="text-xs text-gray-400">OCR 处理中，大文件需要几分钟，请耐心等待...</p>
      <p className="text-xs text-gray-300 mt-3">页面会自动刷新，无需手动操作</p>
    </div>
  )
}
