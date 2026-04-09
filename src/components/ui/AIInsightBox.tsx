import { cn } from '@/lib/utils'

interface AIInsightBoxProps {
  title: string
  content: string
  className?: string
}

export default function AIInsightBox({ title, content, className }: AIInsightBoxProps) {
  return (
    <div
      data-slot="ai-insight-box"
      className={cn("bg-surface-container rounded-2xl p-6 flex gap-4 items-start", className)}
    >
      <div className="bg-primary-container p-3 rounded-xl shadow-lg shrink-0">
        <span className="material-symbols-outlined text-white text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>psychology</span>
      </div>
      <div>
        <h4 className="font-headline font-bold text-on-surface mb-1">{title}</h4>
        <p className="text-sm text-on-surface-variant leading-relaxed">{content}</p>
      </div>
    </div>
  )
}
