export async function extractText(buffer: Buffer, filename: string): Promise<string> {
  const ext = filename.split('.').pop()?.toLowerCase()

  if (ext === 'txt') {
    return buffer.toString('utf-8').trim()
  }

  if (ext === 'pdf') {
    // PDF 由 books/route.ts 异步处理，不在此同步提取
    return ''
  }

  throw new Error('不支持的文件格式，请上传 PDF 或 TXT 文件')
}
