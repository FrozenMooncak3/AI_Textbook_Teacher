'use client'

import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import FormCard from '@/components/ui/FormCard'
import TextInput from '@/components/ui/TextInput'
import AmberButton from '@/components/ui/AmberButton'
import DecorativeBlur from '@/components/ui/DecorativeBlur'

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
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden p-6">
      <DecorativeBlur position="top-right" />
      <DecorativeBlur position="bottom-left" color="secondary" />
      
      <FormCard 
        title="登录" 
        subtitle="用 AI 帮你真正学扎实"
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          <TextInput 
            label="邮箱" 
            type="email" 
            value={email} 
            onChange={setEmail} 
            placeholder="your@email.com" 
          />
          <TextInput 
            label="密码" 
            type="password" 
            value={password} 
            onChange={setPassword} 
            placeholder="输入你的密码" 
          />
          
          {error && (
            <div className="rounded-lg border border-error/20 bg-error-container/10 p-4 text-sm text-error font-medium">
              {error}
            </div>
          )}

          <AmberButton 
            type="submit" 
            fullWidth 
            rounded="lg" 
            disabled={loading}
          >
            {loading ? '登录中...' : '登录'}
          </AmberButton>

          <p className="mt-8 text-center text-sm text-on-surface-variant font-medium">
            还没有账号？{' '}
            <Link href="/register" className="font-bold text-primary hover:underline">
              注册
            </Link>
          </p>
        </form>
      </FormCard>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-surface-container-low">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  )
}
