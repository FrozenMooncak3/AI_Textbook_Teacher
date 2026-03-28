'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Module {
  id: number
  book_id: number
  title: string
  summary: string
  order_index: number
  kp_count: number
  learning_status: string
  pass_status: string
}

interface Guide {
  goal: string
  focus_points: string[]
  common_mistakes: string[]
}

type View = 'guide' | 'reading'

export default function ModuleLearning({
  module_,
  bookRawText,
  bookId,
}: {
  module_: Module
  bookRawText: string
  bookId: number
}) {
  const router = useRouter()
  const [view, setView] = useState<View>('guide')
  const [guide, setGuide] = useState<Guide | null>(null)
  const [loadingGuide, setLoadingGuide] = useState(false)
  const [error, setError] = useState('')

  async function loadGuide() {
    setLoadingGuide(true)
    setError('')

    // 先尝试读缓存
    const cached = await fetch(`/api/modules/${module_.id}/guide`)
    if (cached.ok) {
      const cachedData = await cached.json()
      if (cachedData.guide) {
        setGuide(cachedData.guide)
        setLoadingGuide(false)
        return
      }
    }

    // 无缓存则生成
    const res = await fetch(`/api/modules/${module_.id}/guide`, { method: 'POST' })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error ?? '生成失败，请重试')
      setLoadingGuide(false)
      return
    }
    setGuide(data.guide)
    setLoadingGuide(false)
  }

  function handleStartReading() {
    setView('reading')
  }

  async function handleFinishedReading() {
    // 更新 learning_status 为 'qa'
    await fetch(`/api/modules/${module_.id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ learning_status: 'qa' }),
    })
    router.push(`/books/${bookId}/modules/${module_.id}/qa`)
  }

  // ── 原文阅读视图 ──────────────────────────────────────────
  if (view === 'reading') {
    return (
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">原文阅读</h2>
          <button
            onClick={() => setView('guide')}
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            ← 返回指引
          </button>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6 max-h-[60vh] overflow-y-auto">
          <pre className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap font-sans">
            {bookRawText}
          </pre>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
          <p className="text-sm text-amber-800 font-medium">阅读提示</p>
          <p className="text-xs text-amber-700 mt-1">
            请认真阅读原文后再进入 Q&A。阅读是必须步骤，无法跳过。
          </p>
        </div>

        <button
          onClick={handleFinishedReading}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-lg text-sm transition-colors"
        >
          我读完了，开始 Q&A
        </button>
      </div>
    )
  }

  // ── 读前指引视图 ──────────────────────────────────────────
  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-1">{module_.title}</h2>
        <p className="text-sm text-gray-500">{module_.kp_count} 个知识点</p>
      </div>

      {!guide && (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center mb-6">
          <p className="text-sm text-gray-500 mb-4">
            在开始阅读前，AI 会为你生成读前指引，帮你明确学习目标和重点。
          </p>
          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-4">{error}</p>
          )}
          <button
            onClick={loadGuide}
            disabled={loadingGuide}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-medium px-6 py-2.5 rounded-lg text-sm transition-colors"
          >
            {loadingGuide ? 'AI 生成中...' : '生成读前指引'}
          </button>
        </div>
      )}

      {guide && (
        <div className="space-y-4 mb-6">
          {/* 学习目标 */}
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-5">
            <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-2">
              学完能做什么
            </p>
            <p className="text-sm text-blue-900 leading-relaxed">{guide.goal}</p>
          </div>

          {/* 核心重点 */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
              核心重点（阅读时重点关注）
            </p>
            <ul className="space-y-2">
              {guide.focus_points.map((point, i) => (
                <li key={i} className="flex gap-2 text-sm text-gray-700">
                  <span className="text-blue-400 font-bold shrink-0">{i + 1}.</span>
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* 容易混淆 */}
          <div className="bg-amber-50 border border-amber-100 rounded-xl p-5">
            <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide mb-3">
              容易混淆的地方
            </p>
            <ul className="space-y-2">
              {guide.common_mistakes.map((mistake, i) => (
                <li key={i} className="flex gap-2 text-sm text-amber-800">
                  <span className="shrink-0">⚠</span>
                  <span>{mistake}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {guide && (
        <button
          onClick={handleStartReading}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-lg text-sm transition-colors"
        >
          开始阅读原文 →
        </button>
      )}
    </div>
  )
}
