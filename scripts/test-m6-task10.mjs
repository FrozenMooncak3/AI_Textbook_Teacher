import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'

const repoRoot = process.cwd()

async function read(relativePath) {
  return fs.readFile(path.join(repoRoot, relativePath), 'utf8')
}

test('task 10 Dockerfile uses Next.js standalone multi-stage build', async () => {
  const source = await read('Dockerfile')

  assert.match(source, /FROM node:20-alpine AS base/)
  assert.match(source, /FROM base AS deps/)
  assert.match(source, /RUN npm ci/)
  assert.match(source, /FROM base AS builder/)
  assert.match(source, /RUN npm run build/)
  assert.match(source, /FROM base AS runner/)
  assert.match(source, /COPY --from=builder \/app\/\.next\/standalone \.\//)
  assert.match(source, /CMD \["node", "server\.js"\]/)
})

test('task 10 OCR deployment files expose configurable OCR host and port', async () => {
  const dockerfileOcrSource = await read('Dockerfile.ocr')
  const ocrServerSource = await read('scripts/ocr_server.py')
  const screenshotOcrSource = await read('src/lib/screenshot-ocr.ts')

  assert.match(dockerfileOcrSource, /FROM python:3\.10-slim/)
  assert.match(dockerfileOcrSource, /pip install paddlepaddle paddleocr flask PyMuPDF Pillow psycopg2-binary numpy/)
  assert.match(dockerfileOcrSource, /ENV OCR_HOST=0\.0\.0\.0/)
  assert.match(dockerfileOcrSource, /ENV OCR_PORT=8000/)
  assert.match(ocrServerSource, /import os/)
  assert.match(ocrServerSource, /from flask import Flask, jsonify, request/)
  assert.match(ocrServerSource, /os\.environ\.get\("OCR_HOST", "0\.0\.0\.0"\)/)
  assert.match(ocrServerSource, /os\.environ\.get\("OCR_PORT", "8000"\)/)
  assert.match(ocrServerSource, /@app\.post\("\/ocr-pdf"\)/)
  assert.match(ocrServerSource, /threading\.Thread\(/)
  assert.match(ocrServerSource, /DATABASE_URL/)
  assert.match(screenshotOcrSource, /const OCR_SERVER_HOST = process\.env\.OCR_SERVER_HOST \|\| '127\.0\.0\.1'/)
  assert.match(screenshotOcrSource, /const OCR_SERVER_PORT = Number\(process\.env\.OCR_SERVER_PORT\) \|\| 8000/)
  assert.match(screenshotOcrSource, /hostname: OCR_SERVER_HOST/)
})

test('task 10 docker-compose and dockerignore match deployment contract', async () => {
  const composeSource = await read('docker-compose.yml')
  const dockerignoreSource = await read('.dockerignore')
  const nextConfigSource = await read('next.config.ts')

  assert.match(composeSource, /services:/)
  assert.match(composeSource, /app:/)
  assert.match(composeSource, /db:/)
  assert.match(composeSource, /ocr:/)
  assert.match(composeSource, /OCR_SERVER_HOST=ocr/)
  assert.match(composeSource, /OCR_SERVER_PORT=8000/)
  assert.match(composeSource, /postgresql:\/\/dev:dev@db:5432\/textbook_teacher/)
  assert.match(composeSource, /DATABASE_URL=postgresql:\/\/dev:dev@db:5432\/textbook_teacher/)
  assert.match(composeSource, /- uploads:\/app\/data\/uploads/)
  assert.match(dockerignoreSource, /^node_modules/m)
  assert.match(dockerignoreSource, /^\.next/m)
  assert.match(dockerignoreSource, /^\.git/m)
  assert.match(dockerignoreSource, /^data/m)
  assert.match(dockerignoreSource, /^docs/m)
  assert.match(dockerignoreSource, /^\.ccb/m)
  assert.match(dockerignoreSource, /^\.claude/m)
  assert.match(nextConfigSource, /output: 'standalone'/)
})
