import { cn } from '@/lib/utils'

interface MasteryItem {
  label: string
  count: number
  percentage: number
  color: 'emerald' | 'blue' | 'orange'
}

interface MasteryBarsProps {
  data: MasteryItem[]
  className?: string
}

const barColors = { emerald: 'bg-emerald-500', blue: 'bg-blue-500', orange: 'bg-orange-400' }
const labelColors = { emerald: 'text-emerald-700', blue: 'text-blue-700', orange: 'text-orange-700' }

export default function MasteryBars({ data, className }: MasteryBarsProps) {
  return (
    <div
      data-slot="mastery-bars"
      className={cn("bg-surface-container-low rounded-2xl p-6", className)}
    >
      <h4 className="text-sm font-bold text-on-surface-variant uppercase tracking-wider mb-4">掌握度分布</h4>
      <div className="flex flex-col gap-4">
        {data.map((item) => (
          <div key={item.label}>
            <div className="flex items-center justify-between mb-1">
              <span className={cn("text-sm font-bold", labelColors[item.color])}>{item.label}: {item.count}</span>
              <span className="text-sm font-bold text-on-surface-variant">{item.percentage}%</span>
            </div>
            <div className="h-3 bg-surface-container rounded-full overflow-hidden">
              <div className={cn("h-full rounded-full", barColors[item.color])} style={{ width: `${item.percentage}%` }} />     
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
