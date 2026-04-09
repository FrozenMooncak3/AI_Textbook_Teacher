'use client'

import { cn } from '@/lib/utils'
import AmberButton from './AmberButton'

interface FeedbackPanelProps {
  isCorrect: boolean
  explanation: string
  onNext: () => void
  variant?: 'qa' | 'review'
  nextLabel?: string
  className?: string
}

export default function FeedbackPanel({ isCorrect, explanation, onNext, variant = 'qa', nextLabel = '下一题 →', className }: FeedbackPanelProps) {
  if (variant === 'review') {
    const borderColor = isCorrect ? 'border-emerald-600' : 'border-error'
    const bgColor = isCorrect ? 'bg-emerald-50' : 'bg-red-50'   
    const icon = isCorrect ? 'check_circle' : 'cancel'
    const iconColor = isCorrect ? 'text-emerald-600' : 'text-error'
    return (
      <div
        data-slot="feedback-panel"
        className={cn(
          "border-l-[6px] p-8 shadow-feedback rounded-2xl",
          bgColor,
          borderColor,
          className
        )}
      >
        <div className="flex items-start gap-4">
          <span className={cn("material-symbols-outlined text-2xl", iconColor)} style={{ fontVariationSettings: "'FILL' 1" }}>{icon}</span>
          <div className="flex-1">
            <h3 className="font-headline font-bold text-lg text-on-surface mb-2">{isCorrect ? '回答正确！' : '回答有误'}</h3>   
            <p className="text-on-surface-variant text-sm leading-relaxed">{explanation}</p>
          </div>
          <button onClick={onNext} className="bg-indigo-600 text-white font-bold py-3 px-6 rounded-full hover:bg-indigo-700 transition-colors shrink-0">
            {nextLabel}
          </button>
        </div>
      </div>
    )
  }

  const borderColor = isCorrect ? 'border-emerald-500' : 'border-error'
  const bgColor = isCorrect ? 'bg-emerald-50' : 'bg-red-50'     
  return (
    <div
      data-slot="feedback-panel"
      className={cn(
        "absolute bottom-0 left-0 w-full h-[40%] border-t-4 shadow-feedback z-30 p-10 flex flex-col",
        bgColor,
        borderColor,
        className
      )}
    >
      <div className="flex items-center gap-3 mb-4">
        <span className={cn("material-symbols-outlined text-2xl", isCorrect ? 'text-emerald-600' : 'text-error')} style={{ fontVariationSettings: "'FILL' 1" }}>
          {isCorrect ? 'check_circle' : 'cancel'}
        </span>
        <h3 className="font-headline font-bold text-xl">{isCorrect ? '回答正确！' : '回答有误'}</h3>
      </div>
      <p className="text-on-surface-variant leading-relaxed flex-1 overflow-y-auto">{explanation}</p>
      <div className="mt-4 flex justify-end">
        <AmberButton onClick={onNext}>{nextLabel}</AmberButton> 
      </div>
    </div>
  )
}
