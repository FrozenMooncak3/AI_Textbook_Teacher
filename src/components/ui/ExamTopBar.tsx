'use client'

import { cn } from '@/lib/utils'
import SegmentedProgress from './SegmentedProgress'

interface ExamTopBarProps {
  moduleTitle: string
  currentQuestion: number
  totalQuestions: number
  segments: { status: 'correct' | 'incorrect' | 'answered' | 'unanswered' | 'current' }[]
  onExit: () => void
  className?: string
}

export default function ExamTopBar({ moduleTitle, currentQuestion, totalQuestions, segments, onExit, className }: ExamTopBarProps) {
  return (
    <header
      data-slot="exam-top-bar"
      className={cn("fixed top-0 w-full z-50 bg-amber-50/80 backdrop-blur-xl shadow-header", className)}
    >
      <div className="px-8 py-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <h1 className="font-headline font-bold text-on-surface">{moduleTitle}</h1>
            <span className="bg-primary-container text-on-primary-container px-3 py-1 rounded-full text-xs font-bold font-label uppercase tracking-wider">考试模式</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-on-surface-variant">  
              <span className="material-symbols-outlined text-sm align-middle mr-1" style={{ fontVariationSettings: "'FILL' 1" }}>quiz</span>
              第 {currentQuestion} / {totalQuestions} 题        
            </span>
            <button onClick={onExit} className="text-error text-sm font-medium flex items-center gap-1 hover:underline">        
              <span className="material-symbols-outlined text-sm">warning</span>
              退出测试
            </button>
          </div>
        </div>
        <SegmentedProgress segments={segments} />
      </div>
    </header>
  )
}
