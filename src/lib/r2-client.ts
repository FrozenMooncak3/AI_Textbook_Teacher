import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

let cachedClient: S3Client | null = null

function readConfig(): {
  accountId: string
  accessKeyId: string
  secretAccessKey: string
  bucket: string
} {
  const accountId = process.env.R2_ACCOUNT_ID
  const accessKeyId = process.env.R2_ACCESS_KEY_ID
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY
  const bucket = process.env.R2_BUCKET

  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
    throw new Error('R2 env vars missing: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET all required')
  }

  return { accountId, accessKeyId, secretAccessKey, bucket }
}

export function getR2Client(): S3Client {
  if (cachedClient) return cachedClient
  const { accountId, accessKeyId, secretAccessKey } = readConfig()
  cachedClient = new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    forcePathStyle: true,
    credentials: { accessKeyId, secretAccessKey },
  })
  return cachedClient
}

export function getR2Bucket(): string {
  const bucket = process.env.R2_BUCKET
  if (!bucket) throw new Error('R2_BUCKET missing')
  return bucket
}

export async function getR2ObjectBuffer(objectKey: string): Promise<Buffer> {
  const client = getR2Client()
  const bucket = getR2Bucket()
  const result = await client.send(new GetObjectCommand({ Bucket: bucket, Key: objectKey }))
  if (!result.Body) throw new Error(`R2 object empty: ${objectKey}`)
  const bytes = await (result.Body as { transformToByteArray: () => Promise<Uint8Array> }).transformToByteArray()
  return Buffer.from(bytes)
}

const CONTENT_TYPE_TO_EXT: Record<string, string> = {
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
}

export function buildObjectKey(
  bookId: number,
  contentType: string = 'application/pdf'
): string {
  if (!Number.isInteger(bookId) || bookId <= 0) {
    throw new Error(`Invalid bookId for R2 object key: ${bookId}`)
  }
  const ext = CONTENT_TYPE_TO_EXT[contentType]
  if (!ext) throw new Error(`Unsupported contentType for R2 key: ${contentType}`)
  return `books/${bookId}/original.${ext}`
}

export async function buildPresignedPutUrl(
  bookId: number,
  contentType: string = 'application/pdf',
  expirySeconds: number = 900
): Promise<{ uploadUrl: string; objectKey: string }> {
  const { bucket } = readConfig()
  const objectKey = buildObjectKey(bookId, contentType)

  const uploadUrl = await getSignedUrl(
    getR2Client(),
    new PutObjectCommand({
      Bucket: bucket,
      Key: objectKey,
      ContentType: contentType,
    }),
    { expiresIn: expirySeconds }
  )

  return { uploadUrl, objectKey }
}

export async function uploadPdf(bookId: number, buffer: Buffer): Promise<string> {
  const { bucket } = readConfig()
  const key = buildObjectKey(bookId, 'application/pdf')
  await getR2Client().send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: buffer,
    ContentType: 'application/pdf',
  }))
  return key
}

export async function getSignedPdfUrl(objectKey: string, expirySeconds = 3600): Promise<string> {
  const { bucket } = readConfig()
  return getSignedUrl(
    getR2Client(),
    new GetObjectCommand({ Bucket: bucket, Key: objectKey }),
    { expiresIn: expirySeconds }
  )
}

export async function deletePdf(objectKey: string): Promise<void> {
  const { bucket } = readConfig()
  await getR2Client().send(new DeleteObjectCommand({ Bucket: bucket, Key: objectKey }))
}
