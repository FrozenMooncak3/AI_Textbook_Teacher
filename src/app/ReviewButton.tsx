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
    <div className="w-full">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between bg-surface-container-high border border-primary/10 hover:bg-surface-container transition-all px-6 py-5 rounded-3xl shadow-sm group"       
      >
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-primary text-on-primary rounded-full flex items-center justify-center text-sm font-black shadow-md shadow-orange-900/20">
            {reviews.length}
          </div>
          <div className="flex flex-col items-start">
            <span className="text-sm font-black text-on-surface font-headline uppercase tracking-widest">待复习任务</span>
            <span className="text-[10px] font-bold text-on-surface-variant/60 uppercase tracking-tighter mt-0.5">REVIEW TASKS DUE TODAY</span>
          </div>
        </div>
        <span className={`material-symbols-outlined transition-transform duration-300 text-on-surface-variant ${expanded ? 'rotate-180' : ''}`}>
          expand_more
        </span>
      </button>

      {expanded && (
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-4 duration-300">
          {reviews.map(r => (
            <Link
              key={r.schedule_id}
              href={`/books/${r.book_id}/modules/${r.module_id}/review?scheduleId=${r.schedule_id}`}
              className="bg-surface-container-lowest rounded-2xl border border-outline-variant/10 p-5 hover:shadow-md hover:border-primary/20 transition-all group flex items-center justify-between gap-4"
            >
              <div className="flex items-center gap-4 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-primary/5 flex items-center justify-center text-primary shrink-0 group-hover:bg-primary group-hover:text-white transition-colors duration-300">
                  <span className="material-symbols-outlined text-xl">auto_stories</span>
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-black text-on-surface truncate group-hover:text-primary transition-colors">
                    {r.module_title}
                  </p>
                  <p className="text-[10px] font-bold text-on-surface-variant/40 uppercase tracking-widest mt-1 truncate">
                    {r.book_title}
                  </p>
                </div>
              </div>
              <div className="text-right shrink-0">
                <span className="inline-block text-[10px] font-black bg-primary/10 text-primary px-2.5 py-1 rounded-lg uppercase tracking-widest mb-1">
                  第 {r.review_round} 轮
                </span>
                <p className="text-[10px] font-black text-on-surface-variant/30 uppercase tracking-tighter">
                  到期：{r.due_date}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
