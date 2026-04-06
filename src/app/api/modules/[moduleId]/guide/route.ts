import { NextRequest, NextResponse } from 'next/server'
import { generateText } from 'ai'
import { getModel, timeout } from '@/lib/ai'
import { requireModuleOwner } from '@/lib/auth'
import { query, queryOne, run } from '@/lib/db'
import { UserError } from '@/lib/errors'
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
  const moduleNumericId = Number(moduleId)

  try {
    await requireModuleOwner(_req, moduleNumericId)
  } catch (error) {
    if (error instanceof UserError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode })
    }

    throw error
  }

  const module_ = await queryOne<{ guide_json: string | null }>(
    'SELECT guide_json FROM modules WHERE id = $1',
    [moduleNumericId]
  )

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
  const moduleNumericId = Number(moduleId)

  try {
    await requireModuleOwner(_req, moduleNumericId)
  } catch (error) {
    if (error instanceof UserError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode })
    }

    throw error
  }

  const module_ = await queryOne<Module>(
    'SELECT id, book_id, title, summary, kp_count, guide_json FROM modules WHERE id = $1',
    [moduleNumericId]
  )

  if (!module_) {
    return NextResponse.json({ error: 'Module not found' }, { status: 404 })
  }

  if (module_.guide_json) {
    try {
      const guide = JSON.parse(module_.guide_json) as Guide
      await logAction('Guide cache hit', `moduleId=${moduleId}`)
      return NextResponse.json({ guide })
    } catch {
      // Cached JSON is invalid; regenerate it.
    }
  }

  const kps = await query<GuideKP>(
    `
      SELECT kp_code, description, type, importance, detailed_content
      FROM knowledge_points
      WHERE module_id = $1
    `,
    [moduleNumericId]
  )

  await logAction('Guide generation started', `moduleId=${moduleId}, moduleTitle=${module_.title}`)

  const kpTable = kps
    .map((kp) => `- [${kp.kp_code}] (${kp.type}, importance=${kp.importance}) ${kp.description}`)
    .join('\n')

  const prompt = await getPrompt('coach', 'pre_reading_guide', {
    kp_table:
      kpTable || `Module: ${module_.title}\nSummary: ${module_.summary}\nKP count: ${module_.kp_count}`,
    dependencies: '(No cross-module dependencies in M2)',
  })

  const { text } = await generateText({
    model: getModel(),
    maxOutputTokens: 4096,
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
    await logAction('Guide parse failed', text.slice(0, 200), 'error')
    return NextResponse.json({ error: 'Claude response could not be parsed' }, { status: 500 })
  }

  await run('UPDATE modules SET guide_json = $1 WHERE id = $2', [
    JSON.stringify(guide),
    moduleNumericId,
  ])
  await logAction('Guide generation complete', `moduleId=${moduleId}, moduleTitle=${module_.title}`)

  return NextResponse.json({ guide })
}
