import { queryOne, run } from './db'

interface PromptTemplate {
  id: number
  role: string
  stage: string
  version: number
  template_text: string
  is_active: number
}

/**
 * Get the currently active template for a role + stage.
 * Throws if no active template found.
 */
export async function getActiveTemplate(role: string, stage: string): Promise<PromptTemplate> {
  const row = await queryOne<PromptTemplate>(
    'SELECT * FROM prompt_templates WHERE role = $1 AND stage = $2 AND is_active = 1',
    [role, stage]
  )

  if (!row) {
    throw new Error(`No active prompt template found for role=${role}, stage=${stage}`)
  }

  return row
}

/**
 * Render a template by substituting {variable} placeholders with values.
 * Unmatched placeholders are left as-is.
 */
export function renderTemplate(template: string, variables: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (match, key) => {
    return variables[key] !== undefined ? variables[key] : match
  })
}

/**
 * Load active template + substitute variables in one call.
 */
export async function getPrompt(
  role: string,
  stage: string,
  variables: Record<string, string>
): Promise<string> {
  const template = await getActiveTemplate(role, stage)
  return renderTemplate(template.template_text, variables)
}

/**
 * Insert or update a prompt template. Used for template migrations.
 */
export async function upsertTemplate(
  role: string,
  stage: string,
  templateText: string
): Promise<void> {
  const existing = await queryOne<{ id: number }>(
    'SELECT id FROM prompt_templates WHERE role = $1 AND stage = $2 AND is_active = 1',
    [role, stage]
  )

  if (existing) {
    await run('UPDATE prompt_templates SET template_text = $1 WHERE id = $2', [
      templateText,
      existing.id,
    ])
    return
  }

  await run(
    'INSERT INTO prompt_templates (role, stage, version, template_text, is_active) VALUES ($1, $2, 1, $3, 1)',
    [role, stage, templateText]
  )
}
