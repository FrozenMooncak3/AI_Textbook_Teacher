import { cn } from '@/lib/utils'

interface BadgeProps {
  children: React.ReactNode
  variant?: 'primary' | 'success' | 'error' | 'warning' | 'info'
  className?: string
}

const variantClasses = {
  primary: 'bg-primary-container text-on-primary-container',    
  success: 'bg-emerald-100 text-emerald-700',
  error: 'bg-error/10 text-error',
  warning: 'bg-tertiary-container/20 text-tertiary',
  info: 'bg-surface-container text-on-surface-variant',
}

export default function Badge({ children, variant = 'primary', className }: BadgeProps) {
  return (
    <span
      data-slot="badge"
      className={cn(
        "px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider",
        variantClasses[variant],
        className
      )}
    >
      {children}
    </span>
  )
}
