'use client'

import { cn } from '@/lib/utils'

interface FABProps {
  icon: string
  onClick: () => void
  label?: string
  className?: string
}

export default function FAB({ icon, onClick, label, className }: FABProps) {
  return (
    <button
      data-slot="fab"
      onClick={onClick}
      aria-label={label}
      className={cn(
        "fixed bottom-8 right-8 w-12 h-12 bg-primary rounded-full shadow-fab hover:scale-110 active:scale-95 transition-transform flex items-center justify-center text-white z-40",
        className
      )}
    >
      <span className="material-symbols-outlined text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>{icon}</span>
    </button>
  )
}
