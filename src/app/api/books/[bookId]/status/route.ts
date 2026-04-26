import { requireBookOwner } from '@/lib/auth'
import { query, queryOne } from '@/lib/db'
import { UserError } from '@/lib/errors'
import { handleRoute } from '@/lib/handle-route'

interface BookStatusRow {
  id: number
  upload_status: string
  parse_status: string
  kp_extraction_status: string
  ocr_current_page: number | null
  ocr_total_pages: number | null
  cache_hit: boolean
  cache_hit_count: number
}

interface ModuleStatusRow {
  id: number
  order_index: number
  title: string
  kp_extraction_status: string
}

interface ModuleStatusOut {
  id: number
  orderIndex: number
  title: string
  kpExtractionStatus: 'pending' | 'processing' | 'completed' | 'failed'
  ready: boolean
}

interface BookStatusResponse {
  parseStatus: string
  ocrCurrentPage: number
  ocrTotalPages: number
  parse_status: string
  kp_extraction_status: string
  ocr_current_page: number
  ocr_total_pages: number
  bookId: number
  uploadStatus: 'pending' | 'confirmed'
  kpExtractionStatus: 'pending' | 'processing' | 'completed' | 'failed'
  modules: ModuleStatusOut[]
  progressPct: number
  firstModuleReady: boolean
  estimatedSecondsRemaining: number | null
  cacheHit: boolean
  cacheHitCount: number
  cache_hit: boolean
  cache_hit_count: number
}

function normalizeStatus(raw: string): 'pending' | 'processing' | 'completed' | 'failed' {
  if (raw === 'done') return 'completed'
  if (raw === 'error') return 'failed'
  if (raw === 'running') return 'processing'
  if (raw === 'pending' || raw === 'processing' || raw === 'completed' || raw === 'failed') {
    return raw
  }
  return 'pending'
}

export const GET = handleRoute(async (req, context) => {
  const { bookId } = await context!.params
  const id = Number(bookId)

  if (!Number.isInteger(id) || id <= 0) {
    throw new UserError('Invalid book ID', 'INVALID_ID', 400)
  }

  await requireBookOwner(req, id)

  const book = await queryOne<BookStatusRow>(
    `SELECT b.id, b.upload_status, b.parse_status, b.kp_extraction_status,
            b.ocr_current_page, b.ocr_total_pages,
            b.cache_hit,
            COALESCE(kc.hit_count, 0)::int AS cache_hit_count
     FROM books b
     LEFT JOIN kp_cache kc ON kc.pdf_md5 = b.file_md5
     WHERE b.id = $1`,
    [id]
  )

  if (!book) {
    throw new UserError('Book not found', 'NOT_FOUND', 404)
  }

  const moduleRows = await query<ModuleStatusRow>(
    `SELECT id, order_index, title, kp_extraction_status
     FROM modules WHERE book_id = $1 ORDER BY order_index`,
    [id]
  )

  const modules: ModuleStatusOut[] = moduleRows.map((moduleRow) => {
    const kpStatus = normalizeStatus(moduleRow.kp_extraction_status)

    return {
      id: moduleRow.id,
      orderIndex: moduleRow.order_index,
      title: moduleRow.title,
      kpExtractionStatus: kpStatus,
      ready: kpStatus === 'completed',
    }
  })

  const parseStatus = normalizeStatus(book.parse_status)
  const kpExtractionStatus = normalizeStatus(book.kp_extraction_status)
  const uploadStatus: 'pending' | 'confirmed' =
    book.upload_status === 'pending' ? 'pending' : 'confirmed'

  const readyCount = modules.filter((moduleRow) => moduleRow.ready).length
  const totalModules = Math.max(modules.length, 1)
  const ocrCurrentPage = book.ocr_current_page ?? 0
  const ocrTotalPages = book.ocr_total_pages ?? 0

  let progressPct: number
  if (uploadStatus === 'pending') {
    progressPct = 0
  } else if (parseStatus === 'pending') {
    progressPct = 5
  } else if (parseStatus === 'processing') {
    const ocrPct = ocrTotalPages > 0 ? (ocrCurrentPage / ocrTotalPages) * 30 : 0
    progressPct = 10 + Math.min(ocrPct, 30)
  } else if (parseStatus === 'completed' && kpExtractionStatus !== 'completed') {
    progressPct = 40 + (readyCount / totalModules) * 55
  } else if (kpExtractionStatus === 'completed') {
    progressPct = 100
  } else {
    progressPct = 0
  }

  const response: BookStatusResponse = {
    parseStatus,
    ocrCurrentPage,
    ocrTotalPages,
    parse_status: book.parse_status,
    kp_extraction_status: book.kp_extraction_status,
    ocr_current_page: ocrCurrentPage,
    ocr_total_pages: ocrTotalPages,
    bookId: book.id,
    uploadStatus,
    kpExtractionStatus,
    modules,
    progressPct: Math.round(progressPct),
    firstModuleReady: modules[0]?.ready ?? false,
    estimatedSecondsRemaining: null,
    cacheHit: book.cache_hit ?? false,
    cacheHitCount: book.cache_hit_count ?? 0,
    cache_hit: book.cache_hit ?? false,
    cache_hit_count: book.cache_hit_count ?? 0,
  }

  return { data: response }
})
