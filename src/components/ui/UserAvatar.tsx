import { cn } from '@/lib/utils'

interface UserAvatarProps {
  name?: string
  src?: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export default function UserAvatar({ name, src, size = 'md', className }: UserAvatarProps) {
  const sizeClasses = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-12 h-12 text-base',
  }

  return (
    <div
      data-slot="user-avatar"
      className={cn(
        "rounded-full bg-surface-container-highest flex items-center justify-center shrink-0 overflow-hidden border border-outline-variant/10",
        sizeClasses[size],
        className
      )}
    >
      {src ? (
        <img src={src} alt={name || 'User'} className="w-full h-full object-cover" />
      ) : (
        <span className="material-symbols-outlined text-on-surface-variant">
          account_circle
        </span>
      )}
    </div>
  )
}
