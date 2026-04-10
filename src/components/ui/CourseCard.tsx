'use client'

import { cn } from '@/lib/utils'
import ProgressBar from './ProgressBar'

interface CourseCardProps {
  title: string
  progress: number
  lastStudied?: string
  badges?: { label: string; color: string }[]
  gradient?: string
  icon?: string
  hoverStyle?: 'shadow' | 'pedestal'
  onClick: () => void
  className?: string
}

export default function CourseCard({ title, progress, lastStudied, badges, gradient = 'from-[#e8d5b8] to-[#d4c4a8]', icon = 'menu_book', hoverStyle = 'shadow', onClick, className }: CourseCardProps) {
  return (
    <div className="relative group">
      {/* Style B: pedestal — elliptical shadow underneath */}
      {hoverStyle === 'pedestal' && (
        <div className="absolute left-1/2 -translate-x-1/2 -bottom-1 w-3/4 h-3 rounded-[50%] bg-transparent group-hover:bg-black/15 blur-lg transition-all duration-300 group-hover:h-5" />
      )}
      <button
        data-slot="course-card"
        onClick={onClick}
        className={cn(
          "bg-surface-container-lowest rounded-3xl shadow-course border border-outline-variant/10 overflow-hidden text-left w-full relative z-10 transition-all duration-300",
          hoverStyle === 'shadow'
            ? "group-hover:-translate-y-2 group-hover:shadow-course-hover"
            : "group-hover:-translate-y-3",
          className
        )}
      >
        <div className={cn("h-32 bg-gradient-to-br relative overflow-hidden", gradient)}>
          {/* Decorative: enlarged icon as background pattern */}
          <span
            className="material-symbols-outlined absolute -right-3 -top-3 text-[100px] text-black/[0.12] select-none pointer-events-none"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            {icon}
          </span>

          {/* Small icon */}
          <div className="absolute left-5 bottom-4">
            <span className="material-symbols-outlined text-2xl text-white/50" style={{ fontVariationSettings: "'FILL' 1" }}>{icon}</span>
          </div>

          {/* Badges */}
          {badges?.map((badge, i) => (
            <span key={i} className={cn(
              "absolute top-3 px-3 py-1 rounded-full text-xs font-bold text-white",
              i === 0 ? 'right-3' : 'left-3',
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
    </div>
  )
}
