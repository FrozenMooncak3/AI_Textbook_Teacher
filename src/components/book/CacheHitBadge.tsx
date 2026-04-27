'use client'

interface CacheHitBadgeProps {
  hitCount: number
}

export default function CacheHitBadge({ hitCount }: CacheHitBadgeProps) {
  if (hitCount <= 0) return null

  return (
    <div className="flex items-center justify-center gap-2 mb-6 px-4 py-2.5 bg-emerald-50 border border-emerald-200 rounded-xl">
      <span className="text-emerald-600 text-base font-black">✓</span>
      <span className="text-sm font-bold text-emerald-900">
        已为 <span className="text-emerald-700 text-base font-black">{hitCount}</span> 个同学解析过这本书
      </span>
    </div>
  )
}
