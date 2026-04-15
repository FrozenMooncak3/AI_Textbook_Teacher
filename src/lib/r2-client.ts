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

function getR2Client(): S3Client {
  if (cachedClient) {
    return cachedClient
  }

  const { accountId, accessKeyId, secretAccessKey } = readConfig()
  cachedClient = new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    forcePathStyle: true,
    credentials: { accessKeyId, secretAccessKey },
  })

  return cachedClient
}

export function buildObjectKey(bookId: number): string {
  if (!Number.isInteger(bookId) || bookId <= 0) {
    throw new Error(`Invalid bookId for R2 object key: ${bookId}`)
  }

  return `books/${bookId}/original.pdf`
}

export async function uploadPdf(bookId: number, buffer: Buffer): Promise<string> {
  const { bucket } = readConfig()
  const key = buildObjectKey(bookId)

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
