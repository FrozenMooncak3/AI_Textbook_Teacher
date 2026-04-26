'use client'

interface QuotaIndicatorProps {
  remaining: number
  total: number
}

export default function QuotaIndicator({ remaining, total }: QuotaIndicatorProps) {
  if (total <= 0) return null

  const used = Math.max(0, total - remaining)
  const dots = Array.from({ length: total }, (_, i) => i < used)

  return (
    <div className="flex flex-wrap items-center justify-center gap-3 mb-6 px-4 py-3 bg-surface-container-low rounded-xl">
      <span className="text-sm font-bold text-on-surface-variant">
        剩余上传额度 <span className="text-primary text-base font-black">{remaining}</span> 本 / 累计 {total} 本
      </span>
      <div className="flex gap-1.5">
        {dots.map((isUsed, i) => (
          <span
            key={i}
            className={`w-2.5 h-2.5 rounded-full ${
              isUsed ? 'bg-on-surface-variant/30' : 'bg-primary'
            }`}
          />
        ))}
      </div>
      {remaining === 0 && (
        <span className="text-xs font-bold text-primary ml-2">
          已用完，邀请好友 +1 本
        </span>
      )}
    </div>
  )
}
