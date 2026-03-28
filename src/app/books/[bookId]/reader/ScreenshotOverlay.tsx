'use client'

import { useRef, useState, useCallback } from 'react'

interface Rect {
  x: number
  y: number
  w: number
  h: number
}

interface Props {
  /** 截图完成后回调，传入 base64 图片和当前页码 */
  onCapture: (imageBase64: string, pageNumber: number) => void
  onCancel: () => void
  /** 滚动容器 ref，用于计算偏移 */
  scrollContainer: HTMLDivElement | null
  currentPage: number
}

export default function ScreenshotOverlay({
  onCapture,
  onCancel,
  scrollContainer,
  currentPage,
}: Props) {
  const overlayRef = useRef<HTMLDivElement>(null)
  const [drawing, setDrawing] = useState(false)
  const [start, setStart] = useState<{ x: number; y: number } | null>(null)
  const [rect, setRect] = useState<Rect | null>(null)

  const getPos = useCallback((e: React.MouseEvent) => {
    const el = overlayRef.current
    if (!el) return { x: 0, y: 0 }
    const r = el.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }, [])

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    const pos = getPos(e)
    setStart(pos)
    setRect({ x: pos.x, y: pos.y, w: 0, h: 0 })
    setDrawing(true)
  }, [getPos])

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!drawing || !start) return
    const pos = getPos(e)
    setRect({
      x: Math.min(start.x, pos.x),
      y: Math.min(start.y, pos.y),
      w: Math.abs(pos.x - start.x),
      h: Math.abs(pos.y - start.y),
    })
  }, [drawing, start, getPos])

  const onMouseUp = useCallback(() => {
    if (!drawing || !rect || rect.w < 10 || rect.h < 10) {
      setDrawing(false)
      setStart(null)
      setRect(null)
      return
    }
    setDrawing(false)

    // 从 scrollContainer 内的 canvas 元素们截取选区
    if (!scrollContainer) return

    const containerRect = scrollContainer.getBoundingClientRect()
    // 选区相对于 viewport 的位置
    const overlayEl = overlayRef.current
    if (!overlayEl) return
    const overlayRect = overlayEl.getBoundingClientRect()

    const absX = rect.x + overlayRect.left
    const absY = rect.y + overlayRect.top

    // 收集所有可见 canvas
    const canvases = scrollContainer.querySelectorAll('canvas')
    const tempCanvas = document.createElement('canvas')
    tempCanvas.width = rect.w * window.devicePixelRatio
    tempCanvas.height = rect.h * window.devicePixelRatio
    tempCanvas.style.width = `${rect.w}px`
    tempCanvas.style.height = `${rect.h}px`
    const ctx = tempCanvas.getContext('2d')
    if (!ctx) return
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio)

    canvases.forEach(canvas => {
      const cr = canvas.getBoundingClientRect()
      // 计算 canvas 和选区的交集
      const ix = Math.max(absX, cr.left)
      const iy = Math.max(absY, cr.top)
      const ix2 = Math.min(absX + rect.w, cr.right)
      const iy2 = Math.min(absY + rect.h, cr.bottom)
      if (ix >= ix2 || iy >= iy2) return

      // 源坐标（canvas 像素空间）
      const scaleX = canvas.width / cr.width
      const scaleY = canvas.height / cr.height
      const sx = (ix - cr.left) * scaleX
      const sy = (iy - cr.top) * scaleY
      const sw = (ix2 - ix) * scaleX
      const sh = (iy2 - iy) * scaleY

      // 目标坐标
      const dx = ix - absX
      const dy = iy - absY
      const dw = ix2 - ix
      const dh = iy2 - iy

      ctx.drawImage(canvas, sx, sy, sw, sh, dx, dy, dw, dh)
    })

    const dataUrl = tempCanvas.toDataURL('image/png')
    setRect(null)
    setStart(null)
    onCapture(dataUrl, currentPage)
  }, [drawing, rect, scrollContainer, currentPage, onCapture])

  const onKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onCancel()
  }, [onCancel])

  return (
    <div
      ref={overlayRef}
      className="absolute inset-0 z-30 cursor-crosshair"
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onKeyDown={onKeyDown}
      tabIndex={0}
    >
      {/* 半透明遮罩 */}
      <div className="absolute inset-0 bg-black/10" />

      {/* 选区框 */}
      {rect && rect.w > 0 && rect.h > 0 && (
        <div
          className="absolute border-2 border-blue-500 bg-blue-500/10"
          style={{
            left: rect.x,
            top: rect.y,
            width: rect.w,
            height: rect.h,
          }}
        />
      )}

      {/* 顶部提示 */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/70 text-white text-xs px-3 py-1.5 rounded-full pointer-events-none">
        拖拽选择区域，按 Esc 取消
      </div>
    </div>
  )
}
