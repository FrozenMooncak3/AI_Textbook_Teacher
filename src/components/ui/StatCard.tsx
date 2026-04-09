'use client'

import { cn } from '@/lib/utils'

interface StatCardProps {
  value: string | number
  label: string
  icon?: string
  onClick?: () => void
  className?: string
}

export default function StatCard({ value, label, icon, onClick, className }: StatCardProps) {
  const Wrapper = onClick ? 'button' : 'div'
  return (
    <Wrapper
      data-slot="stat-card"
      onClick={onClick}
      className={cn(
        "flex items-center gap-4 text-left",
        onClick ? 'cursor-pointer hover:bg-surface-container-low rounded-2xl p-4 transition-colors' : '',
        className
      )}
    >
      {icon && (
        <span className="material-symbols-outlined text-3xl text-tertiary" style={{ fontVariationSettings: "'FILL' 1" }}>
          {icon}
        </span>
      )}
      <div>
        <div className="text-5xl font-black font-headline text-tertiary">{value}</div>
        <div className="text-sm text-on-surface-variant font-medium">{label}</div>
      </div>
    </Wrapper>
  )
}
