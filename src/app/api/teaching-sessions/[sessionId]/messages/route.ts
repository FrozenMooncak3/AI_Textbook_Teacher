import { NextRequest, NextResponse } from 'next/server'
import { generateObject } from 'ai'
import { requireUser } from '@/lib/auth'
import { registry } from '@/lib/ai'
import { pool, queryOne } from '@/lib/db'
import { getUserTier } from '@/lib/entitlement'
import { getActiveTemplate, renderTemplate } from '@/lib/prompt-templates'
import { classifyError, retryWithBackoff } from '@/lib/retry'
import { getTeacherModel } from '@/lib/teacher-model'
import {
  TranscriptOutputSchema,
  buildTeacherMessages,
  kpTypeToStage,
  type TranscriptOutput,
} from '@/lib/teacher-prompts'
import type { KPType, TranscriptMessage, TranscriptV1 } from '@/lib/teaching-types'

type MessageBody = {
  message?: unknown
}

type SessionRow = {
  id: string
  user_id: number
  cluster_id: number | null
  transcript: TranscriptV1
}

type KpRow = {
  id: number
  section_name: string
  description: string
  type: KPType
}

type UsageRecord = {
  inputTokens?: number
  outputTokens?: number
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  let user
  try {
    user = await requireUser(req)
  } catch {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  }

  const { sessionId } = await params
  const body = (await req.json().catch(() => ({}))) as MessageBody
  const studentInput = body.message

  if (typeof studentInput !== 'string' || studentInput.trim().length === 0) {
    return NextResponse.json({ error: 'MESSAGE_REQUIRED' }, { status: 400 })
  }

  const session = await queryOne<SessionRow>(
    'SELECT id, user_id, cluster_id, transcript FROM teaching_sessions WHERE id = $1',
    [sessionId]
  )

  if (!session) {
    return NextResponse.json({ error: 'SESSION_NOT_FOUND' }, { status: 404 })
  }

  if (session.user_id !== user.id) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
  }

  const envelope = session.transcript

  if (envelope.state.strugglingStreak >= 3) {
    return NextResponse.json(
      {
        error: 'STRUGGLING_FROZEN',
        forcedChoice: ['reread_source', 'skip_to_qa'],
      },
      { status: 409 }
    )
  }

  const currentKpId = envelope.state.currentKpId
  if (!currentKpId) {
    return NextResponse.json({ error: 'NO_CURRENT_KP' }, { status: 400 })
  }

  const kp = await queryOne<KpRow>(
    `
      SELECT id, section_name, description, type
      FROM knowledge_points
      WHERE id = $1
    `,
    [currentKpId]
  )

  if (!kp) {
    return NextResponse.json({ error: 'KP_NOT_FOUND' }, { status: 500 })
  }

  const clusterKps = session.cluster_id
    ? (
        await pool.query<KpRow>(
          `
            SELECT id, section_name, description, type
            FROM knowledge_points
            WHERE cluster_id = $1
            ORDER BY id ASC
          `,
          [session.cluster_id]
        )
      ).rows
    : [kp]

  const stage = kpTypeToStage(kp.type)
  const template = await getActiveTemplate('teacher', stage)
  const tier = await getUserTier(user.id)
  const modelId = getTeacherModel(tier, template.model)
  const renderedLayer2 = renderTemplate(template.template_text, {
    kp_content: `${kp.section_name}\n${kp.description}`,
    cluster_kps: clusterKps.map((clusterKp) => `- ${clusterKp.section_name}`).join('\n'),
    struggling_streak: String(envelope.state.strugglingStreak),
  })

  const messages = buildTeacherMessages({
    layer2Template: renderedLayer2,
    transcript: envelope,
    studentInput,
  })

  let aiOutput: TranscriptOutput
  let usageRecord: UsageRecord | undefined

  try {
    const result = await retryWithBackoff(() =>
      generateObject({
        model: registry.languageModel(modelId),
        schema: TranscriptOutputSchema,
        messages,
        maxOutputTokens: 65536,
      })
    )

    aiOutput = result.object
    usageRecord = result.usage
  } catch (error) {
    const classifiedError = classifyError(error)
    const reason = classifiedError === 'retryable_validation'
      ? 'invalid_output'
      : 'teacher_unavailable'

    envelope.state.lastError = {
      reason,
      at: new Date().toISOString(),
      attemptCount: 3,
    }

    await pool.query('UPDATE teaching_sessions SET transcript = $1::jsonb WHERE id = $2', [
      JSON.stringify(envelope),
      sessionId,
    ])

    return NextResponse.json({ error: reason, retryable: true }, { status: 503 })
  }

  const now = new Date().toISOString()
  if (!envelope.state.startedAt) {
    envelope.state.startedAt = now
  }
  envelope.state.lastActiveAt = now
  envelope.state.strugglingStreak =
    aiOutput.status === 'struggling' ? envelope.state.strugglingStreak + 1 : 0

  if (usageRecord?.inputTokens) {
    envelope.state.tokensInTotal += usageRecord.inputTokens
  }
  if (usageRecord?.outputTokens) {
    envelope.state.tokensOutTotal += usageRecord.outputTokens
  }
  delete envelope.state.lastError

  const studentMessage: TranscriptMessage = {
    kind: 'student_response',
    role: 'user',
    content: studentInput,
    ts: now,
  }
  envelope.messages.push(studentMessage)

  const teacherKind = aiOutput.status === 'struggling' ? 'struggling_hint' : 'socratic_question'
  const teacherMessage: TranscriptMessage = {
    kind: teacherKind,
    role: 'teacher',
    content: aiOutput.message,
    ts: now,
    kpId: kp.id,
    tokensIn: usageRecord?.inputTokens,
    tokensOut: usageRecord?.outputTokens,
    model: modelId,
  }
  envelope.messages.push(teacherMessage)

  if (aiOutput.status === 'ready_to_advance' && aiOutput.kpTakeaway) {
    const takeawayMessage: TranscriptMessage = {
      kind: 'kp_takeaway',
      role: 'teacher',
      kpId: kp.id,
      summary: aiOutput.kpTakeaway,
      ts: now,
      model: modelId,
    }
    envelope.messages.push(takeawayMessage)

    if (!envelope.state.coveredKpIds.includes(kp.id)) {
      envelope.state.coveredKpIds.push(kp.id)
    }

    const nextKpIndex = clusterKps.findIndex((clusterKp) => clusterKp.id === kp.id)
    if (nextKpIndex >= 0 && nextKpIndex + 1 < clusterKps.length) {
      envelope.state.currentKpId = clusterKps[nextKpIndex + 1].id
    }
  }

  await pool.query('UPDATE teaching_sessions SET transcript = $1::jsonb WHERE id = $2', [
    JSON.stringify(envelope),
    sessionId,
  ])

  return NextResponse.json({
    status: aiOutput.status,
    message: aiOutput.message,
    kpTakeaway: aiOutput.kpTakeaway,
    strugglingStreak: envelope.state.strugglingStreak,
    currentKpId: envelope.state.currentKpId,
    coveredKpIds: envelope.state.coveredKpIds,
  })
}
