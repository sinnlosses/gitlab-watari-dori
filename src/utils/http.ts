export function extractHttpStatus(error: unknown): number | undefined {
  if (!(error instanceof Error)) return undefined
  const { cause } = error
  if (typeof cause !== "object" || cause === null) return undefined
  const response = (cause as { response?: unknown }).response
  if (typeof response !== "object" || response === null) return undefined
  const status = (response as { status?: unknown }).status
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

export function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
