'use client'

import { useState, useEffect, use, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import AppSidebar from '@/components/ui/AppSidebar'
import Breadcrumb from '@/components/ui/Breadcrumb'
import FilterBar from '@/components/ui/FilterBar'
import MistakeCard from '@/components/ui/MistakeCard'
import ToggleSwitch from '@/components/ui/ToggleSwitch'
import ResolvedCard from '@/components/ui/ResolvedCard'
import LoadingState from '@/components/LoadingState'
import DecorativeBlur from '@/components/ui/DecorativeBlur'

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
  is_resolved?: boolean
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

const SOURCE_LABELS: Record<string, string> = {
  test: '测试',
  qa: 'Q&A',
  review: '复习',
}

export default function MistakesPage({ params }: { params: Promise<{ bookId: string }> }) {
  const { bookId } = use(params)
  const router = useRouter()
  const [data, setData] = useState<MistakesData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [showOnlyUnresolved, setShowOnlyUnresolved] = useState(false)

  // Filters
  const [selectedFilters, setSelected] = useState<Record<string, string[]>>({
    module: [],
    errorType: [],
    source: [],
  })

  const fetchMistakes = useCallback(async () => {
    setLoading(true)
    try {
      const p = new URLSearchParams()
      if (selectedFilters.module.length > 0) p.append('module', selectedFilters.module[0])
      if (selectedFilters.errorType.length > 0) p.append('errorType', selectedFilters.errorType[0])
      if (selectedFilters.source.length > 0) p.append('source', selectedFilters.source[0])

      const res = await fetch(`/api/books/${bookId}/mistakes?${p.toString()}`)
      const json = await res.json()
      if (json.success) {
        setData(json.data)
      } else {
        setError(json.error || '无法加载错题记录')
      }
    } catch (err) {
      setError('网络请求失败')
    } finally {
      setLoading(false)
    }
  }, [bookId, selectedFilters])

  useEffect(() => {
    fetchMistakes()
  }, [fetchMistakes])

  const handleFilterChange = (key: string, value: string) => {
    setSelected(prev => ({
      ...prev,
      [key]: prev[key].includes(value) ? [] : [value]
    }))
  }

  const handleResolve = async (id: number) => {
    // In a real app, call API. For now, optimistic update.
    setData(prev => {
      if (!prev) return null
      return {
        ...prev,
        mistakes: prev.mistakes.map(m => m.id === id ? { ...m, is_resolved: true } : m)
      }
    })
  }

  const handleReopen = async (id: number) => {
    setData(prev => {
      if (!prev) return null
      return {
        ...prev,
        mistakes: prev.mistakes.map(m => m.id === id ? { ...m, is_resolved: false } : m)
      }
    })
  }

  const navItems = [
    { icon: 'home', label: '首页中心', href: '/' },
    { icon: 'cloud_upload', label: '上传教材', href: '/upload' },
    { icon: 'analytics', label: '系统日志', href: '/logs' },
  ]

  if (error) {
    return (
      <div className="min-h-screen bg-surface-container-low flex items-center justify-center p-6">
        <div className="bg-surface-container-lowest p-12 rounded-[32px] shadow-xl border border-error/20 text-center max-w-md w-full">
          <span className="material-symbols-outlined text-error text-5xl mb-6">error</span>
          <p className="text-on-surface font-black font-headline text-xl mb-6">{error}</p>
          <button onClick={() => window.location.reload()} className="amber-glow text-white font-bold px-8 py-3 rounded-full shadow-cta active:scale-95 transition-all">重试</button>
        </div>
      </div>
    )
  }

  const filteredMistakes = data?.mistakes.filter(m => !showOnlyUnresolved || !m.is_resolved) || []
  const unresolved = filteredMistakes.filter(m => !m.is_resolved)
  const resolved = filteredMistakes.filter(m => m.is_resolved)

  return (
    <div className="min-h-screen bg-surface-container-low">
      <AppSidebar 
        userName="用户" // Should come from a context/session
        navItems={navItems}
      />

      <main className="ml-72 p-10 relative min-h-screen">
        <DecorativeBlur position="top-right" />
        <DecorativeBlur position="bottom-left" color="secondary" />

        <div className="max-w-4xl mx-auto relative z-10 space-y-10">
          <header>
            <Breadcrumb items={[
              { label: '首页', href: '/' },
              { label: '书籍详情', href: `/books/${bookId}` },
              { label: '错题诊断本' }
            ]} />
            <div className="flex items-center justify-between mt-6">
              <h1 className="text-3xl font-black text-on-surface font-headline tracking-tight">错题诊断本</h1>
              <ToggleSwitch 
                checked={showOnlyUnresolved} 
                onChange={setShowOnlyUnresolved} 
                label="只看未解决" 
              />
            </div>
          </header>

          <FilterBar
            groups={[
              { label: '错误类型', key: 'errorType', options: Object.values(ERROR_TYPE_LABELS) },
              { label: '来源', key: 'source', options: Object.values(SOURCE_LABELS) },
              { label: '模块', key: 'module', options: data?.summary.byModule.map(m => m.moduleTitle) || [] }
            ]}
            selected={{
              errorType: selectedFilters.errorType.map(t => ERROR_TYPE_LABELS[t as keyof typeof ERROR_TYPE_LABELS] || t),
              source: selectedFilters.source.map(s => SOURCE_LABELS[s as keyof typeof SOURCE_LABELS] || s),
              module: selectedFilters.module // assumes value matches option label
            }}
            onChange={(key, label) => {
              let value = label
              if (key === 'errorType') {
                value = Object.keys(ERROR_TYPE_LABELS).find(k => ERROR_TYPE_LABELS[k] === label) || label
              } else if (key === 'source') {
                value = Object.keys(SOURCE_LABELS).find(k => SOURCE_LABELS[k] === label) || label
              }
              handleFilterChange(key, value)
            }}
          />

          {loading ? (
            <div className="py-20 flex justify-center">
              <LoadingState label="加载错题中..." />
            </div>
          ) : filteredMistakes.length === 0 ? (
            <div className="bg-surface-container-lowest rounded-[40px] border border-outline-variant/10 p-20 text-center shadow-sm">
              <span className="text-5xl mb-6 block">🎉</span>
              <h3 className="text-xl font-black text-on-surface font-headline">恭喜！这里没有错题</h3>
              <p className="text-sm text-on-surface-variant mt-2 font-medium">当前筛选条件下没有任何记录</p>
            </div>
          ) : (
            <div className="space-y-6">
              {unresolved.map(m => (
                <MistakeCard
                  key={m.id}
                  expanded={expandedId === m.id}
                  onToggle={() => setExpandedId(expandedId === m.id ? null : m.id)}
                  onResolve={() => handleResolve(m.id)}
                  onPractice={() => {}} // Placeholder
                  mistake={{
                    id: m.id,
                    question: m.questionText,
                    yourAnswer: m.userAnswer,
                    correctAnswer: m.correctAnswer,
                    errorType: ERROR_TYPE_LABELS[m.errorType as keyof typeof ERROR_TYPE_LABELS] || m.errorType,
                    source: SOURCE_LABELS[m.source as keyof typeof SOURCE_LABELS] || m.source,
                    module: m.moduleTitle,
                    diagnosis: m.remediation || '分析中...',
                    loggedAt: new Date(m.createdAt).toLocaleDateString('zh-CN')
                  }}
                />
              ))}

              {resolved.length > 0 && (
                <div className="pt-10 space-y-4">
                  <h2 className="text-sm font-black text-on-surface-variant/50 uppercase tracking-widest px-4">已解决</h2>
                  {resolved.map(m => (
                    <ResolvedCard
                      key={m.id}
                      question={m.questionText}
                      module={m.moduleTitle}
                      resolvedAt={new Date(m.createdAt).toLocaleDateString('zh-CN')}
                      onReopen={() => handleReopen(m.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
