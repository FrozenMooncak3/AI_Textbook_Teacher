'use client'

import { useState } from 'react'
import ReviewBriefing from './ReviewBriefing'
import ReviewSession from './ReviewSession'

interface ReviewPageClientProps {
  bookId: number
  moduleId: number
  scheduleId: number
  bookTitle: string
  moduleTitle: string
}

export default function ReviewPageClient({
  bookId,
  moduleId,
  scheduleId,
  bookTitle,
  moduleTitle,
}: ReviewPageClientProps) {
  const [phase, setPhase] = useState<'briefing' | 'session'>('briefing')

  if (phase === 'briefing') {
    return (
      <ReviewBriefing
        scheduleId={scheduleId}
        bookId={bookId}
        onStart={() => setPhase('session')}
      />
    )
  }

  return (
    <ReviewSession
      bookId={bookId}
      moduleId={moduleId}
      scheduleId={scheduleId}
      bookTitle={bookTitle}
      moduleTitle={moduleTitle}
    />
  )
}
