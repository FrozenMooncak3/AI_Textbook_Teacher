'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import AIResponse from '@/components/AIResponse'

interface Module {
  id: number
  title: string
  summary: string
  order_index: number
  kp_count: number
  learning_status: string
  pass_status: string
}

interface Props {
  bookId: number
  modules: Module[]
}

const STATUS_LABEL: Record<string, string> = {
  unstarted: '未开始',
  reading: '阅读中',
  qa: 'Q&A 中',
  notes_generated: '笔记已生成',
  testing: '测试中',
  completed: '已完成',
}

const PASS_LABEL: Record<string, { label: string; color: string }> = {
  not_passed: { label: '未通过', color: 'text-gray-400' },
  passed: { label: '已过关', color: 'text-green-600' },
}

export default function ModuleMap({ bookId, modules: initialModules }: Props) {
  const router = useRouter()
  const [modules, setModules] = useState<Module[]>(initialModules)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')

  async function handleGenerate() {
    setGenerating(true)
    setError('')

    const res = await fetch('/api/modules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookId }),
    })
    const data = await res.json()

    if (!res.ok) {
      setError(data.error ?? '生成失败，请重试')
      setGenerating(false)
      return
    }

    setModules(data.modules)
    setGenerating(false)
    router.refresh()
  }

  // 尚未生成模块
  if (modules.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center">
        <p className="text-gray-500 text-sm mb-6">
          还没有学习模块。点击下方按钮，AI 将分析教材并生成模块地图。
        </p>
        {error && (
          <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-4">{error}</p>
        )}
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-medium px-6 py-2.5 rounded-lg text-sm transition-colors"
        >
          {generating ? 'AI 分析中，请稍候...' : '生成模块地图'}
        </button>
      </div>
    )
  }

  // 已有模块，展示地图
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500">共 {modules.length} 个模块</p>
      </div>

      {modules.map((mod) => {
        const pass = PASS_LABEL[mod.pass_status] ?? PASS_LABEL['not_passed']
        return (
          <div
            key={mod.id}
            className="bg-white rounded-xl border border-gray-200 p-5 hover:border-blue-300 hover:shadow-sm transition-all cursor-pointer"
            onClick={() => router.push(`/books/${bookId}/modules/${mod.id}`)}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-medium text-gray-400">
                    模块 {mod.order_index}
                  </span>
                  <span className={`text-xs font-medium ${pass.color}`}>{pass.label}</span>
                </div>
                <h3 className="font-medium text-gray-900 text-sm mb-1">{mod.title}</h3>
                <div className="text-xs text-gray-500 leading-relaxed">
                  <AIResponse content={mod.summary} />
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs text-gray-400">{mod.kp_count} 个知识点</p>
                <p className="text-xs text-blue-500 mt-1">
                  {STATUS_LABEL[mod.learning_status] ?? mod.learning_status}
                </p>
                {mod.pass_status === 'not_passed' && mod.learning_status === 'completed' && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      router.push(`/books/${bookId}/modules/${mod.id}/mistakes`)
                    }}
                    className="text-xs text-red-500 hover:text-red-700 mt-1 block"
                  >
                    查看错题 →
                  </button>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
