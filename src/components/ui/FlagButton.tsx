'use client'

import { cn } from '@/lib/utils'

interface FlagButtonProps {
  flagged: boolean
  onClick: () => void
  className?: string
}

export default function FlagButton({ flagged, onClick, className }: FlagButtonProps) {
  return (
    <button
      data-slot="flag-button"
      onClick={onClick}
      className={cn("flex items-center gap-2 text-sm text-on-surface-variant hover:text-tertiary transition-colors", className)}
    >
      <span
        className="material-symbols-outlined text-xl text-tertiary"
        style={{ fontVariationSettings: flagged ? "'FILL' 1" : "'FILL' 0" }}
      >
        flag
      </span>
      <span>{flagged ? '已标记' : '标记复查'}</span>
    </button>
  )
}
