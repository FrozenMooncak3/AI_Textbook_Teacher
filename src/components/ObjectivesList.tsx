import { cn } from '@/lib/utils'

type ObjectiveItem = {
  id: string
  title: string
  summary: string
}

interface ObjectivesListProps {
  items: ObjectiveItem[]
}

export default function ObjectivesList({ items }: ObjectivesListProps) {
  return (
    <ol data-slot="objectives-list" className="space-y-3">
      {items.map((item, index) => (
        <li
          key={item.id}
          data-slot="objective-item"
          className="flex items-start gap-4 p-4 bg-amber-50/80 border border-amber-200 rounded-lg transition-colors hover:bg-amber-50"
        >
          <span className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-on-primary text-sm font-bold shrink-0">
            {index + 1}
          </span>
          <div className="flex flex-col flex-1 min-w-0">
            <span className="text-sm font-bold text-on-surface">
              {item.title}
            </span>
            <span className="text-[13px] text-on-surface-variant mt-1 leading-relaxed">
              {item.summary}
            </span>
          </div>
        </li>
      ))}
    </ol>
  )
}
