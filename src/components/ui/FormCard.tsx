import { cn } from '@/lib/utils'

interface FormCardProps {
  children: React.ReactNode
  title: string
  subtitle?: string
  className?: string
}

export default function FormCard({ children, title, subtitle, className }: FormCardProps) {
  return (
    <div
      data-slot="form-card"
      className={cn(
        "bg-surface-container-lowest rounded-xl p-10 shadow-header w-full max-w-[420px]",
        className
      )}
    >
      <h1 className="text-2xl font-headline font-bold text-on-surface text-center leading-tight">
        {title}
      </h1>
      {subtitle && (
        <p className="text-on-surface-variant text-center mt-2 font-medium">
          {subtitle}
        </p>
      )}
      <div className="mt-8">{children}</div>
    </div>
  )
}
