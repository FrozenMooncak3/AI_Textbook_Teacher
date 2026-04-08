'use client'

import { usePathname } from 'next/navigation'
import { SidebarProvider } from './SidebarProvider'
import Sidebar from './Sidebar'
import SidebarToggle from './SidebarToggle'

export default function SidebarLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isExamMode = pathname.includes('/test')

  if (pathname === '/login' || pathname === '/register' || isExamMode) {
    return <>{children}</>
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen bg-surface-container-low">
        <Sidebar />
        <main className="flex-1 min-w-0">
          <div className="lg:hidden p-4">
            <SidebarToggle />
          </div>
          {children}
        </main>
      </div>
    </SidebarProvider>
  )
}
