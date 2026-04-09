import { cn } from '@/lib/utils'

interface SplitPanelProps {
  sidebar: React.ReactNode
  content: React.ReactNode
  feedbackSlot?: React.ReactNode
  showBorder?: boolean
  className?: string
}

export default function SplitPanel({ sidebar, content, feedbackSlot, showBorder = true, className }: SplitPanelProps) {
  return (
    <div data-slot="split-panel" className={cn("flex h-screen overflow-hidden", className)}>
      <aside className={cn(
        "w-[280px] bg-surface-container-low flex flex-col h-full shrink-0",
        showBorder && 'border-r border-outline-variant/15'      
      )}>
        {sidebar}
      </aside>
      <main className="flex-1 bg-surface overflow-y-auto relative">
        {content}
        {feedbackSlot}
      </main>
    </div>
  )
}
