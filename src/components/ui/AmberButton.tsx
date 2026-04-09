'use client'

import { cn } from '@/lib/utils'

interface AmberButtonProps {
  children: React.ReactNode
  onClick?: () => void
  disabled?: boolean
  fullWidth?: boolean
  size?: 'sm' | 'md' | 'lg'
  rounded?: 'full' | 'lg'
  type?: 'button' | 'submit'
  className?: string
}

export default function AmberButton({
  children, onClick, disabled, fullWidth, size = 'md', rounded = 'full', type = 'button', className
}: AmberButtonProps) {
  const sizeClasses = {
    sm: 'py-2 px-5 text-sm',
    md: 'py-4 px-8',
    lg: 'py-5 px-10 text-lg',
  }
  const roundedClass = rounded === 'full' ? 'rounded-full' : 'rounded-lg'

  return (
    <button
      data-slot="amber-button"
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "amber-glow text-white font-bold shadow-cta hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:pointer-events-none",
        sizeClasses[size],
        roundedClass,
        fullWidth ? 'w-full' : '',
        className
      )}
    >
      {children}
    </button>
  )
}
