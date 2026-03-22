import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { logAction } from '@/lib/log'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { spawn } from 'child_process'
import { handleRoute } from '@/lib/handle-route'
import { bookService } from '@/lib/services/book-service'

const UPLOADS_DIR = join(process.cwd(), 'data', 'uploads')

export const GET = handleRoute(async () => {
  const books = bookService.list()
  return { data: books }
})

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const title = formData.get('title') as string | null

  if (!file) return NextResponse.json({ error: '请选择文件' }, { status: 400 })
  if (!title?.trim()) return NextResponse.json({ error: '请填写教材名称' }, { status: 400 })

  const ext = file.name.split('.').pop()?.toLowerCase()
  if (!ext || !['pdf', 'txt'].includes(ext)) {
    return NextResponse.json({ error: '不支持的文件格式，请上传 PDF 或 TXT 文件' }, { status: 422 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const db = getDb()

  logAction('上传文件', `文件名：${file.name}，教材：${title}`)

  // TXT 直接处理
  if (ext === 'txt') {
    const rawText = buffer.toString('utf-8').trim()
    if (rawText.length < 100) {
      logAction('文件内容过短', `提取字数：${rawText.length}`, 'warn')
      return NextResponse.json({ error: '文件内容过短，请确认文件内容正确' }, { status: 422 })
    }
    const result = db
      .prepare('INSERT INTO books (title, raw_text, parse_status) VALUES (?, ?, ?)')
      .run(title.trim(), rawText, 'done')
    logAction('教材上传成功（TXT）', `《${title}》bookId=${result.lastInsertRowid}，字数：${rawText.length}`)
    return NextResponse.json({ bookId: result.lastInsertRowid }, { status: 201 })
  }

  // PDF：先插入 processing 记录，再后台 OCR
  const result = db
    .prepare('INSERT INTO books (title, raw_text, parse_status) VALUES (?, ?, ?)')
    .run(title.trim(), '', 'processing')
  const bookId = result.lastInsertRowid as number

  logAction('PDF 开始后台 OCR', `bookId=${bookId}，教材：${title}`)

  // 保存 PDF 到磁盘
  await mkdir(UPLOADS_DIR, { recursive: true })
  const pdfPath = join(UPLOADS_DIR, `${bookId}.pdf`)
  await writeFile(pdfPath, buffer)

  // 后台启动 OCR（detached 让进程在响应返回后继续运行）
  const dbPath = join(process.cwd(), 'data', 'app.db')
  const scriptPath = join(process.cwd(), 'scripts', 'ocr_pdf.py')
  const child = spawn('python', [scriptPath, pdfPath, '--book-id', String(bookId), '--db-path', dbPath], {
    detached: true,
    stdio: 'ignore',
  })
  child.unref()

  return NextResponse.json({ bookId, processing: true }, { status: 201 })
}
