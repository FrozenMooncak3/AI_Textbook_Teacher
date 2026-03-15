import { PDFParse } from 'pdf-parse'

export async function extractText(buffer: Buffer, filename: string): Promise<string> {
  const ext = filename.split('.').pop()?.toLowerCase()

  if (ext === 'pdf') {
    const parser = new PDFParse({ data: buffer })
    const result = await parser.getText()
    const text = result.text.trim()
    if (!text) {
      throw new Error('PDF 文本提取失败：该 PDF 可能是扫描版，暂不支持')
    }
    return text
  }

  if (ext === 'txt') {
    return buffer.toString('utf-8').trim()
  }

  throw new Error('不支持的文件格式，请上传 PDF 或 TXT 文件')
}
