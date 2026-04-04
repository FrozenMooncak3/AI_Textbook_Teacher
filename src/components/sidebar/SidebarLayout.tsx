'use client'

import Sidebar from './Sidebar'
import { SidebarProvider } from './SidebarProvider'

export default function SidebarLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <div className="flex h-screen overflow-hidden bg-gray-50">
        <Sidebar />
        <main className="flex-1 overflow-auto relative">
          {/* Main content area */}
          <div className="min-h-full">
            {children}
          </div>
        </main>
      </div>
    </SidebarProvider>
  )
}
