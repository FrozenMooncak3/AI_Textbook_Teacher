'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import LoadingState from '@/components/LoadingState'

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
          <div className="w-20 h-20 bg-error-container/10 text-error rounded-full flex items-center justify-center mx-auto mb-8 text-4xl shadow-sm">
            <span className="material-symbols-outlined text-4xl" style={{ fontVariationSettings: "'FILL' 1" }}>error</span>
          </div>
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
  const getPct = (val: number) => totalMastery > 0 ? (val / totalMastery) * 100 : 0

  return (
    <div className="min-h-screen bg-surface-container-low flex items-center justify-center p-6">
      <div className="bg-surface-container-lowest rounded-[32px] p-8 md:p-12 shadow-[0_40px_80px_-30px_rgba(167,72,0,0.08)] max-w-[640px] w-full border border-outline-variant/10">
        <div className="flex flex-col items-center text-center mb-10">
          <div className="w-20 h-20 amber-glow rounded-3xl flex items-center justify-center mb-6 shadow-lg shadow-orange-900/20">
            <span className="material-symbols-outlined text-4xl text-white">refresh</span>
          </div>
          <div className="flex items-center gap-2 mb-2">
            <span className="bg-primary/10 text-primary px-3 py-1 rounded-full text-[10px] font-black font-headline uppercase tracking-widest">
              第 {data.reviewRound} 轮复习
            </span>
            <span className="text-on-surface-variant/30 text-xs font-black">·</span>
            <span className="text-on-surface-variant text-xs font-bold font-headline uppercase tracking-widest">
              间隔 {data.intervalDays} 天
            </span>
          </div>
          <h2 className="text-3xl font-black text-on-surface font-headline tracking-tight">
            {data.moduleName}
          </h2>
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-2 gap-4 mb-10">
          <div className="bg-surface-container-low p-5 rounded-2xl border border-outline-variant/10">
            <p className="text-[10px] font-black text-on-surface-variant/50 uppercase tracking-widest mb-1">预计题目</p>
            <p className="text-2xl font-black text-on-surface font-headline">{data.estimatedQuestions}</p>
          </div>
          <div className="bg-surface-container-low p-5 rounded-2xl border border-outline-variant/10">
            <p className="text-[10px] font-black text-on-surface-variant/50 uppercase tracking-widest mb-1">预计时间</p>
            <p className="text-2xl font-black text-on-surface font-headline">~{Math.round(data.estimatedQuestions * 1.5)} 分钟</p>
          </div>
          <div className="bg-surface-container-low p-5 rounded-2xl border border-outline-variant/10">
            <p className="text-[10px] font-black text-on-surface-variant/50 uppercase tracking-widest mb-1">上次复习</p>
            <p className="text-2xl font-black text-on-surface font-headline">
              {data.lastReviewDaysAgo !== null ? `${data.lastReviewDaysAgo} 天前` : '首次复习'}
            </p>
          </div>
          <div className="bg-surface-container-low p-5 rounded-2xl border border-outline-variant/10">
            <p className="text-[10px] font-black text-on-surface-variant/50 uppercase tracking-widest mb-1">复习计划</p>
            <p className="text-base font-black text-primary font-headline mt-1">第 {data.intervalDays} 天</p>
            <p className="text-[10px] font-medium text-on-surface-variant opacity-50 uppercase tracking-tighter">of 3/7/15/30/60</p>
          </div>
        </div>

        {/* Mastery Distribution */}
        <div className="mb-12">
          <h3 className="text-xs font-black text-on-surface font-headline uppercase tracking-widest mb-6 flex items-center gap-2">
            <span className="material-symbols-outlined text-sm">bar_chart</span>
            知识掌握分布
          </h3>
          <div className="space-y-5">
            {/* Mastered */}
            <div>
              <div className="flex justify-between items-end mb-2">
                <span className="text-xs font-bold text-emerald-700">掌握牢固</span>
                <span className="text-xs font-black font-headline text-emerald-800">{data.masteryDistribution.mastered} 知识点 ({Math.round(getPct(data.masteryDistribution.mastered))}%)</span>
              </div>
              <div className="w-full h-2.5 bg-emerald-100 rounded-full overflow-hidden shadow-inner">
                <div className="h-full bg-emerald-500 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.4)] transition-all duration-1000 ease-out" style={{ width: `${getPct(data.masteryDistribution.mastered)}%` }} />
              </div>
            </div>
            {/* Improving */}
            <div>
              <div className="flex justify-between items-end mb-2">
                <span className="text-xs font-bold text-orange-700">正在提升</span>
                <span className="text-xs font-black font-headline text-orange-800">{data.masteryDistribution.improving} 知识点 ({Math.round(getPct(data.masteryDistribution.improving))}%)</span>
              </div>
              <div className="w-full h-2.5 bg-orange-100 rounded-full overflow-hidden shadow-inner">
                <div className="h-full bg-primary-fixed-dim rounded-full transition-all duration-1000 ease-out" style={{ width: `${getPct(data.masteryDistribution.improving)}%` }} />
              </div>
            </div>
            {/* Weak */}
            <div>
              <div className="flex justify-between items-end mb-2">
                <span className="text-xs font-bold text-primary">薄弱环节</span>
                <span className="text-xs font-black font-headline text-primary-dim">{data.masteryDistribution.weak} 知识点 ({Math.round(getPct(data.masteryDistribution.weak))}%)</span>
              </div>
              <div className="w-full h-2.5 bg-orange-100 rounded-full overflow-hidden shadow-inner">
                <div className="h-full bg-primary rounded-full transition-all duration-1000 ease-out" style={{ width: `${getPct(data.masteryDistribution.weak)}%` }} />
              </div>
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div className="flex flex-col gap-4">
          <button
            onClick={onStart}
            className="w-full amber-glow text-on-primary font-black font-headline text-lg py-5 rounded-full shadow-xl shadow-orange-900/20 active:scale-95 transition-all flex items-center justify-center gap-3"
          >
            <span>开始本次复习</span>
            <span className="material-symbols-outlined">arrow_forward</span>
          </button>
          <Link
            href={`/books/${bookId}`}
            className="text-center text-on-surface-variant font-bold text-sm py-3 hover:text-on-surface transition-colors"
          >
            返回教材中心
          </Link>
        </div>
      </div>
    </div>
  )
}
