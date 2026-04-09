import { cn } from '@/lib/utils'

interface DecorativeBlurProps {
  color?: string
  size?: string
  position?: string
  className?: string
}

export default function DecorativeBlur({
  color = 'bg-primary/5',
  size = 'w-64 h-64',
  position = '-right-20 -bottom-20',
  className
}: DecorativeBlurProps) {
  return (
    <div
      data-slot="decorative-blur"
      className={cn(
        "absolute rounded-full blur-3xl pointer-events-none transition-colors duration-700",
        color,
        size,
        position,
        className
      )}
    />
  )
}
