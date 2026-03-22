export class UserError extends Error {
  readonly code: string
  readonly statusCode: number

  constructor(message: string, code: string, statusCode: number = 400) {
    super(message)
    this.name = 'UserError'
    this.code = code
    this.statusCode = statusCode
  }
}

export class SystemError extends Error {
  readonly originalError?: unknown

  constructor(message: string, originalError?: unknown) {
    super(message)
    this.name = 'SystemError'
    this.originalError = originalError
  }
}
