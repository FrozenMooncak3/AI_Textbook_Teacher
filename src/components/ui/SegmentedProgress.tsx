import { cn } from '@/lib/utils'

type SegmentStatus = 'correct' | 'incorrect' | 'answered' | 'unanswered' | 'current'

interface SegmentedProgressProps {
  segments: { status: SegmentStatus }[]
  className?: string
}

const statusColors: Record<SegmentStatus, string> = {
  correct: 'bg-emerald-500',
  incorrect: 'bg-error',
  answered: 'bg-primary',
  unanswered: 'bg-surface-container',
  current: 'bg-primary-fixed-dim',
}

export default function SegmentedProgress({ segments, className }: SegmentedProgressProps) {
  return (
    <div
      data-slot="segmented-progress"
      className={cn("flex gap-1.5 h-1.5", className)}
    >
      {segments.map((seg, i) => (
        <div
          key={i}
          className={cn("flex-1 rounded-full", statusColors[seg.status])}
        />
      ))}
    </div>
  )
}
