import { cn } from '@/lib/utils'

interface ProgressBarProps {
  progress: number // 0 to 100
  label?: string
  className?: string
}

export default function ProgressBar({ progress, label, className }: ProgressBarProps) {
  return (
    <div data-slot="progress-bar" className={cn("w-full", className)}>
      {label && (
        <div className="flex justify-between items-end mb-2">
          <span className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest">{label}</span>
          <span className="text-sm font-black font-headline text-primary">{Math.round(progress)}%</span>
        </div>
      )}
      <div className="w-full h-2 bg-surface-container rounded-full overflow-hidden shadow-inner">
        <div
          className="h-full bg-primary rounded-full transition-all duration-1000 ease-out shadow-[0_0_8px_rgba(167,72,0,0.3)]"
          style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
        />
      </div>
    </div>
  )
}
