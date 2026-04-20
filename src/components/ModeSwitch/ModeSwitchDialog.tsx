'use client'

import { useState } from 'react'
import Modal from '@/components/ui/Modal'
import AmberButton from '@/components/ui/AmberButton'
import { getRecommendation } from '@/lib/book-meta-analyzer'

interface ModeSwitchDialogProps {
  open: boolean
  onClose: () => void
  bookId: number
  currentMode: 'teaching' | 'full'
  bookMeta: {
    kpCount: number
    subject?: string
    scanQuality?: 'good' | 'fair' | 'poor'
  }
  onSwitchComplete: (newMode: 'teaching' | 'full') => void
}

export default function ModeSwitchDialog({
  open, onClose, bookId, currentMode, bookMeta, onSwitchComplete
}: ModeSwitchDialogProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const targetMode = currentMode === 'teaching' ? 'full' : 'teaching'
  const recommendation = getRecommendation(bookMeta)
  const isRecommended = recommendation.recommended === targetMode

  const handleConfirm = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/books/${bookId}/switch-mode`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newMode: targetMode })
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `模式切换失败: HTTP ${res.status}`)
      }
      onSwitchComplete(targetMode)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : '模式切换失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={loading ? () => {} : onClose}
      title={targetMode === 'teaching' ? '模式切换：进入 AI 老师模式' : '模式切换：进入自主学习模式'}
    >
      {/* 推荐理由 */}
      {isRecommended && (
        <p className="text-sm bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 text-amber-900">
          推荐理由：{recommendation.reason}
        </p>
      )}

      {/* 对比表格 */}
      <div className="overflow-x-auto mb-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-amber-100">
              <th className="py-2 px-3 text-left text-on-surface-variant font-medium">功能项</th>
              <th className="py-2 px-3 text-left text-on-surface-variant font-medium">
                {currentMode === 'teaching' ? '老师模式 (当前)' : '自主模式 (当前)'}
              </th>
              <th className="py-2 px-3 text-left text-on-surface-variant font-medium text-primary">
                {targetMode === 'teaching' ? '老师模式 (切换后)' : '自主模式 (切换后)'}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-amber-50">
            <tr>
              <td className="py-2 px-3 font-medium text-on-surface">学习流</td>
              <td className="py-2 px-3 text-on-surface-variant">{currentMode === 'teaching' ? '渐进式解锁：老师讲 → Q&A → 笔记' : '自由查阅：阅读 → Q&A → 笔记'}</td>
              <td className="py-2 px-3 text-on-surface-variant">{targetMode === 'teaching' ? '渐进式解锁：老师讲 → Q&A → 笔记' : '自由查阅：阅读 → Q&A → 笔记'}</td>
            </tr>
            <tr>
              <td className="py-2 px-3 font-medium text-on-surface">注意力</td>
              <td className="py-2 px-3 text-on-surface-variant">{currentMode === 'teaching' ? '每节约 3-5 分钟' : '每节约 1-3 分钟'}</td>
              <td className="py-2 px-3 text-on-surface-variant">{targetMode === 'teaching' ? '每节约 3-5 分钟' : '每节约 1-3 分钟'}</td>
            </tr>
            <tr>
              <td className="py-2 px-3 font-medium text-on-surface">引导推荐</td>
              <td className="py-2 px-3 text-on-surface-variant">{currentMode === 'teaching' ? 'AI 路径锁定，强制掌握' : '由用户自行选择顺序'}</td>
              <td className="py-2 px-3 text-on-surface-variant">{targetMode === 'teaching' ? 'AI 路径锁定，强制掌握' : '由用户自行选择顺序'}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <p className="text-xs text-on-surface-variant mb-4">注：切换模式后，当前正在进行的模块将重置到阅读状态，以确保学习完整性。确认切换到 {targetMode === 'teaching' ? '老师模式' : '自主模式'} 吗？</p>

      {error && (
        <p className="text-sm text-error bg-error/10 border border-error/20 rounded-lg p-3 mb-4">{error}</p>
      )}

      <div className="flex justify-end gap-3 pt-2">
        <button
          onClick={onClose}
          disabled={loading}
          className="px-5 py-2 rounded-full border border-outline-variant text-sm font-bold text-on-surface hover:bg-surface-container transition-colors disabled:opacity-50"
        >
          取消
        </button>
        <AmberButton onClick={handleConfirm} disabled={loading}>
          {loading ? '切换中...' : '确认切换'}
        </AmberButton>
      </div>
    </Modal>
  )
}
