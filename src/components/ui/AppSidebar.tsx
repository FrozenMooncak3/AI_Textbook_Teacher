'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import UserAvatar from './UserAvatar'

interface NavItem {
  icon: string
  label: string
  href: string
}

interface AppSidebarProps {
  userName: string
  userAvatar?: string
  navItems: NavItem[]
  bookTitle?: string
  className?: string
}

export default function AppSidebar({ userName, userAvatar, navItems, bookTitle, className }: AppSidebarProps) {
  const pathname = usePathname()

  return (
    <aside
      data-slot="app-sidebar"
      className={cn(
        "fixed left-0 top-0 h-screen w-72 bg-gradient-to-r from-[#fefae8] to-[#fffbff] rounded-r-[32px] shadow-xl shadow-orange-900/5 z-40 flex flex-col py-6",
        className
      )}
    >
      <div className="px-6 mb-6">
        <h1 className="text-lg font-headline font-bold text-primary">AI 教材精学老师</h1>
        {bookTitle && <p className="text-xs text-on-surface-variant mt-1 truncate">{bookTitle}</p>}
      </div>

      <nav className="flex-1 px-4 flex flex-col gap-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 p-3 rounded-xl transition-colors",
                isActive ? 'bg-primary/10 text-primary font-semibold' : 'text-on-surface-variant hover:bg-primary/5'
              )}
            >
              <span className="material-symbols-outlined text-xl" style={isActive ? { fontVariationSettings: "'FILL' 1" } : undefined}>
                {item.icon}
              </span>
              <span className="text-sm">{item.label}</span>     
            </Link>
          )
        })}
      </nav>

      <div className="px-6 pt-4 border-t border-outline-variant/10">
        <div className="flex items-center gap-3">
          <UserAvatar name={userName} src={userAvatar} />       
          <span className="text-sm font-medium text-on-surface truncate">{userName}</span>
        </div>
      </div>
    </aside>
  )
}
