import { UserError } from '@/lib/errors'

type StubState = typeof globalThis & {
  __confirmAuthMode?: 'authorized' | 'unauthorized'
  __confirmUserId?: number
  __confirmUserRole?: 'user' | 'admin'
}

const stubState = globalThis as StubState

export async function requireUser(): Promise<{
  id: number
  email: string
  display_name: null
  role: 'user' | 'admin'
}> {
  if (stubState.__confirmAuthMode === 'unauthorized') {
    throw new UserError('Unauthorized', 'UNAUTHORIZED', 401)
  }

  return {
    id: stubState.__confirmUserId ?? 7,
    email: 'test@example.com',
    display_name: null,
    role: stubState.__confirmUserRole ?? 'user',
  }
}
