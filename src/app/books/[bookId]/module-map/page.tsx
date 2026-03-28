'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'

// --- Types ---

type KPType = 'position' | 'calculation' | 'c1_judgment' | 'c2_evaluation' | 'definition'
type OCRQuality = 'good' | 'uncertain' | 'damaged'
type ExtractionStatus = 'pending' | 'processing' | 'completed' | 'failed'

interface KnowledgePoint {
  id: number
  kp_code: string
  description: string
  type: KPType
  importance: number
  cluster_name: string
  ocr_quality: OCRQuality
}

interface Cluster {
  id: number
  name: string
  kp_count: number
}
interface Module {
  id: number
  title: string
  summary: string
  order_index: number
  kp_count: number
  cluster_count: number
  page_start: number
  page_end: number
  learning_status: string
  knowledge_points: KnowledgePoint[]
  clusters: Cluster[]
}

// --- Components ---

const StatusBadge = ({ status }: { status: string }) => {
  const labels: Record<string, string> = {
    unstarted: '未开始',
    reading: '正在阅读',
    qa: 'Q&A 练习中',
    notes_generated: '笔记已生成',
    completed: '已完成',
    testing: '测试中',
  }

  const styles: Record<string, string> = {
    unstarted: 'bg-slate-100 text-slate-500 border-slate-200',
    reading: 'bg-blue-50 text-blue-600 border-blue-100 animate-pulse',
    qa: 'bg-indigo-50 text-indigo-600 border-indigo-100',
    notes_generated: 'bg-purple-50 text-purple-600 border-purple-100',
    completed: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    testing: 'bg-amber-50 text-amber-600 border-amber-100',
  }

  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${styles[status] || styles.unstarted}`}>
      {labels[status] || status}
    </span>
  )
}

interface ModuleMapData {
  book_id: number
  book_title: string
  kp_extraction_status: ExtractionStatus
  total_kp_count: number
  total_module_count: number
  modules: Module[]
}

// --- Components ---

const KPTypeBadge = ({ type }: { type: KPType }) => {
  const styles: Record<KPType, string> = {
    position: 'bg-blue-100 text-blue-800',
    calculation: 'bg-green-100 text-green-800',
    c1_judgment: 'bg-yellow-100 text-yellow-800',
    c2_evaluation: 'bg-purple-100 text-purple-800',
    definition: 'bg-gray-100 text-gray-800',
  }

  const labels: Record<KPType, string> = {
    position: 'Position',
    calculation: 'Calculation',
    c1_judgment: 'C1 Judgment',
    c2_evaluation: 'C2 Evaluation',
    definition: 'Definition',
  }

  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${styles[type]}`}>
      {labels[type]}
    </span>
  )
}

