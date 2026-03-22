import { getDb } from './db.ts'

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
export function getActiveTemplate(role: string, stage: string): PromptTemplate {
  const db = getDb()
  const row = db.prepare(
    'SELECT * FROM prompt_templates WHERE role = ? AND stage = ? AND is_active = 1'
  ).get(role, stage) as PromptTemplate | undefined

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
export function getPrompt(role: string, stage: string, variables: Record<string, string>): string {
  const template = getActiveTemplate(role, stage)
  return renderTemplate(template.template_text, variables)
}
