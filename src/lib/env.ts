export function loadEnv(key: string): string {
  const value = process.env[key]
  if (!value?.trim()) throw new Error(`環境変数 ${key} が未設定です`)
  return value
}

export function loadOptionalEnv(key: string): string | undefined {
  return process.env[key] || undefined
}

export function parseConcurrencyLimit(raw: string | undefined): number {
  const value = Number(raw ?? "5")
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`CONCURRENCY_LIMIT は 1 以上の整数である必要があります: "${raw}"`)
  }
  return value
}

export const GITLAB_URL = loadEnv("GITLAB_URL")
export const ACCESS_TOKEN = loadEnv("ACCESS_TOKEN")
export const SKIP_PROJECT_IDS = loadOptionalEnv("SKIP_PROJECT_IDS")
export const CONFIG_PATH = loadOptionalEnv("CONFIG_PATH")
export const CONCURRENCY_LIMIT = parseConcurrencyLimit(loadOptionalEnv("CONCURRENCY_LIMIT"))
export const DRY_RUN = loadOptionalEnv("DRY_RUN") === "true"
