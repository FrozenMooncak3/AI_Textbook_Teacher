import { cn } from '@/lib/utils'

type StatusType = 'completed' | 'testing' | 'qa' | 'reading' | 'notes_generated' | 'unstarted'

interface StatusBadgeProps {
  status: StatusType | string
  className?: string
}

const statusConfig: Record<string, { label: string; classes: string }> = {
  completed: { label: '已完成', classes: 'bg-emerald-100 text-emerald-800' },
  testing: { label: '测试中', classes: 'bg-orange-100 text-orange-800' },
  qa: { label: 'Q&A中', classes: 'bg-orange-100 text-orange-800' },
  reading: { label: '阅读中', classes: 'bg-orange-100 text-orange-800' },
  notes_generated: { label: '笔记已生成', classes: 'bg-blue-100 text-blue-700' },
  unstarted: { label: '未开始', classes: 'bg-surface-container text-on-surface-variant' },
}

export default function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status] || statusConfig.unstarted

  return (
    <span
      data-slot="status-badge"
      className={cn(
        "px-3 py-1 rounded-full text-xs font-bold",
        config.classes,
        className
      )}
    >
      {config.label}
    </span>
  )
}
