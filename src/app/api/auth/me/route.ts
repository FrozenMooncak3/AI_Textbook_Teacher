import { requireUser } from '@/lib/auth'
import { handleRoute } from '@/lib/handle-route'

export const GET = handleRoute(async (req) => {
  const user = await requireUser(req)
  return { data: user }
})
