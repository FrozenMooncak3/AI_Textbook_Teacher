import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
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
    return NextResponse.json({ error: '无效的教材 ID', code: 'INVALID_ID' }, { status: 400 })
  }

  const db = getDb()
  const book = db.prepare('SELECT id FROM books WHERE id = ?').get(id)
  if (!book) {
    return NextResponse.json({ error: '教材不存在', code: 'NOT_FOUND' }, { status: 404 })
  }

  const pdfPath = join(process.cwd(), 'data', 'uploads', `${id}.pdf`)
  if (!existsSync(pdfPath)) {
    return NextResponse.json({ error: 'PDF 文件不存在', code: 'PDF_NOT_FOUND' }, { status: 404 })
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

    // 按 API_CONTRACT 格式返回（不含 level 也行，但多给 level 方便前端做缩进）
    return NextResponse.json({
      items: items.map(({ title, page, level }) => ({ title, page, level })),
    })
  } catch {
    return NextResponse.json({ error: '目录提取失败', code: 'TOC_EXTRACT_FAILED' }, { status: 500 })
  }
}
