import { cn } from '@/lib/utils'

interface StatusBadgeProps {
  status: 'completed' | 'in-progress' | 'not-started' | 'locked' | 'processing' | 'readable'
  className?: string
}

const config = {
  'completed': { label: '已完成', classes: 'bg-emerald-100 text-emerald-700' },
  'in-progress': { label: '进行中', classes: 'bg-primary-container/20 text-primary' },
  'not-started': { label: '未开始', classes: 'bg-surface-container text-on-surface-variant' },
  'locked': { label: '未解锁', classes: 'bg-surface-container text-on-surface-variant/50' },
  'processing': { label: '正在识别', classes: 'bg-amber-50 text-amber-700 animate-pulse' },
  'readable': { label: '可以阅读', classes: 'bg-primary/10 text-primary' },
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
