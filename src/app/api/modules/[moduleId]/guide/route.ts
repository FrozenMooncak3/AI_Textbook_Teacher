import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { generateText } from 'ai'
import { getModel, timeout } from '@/lib/ai'
import { logAction } from '@/lib/log'
import { getPrompt } from '@/lib/prompt-templates'

interface Module {
  id: number
  book_id: number
  title: string
  summary: string
  kp_count: number
  guide_json: string | null
}

interface GuideKP {
  kp_code: string
  description: string
  type: string
  importance: number
  detailed_content: string
}

type Guide = { goal: string; focus_points: string[]; common_mistakes: string[] }

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ moduleId: string }> }
) {
  const { moduleId } = await params
  const db = getDb()
  const module_ = db
    .prepare('SELECT guide_json FROM modules WHERE id = ?')
    .get(Number(moduleId)) as { guide_json: string | null } | undefined

  if (!module_) {
    return NextResponse.json({ error: 'Module not found' }, { status: 404 })
  }

  if (!module_.guide_json) {
    return NextResponse.json({ guide: null })
  }

  try {
    const guide = JSON.parse(module_.guide_json) as Guide
    return NextResponse.json({ guide })
  } catch {
    return NextResponse.json({ guide: null })
  }
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ moduleId: string }> }
) {
  const { moduleId } = await params
  const db = getDb()

  const module_ = db
    .prepare('SELECT id, book_id, title, summary, kp_count, guide_json FROM modules WHERE id = ?')
    .get(Number(moduleId)) as Module | undefined

  if (!module_) {
    return NextResponse.json({ error: 'Module not found' }, { status: 404 })
  }

  if (module_.guide_json) {
    try {
      const guide = JSON.parse(module_.guide_json) as Guide
      logAction('Guide cache hit', `moduleId=${moduleId}`)
      return NextResponse.json({ guide })
    } catch {
      // Cached JSON is invalid; regenerate it.
    }
  }

  const kps = db
    .prepare(`
      SELECT kp_code, description, type, importance, detailed_content
      FROM knowledge_points
      WHERE module_id = ?
    `)
    .all(Number(moduleId)) as GuideKP[]

  logAction('Guide generation started', `moduleId=${moduleId}, moduleTitle=${module_.title}`)

  const kpTable = kps
    .map((kp) => `- [${kp.kp_code}] (${kp.type}, importance=${kp.importance}) ${kp.description}`)
    .join('\n')

  const prompt = getPrompt('coach', 'pre_reading_guide', {
    kp_table:
      kpTable || `Module: ${module_.title}\nSummary: ${module_.summary}\nKP count: ${module_.kp_count}`,
    dependencies: '(No cross-module dependencies in M2)',
  })

  const { text } = await generateText({
    model: getModel(),
    maxOutputTokens: 1024,
    prompt,
    abortSignal: AbortSignal.timeout(timeout),
  })

  let guide: Guide
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('No JSON found')
    }

    guide = JSON.parse(jsonMatch[0]) as Guide
  } catch {
    logAction('Guide parse failed', text.slice(0, 200), 'error')
    return NextResponse.json({ error: 'Claude response could not be parsed' }, { status: 500 })
  }

  db.prepare('UPDATE modules SET guide_json = ? WHERE id = ?').run(JSON.stringify(guide), Number(moduleId))
  logAction('Guide generation complete', `moduleId=${moduleId}, moduleTitle=${module_.title}`)

  return NextResponse.json({ guide })
}
