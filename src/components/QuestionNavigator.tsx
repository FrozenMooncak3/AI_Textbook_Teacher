'use client'

import React from 'react'

interface QuestionNavigatorProps {
  questions: Array<{ id: number }>
  currentIndex: number
  answers: Record<number, string>
  flags: Set<number>
  onNavigate: (index: number) => void
  onReview: () => void
}

export default function QuestionNavigator({
  questions,
  currentIndex,
  answers,
  flags,
  onNavigate,
  onReview,
}: QuestionNavigatorProps) {
  return (
    <nav className="bg-white/90 backdrop-blur-2xl shadow-[0_-8px_40px_rgba(167,72,0,0.08)] fixed bottom-0 left-0 w-full z-50 flex justify-around items-center px-4 py-6 rounded-t-[32px]">
      {/* Previous Button */}
      <button
        onClick={() => currentIndex > 0 && onNavigate(currentIndex - 1)}
        disabled={currentIndex === 0}
        className={`flex flex-col items-center justify-center transition-colors ${
          currentIndex === 0 ? 'text-surface-variant cursor-not-allowed' : 'text-on-surface-variant hover:text-primary'
        }`}
      >
        <span className="material-symbols-outlined text-2xl">arrow_back</span>
        <span className="font-label text-[10px] font-bold uppercase tracking-widest mt-1">上一题</span>
      </button>

      {/* Center Navigator */}
      <div className="flex items-center gap-3 bg-surface-container px-6 py-2 rounded-full overflow-x-auto max-w-[60vw] scrollbar-hide">
        {questions.map((q, index) => {
          const isCurrent = index === currentIndex
          const isAnswered = !!answers[q.id]?.trim()
          const isFlagged = flags.has(q.id)

          if (isCurrent) {
            return (
              <div
                key={q.id}
                className="flex flex-col items-center justify-center bg-orange-100 text-orange-800 rounded-full px-6 py-2 ring-2 ring-primary transition-transform translate-y-[-2px] shrink-0"
              >
                <span className="font-bold text-sm">{index + 1}</span>
                <span className="font-label text-[8px] font-black uppercase tracking-tighter">当前</span>
              </div>
            )
          }

          return (
            <button
              key={q.id}
              onClick={() => onNavigate(index)}
              className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold relative shrink-0 transition-all active:scale-90 ${
                isAnswered
                  ? 'bg-primary-fixed-dim text-white'
                  : isFlagged
                  ? 'bg-tertiary-fixed text-on-tertiary-fixed'
                  : 'bg-surface-container-highest text-on-surface-variant hover:bg-surface-variant'
              }`}
            >
              {index + 1}
              {isFlagged && (
                <span 
                  className="absolute -top-1 -right-1 material-symbols-outlined text-[16px] text-primary"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  flag
                </span>
              )}
            </button>
          )
        })}

        {/* Review Button */}
        <button
          onClick={onReview}
          className="ml-2 px-4 py-2 bg-surface-container-lowest border border-outline-variant rounded-full text-xs font-bold font-label text-on-surface-variant hover:text-primary hover:border-primary transition-all whitespace-nowrap shadow-sm active:scale-95"
        >
          检查页
        </button>
      </div>

      {/* Next Button */}
      <button
        onClick={() => currentIndex < questions.length - 1 && onNavigate(currentIndex + 1)}
        disabled={currentIndex === questions.length - 1}
        className={`flex flex-col items-center justify-center transition-colors ${
          currentIndex === questions.length - 1 ? 'text-surface-variant cursor-not-allowed' : 'text-on-surface-variant hover:text-primary'
        }`}
      >
        <span className="material-symbols-outlined text-2xl">arrow_forward</span>
        <span className="font-label text-[10px] font-bold uppercase tracking-widest mt-1">下一题</span>
      </button>
    </nav>
  )
}
