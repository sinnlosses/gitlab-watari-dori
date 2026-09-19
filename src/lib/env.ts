import { type AccessTokenEnvName, type GitLabUrl, toGitLabUrl } from "../types.js"

export function loadEnv(key: string): string {
  const value = process.env[key]
  if (!value?.trim()) throw new Error(`環境変数 ${key} が未設定です`)
  return value
}

export function loadOptionalEnv(key: string): string | undefined {
  const value = process.env[key]
  return value?.trim() ? value : undefined
}

/**
 * グループが宣言した環境変数からアクセストークンの値を取り出す。未設定なら例外をスローする。
 * 環境変数名は設定ファイル由来で実行時にしか分からないため、トップレベルの const では表せない。
 */
export function loadAccessToken(envName: AccessTokenEnvName): string {
  return loadEnv(envName)
}

/**
 * 宣言されたアクセストークンの環境変数がすべて設定されているかを検証する。
 * 未設定のものがあれば、足りない名前をすべて 1 つの例外にまとめてスローする
 * （1 つずつ落とすと、設定漏れを何度も実行して見つけることになるため）。
 */
export function assertAccessTokensPresent(envNames: readonly AccessTokenEnvName[]): void {
  const missing = [...new Set(envNames)].filter((name) => loadOptionalEnv(name) === undefined)
  if (missing.length > 0) {
    throw new Error(`アクセストークンの環境変数が未設定です: ${missing.join(", ")}`)
  }
}

export function validateGitlabUrl(raw: string): GitLabUrl {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new Error(`GITLAB_URL が有効な URL ではありません: "${raw}"`)
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error(`GITLAB_URL は http:// または https:// で始まる必要があります: "${raw}"`)
  }
  return toGitLabUrl(raw)
}

export function parseConcurrencyLimit(raw: string | undefined): number {
  const value = Number(raw ?? "5")
  if (!Number.isInteger(value) || value < 1 || value > 20) {
    throw new Error(`CONCURRENCY_LIMIT は 1〜20 の整数である必要があります: "${raw}"`)
  }
  return value
}

export const GITLAB_URL = validateGitlabUrl(loadEnv("GITLAB_URL"))
export const SKIP_PROJECT_IDS = loadOptionalEnv("SKIP_PROJECT_IDS")
export const CONFIG_PATH = loadOptionalEnv("CONFIG_PATH")
export const CONCURRENCY_LIMIT = parseConcurrencyLimit(loadOptionalEnv("CONCURRENCY_LIMIT"))
export const DRY_RUN = loadOptionalEnv("DRY_RUN") === "true"
