'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist'
import ScreenshotOverlay from './ScreenshotOverlay'
import AiChatDialog from './AiChatDialog'
import TocSidebar from './TocSidebar'

const RENDER_BUFFER = 800 // px outside viewport to pre-render

interface Props {
  bookId: number
  bookTitle: string
}

interface PageDim {
  w: number
  h: number
}

export default function PdfViewer({ bookId, bookTitle }: Props) {
  const router = useRouter()
  const scrollRef = useRef<HTMLDivElement>(null)
  const pageEls = useRef<Map<number, HTMLDivElement>>(new Map())

  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null)
  const [totalPages, setTotalPages] = useState(0)
  const [dims, setDims] = useState<PageDim[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [scale, setScale] = useState(1.25)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [pageInput, setPageInput] = useState('1')
  const [viewMode, setViewMode] = useState<'scroll' | 'single'>('scroll')

  // 目录侧边栏
  const [tocOpen, setTocOpen] = useState(false)

  // 截图问 AI
  const [screenshotMode, setScreenshotMode] = useState(false)
  const [chatImage, setChatImage] = useState<string | null>(null)
  const [chatPage, setChatPage] = useState(1)

  // OCR 进度
  const [ocrStatus, setOcrStatus] = useState<'pending' | 'processing' | 'done' | 'failed'>('pending')
  const [ocrCurrent, setOcrCurrent] = useState(0)
  const [ocrTotal, setOcrTotal] = useState(0)

  // KP 提取状态 (T5)
  const [kpStatus, setKpStatus] = useState<'pending' | 'processing' | 'completed' | 'failed'>('pending')
  const [kpBannerDismissed, setKpBannerDismissed] = useState(false)
  const hasTriggeredExtraction = useRef(false)

  const renderedAt = useRef<Map<number, number>>(new Map())
  const renderTasks = useRef<Map<number, RenderTask>>(new Map())
  const singleCanvasRef = useRef<HTMLCanvasElement>(null)
  const singleRenderTask = useRef<RenderTask | null>(null)
  const isJumping = useRef(false)

  // ── 轮询 OCR & KP 提取进度 ──────────────────────────────────────────
  useEffect(() => {
    let cancelled = false

    async function poll() {
      try {
        const res = await fetch(`/api/books/${bookId}/status`)
        if (!res.ok || cancelled) return
        const data = await res.json()
        
        // 旧 OCR 状态
        setOcrStatus(data.parseStatus)
        setOcrCurrent(data.ocrCurrentPage ?? 0)
        setOcrTotal(data.ocrTotalPages ?? 0)

        // 新 KP 提取状态 (T5)
        const currentKpStatus = data.kp_extraction_status || 'pending'
        setKpStatus(currentKpStatus)

        // 如果 OCR 完成且 KP 提取尚未开始，自动触发一次提取
        if (data.parseStatus === 'done' && currentKpStatus === 'pending' && !hasTriggeredExtraction.current) {
          hasTriggeredExtraction.current = true
          fetch(`/api/books/${bookId}/extract`, { method: 'POST' }).catch(() => {
            hasTriggeredExtraction.current = false // 重置以便重试
          })
        }
      } catch { /* ignore */ }
    }

    poll()
    const id = setInterval(() => {
      // 如果两个都完成了，停止轮询
      if ((ocrStatus === 'done' || ocrStatus === 'failed') && 
          (kpStatus === 'completed' || kpStatus === 'failed')) {
        return
      }
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

  // ── 加载 PDF 文档 ─────────────────────────────────────────
  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const pdfjsLib = await import('pdfjs-dist')
        pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
          'pdfjs-dist/build/pdf.worker.min.mjs',
          import.meta.url
        ).toString()

        const doc = await pdfjsLib.getDocument(`/api/books/${bookId}/pdf`).promise
        if (cancelled) return

        const d: PageDim[] = []
        for (let i = 1; i <= doc.numPages; i++) {
          const p = await doc.getPage(i)
          const vp = p.getViewport({ scale: 1 })
          d.push({ w: vp.width, h: vp.height })
        }
        if (cancelled) return

        setPdfDoc(doc)
        setTotalPages(doc.numPages)
        setDims(d)
        setLoading(false)
      } catch {
        if (!cancelled) {
          setError('PDF 加载失败，请检查文件是否存在')
          setLoading(false)
        }
      }
    }
    load()
    return () => { cancelled = true }
  }, [bookId])

  // ── 渲染单页到 canvas ─────────────────────────────────────
  const renderPage = useCallback(async (
    doc: PDFDocumentProxy,
    pageNum: number,
    sc: number,
  ) => {
    const el = pageEls.current.get(pageNum)
    if (!el) return

    // 取消该页正在进行的渲染
    const prev = renderTasks.current.get(pageNum)
    if (prev) prev.cancel()

    const page = await doc.getPage(pageNum)
    const viewport = page.getViewport({ scale: sc })

    let canvas = el.querySelector('canvas')
    if (!canvas) {
      canvas = document.createElement('canvas')
      canvas.className = 'block'
      el.appendChild(canvas)
    }
    canvas.width = viewport.width
    canvas.height = viewport.height

    const task = page.render({ canvas, viewport })
    renderTasks.current.set(pageNum, task)
    try {
      await task.promise
      renderedAt.current.set(pageNum, sc)
    } catch {
      // RenderingCancelledException is expected when cancelled
    } finally {
      if (renderTasks.current.get(pageNum) === task) {
        renderTasks.current.delete(pageNum)
      }
    }
  }, [])

  // ── IntersectionObserver：按需渲染 + 缩放时重渲染 ─────────
  useEffect(() => {
    if (!pdfDoc || dims.length === 0) return
    const container = scrollRef.current
    if (!container) return

    // scale 变了：取消所有进行中的渲染，清除旧 canvas
    renderTasks.current.forEach(task => task.cancel())
    renderTasks.current.clear()
    pageEls.current.forEach(el => {
      const c = el.querySelector('canvas')
      if (c) c.remove()
    })
    renderedAt.current.clear()

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const num = Number(entry.target.getAttribute('data-page'))
          if (entry.isIntersecting && renderedAt.current.get(num) !== scale) {
            renderPage(pdfDoc, num, scale)
          }
        }
      },
      { root: container, rootMargin: `${RENDER_BUFFER}px 0px` },
    )

    pageEls.current.forEach(el => observer.observe(el))
    return () => observer.disconnect()
  }, [pdfDoc, dims, scale, renderPage])

  // ── 滚动跟踪当前页码 ─────────────────────────────────────
  useEffect(() => {
    const container = scrollRef.current
    if (!container || totalPages === 0) return

    let ticking = false
    const onScroll = () => {
      if (ticking || isJumping.current) return
      ticking = true
      requestAnimationFrame(() => {
        const target = container.scrollTop + container.clientHeight * 0.3
        let best = 1
        let bestDist = Infinity
        pageEls.current.forEach((el, num) => {
          const mid = el.offsetTop + el.offsetHeight / 2
          const dist = Math.abs(mid - target)
          if (dist < bestDist) { bestDist = dist; best = num }
        })
        setCurrentPage(best)
        setPageInput(String(best))
        ticking = false
      })
    }

    container.addEventListener('scroll', onScroll, { passive: true })
    return () => container.removeEventListener('scroll', onScroll)
  }, [totalPages])

  // ── 单页模式：直接渲染当前页 ─────────────────────────────
  useEffect(() => {
    if (viewMode !== 'single' || !pdfDoc || !singleCanvasRef.current) return
    const canvas = singleCanvasRef.current

    // 取消上一次渲染
    if (singleRenderTask.current) {
      singleRenderTask.current.cancel()
      singleRenderTask.current = null
    }

    let cancelled = false

    async function render() {
      const page = await pdfDoc!.getPage(currentPage)
      if (cancelled) return
      const viewport = page.getViewport({ scale })
      canvas.width = viewport.width
      canvas.height = viewport.height

      const task = page.render({ canvas, viewport })
      singleRenderTask.current = task
      try {
        await task.promise
      } catch {
        // RenderingCancelledException is expected
      }
    }

    render()
    return () => { cancelled = true }
  }, [viewMode, pdfDoc, currentPage, scale])

  // ── 缩放时保持当前页位置 ──────────────────────────────────
  const changeScale = useCallback((next: number) => {
    const page = currentPage
    setScale(next)
    // 等 DOM 更新后滚到当前页
    requestAnimationFrame(() => {
      const el = pageEls.current.get(page)
      if (el && scrollRef.current) {
        scrollRef.current.scrollTo({ top: el.offsetTop - 12 })
      }
    })
  }, [currentPage])

  // ── 适应宽度 ──────────────────────────────────────────────
  const fitWidth = useCallback(() => {
    const container = scrollRef.current
    if (!container || dims.length === 0) return
    const containerW = container.clientWidth - 32 // padding
    const maxPageW = Math.max(...dims.map(d => d.w))
    const newScale = Math.round((containerW / maxPageW) * 100) / 100
    changeScale(Math.max(0.5, Math.min(3.0, newScale)))
  }, [dims, changeScale])

  // ── 跳转到指定页 ──────────────────────────────────────────
  const goToPage = useCallback((num: number) => {
    const clamped = Math.max(1, Math.min(totalPages, num))
    if (viewMode === 'scroll') {
      const el = pageEls.current.get(clamped)
      if (el && scrollRef.current) {
        isJumping.current = true
        scrollRef.current.scrollTo({ top: el.offsetTop - 12, behavior: 'smooth' })
        setTimeout(() => { isJumping.current = false }, 500)
      }
    }
    setCurrentPage(clamped)
    setPageInput(String(clamped))
  }, [totalPages, viewMode])

  const commitPageInput = useCallback(() => {
    goToPage(parseInt(pageInput) || 1)
  }, [pageInput, goToPage])

  // ── 加载中 ────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-100">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-500">正在加载 PDF...</p>
        </div>
      </div>
    )
  }

  // ── 加载失败 ──────────────────────────────────────────────
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gray-100 gap-4">
        <p className="text-sm text-gray-600">{error}</p>
        <button
          onClick={() => router.push(`/books/${bookId}`)}
          className="text-sm text-blue-600 hover:underline"
        >
          返回教材页
        </button>
      </div>
    )
  }

  // ── 阅读器 ────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-screen bg-gray-100">

      {/* 工具栏 */}
      <div className="bg-white border-b border-gray-200 px-4 h-12 flex items-center gap-3 shrink-0">

        <button
          onClick={() => router.push(`/books/${bookId}`)}
          className="text-sm text-gray-500 hover:text-gray-800 shrink-0"
        >
          ← 返回
        </button>

        {/* 目录 */}
        <button
          onClick={() => setTocOpen(v => !v)}
          className={`text-xs px-2 py-1 rounded shrink-0 transition-colors ${
            tocOpen
              ? 'bg-blue-100 text-blue-700'
              : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100'
          }`}
        >
          目录
        </button>

        <div className="w-px h-4 bg-gray-200 shrink-0" />

        <span className="text-sm text-gray-700 truncate flex-1 min-w-0 font-medium">
          {bookTitle}
        </span>

        {/* 页码 + 跳页 */}
        <div className="flex items-center gap-1 shrink-0 text-sm">
          <input
            type="number"
            min={1}
            max={totalPages}
            value={pageInput}
            onChange={e => setPageInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && commitPageInput()}
            onBlur={commitPageInput}
            className="w-11 text-center border border-gray-300 rounded px-1 py-0.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
          />
          <span className="text-gray-400 text-xs">/ {totalPages}</span>
        </div>

        <div className="w-px h-4 bg-gray-200 shrink-0" />

        {/* 缩放 */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => changeScale(Math.max(0.5, Math.round((scale - 0.25) * 4) / 4))}
            className="w-7 h-7 flex items-center justify-center text-gray-500 hover:bg-gray-100 rounded"
          >
            −
          </button>
          <span className="text-xs text-gray-500 w-10 text-center select-none">
            {Math.round(scale * 100)}%
          </span>
          <button
            onClick={() => changeScale(Math.min(3.0, Math.round((scale + 0.25) * 4) / 4))}
            className="w-7 h-7 flex items-center justify-center text-gray-500 hover:bg-gray-100 rounded"
          >
            +
          </button>
          <button
            onClick={fitWidth}
            className="ml-1 text-xs text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded px-1.5 py-1"
          >
            适应宽度
          </button>
        </div>

        <div className="w-px h-4 bg-gray-200 shrink-0" />

        {/* 截图问 AI */}
        <button
          onClick={() => setScreenshotMode(true)}
          className={`text-xs px-2 py-1 rounded shrink-0 transition-colors ${
            screenshotMode
              ? 'bg-blue-100 text-blue-700'
              : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100'
          }`}
        >
          截图问 AI
        </button>

        <div className="w-px h-4 bg-gray-200 shrink-0" />

        {/* 单页/滚动切换 */}
        <button
          onClick={() => setViewMode(v => v === 'scroll' ? 'single' : 'scroll')}
          className="text-xs text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded px-2 py-1 shrink-0"
          title={viewMode === 'scroll' ? '切换到单页模式' : '切换到滚动模式'}
        >
          {viewMode === 'scroll' ? '单页' : '滚动'}
        </button>

        {/* 单页模式翻页 */}
        {viewMode === 'single' && (
          <>
            <button
              onClick={() => goToPage(currentPage - 1)}
              disabled={currentPage <= 1}
              className="w-7 h-7 flex items-center justify-center text-gray-500 hover:bg-gray-100 rounded text-lg disabled:opacity-30 leading-none shrink-0"
            >
              ‹
            </button>
            <button
              onClick={() => goToPage(currentPage + 1)}
              disabled={currentPage >= totalPages}
              className="w-7 h-7 flex items-center justify-center text-gray-500 hover:bg-gray-100 rounded text-lg disabled:opacity-30 leading-none shrink-0"
            >
              ›
            </button>
          </>
        )}
      </div>

      {/* KP 提取状态横幅 (T5) */}
      {!kpBannerDismissed && (
        <div className={`px-4 py-2 border-b flex items-center justify-between transition-colors ${
          kpStatus === 'failed' ? 'bg-red-50 border-red-100' : 
          kpStatus === 'completed' ? 'bg-green-50 border-green-100' : 'bg-blue-50 border-blue-100'
        }`}>
          <div className="flex items-center gap-3">
            {kpStatus === 'processing' && (
              <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            )}
            <span className={`text-xs font-medium ${
              kpStatus === 'failed' ? 'text-red-700' : 
              kpStatus === 'completed' ? 'text-green-700' : 'text-blue-700'
            }`}>
              {kpStatus === 'pending' && ocrStatus === 'done' && 'OCR 完成，正在提取知识点...'}
              {kpStatus === 'pending' && ocrStatus !== 'done' && `正在准备 PDF (${ocrCurrent}/${ocrTotal})...`}
              {kpStatus === 'processing' && '正在提取知识点...（这可能需要几分钟）'}
              {kpStatus === 'completed' && '模块地图已生成！'}
              {kpStatus === 'failed' && '知识点提取失败'}
            </span>
          </div>

          <div className="flex items-center gap-3">
            {kpStatus === 'completed' && (
              <button
                onClick={() => router.push(`/books/${bookId}/module-map`)}
                className="text-xs bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded font-bold shadow-sm transition-colors"
              >
                查看模块地图 →
              </button>
            )}
            {kpStatus === 'failed' && (
              <button
                onClick={handleRetryExtraction}
                className="text-xs bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded font-bold shadow-sm transition-colors"
              >
                重试
              </button>
            )}
            <button 
              onClick={() => setKpBannerDismissed(true)}
              className="text-gray-400 hover:text-gray-600"
              title="关闭"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* 主体：目录 + 内容 */}
      <div className="flex-1 flex overflow-hidden">

        {/* 目录侧边栏 */}
        {tocOpen && (
          <TocSidebar
            bookId={bookId}
            currentPage={currentPage}
            onNavigate={goToPage}
            onClose={() => setTocOpen(false)}
          />
        )}

        {/* 内容区域 */}
        <div className="flex-1 overflow-hidden relative">
          {viewMode === 'scroll' ? (
            <div ref={scrollRef} className="h-full overflow-auto">
              <div className="flex flex-col items-center py-4 gap-3">
                {dims.map((d, i) => (
                  <div
                    key={i + 1}
                    data-page={i + 1}
                    ref={el => {
                      if (el) pageEls.current.set(i + 1, el)
                      else pageEls.current.delete(i + 1)
                    }}
                    className="bg-white shadow-lg shrink-0"
                    style={{ width: d.w * scale, height: d.h * scale }}
                  />
                ))}
              </div>
            </div>
          ) : (
            <div className="h-full overflow-auto flex justify-center py-6 px-4">
              <canvas ref={singleCanvasRef} className="shadow-lg block" />
            </div>
          )}

          {/* 截图覆盖层 */}
          {screenshotMode && (
            <ScreenshotOverlay
              scrollContainer={scrollRef.current}
              currentPage={currentPage}
              onCapture={(img, page) => {
                setScreenshotMode(false)
                setChatImage(img)
                setChatPage(page)
              }}
              onCancel={() => setScreenshotMode(false)}
            />
          )}
        </div>
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
