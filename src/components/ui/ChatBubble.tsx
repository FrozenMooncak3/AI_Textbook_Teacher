import { cn } from '@/lib/utils'

interface ChatBubbleProps {
  role: 'user' | 'ai'
  children: React.ReactNode
  className?: string
}

export default function ChatBubble({ role, children, className }: ChatBubbleProps) {
  const isUser = role === 'user'

  return (
    <div
      data-slot="chat-bubble"
      className={cn(
        "max-w-[85%] p-5 rounded-2xl shadow-sm",
        isUser
          ? "bg-surface-container-lowest rounded-tl-none ml-auto"
          : "bg-primary/5 rounded-tr-none border border-primary/10 mr-auto",
        className
      )}
    >
      <div className={cn(
        "text-sm leading-relaxed",
        isUser ? "text-on-surface" : "text-on-surface-variant"
      )}>
        {children}
      </div>
    </div>
  )
}
