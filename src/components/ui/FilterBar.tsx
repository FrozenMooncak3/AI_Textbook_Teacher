'use client'

import { cn } from '@/lib/utils'

interface FilterGroup {
  label: string
  key: string
  options: string[]
}

interface FilterBarProps {
  groups: FilterGroup[]
  selected: Record<string, string[]>
  onChange: (key: string, value: string) => void
  className?: string
}

export default function FilterBar({ groups, selected, onChange, className }: FilterBarProps) {
  return (
    <div
      data-slot="filter-bar"
      className={cn("bg-surface-container-low rounded-3xl p-6 flex flex-col gap-6", className)}
    >
      {groups.map((group) => (
        <div key={group.key} className="flex items-center gap-3 flex-wrap">
          <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider shrink-0">{group.label}</span>    
          {group.options.map((opt) => {
            const isSelected = selected[group.key]?.includes(opt)
            return (
              <button
                key={opt}
                onClick={() => onChange(group.key, opt)}        
                className={cn(
                  "px-4 py-1.5 rounded-full text-sm font-semibold cursor-pointer transition-colors",
                  isSelected
                    ? 'bg-surface-container-lowest text-primary border border-primary/10'
                    : 'bg-surface-container-lowest text-on-surface-variant hover:bg-primary/5'
                )}
              >
                {opt}
              </button>
            )
          })}
        </div>
      ))}
    </div>
  )
}
