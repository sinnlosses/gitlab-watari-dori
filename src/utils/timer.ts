export async function timed<T>(fn: () => Promise<T>): Promise<{ value: T; duration_ms: number }> {
  const start = Date.now()
  const value = await fn()
  return { value, duration_ms: Date.now() - start }
}
