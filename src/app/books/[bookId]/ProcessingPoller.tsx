'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import LoadingState from '@/components/LoadingState'
import ContentCard from '@/components/ui/ContentCard'
import AmberButton from '@/components/ui/AmberButton'

interface ModuleStatus {
  id: number
  title: string
  orderIndex: number
  textStatus: string
  ocrStatus: string
  kpStatus: string
}

interface ModuleStatusResponse {
  bookId: number
  parseStatus: string
  kpExtractionStatus: string
  ocrCurrentPage: number
  ocrTotalPages: number
  modules: ModuleStatus[]
}

interface LegacyStatus {
  parse_status: string
  kp_extraction_status: string
  ocr_current_page: number | null
  ocr_total_pages: number | null
}

export default function ProcessingPoller({ bookId }: { bookId: number }) {
  const router = useRouter()
  const [data, setData] = useState<ModuleStatusResponse | null>(null)
  const [error, setError] = useState('')
  const [isLegacy, setIsLegacy] = useState(false)
  const [legacyStatus, setLegacyStatus] = useState<LegacyStatus | null>(null)
  
  const poll = useCallback(async () => {
    try {
      if (isLegacy) {
        const res = await fetch(`/api/books/${bookId}/status`)
        if (!res.ok) return
        const json = await res.json()
        const status = json.data
        setLegacyStatus(status)

        if (status.parse_status === 'done' && status.kp_extraction_status === 'completed') {
          router.refresh()
        } else if (status.parse_status === 'error' || status.kp_extraction_status === 'failed') {
          setError(status.parse_status === 'error' ? 'PDF 解析失败' : '知识点提取失败')
        }
        return
      }

      const res = await fetch(`/api/books/${bookId}/module-status`)
      if (res.status === 404) {
        setIsLegacy(true)
        return
      }
      if (!res.ok) return
      
      const json = await res.json()
      const statusData: ModuleStatusResponse = json.data
      setData(statusData)

      // Error check
      const hasModuleError = statusData.modules.some(m => m.kpStatus === 'failed')
      if (statusData.parseStatus === 'error' || hasModuleError) {
        setError(statusData.parseStatus === 'error' ? 'PDF 解析失败' : '知识点分析失败，部分模块出错')
        return
      }

      // Completion check
      const allModulesDone = statusData.modules.length > 0 && statusData.modules.every(m => m.kpStatus === 'completed')
      if (allModulesDone && statusData.parseStatus === 'done') {
        router.refresh()
      }
    } catch {
      // Silent — next 4s poll cycle will retry
    }
  }, [bookId, isLegacy, router])

  useEffect(() => {
    const interval = setInterval(poll, 4000)
    poll() // initial poll
    return () => clearInterval(interval)
  }, [poll])

  if (error) {
    return (
      <ContentCard className="p-12 text-center border-error/20">
        <span className="material-symbols-outlined text-error text-5xl mb-6" style={{ fontVariationSettings: "'FILL' 1" }}>error</span>
        <p className="text-lg font-bold text-error font-headline mb-2">{error}</p>
        <p className="text-sm text-on-surface-variant mb-8">请查看系统日志了解详情或重新上传</p>
        <div className="flex flex-col gap-3 items-center">
          <a href="/logs" className="text-sm text-error underline font-bold">查看系统日志</a>
          <AmberButton onClick={() => router.push('/upload')}>重新上传</AmberButton>
        </div>
      </ContentCard>
    )
  }

  if (isLegacy) {
    const ocrCurrent = legacyStatus?.ocr_current_page ?? 0
    const ocrTotal = legacyStatus?.ocr_total_pages ?? 0
    
    if (legacyStatus?.parse_status === 'processing' || !legacyStatus) {
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

    return (
      <ContentCard className="p-10 text-center space-y-4">
        <LoadingState label="正在分析教材知识点..." />
        <p className="text-sm text-on-surface-variant">AI 正在根据识别出的教材文本划分模块并提取知识点</p>
      </ContentCard>
    )
  }

  if (!data) {
    return (
      <ContentCard className="p-10 text-center">
        <LoadingState label="正在获取处理状态..." />
      </ContentCard>
    )
  }

  const { modules, ocrCurrentPage, ocrTotalPages, parseStatus } = data

  if (modules.length === 0 && parseStatus === 'processing') {
    return (
      <ContentCard className="p-10 text-center space-y-4">
        <LoadingState label="正在初始化模块列表..." />
        <p className="text-sm text-on-surface-variant">系统正在准备教材结构，请稍候</p>
      </ContentCard>
    )
  }

  const isOcrProcessing = modules.some(m => m.ocrStatus === 'processing')

  return (
    <div className="space-y-6">
      <ContentCard className="p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h3 className="text-xl font-black font-headline tracking-tight">教材处理进度</h3>
            <p className="text-sm text-on-surface-variant">系统正在逐个模块进行 OCR 识别和知识点提取</p>
          </div>
          {isOcrProcessing && ocrTotalPages > 0 && (
            <div className="text-right">
              <div className="text-2xl font-black font-headline text-primary">
                {Math.round((ocrCurrentPage / ocrTotalPages) * 100)}%
              </div>
              <div className="text-[10px] font-black text-on-surface-variant/50 uppercase tracking-widest">
                OCR 识别中 ({ocrCurrentPage}/{ocrTotalPages} 页)
              </div>
            </div>
          )}
        </div>

        <div className="space-y-3">
          {modules.map((module) => {
            let statusLabel = ''
            let statusColor = 'text-on-surface-variant/50'
            let isClickable = false

            if (module.ocrStatus === 'processing') {
              statusLabel = '正在识别'
              statusColor = 'text-amber-600 animate-pulse'
            } else if (module.textStatus === 'pending') {
              statusLabel = '等待中'
              statusColor = 'text-on-surface-variant/30'
            } else if (module.kpStatus === 'completed') {
              statusLabel = '分析完成'
              statusColor = 'text-emerald-600'
            } else if (module.textStatus === 'ready') {
              statusLabel = '可以阅读'
              statusColor = 'text-primary'
              isClickable = true
            }

            return (
              <div 
                key={module.id}
                onClick={() => isClickable && router.push(`/books/${bookId}/reader`)}
                className={`
                  flex items-center justify-between p-4 rounded-2xl border border-outline-variant/5 transition-all
                  ${isClickable ? 'bg-primary/5 border-primary/10 cursor-pointer hover:bg-primary/10' : 'bg-surface-container-low'}
                `}
              >
                <div className="flex items-center gap-4">
                  <div className={`
                    w-8 h-8 rounded-lg flex items-center justify-center font-black font-headline text-xs
                    ${isClickable ? 'bg-primary text-white shadow-sm' : 'bg-surface-container text-on-surface-variant/40'}
                  `}>
                    {String(module.orderIndex).padStart(2, '0')}
                  </div>
                  <span className={`font-bold ${isClickable ? 'text-on-surface' : 'text-on-surface-variant/60'}`}>
                    {module.title}
                  </span>
                </div>
                <div className={`text-xs font-black uppercase tracking-widest ${statusColor}`}>
                  {statusLabel}
                </div>
              </div>
            )
          })}
        </div>
      </ContentCard>
      
      <p className="text-center text-xs text-on-surface-variant/40 font-medium">
        您可以先开始阅读已完成识别的模块，知识点提取完成后将解锁更多功能
      </p>
    </div>
  )
}
