'use client'

import * as Switch from '@radix-ui/react-switch'
import { cn } from '@/lib/utils'

interface ToggleSwitchProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label?: string
  className?: string
}

export default function ToggleSwitch({ checked, onChange, label, className }: ToggleSwitchProps) {
  return (
    <label data-slot="toggle-switch" className={cn("flex items-center gap-3 cursor-pointer", className)}>
      <Switch.Root
        checked={checked}
        onCheckedChange={onChange}
        className={cn(
          'relative w-12 h-6 rounded-full transition-colors',   
          checked ? 'bg-emerald-600' : 'bg-surface-container-high'
        )}
      >
        <Switch.Thumb className={cn(
          'block w-4 h-4 bg-white rounded-full transition-transform',
          checked ? 'translate-x-7' : 'translate-x-1'
        )} />
      </Switch.Root>
      {label && <span className="text-sm text-on-surface">{label}</span>}
    </label>
  )
}
