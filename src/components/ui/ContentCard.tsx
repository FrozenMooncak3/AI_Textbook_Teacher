import { cn } from '@/lib/utils'

interface ContentCardProps {
  children: React.ReactNode
  className?: string
}

export default function ContentCard({ children, className }: ContentCardProps) {
  return (
    <div
      data-slot="content-card"
      className={cn(
        "bg-surface-container-lowest rounded-3xl p-8 shadow-card border border-outline-variant/10",
        className
      )}
    >
      {children}
    </div>
  )
}
