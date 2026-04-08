'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'

type Phase = 'ocr' | 'extracting' | 'done' | 'error'

export default function ProcessingPoller({ bookId }: { bookId: number }) {
  const router = useRouter()
  const [phase, setPhase] = useState<Phase>('ocr')
  const [ocrCurrent, setOcrCurrent] = useState(0)
  const [ocrTotal, setOcrTotal] = useState(0)
  const [error, setError] = useState('')
  const extractIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Cleanup extraction polling on unmount
  useEffect(() => {
    return () => {
      if (extractIntervalRef.current) clearInterval(extractIntervalRef.current)
    }
  }, [])

  const startExtractionPolling = useCallback(() => {
    if (extractIntervalRef.current) return

    extractIntervalRef.current = setInterval(async () => {    
      const statusRes = await fetch(`/api/books/${bookId}/status`)
      if (!statusRes.ok) return
      const statusJson = await statusRes.json()
      const s = statusJson.data  // UNWRAP handleRoute     

      if (s.kp_extraction_status === 'completed') {       // NOT 'done'
        clearInterval(extractIntervalRef.current!)
        extractIntervalRef.current = null
        setPhase('done')
        router.refresh()
      } else if (s.kp_extraction_status === 'failed') {   // NOT 'error'
        clearInterval(extractIntervalRef.current!)
        extractIntervalRef.current = null
        setError('知识点提取失败，请在系统日志中查看详情或尝试重新生成。')
        setPhase('error')
      }
    }, 4000)
  }, [bookId, router])

  // OCR polling — only runs when phase is 'ocr'
  useEffect(() => {
    if (phase !== 'ocr') return

    const interval = setInterval(async () => {
      const res = await fetch(`/api/books/${bookId}/status`)  
      if (!res.ok) return
      const json = await res.json()
      const status = json.data  // CRITICAL: unwrap handleRoute wrapper

      // Update OCR progress
      setOcrCurrent(status.ocr_current_page ?? 0)
      setOcrTotal(status.ocr_total_pages ?? 0)

      if (status.parse_status === 'done') {
        clearInterval(interval)

        // Check if KP extraction is already done (e.g., user refreshed page)
        if (status.kp_extraction_status === 'completed') {    
          setPhase('done')
          router.refresh()
          return
        }

        // Auto-trigger KP extraction
        setPhase('extracting')
        const extractRes = await fetch(`/api/books/${bookId}/extract`, { method: 'POST' })

        if (!extractRes.ok) {
          const extractJson = await extractRes.json()
          // ALREADY_COMPLETED (409) — extraction already done, just refresh
          if (extractJson.code === 'ALREADY_COMPLETED') {     
            setPhase('done')
            router.refresh()
            return
          }
          // ALREADY_PROCESSING (409) — poll for completion  
          if (extractRes.status === 409) {
            startExtractionPolling()
            return
          }
          // Real error
          setError(extractJson.error ?? '知识点提取启动失败')
          setPhase('error')
          return
        }

        // Extraction started successfully — poll for completion
        startExtractionPolling()
      }

      if (status.parse_status === 'error') {
        clearInterval(interval)
        setError('PDF 解析失败，请查看系统日志了解详情')   
        setPhase('error')
      }
    }, 4000)

    return () => clearInterval(interval)
  }, [bookId, phase, router, startExtractionPolling])

  // --- RENDER ---

  if (phase === 'ocr') {
    const pct = ocrTotal > 0 ? Math.round((ocrCurrent / ocrTotal) * 100) : 0
    return (
      <div className="bg-surface-container rounded-[32px] border border-outline-variant/10 p-10 text-center shadow-sm">
        <div className="w-full bg-surface-variant rounded-full h-2 mb-6 overflow-hidden">
          <div className="bg-primary-fixed-dim h-full rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
        </div>
        <p className="text-lg font-bold text-on-surface font-headline">     
          {ocrTotal > 0 ? `正在识别文字内容 (${ocrCurrent}/${ocrTotal} 页)` : '正在启动 OCR...'}
        </p>
        <p className="text-sm text-on-surface-variant mt-2">这是教材深度学习的第一步，请耐心等待</p>
      </div>
    )
  }

  if (phase === 'extracting') {
    return (
      <div className="bg-surface-container rounded-[32px] border border-outline-variant/10 p-10 text-center shadow-sm">
        <div className="flex justify-center mb-6">
          <div className="w-10 h-10 border-4 border-primary-fixed-dim border-t-transparent rounded-full animate-spin" />
        </div>
        <p className="text-lg font-bold text-on-surface font-headline">正在分析教材知识点...</p>
        <p className="text-sm text-on-surface-variant mt-2">AI 正在根据识别出的教材文本划分模块并提取知识点</p>
      </div>
    )
  }

  if (phase === 'error') {
    return (
      <div className="bg-error-container/10 border border-error/20 rounded-[32px] p-8 text-center shadow-sm">
        <span className="material-symbols-outlined text-error text-5xl mb-4" style={{ fontVariationSettings: "'FILL' 1" }}>error</span>
        <p className="text-lg font-bold text-error font-headline">{error}</p>
        <a href="/logs" className="text-sm text-error underline mt-4 block font-bold">查看系统日志</a>
      </div>
    )
  }

  return null // phase === 'done' — parent re-renders via router.refresh()
}
