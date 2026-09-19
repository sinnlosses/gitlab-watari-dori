import type { Config, RepoConfig } from "../src/types.js"
import { toAccessTokenEnvName } from "../src/types.js"

export const makeHttpError = (status: number): Error =>
  new Error("HTTP Error", { cause: { response: { status } } })

/**
 * `loadConfig` のモック戻り値を作る。
 * グループの分かれ方が結果に関係しないテストは 1 グループにまとめてよい。
 */
export const makeConfig = (repositories: readonly RepoConfig[]): Config => [
  { accessTokenEnv: toAccessTokenEnvName("ACCESS_TOKEN_TEST"), repositories },
]
