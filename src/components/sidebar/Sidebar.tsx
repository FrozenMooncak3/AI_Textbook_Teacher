'use client'

import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useSidebar } from './SidebarProvider'

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { isMobileOpen, setIsMobileOpen } = useSidebar()

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
      router.push('/login')
      router.refresh()
    } catch (e) {
      console.error('Logout failed', e)
    }
  }

  const NavItem = ({ 
    href, 
    label, 
    icon, 
    exact = false,
    onClick
  }: { 
    href: string; 
    label: string; 
    icon: string;
    exact?: boolean;
    onClick?: () => void;
  }) => {
    const isActive = exact ? pathname === href : pathname.startsWith(href)
    
    return (
      <Link
        href={href}
        onClick={() => {
          setIsMobileOpen(false)
          if (onClick) onClick()
        }}
        className={`group flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
          isActive 
            ? 'bg-primary/10 text-primary' 
            : 'text-on-surface hover:bg-surface-container'
        }`}
      >
        <span className="material-symbols-outlined text-[22px] shrink-0">
          {icon}
        </span>
        <span className="truncate flex-1 font-headline tracking-wide">{label}</span>
      </Link>
    )
  }

  return (
    <>
      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div 
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Main Sidebar */}
      <aside 
        className={`fixed inset-y-0 left-0 z-50 flex flex-col w-60 h-screen bg-surface-container-low border-r border-outline-variant transition-transform duration-300 ease-in-out lg:static lg:translate-x-0 ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Sidebar Header */}
        <div className="h-20 flex items-center px-6 shrink-0">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-10 h-10 amber-glow rounded-lg flex items-center justify-center shrink-0 shadow-lg shadow-orange-900/10 text-white font-black text-sm">
              AI
            </div>
            <div className="flex flex-col">
              <span className="font-headline font-black text-on-surface leading-tight tracking-tight text-lg">AI 教材精学</span>
              <span className="text-[10px] text-on-surface-variant font-medium tracking-widest uppercase opacity-70">Companion</span>
            </div>
          </Link>
        </div>

        {/* Navigation Content */}
        <nav className="flex-1 overflow-y-auto p-4 space-y-2">
          <NavItem 
            href="/" 
            label="首页中心" 
            exact 
            icon="home"
          />
          <NavItem 
            href="/upload" 
            label="上传教材" 
            icon="cloud_upload"
          />
        </nav>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-outline-variant/30 space-y-1">
          <NavItem 
            href="/logs" 
            label="系统日志" 
            icon="analytics"
          />
          <button
            onClick={handleLogout}
            className="w-full group flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 text-on-surface hover:bg-error-container/10 hover:text-error"
          >
            <span className="material-symbols-outlined text-[22px] shrink-0">
              logout
            </span>
            <span className="truncate flex-1 text-left font-headline tracking-wide">退出登录</span>
          </button>
        </div>
      </aside>
    </>
  )
}
