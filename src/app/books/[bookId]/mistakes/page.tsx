'use client'

import { useState, useEffect, use, useCallback } from 'react'
import Link from 'next/link'
import AIResponse from '@/components/AIResponse'

interface Mistake {
  id: number
  moduleId: number
  moduleTitle: string
  questionText: string
  userAnswer: string
  correctAnswer: string
  errorType: string
  remediation: string | null
  source: string
  kpTitle: string | null
  createdAt: string
}

interface MistakesData {
  mistakes: Mistake[]
  summary: {
    total: number
    byType: Record<string, number>
    byModule: {
      moduleId: number
      moduleTitle: string
      count: number
    }[]
  }
}

const ERROR_TYPE_LABELS: Record<string, string> = {
  blind_spot: '知识盲点',
  procedural: '程序性失误',
  confusion: '概念混淆',
  careless: '粗心错误',
}

const ERROR_TYPE_COLORS: Record<string, string> = {
  blind_spot: 'bg-red-100 text-red-700 border-red-200',
  procedural: 'bg-blue-100 text-blue-700 border-blue-200',
  confusion: 'bg-amber-100 text-amber-700 border-amber-200',
  careless: 'bg-slate-100 text-slate-700 border-slate-200',
}

const SOURCE_LABELS: Record<string, string> = {
  test: '测试',
  qa: 'Q&A',
  review: '复习',
}

export default function MistakesPage({ params }: { params: Promise<{ bookId: string }> }) {
  const { bookId } = use(params)
  const [data, setData] = useState<MistakesData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filters
  const [moduleFilter, setModuleFilter] = useState<string>('')
  const [errorTypeFilter, setErrorTypeFilter] = useState<string>('')
  const [sourceFilter, setSourceFilter] = useState<string>('')

  const fetchMistakes = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (moduleFilter) params.append('module', moduleFilter)
      if (errorTypeFilter) params.append('errorType', errorTypeFilter)
      if (sourceFilter) params.append('source', sourceFilter)

      const res = await fetch(`/api/books/${bookId}/mistakes?${params.toString()}`)
      const json = await res.json()
      if (json.success) {
        setData(json.data)
      } else {
        setError(json.error || 'Failed to load mistakes')
      }
    } catch (err) {
      setError('Failed to fetch mistakes')
    } finally {
      setLoading(false)
    }
  }, [bookId, moduleFilter, errorTypeFilter, sourceFilter])

  useEffect(() => {
    fetchMistakes()
  }, [fetchMistakes])

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-red-100 text-center max-w-sm w-full">
          <div className="text-red-500 text-4xl mb-4">⚠️</div>
          <p className="text-gray-900 font-medium mb-4">{error}</p>
          <button onClick={() => window.location.reload()} className="text-blue-600 font-medium text-sm">重试</button>
        </div>
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-gray-50 pb-20">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link href={`/books/${bookId}/dashboard`} className="text-xs text-gray-400 hover:text-blue-600 transition-colors uppercase tracking-widest font-bold">
            &larr; 返回仪表盘
          </Link>
          <div className="flex items-center justify-between mt-2">
            <h1 className="text-2xl font-bold text-gray-900">错题诊断本</h1>
            <div className="bg-red-600 text-white px-3 py-1 rounded-full text-xs font-black">
              {data?.summary.total || 0} TOTAL
            </div>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-8 space-y-6">
          {/* Module Dropdown */}
          <div>
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">按模块筛选</label>
            <select 
              value={moduleFilter}
              onChange={(e) => setModuleFilter(e.target.value)}
              className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all appearance-none"
            >
              <option value="">全部模块</option>
              {data?.summary.byModule.map((m) => (
                <option key={m.moduleId} value={m.moduleId.toString()}>
                  {m.moduleTitle} ({m.count})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Error Type Tags */}
            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">错误类型</label>
              <div className="flex flex-wrap gap-2">
                {Object.entries(ERROR_TYPE_LABELS).map(([type, label]) => {
                  const isActive = errorTypeFilter === type
                  return (
                    <button
                      key={type}
                      onClick={() => setErrorTypeFilter(isActive ? '' : type)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                        isActive 
                        ? 'bg-blue-600 text-white border-blue-600 shadow-sm' 
                        : 'bg-white text-gray-500 border-gray-100 hover:border-blue-200'
                      }`}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Source Tags */}
            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">来源渠道</label>
              <div className="flex flex-wrap gap-2">
                {Object.entries(SOURCE_LABELS).map(([src, label]) => {
                  const isActive = sourceFilter === src
                  return (
                    <button
                      key={src}
                      onClick={() => setSourceFilter(isActive ? '' : src)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                        isActive 
                        ? 'bg-gray-800 text-white border-gray-800 shadow-sm' 
                        : 'bg-white text-gray-500 border-gray-100 hover:border-gray-300'
                      }`}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Mistakes List */}
        {loading ? (
          <div className="py-20 flex justify-center">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : data?.mistakes.length === 0 ? (
          <div className="bg-white rounded-3xl border border-gray-100 p-20 text-center">
            <span className="text-4xl mb-4 block">🎉</span>
            <h3 className="text-lg font-bold text-gray-900">恭喜！这里空空如也</h3>
            <p className="text-sm text-gray-400 mt-1">当前筛选条件下没有任何错题记录</p>
          </div>
        ) : (
          <div className="space-y-6">
            {data?.mistakes.map((m) => (
              <div key={m.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                {/* Card Header */}
                <div className="px-6 py-4 bg-gray-50/50 border-b border-gray-50 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-tighter border ${ERROR_TYPE_COLORS[m.errorType] || 'bg-gray-100'}`}>
                      {ERROR_TYPE_LABELS[m.errorType] || m.errorType}
                    </span>
                    <span className="bg-white px-2 py-0.5 rounded border border-gray-100 text-[10px] font-bold text-gray-400 uppercase">
                      {SOURCE_LABELS[m.source] || m.source}
                    </span>
                  </div>
                  <span className="text-[10px] font-bold text-gray-300">{m.createdAt.slice(0, 16).replace('T', ' ')}</span>
                </div>

                <div className="p-6">
                  {/* KP & Module */}
                  <div className="mb-4">
                    <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest">{m.moduleTitle}</p>
                    <h3 className="text-sm font-bold text-gray-900 mt-0.5">{m.kpTitle || '未归类知识点'}</h3>
                  </div>

                  {/* Question */}
                  <div className="bg-gray-50 rounded-xl p-4 mb-6">
                    <p className="text-sm text-gray-700 leading-relaxed font-medium">
                      {m.questionText}
                    </p>
                  </div>

                  {/* Answers Comparison */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">你的回答</label>
                      <div className="bg-red-50 border border-red-100 rounded-xl p-4 text-sm text-red-900 font-medium whitespace-pre-wrap min-h-[60px]">
                        {m.userAnswer || '(未填写)'}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">正确答案</label>
                      <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 text-sm text-emerald-900 font-medium whitespace-pre-wrap min-h-[60px]">
                        {m.correctAnswer || '(待录入)'}
                      </div>
                    </div>
                  </div>

                  {/* AI Remediation */}
                  {m.remediation && (
                    <div className="border-t border-gray-50 pt-6">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-1.5 h-1.5 bg-blue-600 rounded-full"></div>
                        <label className="text-[10px] font-black text-gray-900 uppercase tracking-widest">AI 诊断与建议</label>
                      </div>
                      <div className="prose-sm prose-blue bg-blue-50/30 rounded-2xl p-5 border border-blue-50">
                        <AIResponse content={m.remediation} />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
