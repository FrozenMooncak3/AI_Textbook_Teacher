import { cn } from '@/lib/utils'

interface ProgressBarProps {
  value: number
  color?: 'primary' | 'emerald' | 'blue'
  className?: string
}

const colorClasses = {
  primary: 'bg-primary',
  emerald: 'bg-emerald-500',
  blue: 'bg-blue-500',
}

export default function ProgressBar({ value, color = 'primary', className }: ProgressBarProps) {
  return (
    <div
      data-slot="progress-bar"
      className={cn("h-2 w-full bg-surface-container rounded-full overflow-hidden", className)}
    >
      <div
        className={cn("h-full rounded-full transition-all", colorClasses[color])}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  )
}