const OCRQualityBadge = ({ quality }: { quality: OCRQuality }) => {
  if (quality === 'good') return null

  const styles = {
    uncertain: 'bg-yellow-100 text-yellow-800 border border-yellow-200',
    damaged: 'bg-red-100 text-red-800 border border-red-200',
  }

  const labels = {
    uncertain: 'OCR Uncertain',
    damaged: 'OCR Damaged',
  }

  return (
    <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase tracking-tight ${styles[quality]}`}>
      {labels[quality]}
    </span>
  )
}

const StarRating = ({ rating }: { rating: number }) => {
  return (
    <div className="flex text-yellow-400">
      {[...Array(3)].map((_, i) => (
        <span key={i} className={i < rating ? 'opacity-100' : 'opacity-20'}>
          ★
        </span>
      ))}
    </div>
  )
}

export default function ModuleMapPage() {
  const params = useParams()
  const router = useRouter()
  const bookId = params.bookId as string

  const [status, setStatus] = useState<ExtractionStatus>('pending')
  const [data, setData] = useState<ModuleMapData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [expandedModules, setExpandedModules] = useState<Set<number>>(new Set())
  const [isConfirming, setIsConfirming] = useState(false)
  const [isRegenerating, setIsRegenerating] = useState(false)

  // Polling logic
  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/books/${bookId}/status`)
      const result = await res.json()
      if (result.success) {
        const currentStatus = result.data.kp_extraction_status
        setStatus(currentStatus)
        if (currentStatus === 'completed') {
          fetchModuleMap()
        }
      }
    } catch {
      // silently ignore polling errors
    }
  }, [bookId])

  const fetchModuleMap = async () => {
    try {
      const res = await fetch(`/api/books/${bookId}/module-map`)
      const result = await res.json()
      if (result.success) {
        setData(result.data)
        // Default expand the first module
        if (result.data.modules.length > 0) {
          setExpandedModules(new Set([result.data.modules[0].id]))
        }
      } else {
        setError(result.error || 'Failed to fetch module map')
      }
    } catch {
      setError('Failed to fetch module map')
    }
  }

  useEffect(() => {
    if (status === 'pending' || status === 'processing') {
      const interval = setInterval(fetchStatus, 3000)
      fetchStatus() // Initial check
      return () => clearInterval(interval)
    }
  }, [status, fetchStatus])

  // Actions
  const handleConfirm = async () => {
    if (isConfirming) return
    setIsConfirming(true)
    try {
      const res = await fetch(`/api/books/${bookId}/module-map/confirm`, { method: 'POST' })
      const result = await res.json()
      if (result.success && result.data.firstModuleId) {
        router.push(`/books/${bookId}/modules/${result.data.firstModuleId}`)
      }
    } catch {
      setIsConfirming(false)
    }
  }

  const handleRegenerate = async () => {
    if (isRegenerating) return
    setIsRegenerating(true)
    try {
      const res = await fetch(`/api/books/${bookId}/module-map/regenerate`, { method: 'POST' })
      const result = await res.json()
      if (result.success) {
        setStatus('processing')
        setData(null)
      }
    } catch {
      // ignore
    } finally {
      setIsRegenerating(false)
    }
  }

  const toggleModule = (id: number) => {
    const next = new Set(expandedModules)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setExpandedModules(next)
  }

  // Stats
  const kpStats = useMemo(() => {
    if (!data) return {}
    const stats: Record<KPType, number> = {
      position: 0,
      calculation: 0,
      c1_judgment: 0,
      c2_evaluation: 0,
      definition: 0,
    }
    data.modules.forEach(m => {
      m.knowledge_points.forEach(kp => {
        stats[kp.type]++
      })
    })
    return stats
  }, [data])

  if (status === 'pending' || status === 'processing') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-slate-600 font-medium">正在提取知识点...</p>
        <p className="text-slate-400 text-sm mt-2">这可能需要几分钟，请稍候</p>
      </div>
    )
  }

  if (status === 'failed' || (status === 'completed' && error)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 p-6">
        <div className="bg-white p-8 rounded-xl shadow-sm max-w-md w-full text-center border border-red-100">
          <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">⚠️</div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">提取失败</h2>
          <p className="text-slate-600 mb-6">{error || '提取知识点时发生错误，请重试。'}</p>
          <button 
            onClick={handleRegenerate}
            disabled={isRegenerating}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition-colors disabled:opacity-50"
          >
            {isRegenerating ? '请稍候...' : '重新生成'}
          </button>
        </div>
      </div>
    )
  }

  if (!data) return null

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <Link href={`/books/${bookId}/reader`} className="text-sm text-blue-600 hover:underline mb-1 inline-block">← 返回阅读器</Link>
            <h1 className="text-xl font-bold text-slate-900 truncate max-w-md">{data.book_title}</h1>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
            <span className="text-sm font-medium text-slate-600">模块地图已就绪</span>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Stats Bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
            <div className="text-sm text-slate-500 mb-1">总模块</div>
            <div className="text-2xl font-bold text-slate-900">{data.total_module_count}</div>
          </div>
          <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
            <div className="text-sm text-slate-500 mb-1">总知识点 (KP)</div>
            <div className="text-2xl font-bold text-slate-900">{data.total_kp_count}</div>
          </div>
          <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 col-span-2">
            <div className="text-sm text-slate-500 mb-2">KP 类型分布</div>
            <div className="flex flex-wrap gap-2">
              {(Object.entries(kpStats) as [KPType, number][]).map(([type, count]) => (
                <div key={type} className="flex items-center gap-1.5">
                  <KPTypeBadge type={type} />
                  <span className="text-xs font-bold text-slate-600">{count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Module List */}
        <div className="space-y-4">
          {data.modules.map((module) => (
            <div key={module.id} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <button 
                onClick={() => toggleModule(module.id)}
                className="w-full px-6 py-5 flex items-center justify-between text-left hover:bg-slate-50 transition-colors"
              >
                <div className="flex-1 min-w-0 pr-4">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="bg-slate-100 text-slate-600 text-xs font-bold px-2 py-0.5 rounded">MODULE {module.order_index}</span>
                    <span className="text-xs text-slate-400">P{module.page_start} - P{module.page_end}</span>
                    <StatusBadge status={module.learning_status} />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 truncate">{module.title}</h3>
                  <p className="text-sm text-slate-500 mt-1 line-clamp-1">{module.summary}</p>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-right hidden sm:block">
                    <div className="text-sm font-bold text-slate-900">{module.kp_count} KP</div>
                    <div className="text-xs text-slate-500">{module.cluster_count} 聚类</div>
                  </div>
                  <div className={`transition-transform duration-200 ${expandedModules.has(module.id) ? 'rotate-180' : ''}`}>
                    <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </button>

              {expandedModules.has(module.id) && (
                <div className="px-6 pb-6 pt-2 border-t border-slate-100 bg-slate-50/30">
                  <div className="space-y-6 mt-4">
                    {module.clusters.map((cluster) => (
                      <div key={cluster.id} className="relative pl-4 border-l-2 border-slate-200">
                        <div className="absolute -left-1 top-0 w-2 h-2 bg-slate-300 rounded-full"></div>
                        <h4 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
                          {cluster.name}
                          <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-normal uppercase">{cluster.kp_count} KP</span>
                        </h4>
                        <div className="space-y-3">
                          {module.knowledge_points
                            .filter(kp => kp.cluster_name === cluster.name)
                            .map(kp => (
                              <div key={kp.id} className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
                                <div className="flex items-start justify-between mb-2">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-mono font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">{kp.kp_code}</span>
                                    <KPTypeBadge type={kp.type} />
                                  </div>
                                  <StarRating rating={kp.importance} />
                                </div>
                                <p className="text-sm text-slate-700 leading-relaxed mb-2">{kp.description}</p>
                                <OCRQualityBadge quality={kp.ocr_quality} />
                              </div>
                            ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </main>

      {/* Sticky Bottom Action Bar */}
      <footer className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-md border-t border-slate-200 p-4 z-20">
        <div className="max-w-4xl mx-auto flex gap-4">
          <button 
            onClick={handleRegenerate}
            disabled={isRegenerating || isConfirming}
            className="flex-1 sm:flex-none px-6 py-3 border border-slate-300 text-slate-700 font-semibold rounded-xl hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            {isRegenerating ? '处理中...' : '重新生成'}
          </button>
          <button 
            onClick={handleConfirm}
            disabled={isConfirming || isRegenerating}
            className="flex-[2] sm:flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl shadow-lg shadow-blue-200 transition-all disabled:opacity-50 transform active:scale-[0.98]"
          >
            {isConfirming ? '正在确认...' : '确认模块地图'}
          </button>
        </div>
      </footer>
    </div>
  )
}
