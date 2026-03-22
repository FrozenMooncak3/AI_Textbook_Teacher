import { getDb } from '../db'
import { UserError, SystemError } from '../errors'

interface Book {
  id: number
  title: string
  parse_status: string
  created_at: string
}

export const bookService = {
  list(): Book[] {
    try {
      const db = getDb()
      return db.prepare(
        'SELECT id, title, parse_status, created_at FROM books ORDER BY created_at DESC'
      ).all() as Book[]
    } catch (err) {
      throw new SystemError('查询教材列表失败', err)
    }
  },

  getById(id: number): Book {
    try {
      const db = getDb()
      const book = db.prepare(
        'SELECT id, title, parse_status, created_at FROM books WHERE id = ?'
      ).get(id) as Book | undefined
      if (!book) {
        throw new UserError('教材不存在', 'NOT_FOUND', 404)
      }
      return book
    } catch (err) {
      if (err instanceof UserError) throw err
      throw new SystemError('查询教材失败', err)
    }
  },
}
