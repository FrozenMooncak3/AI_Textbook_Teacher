'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import LoadingState from '@/components/LoadingState'
import SplitPanel from '@/components/ui/SplitPanel'
import KnowledgePointList from '@/components/ui/KnowledgePointList'
import BriefingCard from '@/components/ui/BriefingCard'

interface ReviewBriefingProps {
  scheduleId: number
  bookId: number
  onStart: () => void
}

interface BriefingData {
  scheduleId: number
  moduleId: number
  moduleName: string
  reviewRound: number
  intervalDays: number
  estimatedQuestions: number
  lastReviewDaysAgo: number | null
  masteryDistribution: { mastered: number; improving: number; weak: number }
  clusters: { id: number; name: string; currentP: number; kpCount: number }[]
}

export default function ReviewBriefing({
  scheduleId,
  bookId,
  onStart,
}: ReviewBriefingProps) {
  const [data, setData] = useState<BriefingData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/review/${scheduleId}/briefing`)
      const json = await res.json()
      if (json.success) {
        setData(json.data)
      } else {
        setError(json.error || '获取复习概览失败')
      }
    } catch (e) {
      setError('无法连接服务器，请检查网络后重试')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [scheduleId])

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-container-low">
        <LoadingState label="正在准备复习概览..." />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-container-low p-6">
        <div className="bg-surface-container-lowest rounded-[32px] border border-error/20 p-12 text-center shadow-xl max-w-md w-full">
          <span className="material-symbols-outlined text-error text-5xl mb-6">error</span>
          <h3 className="text-2xl font-black text-on-surface mb-4 font-headline tracking-tight">获取概览失败</h3>
          <p className="text-on-surface-variant mb-10 leading-relaxed font-medium">{error}</p>
          <button
            onClick={fetchData}
            className="w-full amber-glow text-on-primary font-bold py-4 rounded-full shadow-lg shadow-orange-900/10 active:scale-95 transition-all"
          >
            重试
          </button>
        </div>
      </div>
    )
  }

  const totalMastery = data.masteryDistribution.mastered + data.masteryDistribution.improving + data.masteryDistribution.weak
  const getPct = (val: number) => totalMastery > 0 ? Math.round((val / totalMastery) * 100) : 0

  const kpData = data.clusters.map(c => ({
    name: c.name,
    status: c.currentP > 0.8 ? 'done' as const : c.currentP > 0.4 ? 'active' as const : 'pending' as const,
    progress: `${c.kpCount} 个知识点`
  }))

  const masteryData = [
    { label: '掌握牢固', count: data.masteryDistribution.mastered, percentage: getPct(data.masteryDistribution.mastered), color: 'emerald' as const },
    { label: '正在提升', count: data.masteryDistribution.improving, percentage: getPct(data.masteryDistribution.improving), color: 'blue' as const },
    { label: '薄弱环节', count: data.masteryDistribution.weak, percentage: getPct(data.masteryDistribution.weak), color: 'orange' as const },
  ]

  return (
    <SplitPanel
      sidebar={
        <div className="flex flex-col h-full">
          <div className="p-6 border-b border-outline-variant/10">
            <h2 className="font-headline font-bold text-on-surface truncate">{data.moduleName}</h2>
            <p className="text-xs text-on-surface-variant mt-1 uppercase tracking-widest">知识点集群</p>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            <KnowledgePointList items={kpData} />
          </div>
        </div>
      }
      content={
        <div className="flex items-center justify-center min-h-full p-8">
          <BriefingCard
            questions={data.estimatedQuestions}
            estTime={`~${Math.round(data.estimatedQuestions * 1.5)} 分钟`}
            lastReview={data.lastReviewDaysAgo !== null ? `${data.lastReviewDaysAgo} 天前` : '首次复习'}
            schedule={`第 ${data.intervalDays} 天`}
            round={data.reviewRound}
            masteryData={masteryData}
            onStart={onStart}
          />
        </div>
      }
    />
  )
}
