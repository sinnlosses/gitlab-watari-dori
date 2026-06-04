import { extractHttpStatus } from "./http.js"

const RETRYABLE_STATUSES = new Set([429, 502, 503, 504])

function isRetryable(error: unknown): boolean {
  const status = extractHttpStatus(error)
  return status !== undefined && RETRYABLE_STATUSES.has(status)
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: { maxAttempts?: number; baseDelayMs?: number } = {},
): Promise<T> {
  const { maxAttempts = 3, baseDelayMs = 1000 } = options
  let lastError: unknown
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (err) {
      if (!isRetryable(err) || attempt === maxAttempts) throw err
      const delay = baseDelayMs * 2 ** (attempt - 1)
      await new Promise((resolve) => setTimeout(resolve, delay))
      lastError = err
    }
  }
  throw lastError
}
