'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'

interface TextInputProps {
  label: string
  placeholder?: string
  type?: string
  value: string
  onChange: (value: string) => void
  endIcon?: React.ReactNode
  className?: string
}

export default function TextInput({ label, placeholder, type = 'text', value, onChange, endIcon, className }: TextInputProps) {
  const [showPassword, setShowPassword] = useState(false)
  const isPassword = type === 'password'
  const inputType = isPassword && showPassword ? 'text' : type

  return (
    <div data-slot="text-input" className={cn("", className)}>
      <label className="block text-sm font-medium text-on-surface mb-2">{label}</label>
      <div className="relative">
        <input
          type={inputType}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full bg-surface-container-low border-none rounded-lg py-4 px-5 text-on-surface placeholder:text-on-surface-variant/50 focus:ring-2 focus:ring-primary/20 focus:bg-surface-bright transition-all outline-none"
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-on-surface-variant"
          >
            <span className="material-symbols-outlined text-xl">
              {showPassword ? 'visibility_off' : 'visibility'}
            </span>
          </button>
        )}
        {endIcon && !isPassword && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2">{endIcon}</div>
        )}
      </div>
    </div>
  )
}
