'use client'

import { cn } from '@/lib/utils'
import Badge from '@/components/ui/Badge'

interface BookTOCItemProps {
  id: string
  name: string
  learningStatus: string // 'unstarted' | 'reading' | 'taught' | 'qa_in_progress' | 'qa' | 'notes_generated' | 'testing' | 'completed'
  index: number // 1-based index within group
  guideMode?: boolean
  isRecommended?: boolean
  isBlocked?: boolean
  onClick?: () => void
}

export default function BookTOCItem({
  id,
  name,
  learningStatus,
  index,
  guideMode = false,
  isRecommended = false,
  isBlocked = false,
  onClick
}: BookTOCItemProps) {
  
  // Status dot color
  let dotColor = 'bg-gray-300'
  if (['completed', 'notes_generated', 'testing'].includes(learningStatus)) {
    dotColor = 'bg-emerald-500'
  } else if (['reading', 'qa', 'qa_in_progress', 'taught'].includes(learningStatus)) {
    dotColor = 'bg-amber-500'
  }

  // Badge mapping
  let badgeLabel = '未开始'
  let badgeVariant: 'info' | 'primary' | 'success' | 'warning' | 'error' = 'info'

  if (learningStatus === 'completed') {
    badgeLabel = '已完成'
    badgeVariant = 'success'
  } else if (learningStatus !== 'unstarted') {
    badgeLabel = '学习中'
    badgeVariant = 'primary' // 'primary' in Badge.tsx is 'bg-primary-container text-on-primary-container' (amber-ish)
  }

  return (
    <div
      data-slot="book-toc-item"
      onClick={!isBlocked ? onClick : undefined}
      className={cn(
        "flex items-center gap-3 px-4 py-3 rounded-lg transition-colors group",
        isBlocked ? "opacity-40 cursor-not-allowed" : "cursor-pointer hover:bg-amber-50",
        isRecommended && guideMode && "ring-2 ring-amber-400 ring-inset bg-amber-50/50 shadow-sm"
      )}
    >
      {/* Status Dot */}
      <div className={cn("w-2 h-2 rounded-full shrink-0", dotColor)} />
      
      {/* Index and Name */}
      <div className="flex flex-col flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-on-surface-variant shrink-0">
            {String(index).padStart(2, '0')}
          </span>
          <span className={cn(
            "text-base font-medium text-on-surface truncate",
            isRecommended && guideMode && "text-amber-900 font-bold"
          )}>
            {name}
          </span>
        </div>
      </div>

      {/* Recommendation Pulse */}
      {isRecommended && guideMode && (
        <span className="text-[10px] font-black text-amber-600 uppercase tracking-widest animate-pulse shrink-0">
          推荐
        </span>
      )}

      {/* Badge */}
      <Badge variant={badgeVariant} className="shrink-0 px-2 py-0.5 text-[10px]">
        {badgeLabel}
      </Badge>
    </div>
  )
}
