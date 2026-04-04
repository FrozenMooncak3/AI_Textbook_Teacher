'use client'

import { useSidebar } from './SidebarProvider'

export default function SidebarToggle() {
  const { toggleCollapsed, toggleMobile, isCollapsed } = useSidebar()

  return (
    <>
      {/* Mobile Toggle (Hamburger) */}
      <button
        onClick={toggleMobile}
        className="lg:hidden p-2 bg-white shadow-sm rounded-lg border border-gray-200 text-gray-500 hover:text-gray-700 focus:outline-none transition-colors"
        aria-label="Toggle Menu"
      >
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 6h16M4 12h16M4 18h16"
          />
        </svg>
      </button>

      {/* Desktop Toggle (Chevron) */}
      <button
        onClick={toggleCollapsed}
        className="hidden lg:flex items-center justify-center w-6 h-6 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
        aria-label={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
      >
        <svg
          className={`w-4 h-4 transition-transform duration-200 ${
            isCollapsed ? 'rotate-180' : ''
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 19l-7-7 7-7"
          />
        </svg>
      </button>
    </>
  )
}
