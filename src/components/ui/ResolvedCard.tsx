import { cn } from '@/lib/utils'

interface ResolvedCardProps {
  question: string
  module: string
  resolvedAt: string
  onReopen: () => void
  className?: string
}

export default function ResolvedCard({ question, module, resolvedAt, onReopen, className }: ResolvedCardProps) {
  return (
    <div
      data-slot="resolved-card"
      className={cn("bg-surface-dim/30 rounded-3xl p-6 opacity-70 grayscale-[0.3] border-l-[6px] border-emerald-500/50", className)}
    >
      <div className="flex items-center justify-between">       
        <div>
          <p className="text-xs text-emerald-600 font-bold">✅ 已解决 · {module}</p>
          <h3 className="font-headline font-medium text-on-surface mt-1 line-clamp-1">{question}</h3>
          <p className="text-xs text-on-surface-variant mt-1">{resolvedAt}</p>
        </div>
        <button onClick={onReopen} className="text-on-surface-variant hover:text-primary">
          <span className="material-symbols-outlined text-lg">refresh</span>
        </button>
      </div>
    </div>
  )
}
