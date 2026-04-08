'use client'

import React, { useState } from 'react'
import Link from 'next/link'

interface KnowledgePoint {
  id: number
  code: string
  name: string
  status: 'done' | 'current' | 'pending'
}

interface SplitPanelProps {
  breadcrumbs: { label: string; href?: string }[]
  knowledgePoints: { id: number; code: string; name: string; status: 'done' | 'current' | 'pending' }[]
  onKpClick?: (kpId: number) => void
  children: React.ReactNode
  feedbackSlot?: React.ReactNode
  footerSlot?: React.ReactNode
}

export default function SplitPanelLayout({
  breadcrumbs,
  knowledgePoints,
  onKpClick,
  children,
  feedbackSlot,
  footerSlot
}: SplitPanelProps) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false)

  const StatusDot = ({ status }: { status: KnowledgePoint['status'] }) => {
    switch (status) {
      case 'done':
        return (
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]" />
        )
      case 'current':
        return (
          <div className="w-2.5 h-2.5 rounded-full bg-primary-fixed-dim" />
        )
      case 'pending':
      default:
        return (
          <div className="w-2.5 h-2.5 rounded-full bg-surface-variant" />
        )
    }
  }

  return (
    <div className="flex flex-col h-screen bg-surface overflow-hidden">
      {/* Breadcrumb Bar */}
      <nav className="flex items-center gap-2 px-6 py-3 bg-surface-container-lowest border-b border-outline-variant/30 shrink-0 z-20">
        {breadcrumbs.map((crumb, index) => (
          <React.Fragment key={index}>
            {index > 0 && (
              <span className="material-symbols-outlined text-sm text-on-surface-variant/50">
                chevron_right
              </span>
            )}
            {crumb.href ? (
              <Link
                href={crumb.href}
                className="text-sm text-on-surface-variant hover:text-primary transition-colors font-medium"
              >
                {crumb.label}
              </Link>
            ) : (
              <span className={`text-sm ${index === breadcrumbs.length - 1 ? 'text-on-surface font-semibold' : 'text-on-surface-variant'}`}>
                {crumb.label}
              </span>
            )}
          </React.Fragment>
        ))}
      </nav>

      <div className="flex flex-1 overflow-hidden relative">
        {/* Mobile Sidebar Toggle Button */}
        <button
          onClick={() => setIsMobileSidebarOpen(true)}
          className="lg:hidden absolute top-4 left-4 z-10 w-10 h-10 bg-surface-container-lowest shadow-lg rounded-full flex items-center justify-center border border-outline-variant/30"
        >
          <span className="material-symbols-outlined text-on-surface-variant">list</span>
        </button>

        {/* Mobile Sidebar Overlay */}
        {isMobileSidebarOpen && (
          <div
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 lg:hidden"
            onClick={() => setIsMobileSidebarOpen(false)}
          />
        )}

        {/* Left Panel (KP sidebar) */}
        <aside
          className={`
            fixed inset-y-0 left-0 z-50 w-60 bg-surface-container border-r border-outline-variant flex flex-col transition-transform duration-300 ease-in-out lg:static lg:translate-x-0
            ${isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
            ${isSidebarCollapsed ? 'lg:hidden' : 'lg:flex'}
          `}
        >
          <div className="p-5 flex items-center justify-between border-b border-outline-variant/30 lg:border-none">
            <h3 className="text-xs font-bold text-on-surface-variant uppercase tracking-widest font-headline">
              知识点列表
            </h3>
            <button
              onClick={() => setIsSidebarCollapsed(true)}
              className="hidden lg:flex w-6 h-6 items-center justify-center text-on-surface-variant hover:text-on-surface transition-colors"
            >
              <span className="material-symbols-outlined text-lg">chevron_left</span>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {knowledgePoints.map((kp) => (
              <button
                key={kp.id}
                onClick={() => {
                  onKpClick?.(kp.id)
                  setIsMobileSidebarOpen(false)
                }}
                className={`
                  w-full flex items-center gap-3 p-3 rounded-xl transition-all duration-200 group text-left
                  ${kp.status === 'current' 
                    ? 'bg-surface-container-lowest shadow-sm border border-outline-variant/10' 
                    : 'hover:bg-surface-container-high'}
                `}
              >
                <div className="shrink-0">
                  <StatusDot status={kp.status} />
                </div>
                <div className="min-w-0">
                  <div className="text-[10px] font-bold text-on-surface-variant/50 leading-none mb-1 font-headline">
                    {kp.code}
                  </div>
                  <div className={`text-sm truncate ${kp.status === 'current' ? 'text-on-surface font-bold' : 'text-on-surface-variant font-medium'}`}>
                    {kp.name}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </aside>

        {/* Right Panel */}
        <div className="flex-1 flex flex-col min-w-0 relative h-full">
          {/* Collapse Toggle (hidden when sidebar is visible) */}
          {isSidebarCollapsed && (
            <button
              onClick={() => setIsSidebarCollapsed(false)}
              className="hidden lg:flex absolute top-4 left-4 z-10 w-8 h-8 bg-surface-container-lowest shadow-md rounded-full items-center justify-center border border-outline-variant/30 hover:text-primary transition-colors"
            >
              <span className="material-symbols-outlined text-lg">chevron_right</span>
            </button>
          )}

          {/* Main Content Area */}
          <main className="flex-1 overflow-y-auto relative scroll-smooth bg-surface-container-low/30">
            {children}
            
            {/* Feedback Slot */}
            {feedbackSlot && (
              <div className="absolute inset-x-0 bottom-0 z-30 pointer-events-none">
                <div className="pointer-events-auto">
                  {feedbackSlot}
                </div>
              </div>
            )}
          </main>

          {/* Footer Slot */}
          {footerSlot && (
            <footer className="sticky bottom-0 bg-surface-container-lowest border-t border-outline-variant/30 px-6 py-4 z-20 shrink-0 shadow-[0_-8px_40px_rgba(167,72,0,0.04)]">
              {footerSlot}
            </footer>
          )}
        </div>
      </div>
    </div>
  )
}
