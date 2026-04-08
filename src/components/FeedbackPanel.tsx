'use client'

import React from 'react'
import AIResponse from '@/components/AIResponse'

interface FeedbackPanelProps {
  visible: boolean
  isCorrect: boolean
  score?: number
  content: string
  onNext: () => void
  nextLabel?: string
}

export default function FeedbackPanel({
  visible,
  isCorrect,
  score,
  content,
  onNext,
  nextLabel = '下一题'
}: FeedbackPanelProps) {
  return (
    <div
      className={`
        transform transition-transform duration-300 ease-out
        ${visible ? 'translate-y-0' : 'translate-y-full'}
      `}
    >
      <div
        className={`
          max-w-7xl mx-auto bg-surface-container-lowest rounded-t-3xl shadow-[0_-8px_40px_rgba(167,72,0,0.12)] border-t-4
          ${isCorrect ? 'border-emerald-500' : 'border-error'}
        `}
      >
        <div className="px-6 py-6 md:px-10 lg:py-8 max-h-[45vh] flex flex-col">
          {/* Header Row */}
          <div className="flex items-center justify-between mb-6 shrink-0">
            <div className="flex items-center gap-3">
              <span className={`material-symbols-outlined text-3xl font-variation-fill ${isCorrect ? 'text-emerald-600' : 'text-error'}`} style={{ fontVariationSettings: "'FILL' 1" }}>
                {isCorrect ? 'check_circle' : 'cancel'}
              </span>
              <h2 className={`text-2xl font-bold font-headline ${isCorrect ? 'text-emerald-800' : 'text-error'}`}>
                {isCorrect ? '正确!' : '再想想'}
              </h2>
            </div>
            {score !== undefined && (
              <div className="bg-primary px-4 py-1.5 rounded-full text-on-primary font-bold font-headline shadow-sm shadow-orange-900/10">
                得分: {score}
              </div>
            )}
          </div>

          {/* AI Feedback Content */}
          <div className="flex-1 overflow-y-auto mb-8 pr-2 custom-scrollbar">
            <AIResponse content={content} />
          </div>

          {/* Footer Action */}
          <div className="flex justify-end shrink-0">
            <button
              onClick={onNext}
              className="w-full md:w-auto px-10 py-4 amber-glow text-on-primary rounded-full font-bold shadow-xl shadow-orange-900/20 active:scale-95 transition-transform font-headline tracking-wide"
            >
              {nextLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
