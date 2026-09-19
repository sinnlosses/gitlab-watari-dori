const SENSITIVE_KEYS = new Set(["token", "access_token", "authorization", "password", "secret"])

// グループごとのトークンは ACCESS_TOKEN_TEAM_A のように接尾辞つきのキーになりうるため前方一致で見る。
// accessTokenEnv（環境変数の「名前」であって値ではない）は小文字化しても
// アンダースコアが無いので前方一致せず、そのまま残る
const SENSITIVE_KEY_PREFIX = "access_token_"

function isSensitiveKey(key: string): boolean {
  const normalized = key.toLowerCase()
  return SENSITIVE_KEYS.has(normalized) || normalized.startsWith(SENSITIVE_KEY_PREFIX)
}

function redact(fields: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(fields).map(([k, v]) => [k, isSensitiveKey(k) ? "[REDACTED]" : v]),
  )
}

function formatLog(level: string, fields: Record<string, unknown>): string {
  return JSON.stringify({ level, timestamp: new Date().toISOString(), ...redact(fields) })
}

export const logger = {
  info(fields: Record<string, unknown>): void {
    console.log(formatLog("info", fields))
  },
  error(fields: Record<string, unknown>): void {
    console.error(formatLog("error", fields))
  },
}
