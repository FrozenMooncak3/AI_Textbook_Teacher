'use client'

import { cn } from '@/lib/utils'
import AmberButton from './AmberButton'
import MasteryBars from './MasteryBars'

interface BriefingCardProps {
  questions: number
  estTime: string
  lastReview: string
  schedule: string
  round: number
  masteryData: { label: string; count: number; percentage: number; color: 'emerald' | 'blue' | 'orange' }[]
  onStart: () => void
  className?: string
}

export default function BriefingCard({ questions, estTime, lastReview, schedule, round, masteryData, onStart, className }: BriefingCardProps) {
  return (
    <div
      data-slot="briefing-card"
      className={cn("bg-surface-container-lowest rounded-3xl p-10 shadow-card-lg max-w-lg mx-auto", className)}
    >
      <div className="flex justify-center mb-6">
        <div className="w-20 h-20 rounded-full bg-indigo-50 flex items-center justify-center">
          <span className="material-symbols-outlined text-4xl text-indigo-600" style={{ fontVariationSettings: "'FILL' 1" }}>refresh</span>
        </div>
      </div>

      <h2 className="text-2xl font-headline font-bold text-center text-on-surface">复习 — 第 {round} 轮</h2>

      <div className="grid grid-cols-2 gap-6 mt-8">
        {[
          { label: '题数', value: questions },
          { label: '预计时间', value: estTime },
          { label: '上次复习', value: lastReview },
          { label: '间隔', value: schedule },
        ].map((stat) => (
          <div key={stat.label} className="text-center">        
            <p className="text-xs text-on-surface-variant uppercase tracking-wider">{stat.label}</p>
            <p className="text-xl font-extrabold text-on-surface font-headline mt-1">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-8">
        <MasteryBars data={masteryData} />
      </div>

      <div className="mt-8">
        <AmberButton fullWidth onClick={onStart}>开始复习 →</AmberButton>
      </div>
    </div>
  )
}
