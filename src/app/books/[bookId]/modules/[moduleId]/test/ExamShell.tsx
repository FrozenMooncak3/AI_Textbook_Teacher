'use client'

import React from 'react'
import Link from 'next/link'

interface ExamShellProps {
  moduleTitle: string
  bookId: number
  totalQuestions: number
  answeredCount: number
  currentIndex: number
  children: React.ReactNode
  footer?: React.ReactNode
  onSubmit: () => void
  onExit: () => void
  questionStatuses?: Array<'answered' | 'current' | 'flagged' | 'unanswered'>
}

export default function ExamShell({
  moduleTitle,
  bookId,
  totalQuestions,
  answeredCount,
  currentIndex,
  children,
  footer,
  onSubmit,
  onExit,
  questionStatuses = [],
}: ExamShellProps) {
  return (
    <div className="min-h-screen bg-surface-container-low flex flex-col">
      {/* Top AppBar */}
      <header className="bg-amber-50/80 backdrop-blur-xl shadow-[0_40px_40px_0_rgba(167,72,0,0.06)] fixed top-0 w-full z-50 flex justify-between items-center px-6 py-4">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold text-primary font-headline tracking-tight max-w-[200px] truncate md:max-w-none">
            {moduleTitle}
          </h1>
          <span className="bg-primary-container text-on-primary-container px-3 py-1 rounded-full text-[10px] font-black font-label uppercase tracking-wider shrink-0">
            Exam Mode
          </span>
        </div>

        {/* Progress Tracker (Desktop) */}
        <div className="hidden md:flex flex-col items-center gap-2 flex-1 max-w-md px-12">
          <div className="flex gap-1.5 w-full h-1.5">
            {Array.from({ length: totalQuestions }).map((_, i) => {
              const status = questionStatuses[i] || 'unanswered'
              let colorClass = 'bg-surface-variant'
              let shadowClass = ''

              if (status === 'current') {
                colorClass = 'bg-tertiary-fixed'
                shadowClass = 'shadow-[0_0_8px_rgba(254,187,40,0.6)]'
              } else if (status === 'answered') {
                colorClass = 'bg-primary-fixed-dim'
              } else if (status === 'flagged') {
                colorClass = 'bg-tertiary-fixed'
              }

              return (
                <div 
                  key={i} 
                  className={`flex-1 rounded-full transition-all duration-500 ${colorClass} ${shadowClass}`} 
                />
              )
            })}
          </div>
        </div>

        <div className="flex items-center gap-4 md:gap-8">
          <div className="flex items-center gap-2 font-label font-bold text-on-surface-variant shrink-0">
            <span className="material-symbols-outlined text-primary text-xl">timer</span>
            <span className="text-xs md:text-sm whitespace-nowrap">第 {currentIndex + 1} / {totalQuestions} 题</span>
          </div>
          <button 
            onClick={onExit}
            className="flex items-center gap-2 px-4 py-2 text-error font-bold hover:bg-error-container/10 transition-colors rounded-full text-sm shrink-0"
          >
            <span className="material-symbols-outlined text-sm">logout</span>
            <span className="hidden sm:inline">退出测试</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 pt-32 pb-40 px-6 overflow-y-auto">
        <div className="max-w-[800px] mx-auto">
          {children}
        </div>
      </main>

      {/* Footer */}
      {footer}
    </div>
  )
}
