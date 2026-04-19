export type RetryOpts = {
  maxAttempts?: number
  baseMs?: number
}

export type ErrorClass = 'retryable_network' | 'retryable_validation' | 'permanent'

interface ErrorWithStatus {
  status?: number
}

export function classifyError(error: unknown): ErrorClass {
  if (error instanceof Error) {
    if (error.name === 'AI_TypeValidationError' || error.name === 'AI_JSONParseError') {
      return 'retryable_validation'
    }

    if (error.name === 'AbortError' || error.name === 'TimeoutError') {
      return 'retryable_network'
    }

    const status = (error as ErrorWithStatus).status
    if (status === 429 || (typeof status === 'number' && status >= 500)) {
      return 'retryable_network'
    }

    if (typeof status === 'number' && status >= 400 && status < 500) {
      return 'permanent'
    }
  }

  return 'retryable_network'
}

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  opts: RetryOpts = {}
): Promise<T> {
  const maxAttempts = opts.maxAttempts ?? 3
  const baseMs = opts.baseMs ?? 1000
  let lastError: unknown

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      return await fn()
    } catch (error) {
      lastError = error
      const errorClass = classifyError(error)

      if (errorClass === 'permanent') {
        throw error
      }

      if (attempt === maxAttempts - 1) {
        break
      }

      const delayMs = baseMs * Math.pow(2, attempt)
      await new Promise((resolve) => setTimeout(resolve, delayMs))
    }
  }

  throw lastError
}
