function formatLog(level: string, fields: Record<string, unknown>): string {
  return JSON.stringify({ level, timestamp: new Date().toISOString(), ...fields })
}

export const logger = {
  info(fields: Record<string, unknown>): void {
    console.log(formatLog("info", fields))
  },
  error(fields: Record<string, unknown>): void {
    console.error(formatLog("error", fields))
  },
}
