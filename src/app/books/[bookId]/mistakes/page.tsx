'use client'

import { useState, useEffect, use, useCallback } from 'react'
import Link from 'next/link'
import AIResponse from '@/components/AIResponse'
import LoadingState from '@/components/LoadingState'

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
  blind_spot: 'bg-error-container/10 text-error border-error/20',
  procedural: 'bg-tertiary-container/10 text-tertiary border-tertiary-container/20',
  confusion: 'bg-secondary-container/10 text-secondary border-secondary-container/20',
  careless: 'bg-surface-container text-on-surface-variant border-outline-variant/30',
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
      <div className="min-h-full bg-surface-container-low flex items-center justify-center p-4">
        <div className="bg-surface-container-lowest p-12 rounded-[32px] shadow-xl shadow-orange-900/10 border border-error/20 text-center max-w-md w-full">
          <span className="material-symbols-outlined text-error text-5xl mb-6" style={{ fontVariationSettings: "'FILL' 1" }}>error</span>
          <p className="text-on-surface font-black font-headline text-xl mb-6">{error}</p>
          <button onClick={() => window.location.reload()} className="amber-glow text-on-primary font-bold px-8 py-3 rounded-full shadow-lg shadow-orange-900/20 active:scale-95 transition-all">重试</button>
        </div>
      </div>
    )
  }

  return (
    <main className="min-h-full bg-surface-container-low pb-20">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-10">
          <Link href={`/books/${bookId}`} className="text-[10px] font-black text-on-surface-variant/50 hover:text-primary transition-colors uppercase tracking-widest flex items-center gap-2">
            <span className="material-symbols-outlined text-sm">arrow_back</span>
            返回教材中心
          </Link>
          <div className="flex items-center justify-between mt-4">
            <h1 className="text-3xl font-black text-on-surface font-headline tracking-tight">错题诊断本</h1>
            <div className="bg-primary text-on-primary px-4 py-1.5 rounded-full text-xs font-black font-headline shadow-lg shadow-orange-900/10">
              {data?.summary.total || 0} TOTAL
            </div>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="bg-surface-container-lowest rounded-[32px] shadow-sm shadow-orange-900/5 border border-outline-variant/10 p-8 mb-10 space-y-8">
          {/* Module Dropdown */}
          <div>
            <label className="block text-[10px] font-black text-on-surface-variant uppercase tracking-widest mb-3">按模块筛选</label>
            <div className="relative">
              <select 
                value={moduleFilter}
                onChange={(e) => setModuleFilter(e.target.value)}
                className="w-full bg-surface-container-low border border-outline-variant/10 rounded-2xl px-6 py-4 text-sm font-bold text-on-surface focus:outline-none focus:ring-4 focus:ring-primary/5 transition-all appearance-none"
              >
                <option value="">全部模块</option>
                {data?.summary.byModule.map((m) => (
                  <option key={m.moduleId} value={m.moduleId.toString()}>
                    {m.moduleTitle} ({m.count})
                  </option>
                ))}
              </select>
              <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none">expand_more</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Error Type Tags */}
            <div>
              <label className="block text-[10px] font-black text-on-surface-variant uppercase tracking-widest mb-3">错误类型</label>
              <div className="flex flex-wrap gap-2">
                {Object.entries(ERROR_TYPE_LABELS).map(([type, label]) => {
                  const isActive = errorTypeFilter === type
                  return (
                    <button
                      key={type}
                      onClick={() => setErrorTypeFilter(isActive ? '' : type)}
                      className={`px-4 py-2 rounded-full text-xs font-bold border transition-all ${
                        isActive 
                        ? 'bg-primary text-on-primary border-primary shadow-md' 
                        : 'bg-surface-container-lowest text-on-surface-variant border-outline-variant/30 hover:border-primary/30'
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
              <label className="block text-[10px] font-black text-on-surface-variant uppercase tracking-widest mb-3">来源渠道</label>
              <div className="flex flex-wrap gap-2">
                {Object.entries(SOURCE_LABELS).map(([src, label]) => {
                  const isActive = sourceFilter === src
                  return (
                    <button
                      key={src}
                      onClick={() => setSourceFilter(isActive ? '' : src)}
                      className={`px-4 py-2 rounded-full text-xs font-bold border transition-all ${
                        isActive 
                        ? 'bg-primary text-on-primary border-primary shadow-md' 
                        : 'bg-surface-container-lowest text-on-surface-variant border-outline-variant/30 hover:border-primary/30'
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
          <div className="py-20">
            <LoadingState label="正在加载全书错题记录..." />
          </div>
        ) : data?.mistakes.length === 0 ? (
          <div className="bg-surface-container-lowest rounded-[40px] border border-outline-variant/10 p-20 text-center shadow-sm shadow-orange-900/5">
            <span className="text-5xl mb-6 block">🎉</span>
            <h3 className="text-xl font-black text-on-surface font-headline">恭喜！这里空空如也</h3>
            <p className="text-sm text-on-surface-variant mt-2 font-medium">当前筛选条件下没有任何错题记录</p>
          </div>
        ) : (
          <div className="space-y-8">
            {data?.mistakes.map((m) => (
              <div key={m.id} className="bg-surface-container-lowest rounded-[32px] shadow-sm shadow-orange-900/5 border border-outline-variant/10 overflow-hidden">
                {/* Card Header */}
                <div className="px-8 py-5 bg-surface-container-low/30 border-b border-outline-variant/5 flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border ${ERROR_TYPE_COLORS[m.errorType] || 'bg-surface-container'}`}>
                      {ERROR_TYPE_LABELS[m.errorType] || m.errorType}
                    </span>
                    <span className="bg-surface-container-lowest px-3 py-1 rounded-lg border border-outline-variant/10 text-[10px] font-black text-on-surface-variant/50 uppercase tracking-widest">
                      {SOURCE_LABELS[m.source] || m.source}
                    </span>
                  </div>
                  <span className="text-[10px] font-black text-on-surface-variant/30 uppercase tracking-widest">{m.createdAt.slice(0, 16).replace('T', ' ')}</span>
                </div>

                <div className="p-8 md:p-10">
                  {/* KP & Module */}
                  <div className="mb-6">
                    <p className="text-[10px] font-black text-primary uppercase tracking-[0.2em] mb-1">{m.moduleTitle}</p>
                    <h3 className="text-lg font-black text-on-surface font-headline tracking-tight">{m.kpTitle || '未归类知识点'}</h3>
                  </div>

                  {/* Question */}
                  <div className="bg-surface-container-low/50 rounded-2xl p-6 mb-8 border border-outline-variant/10 shadow-inner">
                    <div className="text-on-surface leading-relaxed font-bold font-headline">
                      <AIResponse content={m.questionText} />
                    </div>
                  </div>

                  {/* Answers Comparison */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest ml-1">你的回答</label>
                      <div className="bg-error-container/10 border border-error/20 rounded-2xl p-6 text-sm text-error font-bold min-h-[80px] leading-relaxed shadow-sm">
                        {m.userAnswer || '(未填写)'}
                      </div>
                    </div>
                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-emerald-600 uppercase tracking-widest ml-1">正确答案</label>
                      <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 text-sm text-emerald-900 font-bold min-h-[80px] leading-relaxed shadow-sm">
                        <AIResponse content={m.correctAnswer || '(待录入)'} />
                      </div>
                    </div>
                  </div>

                  {/* AI Remediation */}
                  {m.remediation && (
                    <div className="border-t border-outline-variant/10 pt-8 mt-4">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-2 h-2 bg-primary rounded-full shadow-[0_0_8px_rgba(167,72,0,0.4)]"></div>
                        <label className="text-[10px] font-black text-on-surface uppercase tracking-[0.2em]">AI 诊断与建议</label>
                      </div>
                      <div className="bg-primary/5 rounded-3xl p-8 border border-primary/10 prose-sm max-w-none text-on-surface-variant font-medium leading-relaxed">
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
