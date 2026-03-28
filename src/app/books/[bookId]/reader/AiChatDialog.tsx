'use client'

import { useState, useRef, useEffect, useCallback } from 'react'

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

export default function AiChatDialog({
  bookId,
  imageBase64,
  pageNumber,
  onClose,
}: Props) {
  const [messages, setMessages] = useState<Message[]>([])
  const [extractedText, setExtractedText] = useState('')
  const [conversationId, setConversationId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [input, setInput] = useState('')
  const [error, setError] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // 首次发送截图到 API
  useEffect(() => {
    let cancelled = false

    async function ask() {
      try {
        const res = await fetch(`/api/books/${bookId}/screenshot-ask`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageBase64, pageNumber }),
        })

        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(data.error || '请求失败')
        }

        const data = await res.json()
        if (cancelled) return

        setConversationId(data.conversationId)
        setExtractedText(data.extractedText)
        setMessages([{ role: 'assistant', content: data.answer }])
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : '截图识别失败')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    ask()
    return () => { cancelled = true }
  }, [bookId, imageBase64, pageNumber])

  // 滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // 追问
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

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || '追问失败')
      }

      const data = await res.json()
      setMessages(prev => [...prev, { role: 'assistant', content: data.answer }])
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

  const onKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendFollowUp()
    }
  }, [sendFollowUp])

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
          {loading && (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
              正在识别并分析…
            </div>
          )}

          {error && (
            <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</div>
          )}

          {extractedText && (
            <div className="text-xs text-gray-400 bg-gray-50 rounded-lg px-3 py-2">
              <span className="font-medium text-gray-500">识别文字：</span>{extractedText}
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={msg.role === 'user' ? 'flex justify-end' : ''}>
              <div
                className={
                  msg.role === 'user'
                    ? 'bg-blue-50 text-blue-900 rounded-lg px-3 py-2 text-sm max-w-[85%]'
                    : 'text-gray-800 text-sm leading-relaxed whitespace-pre-wrap'
                }
              >
                {msg.content}
              </div>
            </div>
          ))}

          {sending && (
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <div className="w-3 h-3 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />
              思考中…
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* 输入区域 */}
        {conversationId && !error && (
          <div className="border-t border-gray-100 px-4 py-3">
            <div className="flex gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="追问…"
                rows={1}
                className="flex-1 resize-none border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400"
              />
              <button
                onClick={sendFollowUp}
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
