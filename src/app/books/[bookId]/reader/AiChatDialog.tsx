'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import AIResponse from '@/components/AIResponse'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface Props {
  bookId: number
  imageBase64: string
  pageNumber: number
  onClose: () => void
}

type FlowState = 'ocr_processing' | 'text_ready' | 'asking' | 'answered' | 'error'

export default function AiChatDialog({
  bookId,
  imageBase64,
  pageNumber,
  onClose,
}: Props) {
  const [flowState, setFlowState] = useState<FlowState>('ocr_processing')
  const [messages, setMessages] = useState<Message[]>([])
  const [ocrText, setOcrText] = useState('')
  const [conversationId, setConversationId] = useState<number | null>(null)
  const [sending, setSending] = useState(false)
  const [input, setInput] = useState('')
  const [error, setError] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // 第一步：截图 OCR (on mount)
  useEffect(() => {
    let cancelled = false

    async function doOcr() {
      try {
        const res = await fetch(`/api/books/${bookId}/screenshot-ocr`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageBase64 }),
        })

        const json = await res.json()
        if (!res.ok) {
          throw new Error(json.error || 'OCR 识别失败')
        }

        if (cancelled) return

        setOcrText(json.data.text)
        setFlowState('text_ready')
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : '截图识别失败')
          setFlowState('error')
        }
      }
    }

    doOcr()
    return () => { cancelled = true }
  }, [bookId, imageBase64])

  // 第二步：用户提问 (on submit)
  const handleAsk = async () => {
    const question = input.trim()
    if (!question || sending) return

    setInput('')
    setSending(true)
    setFlowState('asking')
    setMessages([{ role: 'user', content: question }])

    try {
      const res = await fetch(`/api/books/${bookId}/screenshot-ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: imageBase64,
          text: ocrText,
          question: question
        }),
      })

      const json = await res.json()
      if (!res.ok) {
        throw new Error(json.error || '请求失败')
      }

      setConversationId(json.data.conversationId)
      setMessages(prev => [...prev, { role: 'assistant', content: json.data.answer }])
      setFlowState('answered')
    } catch (e) {
      setError(e instanceof Error ? e.message : '请求失败')
      setFlowState('error')
    } finally {
      setSending(false)
    }
  }

  // 追问 (follow-up)
  const sendFollowUp = useCallback(async () => {
    const text = input.trim()
    if (!text || !conversationId || sending) return

    setInput('')
    setSending(true)
    setMessages(prev => [...prev, { role: 'user', content: text }])

    try {
      const res = await fetch(`/api/conversations/${conversationId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      })

      const json = await res.json()
      if (!res.ok) {
        throw new Error(json.error || '追问失败')
      }

      setMessages(prev => [...prev, { role: 'assistant', content: json.data.answer }])
    } catch (e) {
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: `错误：${e instanceof Error ? e.message : '请求失败'}` },
      ])
    } finally {
      setSending(false)
      inputRef.current?.focus()
    }
  }, [input, conversationId, sending])

  // 滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, flowState])

  const onKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (flowState === 'text_ready') {
        handleAsk()
      } else if (flowState === 'answered') {
        sendFollowUp()
      }
    }
  }, [flowState, handleAsk, sendFollowUp])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[80vh] flex flex-col">

        {/* 头部 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <div className="text-sm font-medium text-gray-800">
            AI 解读 <span className="text-gray-400 text-xs ml-1">第 {pageNumber} 页</span>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-lg leading-none"
          >
            ×
          </button>
        </div>

        {/* 截图预览 */}
        <div className="px-4 pt-3 pb-2 border-b border-gray-50">
          <img
            src={imageBase64}
            alt="截图区域"
            className="max-h-32 rounded border border-gray-200 object-contain"
          />
        </div>

        {/* 消息区域 */}
        <div className="flex-1 overflow-auto px-4 py-3 space-y-3 min-h-0">
          {flowState === 'ocr_processing' && (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
              识别中…
            </div>
          )}

          {error && (
            <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</div>
          )}

          {ocrText && (
            <div className="text-xs text-gray-400 bg-gray-50 rounded-lg px-3 py-2">
              <span className="font-medium text-gray-500">识别文字：</span>{ocrText}
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={msg.role === 'user' ? 'flex justify-end' : ''}>
              <div
                className={
                  msg.role === 'user'
                    ? 'bg-blue-50 text-blue-900 rounded-lg px-3 py-2 text-sm max-w-[85%]'
                    : 'text-gray-800 text-sm leading-relaxed'
                }
              >
                {msg.role === 'assistant' ? (
                  <AIResponse content={msg.content} />
                ) : (
                  msg.content
                )}
              </div>
            </div>
          ))}

          {(flowState === 'asking' || sending) && flowState !== 'answered' && (
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <div className="w-3 h-3 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />
              AI 思考中…
            </div>
          )}

          {flowState === 'answered' && sending && (
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <div className="w-3 h-3 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />
              思考中…
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* 输入区域 */}
        {(flowState === 'text_ready' || flowState === 'asking' || flowState === 'answered') && !error && (
          <div className="border-t border-gray-100 px-4 py-3">
            <div className="flex gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder={flowState === 'text_ready' ? "向 AI 提问这个片段…" : "追问…"}
                rows={1}
                className="flex-1 resize-none border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400"
                disabled={sending}
              />
              <button
                onClick={flowState === 'text_ready' ? handleAsk : sendFollowUp}
                disabled={!input.trim() || sending}
                className="shrink-0 bg-blue-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-40 transition-colors"
              >
                发送
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
