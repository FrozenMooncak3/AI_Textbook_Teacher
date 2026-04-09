import { cn } from '@/lib/utils'

interface ContentCardProps {
  children: React.ReactNode
  className?: string
  onClick?: () => void
}

export default function ContentCard({ children, className, onClick }: ContentCardProps) {
  const Wrapper = onClick ? 'div' : 'div' // Keeping it as div for now to avoid button styling issues, but handling click
  
  return (
    <div
      data-slot="content-card"
      onClick={onClick}
      className={cn(
        "bg-surface-container-lowest rounded-3xl p-8 shadow-card border border-outline-variant/10",
        onClick && "cursor-pointer transition-all active:scale-[0.99]",
        className
      )}
    >
      {children}
    </div>
  )
}
