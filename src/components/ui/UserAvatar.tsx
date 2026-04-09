import { cn } from '@/lib/utils'

interface UserAvatarProps {
  src?: string
  name: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizeClasses = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-14 h-14 text-lg',
}

export default function UserAvatar({ src, name, size = 'md', className }: UserAvatarProps) {
  const initials = name.slice(0, 2).toUpperCase()
  return src ? (
    <img
      data-slot="user-avatar"
      src={src}
      alt={name}
      className={cn(
        "rounded-full border-2 border-primary-container object-cover",
        sizeClasses[size],
        className
      )}
    />
  ) : (
    <div
      data-slot="user-avatar"
      className={cn(
        "rounded-full border-2 border-primary-container bg-primary-container/20 text-primary font-bold flex items-center justify-center",
        sizeClasses[size],
        className
      )}
    >
      {initials}
    </div>
  )
}
