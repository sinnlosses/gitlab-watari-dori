// @gitbeaker/rest がスローするエラー構造 (Error → cause.response.status) に依存している。
// ライブラリのメジャーバージョンアップ時はこの構造が変わる可能性がある。

function hasKey<K extends string>(obj: object, key: K): obj is Record<K, unknown> {
  return key in obj
}

export function extractHttpStatus(error: unknown): number | undefined {
  if (!(error instanceof Error)) return undefined
  const { cause } = error
  if (typeof cause !== "object" || cause === null) return undefined
  if (!hasKey(cause, "response")) return undefined
  const { response } = cause
  if (typeof response !== "object" || response === null) return undefined
  if (!hasKey(response, "status")) return undefined
  const { status } = response
  return typeof status === "number" ? status : undefined
}

export function isNotFoundError(error: unknown): boolean {
  return extractHttpStatus(error) === 404
}

// 403 はトークンが特定プロジェクトへのアクセス権を持たない場合に発生しうるため fatal 扱いしない。
// 401（認証失敗）と 5xx（サーバー障害）は全プロジェクトに影響するため即時終了する。
export function isFatalStatus(status: number | undefined): boolean {
  if (status === undefined) return false
  return status === 401 || status >= 500
}

// HTTP ステータスのほか、DNS 解決失敗・接続拒否・タイムアウトなどネットワーク障害も
// 全プロジェクトに影響する致命的エラーとして扱う。
export function isFatalError(error: unknown): boolean {
  const status = extractHttpStatus(error)
  if (status !== undefined) return isFatalStatus(status)
  if (!(error instanceof Error)) return false
  if (!hasKey(error, "code")) return false
  const { code } = error
  return code === "ECONNREFUSED" || code === "ENOTFOUND" || code === "ETIMEDOUT"
}

export function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
