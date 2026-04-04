'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { useSidebar } from './SidebarProvider'
import SidebarToggle from './SidebarToggle'

interface Book {
  id: number
  title: string
}

interface Module {
  id: number
  title: string
  learning_status: string
  order_index: number
}

const STATUS_LABEL: Record<string, string> = {
  unstarted: '未开始',
  reading: '阅读中',
  qa: 'Q&A 中',
  notes_generated: '笔记已生成',
  testing: '测试中',
  completed: '已完成',
}

const STATUS_COLORS: Record<string, string> = {
  unstarted: 'bg-gray-100 text-gray-500',
  reading: 'bg-blue-100 text-blue-600',
  qa: 'bg-purple-100 text-purple-600',
  notes_generated: 'bg-indigo-100 text-indigo-600',
  testing: 'bg-amber-100 text-amber-600',
  completed: 'bg-emerald-100 text-emerald-600',
}

export default function Sidebar() {
  const pathname = usePathname()
  const { isCollapsed, isMobileOpen, setIsMobileOpen } = useSidebar()

  const [books, setBooks] = useState<Book[]>([])
  const [modules, setModules] = useState<Module[]>([])
  const [isLoadingBooks, setIsLoadingBooks] = useState(false)
  const [isLoadingModules, setIsLoadingModules] = useState(false)

  // Route parsing
  const bookMatch = pathname.match(/^\/books\/(\d+)/)
  const moduleMatch = pathname.match(/^\/books\/(\d+)\/modules\/(\d+)/)
  const bookId = bookMatch ? Number(bookMatch[1]) : null
  const moduleId = moduleMatch ? Number(moduleMatch[2]) : null

  const currentBook = books.find(b => b.id === bookId)

  // Fetch books
  useEffect(() => {
    async function fetchBooks() {
      setIsLoadingBooks(true)
      try {
        const res = await fetch('/api/books')
        const json = await res.json()
        if (json.success) {
          setBooks(json.data)
        }
      } catch (e) {
        // Error handled by loading state
      } finally {
        setIsLoadingBooks(false)
      }
    }
    fetchBooks()
  }, [])

  // Fetch modules when bookId changes
  useEffect(() => {
    if (!bookId) {
      setModules([])
      return
    }

    async function fetchModules() {
      setIsLoadingModules(true)
      try {
        const res = await fetch(`/api/modules?bookId=${bookId}`)
        const json = await res.json()
        if (json.modules) {
          setModules(json.modules)
        }
      } catch (e) {
        // Error handled by loading state
      } finally {
        setIsLoadingModules(false)
      }
    }
    fetchModules()
  }, [bookId])

  const NavItem = ({ 
    href, 
    label, 
    icon, 
    exact = false,
    badge
  }: { 
    href: string; 
    label: string; 
    icon: React.ReactNode;
    exact?: boolean;
    badge?: string;
  }) => {
    const isActive = exact ? pathname === href : pathname.startsWith(href)
    
    return (
      <Link
        href={href}
        onClick={() => setIsMobileOpen(false)}
        className={`group relative flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
          isActive 
            ? 'bg-blue-50 text-blue-700' 
            : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
        }`}
      >
        {isActive && (
          <div className="absolute left-0 top-1.5 bottom-1.5 w-1 bg-blue-600 rounded-r-full" />
        )}
        <div className={`shrink-0 transition-colors duration-200 ${isActive ? 'text-blue-600' : 'text-gray-400 group-hover:text-gray-600'}`}>
          {icon}
        </div>
        {!isCollapsed && (
          <span className="truncate flex-1">{label}</span>
        )}
        {!isCollapsed && badge && (
          <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-tighter shrink-0 ${STATUS_COLORS[badge] || 'bg-gray-100 text-gray-500'}`}>
            {STATUS_LABEL[badge] || badge}
          </span>
        )}
        
        {/* Tooltip for collapsed mode */}
        {isCollapsed && (
          <div className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 whitespace-nowrap">
            {label} {badge ? `(${STATUS_LABEL[badge]})` : ''}
          </div>
        )}
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
        className={`fixed inset-y-0 left-0 z-50 flex flex-col bg-white border-r border-gray-200 transition-all duration-200 ease-in-out lg:static ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        } ${isCollapsed ? 'w-[56px]' : 'w-[240px]'}`}
      >
        {/* Sidebar Header */}
        <div className="h-14 flex items-center justify-between px-4 border-b border-gray-50 shrink-0">
          {!isCollapsed && (
            <Link href="/" className="flex items-center gap-2 overflow-hidden">
              <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center shrink-0 shadow-sm shadow-blue-200 text-white font-black text-xs">
                AI
              </div>
              <span className="font-black text-gray-900 tracking-tight whitespace-nowrap">教辅精学</span>
            </Link>
          )}
          {isCollapsed && (
            <div className="w-full flex justify-center">
              <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center shadow-sm shadow-blue-200 text-white font-black text-xs">
                AI
              </div>
            </div>
          )}
          {!isCollapsed && <SidebarToggle />}
        </div>

        {/* Desktop Toggle (Centered) when collapsed */}
        {isCollapsed && (
          <div className="py-2 flex justify-center border-b border-gray-50">
            <SidebarToggle />
          </div>
        )}

        {/* Navigation Content */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-2 space-y-6">
          
          {/* Layer 1: Global */}
          <div className="space-y-1">
            <NavItem 
              href="/" 
              label="妫ｆ牠銆" 
              exact 
              icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg>}
            />
            <NavItem 
              href="/upload" 
              label="娑撳﹣绱堕弫娆愭綏" 
              icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>}
            />
          </div>

          {/* Layer 2: Book Level */}
          {bookId && (
            <div className="space-y-4 animate-in fade-in slide-in-from-left-2 duration-300">
              <div className="px-3">
                {!isCollapsed ? (
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest truncate" title={currentBook?.title}>
                    {currentBook?.title || '当前教材'}
                  </p>
                ) : (
                  <div className="h-px bg-gray-100 mx-auto w-8" />
                )}
              </div>
              
              <div className="space-y-1">
                <NavItem 
                  href={`/books/${bookId}/reader`} 
                  label="闂冨懓顕伴崢鐔告瀮" 
                  icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/></svg>}
                />
                <NavItem 
                  href={`/books/${bookId}/module-map`} 
                  label="濡€虫健閸︽澘娴" 
                  icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"/></svg>}
                />
                <NavItem 
                  href={`/books/${bookId}/dashboard`} 
                  label="娴狀亣銆冮惄?" 
                  icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>}
                />
                <NavItem 
                  href={`/books/${bookId}/mistakes`} 
                  label="错题本" 
                  icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>}
                />
              </div>

              {/* Module List Header */}
              <div className="px-3 pt-2">
                {!isCollapsed ? (
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest truncate">
                    章节模块
                  </p>
                ) : (
                  <div className="h-px bg-gray-100 mx-auto w-8" />
                )}
              </div>

              {/* Module Items */}
              <div className="space-y-1">
                {modules.map((m) => {
                  const isCurrentModule = m.id === moduleId
                  
                  return (
                    <div key={m.id} className="space-y-1">
                      <NavItem 
                        href={`/books/${bookId}/modules/${m.id}`} 
                        label={m.title} 
                        badge={m.learning_status}
                        icon={<div className="w-5 h-5 flex items-center justify-center font-bold text-xs">{m.order_index}</div>}
                      />
                      
                      {/* Layer 3: Module Sub-pages (Expanded only for active module) */}
                      {isCurrentModule && !isCollapsed && (
                        <div className="ml-8 space-y-1 pr-2 animate-in slide-in-from-top-2 duration-200">
                          <NavItem 
                            href={`/books/${bookId}/modules/${m.id}`} 
                            label="鐎涳缚绡" 
                            exact
                            icon={<div className="w-1.5 h-1.5 rounded-full bg-current" />}
                          />
                          <NavItem 
                            href={`/books/${bookId}/modules/${m.id}/qa`} 
                            label="Q&A 练习" 
                            icon={<div className="w-1.5 h-1.5 rounded-full bg-current" />}
                          />
                          <NavItem 
                            href={`/books/${bookId}/modules/${m.id}/test`} 
                            label="能力测试" 
                            icon={<div className="w-1.5 h-1.5 rounded-full bg-current" />}
                          />
                          <NavItem 
                            href={`/books/${bookId}/modules/${m.id}/mistakes`} 
                            label="错题诊断" 
                            icon={<div className="w-1.5 h-1.5 rounded-full bg-current" />}
                          />
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar Footer */}
        <div className="p-2 border-t border-gray-50 shrink-0">
          <NavItem 
            href="/logs" 
            label="系统日志" 
            icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>}
          />
        </div>
      </aside>
    </>
  )
}
