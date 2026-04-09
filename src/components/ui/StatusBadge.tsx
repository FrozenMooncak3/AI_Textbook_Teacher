import { cn } from '@/lib/utils'

interface StatusBadgeProps {
  status: 'completed' | 'in-progress' | 'not-started' | 'locked'
  className?: string
}

const config = {
  'completed': { label: '已完成', classes: 'bg-emerald-100 text-emerald-700' },
  'in-progress': { label: '进行中', classes: 'bg-primary-container/20 text-primary' },
  'not-started': { label: '未开始', classes: 'bg-surface-container text-on-surface-variant' },
  'locked': { label: '未解锁', classes: 'bg-surface-container text-on-surface-variant/50' },
}

export default function StatusBadge({ status, className }: StatusBadgeProps) {
  const { label, classes } = config[status]
  return (
    <span
      data-slot="status-badge"
      className={cn(
        "px-4 py-1.5 rounded-full text-xs font-bold",
        classes,
        className
      )}
    >
      {label}
    </span>
  )
}
