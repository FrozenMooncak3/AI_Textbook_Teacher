'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'

interface DueReview {
  schedule_id: number
  module_id: number
  module_title: string
  book_id: number
  book_title: string
  review_round: number
  due_date: string
}

export default function ReviewButton() {
  const [reviews, setReviews] = useState<DueReview[]>([])       
  const [expanded, setExpanded] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/review/due')
      .then(r => r.json())
      .then(result => {
        if (result.success) setReviews(result.data.reviews)     
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading || reviews.length === 0) return null

  return (
    <div className="mb-8">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between bg-amber-50 border border-amber-200 hover:bg-amber-100 text-amber-900 px-5 py-4 rounded-xl transition-all shadow-sm"       
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-amber-500 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-sm">
            {reviews.length}
          </div>
          <span className="text-sm font-bold uppercase tracking-tight">待复习任务</span>
        </div>
        <svg 
          className={`w-5 h-5 transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`} 
          fill="none" 
          viewBox="0 0 24 24" 
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="mt-3 bg-white rounded-xl border border-slate-200 overflow-hidden shadow-lg animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="divide-y divide-slate-100">
            {reviews.map(r => (
              <Link
                key={r.schedule_id}
                href={`/books/${r.book_id}/modules/${r.module_id}/review?scheduleId=${r.schedule_id}`}
                className="block px-5 py-4 hover:bg-amber-50/50 transition-colors group"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm font-bold text-slate-900 group-hover:text-amber-900 transition-colors">
                      {r.module_title}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      {r.book_title}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded uppercase tracking-tighter">
                      Round {r.review_round}
                    </span>
                    <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-tighter font-medium">
                      Due: {r.due_date}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
