import { cn } from '@/lib/utils'

interface ProgressRingProps {
  value: number
  label?: string
  className?: string
}

export default function ProgressRing({ value, label, className }: ProgressRingProps) {
  const circumference = 2 * Math.PI * 70 // r=70
  const offset = circumference - (circumference * Math.min(100, Math.max(0, value))) / 100

  return (
    <div
      data-slot="progress-ring"
      className={cn("relative w-40 h-40", className)}
    >
      <svg className="w-full h-full transform -rotate-90" viewBox="0 0 160 160">
        <circle cx="80" cy="80" r="70" stroke="currentColor" strokeWidth="12" fill="none" className="text-primary/10" />        
        <circle cx="80" cy="80" r="70" stroke="currentColor" strokeWidth="12" fill="none"
          className="text-primary" strokeLinecap="round"        
          strokeDasharray={circumference} strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.5s ease' }} 
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-black font-headline text-on-surface">{value}%</span>
        {label && <span className="text-xs text-on-surface-variant">{label}</span>}
      </div>
    </div>
  )
}
