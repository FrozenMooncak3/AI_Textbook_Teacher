import type { Tier } from './entitlement'

export type TeacherModelId = `anthropic:${string}` | `google:${string}` | `openai:${string}`

const tierModelMap: Record<Tier, TeacherModelId> = {
  free: 'google:gemini-2.5-flash-lite',
  premium: 'anthropic:claude-sonnet-4-6',
}

function isTeacherModelId(value: string): value is TeacherModelId {
  return (
    value.startsWith('anthropic:') ||
    value.startsWith('google:') ||
    value.startsWith('openai:')
  )
}

export function getTeacherModel(tier: Tier, overrideModel?: string | null): TeacherModelId {
  if (overrideModel && isTeacherModelId(overrideModel)) {
    return overrideModel
  }

  return tierModelMap[tier]
}
