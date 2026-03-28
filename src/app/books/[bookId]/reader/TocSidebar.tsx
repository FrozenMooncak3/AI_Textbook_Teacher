'use client'

import { useEffect, useState, useCallback } from 'react'

interface TocItem {
  title: string
  page: number
}

interface Props {
  bookId: number
  currentPage: number
  onNavigate: (page: number) => void
  onClose: () => void
}

export default function TocSidebar({ bookId, currentPage, onNavigate, onClose }: Props) {
  const [items, setItems] = useState<TocItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    async function fetchToc() {
      try {
        const res = await fetch(`/api/books/${bookId}/toc`)
        if (!res.ok) throw new Error('目录暂不可用')
        const data = await res.json()
        if (!cancelled) setItems(data.items ?? [])
      } catch {
        if (!cancelled) setError('目录暂不可用，OCR 完成后自动生成')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchToc()
    return () => { cancelled = true }
  }, [bookId])

  // 找到当前所在章节
  const activeIdx = useCallback(() => {
    for (let i = items.length - 1; i >= 0; i--) {
      if (items[i].page <= currentPage) return i
    }
    return -1
  }, [items, currentPage])

  const active = activeIdx()

  return (
    <div className="w-64 bg-white border-r border-gray-200 flex flex-col shrink-0 h-full">
      {/* 头部 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <span className="text-sm font-medium text-gray-700">目录</span>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 text-lg leading-none"
        >
          ×
        </button>
      </div>

      {/* 内容 */}
      <div className="flex-1 overflow-auto py-2">
        {loading && (
          <div className="flex items-center justify-center py-8">
            <div className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {error && (
          <p className="text-xs text-gray-400 px-4 py-6 text-center">{error}</p>
        )}

        {!loading && !error && items.length === 0 && (
          <p className="text-xs text-gray-400 px-4 py-6 text-center">暂无目录信息</p>
        )}

        {items.map((item, i) => (
          <button
            key={i}
            onClick={() => onNavigate(item.page)}
            className={`w-full text-left px-4 py-2 text-sm transition-colors ${
              i === active
                ? 'bg-blue-50 text-blue-700 font-medium'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <span className="block truncate">{item.title}</span>
            <span className="text-xs text-gray-400">第 {item.page} 页</span>
          </button>
        ))}
      </div>
    </div>
  )
}
