import { GetObjectCommand } from '@aws-sdk/client-s3'
import { createHash } from 'node:crypto'
import { Readable } from 'node:stream'
import { getR2Client, getR2Bucket } from '@/lib/r2-client'

export async function computePdfMd5FromR2(objectKey: string): Promise<string> {
  const client = getR2Client()
  const bucket = getR2Bucket()
  const result = await client.send(
    new GetObjectCommand({ Bucket: bucket, Key: objectKey })
  )
  if (!result.Body) {
    throw new Error(`R2 object body empty for key=${objectKey}`)
  }

  const hash = createHash('md5')
  // AWS SDK Body 是 ReadableStream | Blob | Buffer，Node 环境是 ReadableStream
  const stream = Readable.from(result.Body as AsyncIterable<Buffer>)
  for await (const chunk of stream) {
    hash.update(chunk)
  }
  return hash.digest('hex')
}
