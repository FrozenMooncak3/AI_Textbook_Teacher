'use client'

import { cn } from '@/lib/utils'
import ContentCard from './ContentCard'
import ProgressRing from './ProgressRing'
import AmberButton from './AmberButton'

interface HeroCardProps {
  progress: number
  currentModule: string
  reviewsDue: number
  mistakesCount: number
  onContinue: () => void
  onReview: () => void
  onMistakes: () => void
  className?: string
}

export default function HeroCard({ progress, currentModule, reviewsDue, mistakesCount, onContinue, onReview, onMistakes, className }: HeroCardProps) {
  return (
    <div data-slot="hero-card">
    <ContentCard className={cn("flex items-center gap-10", className)}>
      <ProgressRing value={progress} label="完成" />
      <div className="flex-1">
        <p className="text-xs text-on-surface-variant uppercase tracking-wider font-label">学习路径</p>
        <h2 className="text-2xl font-headline font-bold text-on-surface mt-1">继续学习</h2>
        <p className="text-on-surface-variant mt-1">{currentModule}</p>
        <div className="mt-4">
          <AmberButton onClick={onContinue}>继续学习 →</AmberButton>
        </div>
      </div>
      <div className="flex flex-col gap-4 shrink-0">
        <button onClick={onReview} className="flex items-center gap-3 p-4 rounded-2xl bg-tertiary-container/10 hover:bg-tertiary-container/20 transition-colors">
          <span className="material-symbols-outlined text-2xl text-tertiary" style={{ fontVariationSettings: "'FILL' 1" }}>refresh</span>
          <div>
            <p className="text-2xl font-black font-headline text-tertiary">{reviewsDue}</p>
            <p className="text-xs text-on-surface-variant">待复习</p>
          </div>
        </button>
        <button onClick={onMistakes} className="flex items-center gap-3 p-4 rounded-2xl bg-error/5 hover:bg-error/10 transition-colors">
          <span className="material-symbols-outlined text-2xl text-error" style={{ fontVariationSettings: "'FILL' 1" }}>error</span>
          <div>
            <p className="text-2xl font-black font-headline text-error">{mistakesCount}</p>
            <p className="text-xs text-on-surface-variant">错题</p>
          </div>
        </button>
      </div>
    </ContentCard>
    </div>
  )
}
