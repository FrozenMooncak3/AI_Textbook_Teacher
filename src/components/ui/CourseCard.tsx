'use client'

import { cn } from '@/lib/utils'
import ProgressBar from './ProgressBar'

interface CourseCardProps {
  title: string
  progress: number
  lastStudied?: string
  badges?: { label: string; color: string }[]
  gradient?: string
  onClick: () => void
  className?: string
}

export default function CourseCard({ title, progress, lastStudied, badges, gradient = 'from-violet-500 to-purple-600', onClick, className }: CourseCardProps) {
  return (
    <button
      data-slot="course-card"
      onClick={onClick}
      className={cn(
        "bg-surface-container-lowest rounded-3xl shadow-card border border-outline-variant/10 overflow-hidden text-left group hover:-translate-y-1 transition-transform w-full",
        className
      )}
    >
      <div className={cn("h-32 bg-gradient-to-br relative", gradient)}>
        {badges?.map((badge, i) => (
          <span key={i} className={cn(
            "absolute top-3 px-3 py-1 rounded-full text-xs font-bold text-white",
            i === 0 ? 'left-3' : 'right-3',
            badge.color
          )}>
            {badge.label}
          </span>
        ))}
      </div>
      <div className="p-6">
        <h3 className="font-headline font-bold text-on-surface mb-3 line-clamp-2">{title}</h3>
        <div className="mb-2 flex items-center justify-between text-xs text-on-surface-variant">
          <span>完成度</span>
          <span>{progress}%</span>
        </div>
        <ProgressBar value={progress} />
        {lastStudied && (
          <p className="text-xs text-on-surface-variant mt-3 flex items-center gap-1">
            <span className="material-symbols-outlined text-xs">schedule</span>
            {lastStudied}
          </p>
        )}
      </div>
    </button>
  )
}
