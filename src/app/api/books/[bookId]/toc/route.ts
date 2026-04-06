import { NextRequest, NextResponse } from 'next/server'
import { requireBookOwner } from '@/lib/auth'
import { queryOne } from '@/lib/db'
import { UserError } from '@/lib/errors'
import { existsSync } from 'fs'
import { join } from 'path'
import { execFile } from 'child_process'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)

interface TocItem {
  title: string
  page: number
  level: number
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ bookId: string }> }
) {
  const { bookId } = await params
  const id = Number(bookId)
  if (isNaN(id)) {
    return NextResponse.json({ error: 'Invalid book ID', code: 'INVALID_ID' }, { status: 400 })
  }

  try {
    await requireBookOwner(_req, id)
  } catch (error) {
    if (error instanceof UserError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode })
    }

    throw error
  }

  const book = await queryOne<{ id: number }>('SELECT id FROM books WHERE id = $1', [id])
  if (!book) {
    return NextResponse.json({ error: 'Book not found', code: 'NOT_FOUND' }, { status: 404 })
  }

  const pdfPath = join(process.cwd(), 'data', 'uploads', `${id}.pdf`)
  if (!existsSync(pdfPath)) {
    return NextResponse.json({ error: 'PDF file not found', code: 'PDF_NOT_FOUND' }, { status: 404 })
  }

  try {
    const scriptPath = join(process.cwd(), 'scripts', 'extract_toc.py')
    const { stdout } = await execFileAsync('python', [scriptPath, pdfPath], {
      timeout: 15_000,
      maxBuffer: 1024 * 1024,
      env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
      encoding: 'utf-8',
    })

    const items: TocItem[] = JSON.parse(stdout.trim())

    return NextResponse.json({
      items: items.map(({ title, page, level }) => ({ title, page, level })),
    })
  } catch {
    return NextResponse.json({ error: 'Failed to extract table of contents', code: 'TOC_EXTRACT_FAILED' }, { status: 500 })
  }
}
