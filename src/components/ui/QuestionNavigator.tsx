'use client'

import { cn } from '@/lib/utils'

interface QuestionStatus { status: 'answered' | 'current' | 'unanswered' | 'flagged' }

interface QuestionNavigatorProps {
  questions: QuestionStatus[]
  onSelect: (index: number) => void
  onPrev: () => void
  onNext: () => void
  className?: string
}

const dotStyles = {
  answered: 'bg-primary-fixed-dim text-white',
  current: 'bg-surface-container-lowest ring-2 ring-primary text-primary font-bold',
  unanswered: 'bg-surface-container text-on-surface-variant',   
  flagged: 'bg-tertiary-container text-on-tertiary-container',  
}

export default function QuestionNavigator({ questions, onSelect, onPrev, onNext, className }: QuestionNavigatorProps) {
  return (
    <div
      data-slot="question-navigator"
      className={cn("fixed bottom-0 left-0 w-full bg-white/90 backdrop-blur-2xl shadow-bottom-nav rounded-t-[32px] z-50 px-8 py-4", className)}
    >
      <div className="flex items-center justify-between max-w-3xl mx-auto">
        <button onClick={onPrev} className="flex items-center gap-2 text-on-surface-variant hover:text-primary transition-colors">
          <span className="material-symbols-outlined">arrow_back</span>
          <span className="text-sm">上一题</span>
        </button>

        <div className="flex items-center gap-2">
          {questions.map((q, i) => (
            <button
              key={i}
              onClick={() => onSelect(i)}
              className={cn("w-9 h-9 rounded-full text-xs flex items-center justify-center transition-all", dotStyles[q.status])}
            >
              {q.status === 'flagged' ? (
                <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>flag</span>   
              ) : (
                i + 1
              )}
            </button>
          ))}
        </div>

        <button onClick={onNext} className="flex items-center gap-2 text-on-surface-variant hover:text-primary transition-colors">
          <span className="text-sm">下一题</span>
          <span className="material-symbols-outlined">arrow_forward</span>
        </button>
      </div>
    </div>
  )
}
