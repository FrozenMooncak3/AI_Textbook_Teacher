import { cn } from '@/lib/utils'

interface GlassHeaderProps {
  children: React.ReactNode
  className?: string
}

export default function GlassHeader({ children, className }: GlassHeaderProps) {
  return (
    <header
      data-slot="glass-header"
      className={cn(
        "sticky top-0 z-40 border-b border-outline-variant/10 bg-surface-bright/80 backdrop-blur-xl",
        className
      )}
    >
      {children}
    </header>
  )
}
