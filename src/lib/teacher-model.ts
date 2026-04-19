import type { Tier } from './entitlement'

const tierModelMap: Record<Tier, string> = {
  free: 'google:gemini-2.5-flash-lite',
  premium: 'anthropic:claude-sonnet-4-6',
}

export function getTeacherModel(tier: Tier, overrideModel?: string | null): string {
  return overrideModel ?? tierModelMap[tier]
}
