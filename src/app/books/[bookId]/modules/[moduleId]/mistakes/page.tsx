'use client'

import { useState, useEffect, use } from 'react'
import AIResponse from '@/components/AIResponse'
import LoadingState from '@/components/LoadingState'
import Link from 'next/link'

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
  blind_spot: 'bg-error-container/10 text-error border-error/20',
  procedural: 'bg-tertiary-container/10 text-tertiary border-tertiary-container/20',
  confusion: 'bg-secondary-container/10 text-secondary border-secondary-container/20',
  careless: 'bg-surface-container text-on-surface-variant border-outline-variant/30',
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
      <div className="min-h-full bg-surface-container-low flex items-center justify-center">
        <LoadingState label="正在分析模块错题记录..." />
      </div>
    )
  }

  const unresolvedMistakes = mistakes.filter(m => !m.is_resolved)
  const resolvedMistakes = mistakes.filter(m => m.is_resolved)

  return (
    <main className="min-h-full bg-surface-container-low pb-20">
      <div className="max-w-2xl mx-auto px-4 py-10">
        {/* Breadcrumbs */}
        <nav className="flex items-center gap-2 text-[10px] font-black text-on-surface-variant/50 mb-8 uppercase tracking-widest">
          <Link href={`/books/${bookId}`} className="hover:text-primary transition-colors">
            书籍详情
          </Link>
          <span className="material-symbols-outlined text-xs">chevron_right</span>
          <span className="text-on-surface font-bold">模块错题诊断</span>
        </nav>

        <div className="mb-10">
          <h1 className="text-3xl font-black text-on-surface font-headline tracking-tight mb-2">错题诊断报告</h1>
          <p className="text-sm text-on-surface-variant font-medium">
            AI 已根据你的错误模式自动分析了知识盲点，并生成了补救建议。
          </p>
        </div>

        {error && (
          <div className="bg-error-container/10 border border-error/20 rounded-2xl p-6 text-error text-sm font-bold mb-8 animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined">error</span>
              {error}
            </div>
          </div>
        )}

        {mistakes.length === 0 ? (
          <div className="bg-surface-container-lowest rounded-[40px] border border-outline-variant/10 p-16 text-center shadow-sm shadow-orange-900/5">
            <div className="w-20 h-20 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6 text-4xl">
              <span className="material-symbols-outlined text-4xl" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
            </div>
            <h3 className="text-xl font-black text-on-surface font-headline mb-2">暂无错题记录</h3>
            <p className="text-sm text-on-surface-variant font-medium">继续保持！本模块的知识点你掌握得很扎实。</p>
            <Link
              href={`/books/${bookId}`}
              className="inline-flex items-center gap-2 mt-8 text-sm font-bold text-primary hover:underline"
            >
              返回教材中心
              <span className="material-symbols-outlined text-sm">arrow_forward</span>
            </Link>
          </div>
        ) : (
          <div className="space-y-12">
            {/* 未解决错题 */}
            {unresolvedMistakes.length > 0 && (
              <section className="space-y-6">
                <div className="flex items-center justify-between px-2">
                  <h2 className="text-lg font-black text-on-surface font-headline flex items-center gap-3 uppercase tracking-wider">
                    <span>待补救</span>
                    <span className="text-[10px] bg-error text-on-error px-2.5 py-0.5 rounded-full font-black">{unresolvedMistakes.length}</span>
                  </h2>
                </div>
                <div className="space-y-6">
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
                  <h2 className="text-lg font-black text-on-surface-variant/50 font-headline flex items-center gap-3 uppercase tracking-wider">
                    <span>已标记解决</span>
                    <span className="text-[10px] bg-surface-container-highest text-on-surface-variant px-2.5 py-0.5 rounded-full font-black">{resolvedMistakes.length}</span>
                  </h2>
                </div>
                <div className="space-y-6 opacity-60 grayscale-[0.5]">
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
    <div className="bg-surface-container-lowest rounded-[32px] border border-outline-variant/10 overflow-hidden shadow-sm shadow-orange-900/5">
      <div className="p-8">
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <span className={`text-[10px] font-black px-3 py-1 rounded-lg border uppercase tracking-widest ${ERROR_TYPE_COLORS[mistake.error_type]}`}>
            {ERROR_TYPE_LABELS[mistake.error_type]}
          </span>
          <span className="text-[10px] font-black bg-surface-container-low text-on-surface-variant/70 px-3 py-1 rounded-lg uppercase tracking-widest border border-outline-variant/10">
            {SOURCE_LABELS[mistake.source]}
          </span>
          <span className="text-[10px] font-black text-on-surface-variant/30 ml-auto uppercase tracking-widest">
            {new Date(mistake.created_at).toLocaleDateString('zh-CN')}
          </span>
        </div>

        <div className="mb-6">
          <p className="text-lg font-black text-on-surface font-headline mb-1 tracking-tight">
            {mistake.knowledge_point || '未命名知识点'}
          </p>
          {mistake.kp_code && (
            <p className="text-[10px] text-primary font-black uppercase tracking-widest opacity-60">
              Code: {mistake.kp_code}
            </p>
          )}
          {mistake.kp_description && (
            <div className="text-sm text-on-surface-variant mt-3 leading-relaxed font-medium">
              <AIResponse content={mistake.kp_description} />
            </div>
          )}
        </div>

        <div className="bg-primary/5 border border-primary/10 rounded-2xl p-6 shadow-inner">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-1.5 h-1.5 bg-primary rounded-full"></div>
            <span className="text-[10px] font-black text-primary uppercase tracking-[0.2em]">补救方案</span>
          </div>
          <div className="text-sm text-on-surface-variant leading-relaxed font-medium">
            <AIResponse content={mistake.remediation} />
          </div>
        </div>
      </div>
    </div>
  )
}
