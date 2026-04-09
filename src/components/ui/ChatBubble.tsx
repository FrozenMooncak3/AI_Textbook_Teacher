import { cn } from '@/lib/utils'

interface ChatBubbleProps {
  role: 'user' | 'ai'
  children: React.ReactNode
  className?: string
}

export default function ChatBubble({ role, children, className }: ChatBubbleProps) {
  return (
    <div
      data-slot="chat-bubble"
      className={cn(
        role === 'user'
          ? "bg-surface-container-lowest p-5 rounded-2xl rounded-tl-none"
          : "bg-primary/5 p-5 rounded-2xl rounded-tr-none border border-primary/10",
        className
      )}
    >
      {children}
    </div>
  )
}
