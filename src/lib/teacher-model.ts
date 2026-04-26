import type { Tier } from './entitlement'
import type { ProviderModelId } from './ai'

export type TeacherModelId = ProviderModelId

const tierModelMap: Record<Tier, TeacherModelId> = {
  free: 'deepseek:deepseek-chat',
  premium: 'anthropic:claude-sonnet-4-6',
}

function isTeacherModelId(value: string): value is TeacherModelId {
  return (
    value.startsWith('anthropic:') ||
    value.startsWith('google:') ||
    value.startsWith('openai:') ||
    value.startsWith('deepseek:') ||
    value.startsWith('qwen:')
  )
}

/**
 * 教学护城河补丁（spec §5.5，D5 lock 2026-04-25）：
 * tier='premium' 永远返回 Sonnet 4.6，忽略任何 prompt_templates.model override；
 * override 仅对 tier='free' 生效（用于免费档微调）。
 */
export function getTeacherModel(tier: Tier, overrideModel?: string | null): TeacherModelId {
  if (tier === 'premium') {
    return tierModelMap.premium
  }

  if (overrideModel && isTeacherModelId(overrideModel)) {
    return overrideModel
  }

  return tierModelMap[tier]
}
