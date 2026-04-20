'use client'

import { useEffect } from 'react'
import { cn } from '@/lib/utils'
import BookTOCItem from './BookTOCItem'

interface Module {
  id: string
  name: string
  learningStatus: string
  moduleGroup?: string
}

interface BookTOCProps {
  modules: Module[]
  collapsed?: boolean
  onToggleCollapse?: () => void
  guideMode?: boolean
  recommendedModuleId?: string
  onModuleClick?: (moduleId: string) => void
}

export default function BookTOC({
  modules,
  collapsed = false,
  onToggleCollapse,
  guideMode = false,
  recommendedModuleId,
  onModuleClick
}: BookTOCProps) {
  
  // Group modules by moduleGroup
  const groups: Record<string, Module[]> = {}
  const ungrouped: Module[] = []

  modules.forEach(m => {
    if (m.moduleGroup) {
      if (!groups[m.moduleGroup]) groups[m.moduleGroup] = []
      groups[m.moduleGroup].push(m)
    } else {
      ungrouped.push(m)
    }
  })

  // Keyboard shortcut Ctrl+B
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
        e.preventDefault()
        onToggleCollapse?.()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onToggleCollapse])

  if (collapsed) {
    return (
      <aside 
        data-slot="book-toc-collapsed"
        className="w-16 bg-white border-r border-amber-100 h-full flex flex-col items-center py-4 gap-4 transition-all"
      >
        <button 
          onClick={onToggleCollapse}
          className="p-2 hover:bg-amber-50 rounded-lg text-on-surface-variant transition-colors"
          title="展开目录 (Ctrl+B)"
        >
          <span className="material-symbols-outlined">menu</span>
        </button>
        <div className="w-8 h-px bg-amber-100" />
        <div className="flex-1 overflow-y-auto no-scrollbar flex flex-col items-center gap-4">
          {modules.map((m, i) => (
            <div 
              key={m.id}
              className={cn(
                "w-2 h-2 rounded-full",
                ['completed', 'notes_generated', 'testing'].includes(m.learningStatus) ? 'bg-emerald-500' :
                ['reading', 'qa', 'qa_in_progress', 'taught'].includes(m.learningStatus) ? 'bg-amber-500' : 'bg-gray-300'
              )}
              title={m.name}
            />
          ))}
        </div>
      </aside>
    )
  }

  return (
    <aside 
      data-slot="book-toc"
      className={cn(
        "w-64 bg-white border-r border-amber-100 h-full flex flex-col transition-all",
        guideMode && "ring-4 ring-amber-400 shadow-2xl"
      )}
    >
      {/* Header */}
      <div className="px-6 py-4 flex items-center justify-between border-b border-amber-50">
        <h3 className="font-black font-headline text-on-surface flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-xl">menu_book</span>
          课程目录
        </h3>
        <button 
          onClick={onToggleCollapse}
          className="p-1.5 hover:bg-amber-50 rounded-lg text-on-surface-variant transition-colors"
          title="收起目录 (Ctrl+B)"
        >
          <span className="material-symbols-outlined text-xl">menu_open</span>
        </button>
      </div>

      {/* Guide Mode Banner */}
      {guideMode && (
        <div className="bg-amber-100 border-b border-amber-200 px-4 py-3 text-xs text-amber-900 font-bold text-center leading-snug">
          推荐学习：老师已为你锁定最优路径，点击高亮模块开始。
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-8 custom-scrollbar">
        {/* Render Grouped Modules */}
        {Object.entries(groups).map(([groupName, groupModules]) => (
          <div key={groupName} className="space-y-2">
            <h4 className="px-4 text-[10px] font-black text-on-surface-variant/50 uppercase tracking-widest">
              {groupName}
            </h4>
            <div className="space-y-1">
              {groupModules.map((m, i) => (
                <BookTOCItem
                  key={m.id}
                  id={m.id}
                  name={m.name}
                  learningStatus={m.learningStatus}
                  index={i + 1}
                  guideMode={guideMode}
                  isRecommended={m.id === recommendedModuleId}
                  isBlocked={guideMode && m.learningStatus !== 'unstarted'}
                  onClick={() => onModuleClick?.(m.id)}
                />
              ))}
            </div>
          </div>
        ))}

        {/* Render Ungrouped Modules */}
        {ungrouped.length > 0 && (
          <div className="space-y-1">
            {ungrouped.map((m, i) => (
              <BookTOCItem
                key={m.id}
                id={m.id}
                name={m.name}
                learningStatus={m.learningStatus}
                index={i + 1}
                guideMode={guideMode}
                isRecommended={m.id === recommendedModuleId}
                isBlocked={guideMode && m.learningStatus !== 'unstarted'}
                onClick={() => onModuleClick?.(m.id)}
              />
            ))}
          </div>
        )}
      </div>
    </aside>
  )
}
