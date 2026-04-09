'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import LoadingState from '@/components/LoadingState'
import ContentCard from '@/components/ui/ContentCard'
import AmberButton from '@/components/ui/AmberButton'

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
      const s = statusJson.data  

      if (s.kp_extraction_status === 'completed') {
        clearInterval(extractIntervalRef.current!)
        extractIntervalRef.current = null
        setPhase('done')
        router.refresh()
      } else if (s.kp_extraction_status === 'failed') {
        clearInterval(extractIntervalRef.current!)
        extractIntervalRef.current = null
        setError('知识点提取失败，请在系统日志中查看详情或尝试重新生成。')
        setPhase('error')
      }
    }, 4000)
  }, [bookId, router])

  // OCR polling
  useEffect(() => {
    if (phase !== 'ocr') return

    const interval = setInterval(async () => {
      const res = await fetch(`/api/books/${bookId}/status`)  
      if (!res.ok) return
      const json = await res.json()
      const status = json.data  

      setOcrCurrent(status.ocr_current_page ?? 0)
      setOcrTotal(status.ocr_total_pages ?? 0)

      if (status.parse_status === 'done') {
        clearInterval(interval)

        if (status.kp_extraction_status === 'completed') {    
          setPhase('done')
          router.refresh()
          return
        }

        setPhase('extracting')
        const extractRes = await fetch(`/api/books/${bookId}/extract`, { method: 'POST' })

        if (!extractRes.ok) {
          const extractJson = await extractRes.json()
          if (extractJson.code === 'ALREADY_COMPLETED') {     
            setPhase('done')
            router.refresh()
            return
          }
          if (extractRes.status === 409) {
            startExtractionPolling()
            return
          }
          setError(extractJson.error ?? '知识点提取启动失败')
          setPhase('error')
          return
        }

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

  if (phase === 'ocr') {
    return (
      <ContentCard className="p-10 text-center space-y-4">
        <LoadingState 
          label={ocrTotal > 0 ? `正在识别文字内容 (${ocrCurrent}/${ocrTotal} 页)` : '正在启动 OCR...'} 
          type="progress"
          current={ocrCurrent}
          total={ocrTotal}
        />
        <p className="text-sm text-on-surface-variant">这是教材深度学习的第一步，请耐心等待</p>
      </ContentCard>
    )
  }

  if (phase === 'extracting') {
    return (
      <ContentCard className="p-10 text-center space-y-4">
        <LoadingState label="正在分析教材知识点..." />
        <p className="text-sm text-on-surface-variant">AI 正在根据识别出的教材文本划分模块并提取知识点</p>
      </ContentCard>
    )
  }

  if (phase === 'error') {
    return (
      <ContentCard className="p-12 text-center border-error/20">
        <span className="material-symbols-outlined text-error text-5xl mb-6" style={{ fontVariationSettings: "'FILL' 1" }}>error</span>
        <p className="text-lg font-bold text-error font-headline mb-2">{error}</p>
        <a href="/logs" className="text-sm text-error underline mt-4 block font-bold mb-8">查看系统日志</a>
        <AmberButton onClick={() => router.push('/upload')}>重新上传</AmberButton>
      </ContentCard>
    )
  }

  return null 
}
