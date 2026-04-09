'use client'

import * as RadioGroup from '@radix-ui/react-radio-group'       
import { cn } from '@/lib/utils'

interface MCOptionCardProps {
  label: string
  text: string
  value: string
  showResult?: 'correct' | 'incorrect'
  disabled?: boolean
  className?: string
}

export function MCOptionCard({ label, text, value, showResult, disabled, className }: MCOptionCardProps) {
  const isCorrect = showResult === 'correct'
  const isIncorrect = showResult === 'incorrect'

  return (
    <RadioGroup.Item
      value={value}
      disabled={disabled}
      data-slot="mc-option-card"
      className={cn(
        'group w-full flex items-center gap-4 p-5 rounded-lg transition-all',
        isCorrect ? 'bg-emerald-50 border-2 border-emerald-500' :
        isIncorrect ? 'bg-red-50 border-2 border-error' :       
        'bg-surface-container hover:bg-surface-variant data-[state=checked]:border-2 data-[state=checked]:border-primary-fixed-dim data-[state=checked]:bg-secondary-container/30',
        disabled && 'pointer-events-none',
        className
      )}
    >
      <div className={cn(
        'w-10 h-10 rounded-full flex items-center justify-center font-bold shrink-0',
        isCorrect ? 'bg-emerald-500 text-white' :
        isIncorrect ? 'bg-error text-white' :
        'bg-surface-container-lowest border border-outline-variant group-data-[state=checked]:bg-primary-fixed-dim group-data-[state=checked]:text-white group-data-[state=checked]:border-none'
      )}>
        {isCorrect ? (
          <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>check</span>        
        ) : isIncorrect ? (
          <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>close</span>        
        ) : (
          label
        )}
      </div>
      <span className="text-left text-on-surface">{text}</span> 
    </RadioGroup.Item>
  )
}

interface MCOptionGroupProps {
  value: string
  onValueChange: (value: string) => void
  disabled?: boolean
  children: React.ReactNode
  className?: string
}

export function MCOptionGroup({ value, onValueChange, disabled, children, className }: MCOptionGroupProps) {
  return (
    <RadioGroup.Root
      data-slot="mc-option-group"
      value={value}
      onValueChange={onValueChange}
      disabled={disabled}
      className={cn('flex flex-col gap-3', className)}
    >
      {children}
    </RadioGroup.Root>
  )
}
