'use client'

import { useState, useEffect, use } from 'react'

interface Mistake {
  id: number
  kp_id: number | null
  kp_code: string | null
  kp_description: string | null
  knowledge_point: string | null
  error_type: 'blind_spot' | 'procedural' | 'confusion' | 'careless'
  source: 'test' | 'qa' | 'review'
  remediation: string
  is_resolved: boolean
  created_at: string
}

const ERROR_TYPE_LABELS: Record<string, string> = {
  blind_spot: '知识盲点',
  procedural: '程序性失误',
  confusion: '概念混淆',
  careless: '粗心错误',
}

const ERROR_TYPE_COLORS: Record<string, string> = {
  blind_spot: 'bg-red-50 text-red-700 border-red-100',
  procedural: 'bg-amber-50 text-amber-700 border-amber-100',
  confusion: 'bg-yellow-50 text-yellow-700 border-yellow-100',
  careless: 'bg-slate-50 text-slate-700 border-slate-100',
}

const SOURCE_LABELS: Record<string, string> = {
  test: '考试',
  qa: 'Q&A 训练',
  review: '复习',
}

export default function MistakesPage({
  params,
}: {
  params: Promise<{ bookId: string; moduleId: string }>
}) {
  const { bookId, moduleId } = use(params)
  const [mistakes, setMistakes] = useState<Mistake[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function fetchMistakes() {
      try {
        const res = await fetch(`/api/modules/${moduleId}/mistakes`)
        const { success, data, error } = await res.json()
        if (success) {
          setMistakes(data.mistakes)
        } else {
          setError(error || '获取错题记录失败')
        }
      } catch (err) {
        setError('网络请求失败')
      } finally {
        setLoading(false)
      }
    }
    fetchMistakes()
  }, [moduleId])

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const unresolvedMistakes = mistakes.filter(m => !m.is_resolved)
  const resolvedMistakes = mistakes.filter(m => m.is_resolved)

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-2xl mx-auto px-4 py-10">
        {/* Breadcrumbs */}
        <nav className="flex items-center gap-2 text-xs text-slate-400 mb-8">
          <a href={`/books/${bookId}`} className="hover:text-slate-600 transition-colors">
            书籍详情
          </a>
          <span className="text-slate-300">/</span>
          <span className="text-slate-600 font-medium">模块错题诊断</span>
        </nav>

        <div className="mb-10">
          <h1 className="text-2xl font-bold text-slate-900 mb-2">错题诊断报告</h1>
          <p className="text-sm text-slate-500">
            AI 已根据你的错误模式自动分析了知识盲点，并生成了补救建议。
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm mb-6">
            {error}
          </div>
        )}

        {mistakes.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
            <div className="w-16 h-16 bg-green-50 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-1">暂无错题记录</h3>
            <p className="text-sm text-slate-500">继续保持！本模块的知识点你掌握得很扎实。</p>
            <a
              href={`/books/${bookId}`}
              className="inline-block mt-6 text-sm font-bold text-blue-600 hover:text-blue-700"
            >
              返回模块地图 →
            </a>
          </div>
        ) : (
          <div className="space-y-12">
            {/* 未解决错题 */}
            {unresolvedMistakes.length > 0 && (
              <section className="space-y-6">
                <div className="flex items-center justify-between px-2">
                  <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <span>待补救</span>
                    <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">{unresolvedMistakes.length}</span>
                  </h2>
                </div>
                <div className="space-y-4">
                  {unresolvedMistakes.map(m => (
                    <MistakeCard key={m.id} mistake={m} />
                  ))}
                </div>
              </section>
            )}

            {/* 已解决错题 */}
            {resolvedMistakes.length > 0 && (
              <section className="space-y-6">
                <div className="flex items-center justify-between px-2">
                  <h2 className="text-lg font-semibold text-slate-500 flex items-center gap-2">
                    <span>已标记解决</span>
                    <span className="text-xs bg-slate-200 text-slate-500 px-2 py-0.5 rounded-full">{resolvedMistakes.length}</span>
                  </h2>
                </div>
                <div className="space-y-4 opacity-75">
                  {resolvedMistakes.map(m => (
                    <MistakeCard key={m.id} mistake={m} />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </main>
  )
}

function MistakeCard({ mistake }: { mistake: Mistake }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="p-5">
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${ERROR_TYPE_COLORS[mistake.error_type]}`}>
            {ERROR_TYPE_LABELS[mistake.error_type]}
          </span>
          <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full uppercase tracking-wider">
            来源：{SOURCE_LABELS[mistake.source]}
          </span>
          <span className="text-xs text-slate-400 ml-auto">
            {new Date(mistake.created_at).toLocaleDateString()}
          </span>
        </div>

        <div className="mb-4">
          <p className="text-sm font-semibold text-slate-900 mb-1">
            {mistake.knowledge_point || '未命名知识点'}
          </p>
          {mistake.kp_code && (
            <p className="text-xs text-slate-400 font-mono">
              KP Code: {mistake.kp_code}
            </p>
          )}
          {mistake.kp_description && (
            <p className="text-xs text-slate-500 mt-2 leading-relaxed">
              {mistake.kp_description}
            </p>
          )}
        </div>

        <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-bold text-blue-700 uppercase tracking-widest">补救方案</span>
          </div>
          <p className="text-sm text-slate-700 leading-relaxed">
            {mistake.remediation}
          </p>
        </div>
      </div>
    </div>
  )
}
