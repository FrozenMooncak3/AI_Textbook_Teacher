// MVP: 所有用户永远 premium（子 spec §2.1 Step 5 / 决策 1）
// 未来：读 user_subscriptions 表取 tier（父 spec §6）

export type Tier = 'free' | 'premium'

export async function getUserTier(_userId: number): Promise<Tier> {
  return 'premium'
}

export async function canUseTeaching(userId: number): Promise<boolean> {
  const tier = await getUserTier(userId)
  return tier === 'premium'
}
