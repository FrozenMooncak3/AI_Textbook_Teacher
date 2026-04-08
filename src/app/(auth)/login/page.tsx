'use client'

import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'

function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await response.json()

      if (response.ok && data.success) {
        const rawNext = searchParams.get('next') || '/'
        const next = rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/'
        router.push(next)
        router.refresh()
      } else {
        setError(data.error || '登录失败，请检查你的邮箱和密码。')
      }
    } catch {
      setError('网络请求失败，请稍后重试。')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-md bg-surface-container-lowest rounded-xl p-10 shadow-[0_40px_40px_0_rgba(167,72,0,0.06)] border border-outline-variant/10">
      <div className="flex flex-col items-center text-center mb-10">
        <div className="w-16 h-16 rounded-full bg-surface-container-low flex items-center justify-center mb-6">
          <span className="material-symbols-outlined text-4xl text-primary">auto_stories</span>
        </div>
        <h1 className="text-2xl font-black text-on-surface font-headline tracking-tight mb-2">AI 教材精学老师</h1>
        <p className="text-on-surface-variant font-medium text-sm">用 AI 帮你真正学扎实</p>
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-error/20 bg-error-container/10 p-4 text-sm text-error font-medium">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="mb-2 block text-[10px] font-black text-on-surface-variant uppercase tracking-widest ml-1">邮箱</label>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            className="w-full bg-surface-container-low border-none rounded-lg py-4 px-5 text-on-surface placeholder:text-outline focus:ring-2 focus:ring-primary/20 focus:bg-surface-bright transition-all outline-none"
            placeholder="your@email.com"
          />
        </div>

        <div>
          <label className="mb-2 block text-[10px] font-black text-on-surface-variant uppercase tracking-widest ml-1">密码</label>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            className="w-full bg-surface-container-low border-none rounded-lg py-4 px-5 text-on-surface placeholder:text-outline focus:ring-2 focus:ring-primary/20 focus:bg-surface-bright transition-all outline-none"
            placeholder="输入你的密码"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="amber-glow w-full text-white font-bold py-4 rounded-lg shadow-lg shadow-primary/20 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? '登录中...' : '登录'}
        </button>
      </form>

      <p className="mt-8 text-center text-sm text-on-surface-variant font-medium">
        还没有账号？{' '}
        <Link href="/register" className="font-bold text-primary hover:underline">
          注册
        </Link>
      </p>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="w-full max-w-md bg-surface-container-lowest rounded-xl p-10 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  )
}
