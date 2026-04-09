import Link from 'next/link'
import { cn } from '@/lib/utils'

interface BreadcrumbItem {
  label: string
  href?: string
}

interface BreadcrumbProps {
  items: BreadcrumbItem[]
  className?: string
}

export default function Breadcrumb({ items, className }: BreadcrumbProps) {
  return (
    <nav
      data-slot="breadcrumb"
      className={cn("flex items-center gap-2 text-on-surface-variant text-sm", className)}
    >
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-2">
          {i > 0 && (
            <span className="material-symbols-outlined text-xs">
              chevron_right
            </span>
          )}
          {item.href ? (
            <Link href={item.href} className="hover:text-primary transition-colors">
              {item.label}
            </Link>
          ) : (
            <span className="text-on-surface font-medium">
              {item.label}
            </span>
          )}
        </span>
      ))}
    </nav>
  )
}
