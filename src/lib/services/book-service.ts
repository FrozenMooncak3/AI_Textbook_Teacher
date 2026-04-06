import { query, queryOne } from '../db'
import { UserError, SystemError } from '../errors'

interface Book {
  id: number
  title: string
  parse_status: string
  created_at: string
}

export const bookService = {
  async list(userId: number): Promise<Book[]> {
    try {
      return await query<Book>(
        `
          SELECT id, title, parse_status, created_at
          FROM books
          WHERE user_id = $1
          ORDER BY created_at DESC
        `,
        [userId]
      )
    } catch (err) {
      throw new SystemError('查询教材列表失败', err)
    }
  },

  async getById(id: number): Promise<Book> {
    try {
      const book = await queryOne<Book>(
        'SELECT id, title, parse_status, created_at FROM books WHERE id = $1',
        [id]
      )

      if (!book) {
        throw new UserError('教材不存在', 'NOT_FOUND', 404)
      }

      return book
    } catch (err) {
      if (err instanceof UserError) {
        throw err
      }

      throw new SystemError('查询教材失败', err)
    }
  },
}
