export type ModeRecommendation = {
  recommended: 'teaching' | 'full' | null
  reason: string
}

type BookMeta = {
  kpCount: number
  subject?: string
  scanQuality?: 'good' | 'fair' | 'poor'
}

const TEACHING_SUBJECTS = new Set(['数学', '物理', '经济'])
const FULL_SUBJECTS = new Set(['文学', '历史'])

export function getRecommendation(bookMeta: BookMeta): ModeRecommendation {
  if (
    bookMeta.kpCount >= 40 ||
    (bookMeta.subject !== undefined && TEACHING_SUBJECTS.has(bookMeta.subject)) ||
    bookMeta.scanQuality === 'poor'
  ) {
    return {
      recommended: 'teaching',
      reason: '这本教材知识点较多或理解门槛较高，更适合用教学模式逐步带学。',
    }
  }

  if (
    bookMeta.kpCount < 20 ||
    (bookMeta.subject !== undefined && FULL_SUBJECTS.has(bookMeta.subject)) ||
    bookMeta.scanQuality === 'good'
  ) {
    return {
      recommended: 'full',
      reason: '这本教材结构相对清晰，适合直接使用完整模式自主推进。',
    }
  }

  return {
    recommended: null,
    reason: '两种模式都合适，可按你的时间安排和学习偏好自由选择。',
  }
}
