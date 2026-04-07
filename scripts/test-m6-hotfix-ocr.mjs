import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'

const repoRoot = process.cwd()

async function read(relativePath) {
  return fs.readFile(path.join(repoRoot, relativePath), 'utf8')
}

async function readIfExists(relativePath) {
  try {
    return await read(relativePath)
  } catch {
    return ''
  }
}

test('OCR upload route calls HTTP OCR service instead of spawning local Python', async () => {
  const source = await read('src/app/api/books/route.ts')

  assert.doesNotMatch(source, /from 'child_process'/)
  assert.doesNotMatch(source, /\bspawn\(/)
  assert.doesNotMatch(source, /data[\\/]+app\.db/)
  assert.doesNotMatch(source, /ocr_pdf\.py/)

  assert.match(source, /const ocrHost = process\.env\.OCR_SERVER_HOST \|\| '127\.0\.0\.1'/)
  assert.match(source, /const ocrPort = process\.env\.OCR_SERVER_PORT \|\| '8000'/)
  assert.match(source, /const ocrUrl = `http:\/\/\$\{ocrHost\}:\$\{ocrPort\}\/ocr-pdf`/)
  assert.match(source, /fetch\(ocrUrl,/)
  assert.match(source, /pdf_path: pdfPath/)
  assert.match(source, /book_id: bookId/)
  assert.match(source, /markOcrFailure\(`OCR service call failed: \$\{String\(error\)\}`\)/)
})

test('OCR server exposes background PDF processing endpoint backed by PostgreSQL', async () => {
  const source = await read('scripts/ocr_server.py')

  assert.match(source, /from flask import Flask, jsonify, request/)
  assert.match(source, /import threading/)
  assert.match(source, /import psycopg2/)
  assert.match(source, /@app\.post\("\/ocr-pdf"\)/)
  assert.match(source, /request\.get_json\(/)
  assert.match(source, /DATABASE_URL/)
  assert.match(source, /threading\.Thread\(/)
  assert.match(source, /fitz\.open\(/)
  assert.match(source, /page\.get_text\(\)/)
  assert.match(source, /ocr_engine\.ocr\(/)
  assert.match(source, /UPDATE books SET ocr_current_page = %s, ocr_total_pages = %s, parse_status = 'processing' WHERE id = %s/)
  assert.match(source, /UPDATE books SET raw_text = %s, parse_status = 'done' WHERE id = %s/)
  assert.match(source, /UPDATE books SET parse_status = 'error' WHERE id = %s/)
  assert.match(source, /INSERT INTO logs \(level, action, details\) VALUES \(%s, %s, %s\)/)
  assert.match(source, /return jsonify\(\{"status": "processing"\}\), 202/)
})

test('OCR service health and port defaults align across server and screenshot client', async () => {
  const serverSource = await read('scripts/ocr_server.py')
  const screenshotSource = await read('src/lib/screenshot-ocr.ts')

  assert.match(serverSource, /@app\.get\("\/health"\)/)
  assert.match(serverSource, /DATABASE_URL/)
  assert.match(serverSource, /os\.environ\.get\("OCR_HOST", "0\.0\.0\.0"\)/)
  assert.match(serverSource, /os\.environ\.get\("OCR_PORT", "8000"\)/)

  assert.match(screenshotSource, /const OCR_SERVER_PORT = Number\(process\.env\.OCR_SERVER_PORT\) \|\| 8000/)
})

test('OCR Docker files include PostgreSQL wiring and shared uploads volume', async () => {
  const dockerfileSource = await read('Dockerfile.ocr')
  const composeSource = await read('docker-compose.yml')

  assert.match(dockerfileSource, /pip install paddlepaddle paddleocr flask PyMuPDF Pillow psycopg2-binary numpy/)

  assert.match(composeSource, /ocr:/)
  assert.match(composeSource, /DATABASE_URL=postgresql:\/\/dev:dev@db:5432\/textbook_teacher/)
  assert.match(composeSource, /- uploads:\/app\/data\/uploads/)
})

test('legacy sqlite OCR worker is removed and no Python OCR script uses sqlite3', async () => {
  const ocrPdfSource = await readIfExists('scripts/ocr_pdf.py')
  const pythonFiles = ['scripts/ocr_server.py', 'scripts/ocr_image.py', 'scripts/extract_toc.py']

  assert.equal(ocrPdfSource, '')

  for (const file of pythonFiles) {
    const source = await read(file)
    assert.doesNotMatch(source, /import sqlite3/, `${file} should not import sqlite3`)
  }
})
