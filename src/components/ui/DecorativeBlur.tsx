import { cn } from '@/lib/utils'

interface DecorativeBlurProps {
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
  color?: 'primary' | 'secondary'
  className?: string
}

const positionClasses = {
  'top-left': '-top-24 -left-24',
  'top-right': '-top-24 -right-24',
  'bottom-left': '-bottom-24 -left-24',
  'bottom-right': '-bottom-24 -right-24',
}

export default function DecorativeBlur({ position = 'top-right', color = 'primary', className }: DecorativeBlurProps) {
  const colorClass = color === 'primary' ? 'bg-primary-container/10' : 'bg-secondary-container/10'
  return (
    <div
      data-slot="decorative-blur"
      className={cn(
        "absolute w-96 h-96 rounded-full blur-3xl opacity-50 pointer-events-none",
        positionClasses[position],
        colorClass,
        className
      )}
    />
  )
}
