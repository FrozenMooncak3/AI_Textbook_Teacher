'use client'

import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import FormCard from '@/components/ui/FormCard'
import TextInput from '@/components/ui/TextInput'
import AmberButton from '@/components/ui/AmberButton'
import Badge from '@/components/ui/Badge'
import DecorativeBlur from '@/components/ui/DecorativeBlur'

function RegisterForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const urlCode = searchParams.get('code')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [inviteCode, setInviteCode] = useState(urlCode || '')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')

    if (password.length < 8) {
      setError('密码长度至少为 8 位。')
      return
    }

    setLoading(true)

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, displayName, inviteCode }),
      })
      const data = await response.json()

      if (response.ok && data.success) {
        router.push('/')
        router.refresh()
      } else {
        setError(data.error || '注册失败，请检查输入的信息。')
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
        title="注册账号" 
        subtitle="加入 AI 教材精学，开启高效学习"
      >
        <form onSubmit={handleSubmit} className="space-y-5">
          <TextInput 
            label="邮箱 *" 
            type="email" 
            value={email} 
            onChange={setEmail} 
            placeholder="your@email.com" 
          />
          <TextInput 
            label="密码 *" 
            type="password" 
            value={password} 
            onChange={setPassword} 
            placeholder="至少 8 位字符" 
          />
          <TextInput 
            label="显示名称（可选）" 
            value={displayName} 
            onChange={setDisplayName} 
            placeholder="例如：小明" 
          />
          
          <TextInput 
            label="邀请码（可选）" 
            value={inviteCode} 
            onChange={setInviteCode} 
            placeholder="如果有邀请码请在此输入"
            endIcon={urlCode ? <Badge variant="primary" className="text-[8px] px-2 py-0.5">已激活</Badge> : undefined}
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
            className="mt-2"
          >
            {loading ? '注册中...' : '注册'}
          </AmberButton>

          <p className="mt-8 text-center text-sm text-on-surface-variant font-medium">
            已有账号？{' '}
            <Link href="/login" className="font-bold text-primary hover:underline">
              去登录
            </Link>
          </p>
        </form>
      </FormCard>
    </div>
  )
}

export default function RegisterPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-surface-container-low">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    }>
      <RegisterForm />
    </Suspense>
  )
}
