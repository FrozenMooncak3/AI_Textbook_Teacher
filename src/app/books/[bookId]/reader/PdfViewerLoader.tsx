'use client'

import dynamic from 'next/dynamic'

const PdfViewer = dynamic(() => import('./PdfViewer'), { ssr: false })

export default function PdfViewerLoader({ bookId, bookTitle }: { bookId: number; bookTitle: string }) {
  return <PdfViewer bookId={bookId} bookTitle={bookTitle} />
}
