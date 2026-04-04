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
        <div className="w-48 bg-gray-200 rounded-full h-2 mb-4">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      ) : (
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mb-4" />
      )}
      <p className="text-sm font-medium text-gray-600">{label}</p>
    </div>
  )
}
