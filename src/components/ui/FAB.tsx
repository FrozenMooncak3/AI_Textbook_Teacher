'use client'

import { cn } from '@/lib/utils'

interface FABProps {
  icon: string
  onClick?: () => void
  label?: string
  className?: string
}

export default function FAB({ icon, onClick, label, className }: FABProps) {
  return (
    <button
      data-slot="fab"
      onClick={onClick}
      className={cn(
        "fixed bottom-8 right-8 amber-glow text-white rounded-full p-4 shadow-fab hover:scale-110 active:scale-90 transition-all flex items-center gap-2 group z-40",
        className
      )}
    >
      <span className="material-symbols-outlined text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>
        {icon}
      </span>
      {label && (
        <span className="max-w-0 overflow-hidden group-hover:max-w-xs transition-all duration-500 ease-in-out whitespace-nowrap text-sm font-bold pr-2">
          {label}
        </span>
      )}
    </button>
  )
}
