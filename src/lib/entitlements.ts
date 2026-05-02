import type { UserRole } from './auth'

interface UserWithRole {
  role: UserRole
}

/**
 * Admin users bypass D7 upload gates: quota, 1h rate limit, and monthly budget checks.
 * This does not change audit/cost writes; it only centralizes the check-side bypass.
 */
export function canBypassUploadLimits(user: UserWithRole): boolean {
  return user.role === 'admin'
}
