'use client'

import Sidebar from './Sidebar'
import { SidebarProvider } from './SidebarProvider'
import SidebarToggle from './SidebarToggle'

export default function SidebarLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <div className="flex h-screen overflow-hidden bg-gray-50">
        <Sidebar />
        <main className="flex-1 overflow-auto relative">
          {/* Mobile hamburger — visible only on <1024px, positioned top-left */}
          <div className="fixed top-3 left-3 z-30 lg:hidden">
            <SidebarToggle />
          </div>
          {/* Main content area */}
          <div className="min-h-full">
            {children}
          </div>
        </main>
      </div>
    </SidebarProvider>
  )
}
