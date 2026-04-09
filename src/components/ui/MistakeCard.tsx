'use client'

import { cn } from '@/lib/utils'
import AIInsightBox from './AIInsightBox'
import Badge from './Badge'

interface MistakeData {
  id: number
  question: string
  yourAnswer: string
  correctAnswer: string
  errorType: string
  source: string
  module: string
  diagnosis: string
  loggedAt: string
}

interface MistakeCardProps {
  mistake: MistakeData
  expanded: boolean
  onToggle: () => void
  onResolve: () => void
  onPractice: () => void
  className?: string
}

export default function MistakeCard({ mistake, expanded, onToggle, onResolve, onPractice, className }: MistakeCardProps) {      
  return (
    <div
      data-slot="mistake-card"
      className={cn(
        "bg-surface-container-lowest rounded-3xl border-l-[6px] border-error transition-shadow",
        expanded ? 'p-8 shadow-mistake' : 'p-6 shadow-card hover:shadow-card-lg cursor-pointer',
        className
      )}
      onClick={!expanded ? onToggle : undefined}
    >
      <div className="flex items-start justify-between">        
        <div className="flex items-center gap-2 flex-wrap">     
          <Badge variant="error">{mistake.errorType}</Badge>    
          <Badge variant="primary">{mistake.source}</Badge>     
          <span className="text-xs text-on-surface-variant">{mistake.module}</span>
        </div>
        <button onClick={onToggle} className="text-on-surface-variant hover:text-primary">
          <span className="material-symbols-outlined">{expanded ? 'expand_less' : 'expand_more'}</span>
        </button>
      </div>

      <h3 className="font-headline font-bold text-on-surface mt-3 line-clamp-2">{mistake.question}</h3>
      <p className="text-xs text-on-surface-variant mt-1">{mistake.loggedAt}</p>

      {expanded && (
        <>
          <div className="grid grid-cols-2 gap-6 mt-6">
            <div className="bg-error/5 rounded-2xl p-5">        
              <p className="text-xs font-bold text-error mb-2 uppercase">❌ 你的答案</p>
              <p className="text-sm text-on-surface">{mistake.yourAnswer}</p>
            </div>
            <div className="bg-emerald-50 rounded-2xl p-5">     
              <p className="text-xs font-bold text-emerald-700 mb-2 uppercase">✅ 正确答案</p>
              <p className="text-sm text-on-surface">{mistake.correctAnswer}</p>
            </div>
          </div>

          <div className="mt-6">
            <AIInsightBox title="AI 诊断" content={mistake.diagnosis} />
          </div>

          <div className="mt-6 flex items-center justify-center gap-4">
            <button onClick={onResolve} className="flex items-center gap-2 px-6 py-3 rounded-full border border-outline-variant text-on-surface-variant hover:bg-surface-container transition-colors">
              <span className="material-symbols-outlined text-lg">check_circle</span>
              标记已解决
            </button>
            <button onClick={onPractice} className="flex items-center gap-2 px-6 py-3 rounded-full border border-primary text-primary hover:bg-primary/5 transition-colors">
              <span className="material-symbols-outlined text-lg">exercise</span>
              练习类似题
            </button>
          </div>
        </>
      )}
    </div>
  )
}
