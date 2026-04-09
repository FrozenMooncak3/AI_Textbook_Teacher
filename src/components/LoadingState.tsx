interface LoadingStateProps {
  label: string                    // e.g., "正在准备练习..."
  type?: 'stage' | 'progress'     // default: 'stage'
  current?: number                 // for progress type       
  total?: number                   // for progress type       
}

export default function LoadingState({ label, type = 'stage', current, total }: LoadingStateProps) {
  const pct = type === 'progress' && total ? Math.round((current ?? 0) / total * 100) : 0

  return (
    <div className="flex flex-col items-center justify-center py-10">
      {type === 'progress' && total ? (
        <div className="w-48 bg-surface-container rounded-full h-2 mb-4 overflow-hidden shadow-inner">
          <div
            className="bg-primary h-2 rounded-full transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      ) : (
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mb-6" />
      )}
      <p className="text-sm font-bold text-on-surface-variant font-headline tracking-wide uppercase opacity-70 animate-pulse">
        {label}
      </p>
    </div>
  )
}
