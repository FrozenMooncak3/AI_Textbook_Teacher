'use client'

import { useSidebar } from './SidebarProvider'

export default function SidebarToggle() {
  const { toggleMobile } = useSidebar()

  return (
    <>
      {/* Mobile Toggle (Hamburger) */}
      <button
        onClick={toggleMobile}
        className="lg:hidden p-2.5 bg-surface-container-lowest shadow-sm rounded-xl border border-outline-variant text-on-surface-variant hover:text-on-surface focus:outline-none transition-colors"
        aria-label="Toggle Menu"
      >
        <span className="material-symbols-outlined text-2xl">
          menu
        </span>
      </button>
    </>
  )
}
