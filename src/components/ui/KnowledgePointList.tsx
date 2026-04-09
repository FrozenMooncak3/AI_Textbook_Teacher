'use client'

import { cn } from '@/lib/utils'

interface KPItem {
  name: string
  status: 'done' | 'active' | 'pending'
  progress?: string
}

interface KnowledgePointListProps {
  items: KPItem[]
  onItemClick?: (index: number) => void
  activeColor?: 'blue' | 'orange'
  className?: string
}

const dotColors: Record<string, string> = { done: 'bg-emerald-500', pending: 'bg-surface-container-high' }
const activeStyles = {
  blue: { bg: 'bg-blue-50 border border-blue-100/50 shadow-sm', dot: 'bg-blue-500', text: 'text-blue-900' },
  orange: { bg: 'bg-orange-100 ring-1 ring-primary/20', dot: 'bg-orange-500 animate-pulse', text: 'text-on-surface' },
}

export default function KnowledgePointList({ items, onItemClick, activeColor = 'blue', className }: KnowledgePointListProps) {  
  return (
    <div data-slot="knowledge-point-list" className={cn("flex flex-col gap-1", className)}>
      {items.map((item, i) => {
        const isActive = item.status === 'active'
        const active = activeStyles[activeColor]
        return (
          <button
            key={i}
            onClick={() => onItemClick?.(i)}
            className={cn(
              "flex items-center justify-between p-3 rounded-xl transition-colors text-left",
              isActive ? active.bg : 'hover:bg-surface-container-low'
            )}
          >
            <div className="flex items-center gap-3">
              <div className={cn(
                "w-2 h-2 rounded-full",
                isActive ? active.dot : dotColors[item.status] || dotColors.pending
              )} />
              <span className={cn(
                "text-sm font-medium",
                isActive ? active.text : 'text-on-surface'      
              )}>{item.name}</span>
            </div>
            {item.progress && <span className="text-xs text-on-surface-variant">{item.progress}</span>}
          </button>
        )
      })}
    </div>
  )
}
