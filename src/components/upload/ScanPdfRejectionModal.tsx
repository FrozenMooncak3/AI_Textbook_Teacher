'use client'

import { useState } from 'react'
import Modal from '@/components/ui/Modal'
import AmberButton from '@/components/ui/AmberButton'
import TextInput from '@/components/ui/TextInput'

export type RejectReason =
  | 'scanned_pdf'
  | 'too_large'
  | 'too_many_pages'
  | 'too_many_slides'
  | 'unsupported_type'

interface ScanPdfRejectionModalProps {
  open: boolean
  onClose: () => void
  rejectReason: RejectReason
  bookFilename?: string
  bookSizeBytes?: number
}

export default function ScanPdfRejectionModal({
  open,
  onClose,
  rejectReason,
  bookFilename,
  bookSizeBytes,
}: ScanPdfRejectionModalProps) {
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())

  async function handleSubmit() {
    if (!isValidEmail || submitting) return
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch('/api/email-collection/scan-pdf-waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          rejectReason,
          bookFilename,
          bookSizeBytes,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? '提交失败，请稍后重试')
        return
      }
      setSubmitted(true)
    } catch {
      setError('网络异常，请检查连接')
    } finally {
      setSubmitting(false)
    }
  }

  function handleClose() {
    setEmail('')
    setSubmitted(false)
    setError('')
    onClose()
  }

  return (
    <Modal open={open} onClose={handleClose} title="抱歉，该图书暂不支持直接解析">
      {submitted ? (
        <div className="space-y-4 py-2">
          <div className="bg-primary/10 text-primary p-4 rounded-xl text-sm font-bold flex items-center gap-3">
            <span className="material-symbols-outlined text-lg">check_circle</span>
            申请提交成功！我们已记录您的需求，并将在支持此类图书的第一时间通知您。
          </div>
          <AmberButton onClick={handleClose} fullWidth>
            返回上传更多图书
          </AmberButton>
        </div>
      ) : (
        <div className="space-y-5">
          <p className="text-on-surface text-sm leading-relaxed">
            由于该图书属于<strong>扫描版 PDF</strong>，为了确保 AI 深度解析的质量，我们正针对此类文档进行
            <strong>深度优化</strong>，以解决复杂排版和文字识别精度问题。请留下您的邮箱，我们将在该功能
            <strong>准备就绪时通知您</strong>。
          </p>
          <TextInput
            label="您的邮箱"
            value={email}
            onChange={setEmail}
            placeholder="your@email.com"
            type="email"
          />
          {error && (
            <div className="bg-error/10 text-error p-3 rounded-xl text-xs font-bold flex items-center gap-2">
              <span className="material-symbols-outlined text-base">error</span>
              {error}
            </div>
          )}
          <div className="flex gap-3 pt-2">
            <AmberButton
              onClick={handleSubmit}
              disabled={!isValidEmail || submitting}
              fullWidth
            >
              {submitting ? '提交中...' : '提交订阅需求'}
            </AmberButton>
            <button
              onClick={handleClose}
              disabled={submitting}
              className="px-5 py-3 rounded-xl text-sm font-bold text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low transition-colors disabled:opacity-50"
            >
              返回上传更多图书
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}
