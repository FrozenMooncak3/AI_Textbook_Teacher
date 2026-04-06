import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import { spawn } from 'child_process'
import { join } from 'path'
import { insert, run } from '@/lib/db'
import { handleRoute } from '@/lib/handle-route'
import { logAction } from '@/lib/log'
import { bookService } from '@/lib/services/book-service'

const UPLOADS_DIR = join(process.cwd(), 'data', 'uploads')

export const GET = handleRoute(async () => {
  const books = await bookService.list()
  return { data: books }
})

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const title = formData.get('title') as string | null

  if (!file) {
    return NextResponse.json({ error: 'Missing file' }, { status: 400 })
  }

  if (!title?.trim()) {
    return NextResponse.json({ error: 'Missing title' }, { status: 400 })
  }

  const ext = file.name.split('.').pop()?.toLowerCase()
  if (!ext || !['pdf', 'txt'].includes(ext)) {
    return NextResponse.json({ error: 'Unsupported file type' }, { status: 422 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())

  await logAction('book_upload_started', `file=${file.name}, title=${title}`)

  if (ext === 'txt') {
    const rawText = buffer.toString('utf-8').trim()
    if (rawText.length < 100) {
      await logAction('book_upload_short_text', `chars=${rawText.length}`, 'warn')
      return NextResponse.json({ error: 'Text file content is too short' }, { status: 422 })
    }

    const bookId = await insert(
      'INSERT INTO books (title, raw_text, parse_status) VALUES ($1, $2, $3)',
      [title.trim(), rawText, 'done']
    )

    await logAction('book_upload_completed_txt', `bookId=${bookId}, chars=${rawText.length}`)
    return NextResponse.json({ bookId }, { status: 201 })
  }

  const bookId = await insert(
    'INSERT INTO books (title, raw_text, parse_status) VALUES ($1, $2, $3)',
    [title.trim(), '', 'processing']
  )

  await mkdir(UPLOADS_DIR, { recursive: true })
  const pdfPath = join(UPLOADS_DIR, `${bookId}.pdf`)
  await writeFile(pdfPath, buffer)

  const markOcrFailure = async (details: string) => {
    try {
      await run("UPDATE books SET parse_status = 'error' WHERE id = $1", [bookId])
    } catch {
      // Ignore update failures while surfacing OCR failures.
    }

    try {
      await logAction('book_ocr_failed', `bookId=${bookId}, ${details}`, 'error')
    } catch {
      // Ignore logging failures in background OCR paths.
    }
  }

  const dbPath = join(process.cwd(), 'data', 'app.db')
  const scriptPath = join(process.cwd(), 'scripts', 'ocr_pdf.py')
  const pythonCommand = process.env.PYTHON_BIN ?? (process.platform === 'win32' ? 'python' : 'python3')

  let child: ReturnType<typeof spawn>
  try {
    child = spawn(pythonCommand, [scriptPath, pdfPath, '--book-id', String(bookId), '--db-path', dbPath], {
      cwd: process.cwd(),
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    })
  } catch (error) {
    await markOcrFailure(`spawn exception: ${String(error)}`)
    return NextResponse.json({ error: 'Failed to start OCR worker' }, { status: 500 })
  }

  let completed = false
  let stderr = ''

  const failOnce = (details: string) => {
    if (completed) {
      return
    }

    completed = true
    void markOcrFailure(details)
  }

  child.stdout?.on('data', () => {})
  child.stderr?.on('data', (chunk: Buffer | string) => {
    stderr = `${stderr}${chunk.toString()}`.slice(-4000)
  })
  child.on('error', (error) => {
    failOnce(`spawn error: ${String(error)}`)
  })
  child.on('exit', (code, signal) => {
    if (code === 0) {
      return
    }

    const errorOutput = stderr.trim() || `signal=${signal ?? 'none'}`
    failOnce(`exit code=${code ?? 'null'}, ${errorOutput}`)
  })

  await logAction('book_ocr_started', `bookId=${bookId}, title=${title}`)
  return NextResponse.json({ bookId, processing: true }, { status: 201 })
}
