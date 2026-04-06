'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Worker, Viewer } from '@react-pdf-viewer/core'
import { defaultLayoutPlugin } from '@react-pdf-viewer/default-layout'
import '@react-pdf-viewer/core/lib/styles/index.css'
import '@react-pdf-viewer/default-layout/lib/styles/index.css'

import ScreenshotOverlay from './ScreenshotOverlay'
import AiChatDialog from './AiChatDialog'

interface Props {
  bookId: number
  bookTitle: string
}

export default function PdfViewer({ bookId, bookTitle }: Props) {
  const router = useRouter()
  const viewerRef = useRef<HTMLDivElement>(null)

  const defaultLayoutPluginInstance = defaultLayoutPlugin()

  // 截图问 AI
  const [screenshotMode, setScreenshotMode] = useState(false)
  const [chatImage, setChatImage] = useState<string | null>(null)
  const [chatPage, setChatPage] = useState(1)

  // OCR/KP 进度
  const [ocrStatus, setOcrStatus] = useState<'pending' | 'processing' | 'done' | 'failed'>('pending')
  const [ocrCurrent, setOcrCurrent] = useState(0)
  const [ocrTotal, setOcrTotal] = useState(0)
  const [kpStatus, setKpStatus] = useState<'pending' | 'processing' | 'completed' | 'failed'>('pending')
  const [kpBannerDismissed, setKpBannerDismissed] = useState(false)
  const hasTriggeredExtraction = useRef(false)

  useEffect(() => {
    let cancelled = false
    async function poll() {
      try {
        const res = await fetch(`/api/books/${bookId}/status`)
        if (!res.ok || cancelled) return
        const data = await res.json()
        const s = data.data // unwrap handleRoute wrapper
        if (!s) return
        setOcrStatus(s.parse_status || 'pending')
        setOcrCurrent(s.ocr_current_page ?? 0)
        setOcrTotal(s.ocr_total_pages ?? 0)
        const currentKpStatus = s.kp_extraction_status || 'pending'
        setKpStatus(currentKpStatus)

        if (s.parse_status === 'done' && currentKpStatus === 'pending' && !hasTriggeredExtraction.current) {
          hasTriggeredExtraction.current = true
          fetch(`/api/books/${bookId}/extract`, { method: 'POST' }).catch(() => {
            hasTriggeredExtraction.current = false
          })
        }
      } catch { /* ignore */ }
    }
    poll()
    const id = setInterval(() => {
      if ((ocrStatus === 'done' || ocrStatus === 'failed') && 
          (kpStatus === 'completed' || kpStatus === 'failed')) return
      poll()
    }, 3000)
    return () => { cancelled = true; clearInterval(id) }
  }, [bookId, ocrStatus, kpStatus])

  const handleRetryExtraction = async () => {
    setKpStatus('processing')
    try {
      await fetch(`/api/books/${bookId}/extract`, { method: 'POST' })
    } catch {
      setKpStatus('failed')
    }
  }

  return (
    <div className="flex flex-col h-full bg-gray-100">
      {/* 顶部工具栏 (App Navigation & Features) */}
      <div className="bg-white border-b border-gray-200 px-4 h-14 flex items-center gap-4 shrink-0 shadow-sm z-10">
        <button
          onClick={() => router.push(`/books/${bookId}`)}
          className="text-sm font-medium text-gray-600 hover:text-gray-900 flex items-center gap-1 bg-gray-50 hover:bg-gray-100 px-3 py-1.5 rounded-lg transition-colors"
        >
          <span>←</span> 返回教材
        </button>

        <div className="w-px h-6 bg-gray-200 shrink-0" />

        <span className="text-sm text-gray-900 truncate flex-1 min-w-0 font-bold">
          {bookTitle}
        </span>

        <div className="w-px h-6 bg-gray-200 shrink-0" />

        <button
          onClick={() => setScreenshotMode(true)}
          className={`text-sm font-medium px-4 py-1.5 rounded-lg shrink-0 transition-colors flex items-center gap-2 ${
            screenshotMode
              ? 'bg-blue-100 text-blue-700 shadow-inner'
              : 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm'
          }`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
          {screenshotMode ? '按 Esc 取消截图' : '截图问 AI'}
        </button>
      </div>

      {/* KP 提取状态横幅 */}
      {!kpBannerDismissed && (
        <div className={`px-4 py-2 flex items-center justify-between transition-colors z-10 shadow-sm ${
          kpStatus === 'failed' ? 'bg-red-50 border-b border-red-100' : 
          kpStatus === 'completed' ? 'bg-green-50 border-b border-green-100' : 'bg-blue-50 border-b border-blue-100'
        }`}>
          <div className="flex items-center gap-3">
            {kpStatus === 'processing' && (
              <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            )}
            <span className={`text-xs font-bold uppercase tracking-widest ${
              kpStatus === 'failed' ? 'text-red-700' : 
              kpStatus === 'completed' ? 'text-green-700' : 'text-blue-700'
            }`}>
              {kpStatus === 'pending' && ocrStatus === 'done' && 'OCR COMPLETED, PREPARING EXTRACTION...'}
              {kpStatus === 'pending' && ocrStatus !== 'done' && `PREPARING PDF (${ocrCurrent}/${ocrTotal})...`}
              {kpStatus === 'processing' && 'EXTRACTING KNOWLEDGE POINTS (MAY TAKE A FEW MINUTES)...'}
              {kpStatus === 'completed' && 'MODULE MAP GENERATED!'}
              {kpStatus === 'failed' && 'EXTRACTION FAILED'}
            </span>
          </div>

          <div className="flex items-center gap-3">
            {kpStatus === 'completed' && (
              <button
                onClick={() => router.push(`/books/${bookId}/module-map`)}
                className="text-xs bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded-lg font-bold shadow-sm transition-colors"
              >
                查看模块地图 →
              </button>
            )}
            {kpStatus === 'failed' && (
              <button
                onClick={handleRetryExtraction}
                className="text-xs bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded-lg font-bold shadow-sm transition-colors"
              >
                重试提取
              </button>
            )}
            <button 
              onClick={() => setKpBannerDismissed(true)}
              className="text-gray-400 hover:text-gray-600 p-1"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* PDF Viewer Container */}
      <div className="flex-1 relative overflow-hidden bg-gray-100" ref={viewerRef}>
        <Worker workerUrl={`https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js`}>
          <div className="h-full">
            <Viewer
              fileUrl={`/api/books/${bookId}/pdf`}
              plugins={[defaultLayoutPluginInstance]}
              onPageChange={(e) => setChatPage(e.currentPage + 1)}
            />
          </div>
        </Worker>

        {/* 截图覆盖层 */}
        {screenshotMode && (
          <ScreenshotOverlay
            scrollContainer={viewerRef.current}
            currentPage={chatPage}
            onCapture={(img, page) => {
              setScreenshotMode(false)
              setChatImage(img)
              // chatPage is already set by onPageChange
            }}
            onCancel={() => setScreenshotMode(false)}
          />
        )}
      </div>

      {/* AI 对话框 */}
      {chatImage && (
        <AiChatDialog
          bookId={bookId}
          imageBase64={chatImage}
          pageNumber={chatPage}
          onClose={() => setChatImage(null)}
        />
      )}
    </div>
  )
}
