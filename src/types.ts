declare const projectIdBrand: unique symbol
export type ProjectId = number & { readonly [projectIdBrand]: never }
export function toProjectId(n: number): ProjectId {
  return n as ProjectId
}

declare const projectNameBrand: unique symbol
export type ProjectName = string & { readonly [projectNameBrand]: never }
export function toProjectName(s: string): ProjectName {
  return s as ProjectName
}

declare const branchNameBrand: unique symbol
export type BranchName = string & { readonly [branchNameBrand]: never }
export function toBranchName(s: string): BranchName {
  return s as BranchName
}

export type BranchPair = {
  readonly source: BranchName
  readonly target: BranchName
}

declare const gitLabUrlBrand: unique symbol
export type GitLabUrl = string & { readonly [gitLabUrlBrand]: never }
export function toGitLabUrl(s: string): GitLabUrl {
  return s as GitLabUrl
}

declare const accessTokenEnvNameBrand: unique symbol
/**
 * アクセストークンが入っている環境変数の名前（`ACCESS_TOKEN_GROUP_A` など）。
 * 素の文字列（トークンの値）と取り違えないようブランド型にしている。
 * 名前の形式は `src/lib/config.ts` の zod スキーマが検証する。
 */
export type AccessTokenEnvName = string & { readonly [accessTokenEnvNameBrand]: never }
export function toAccessTokenEnvName(s: string): AccessTokenEnvName {
  return s as AccessTokenEnvName
}

export type RepoConfig = {
  readonly projectId: ProjectId
  readonly projectName: ProjectName
  readonly branchPairs: readonly BranchPair[]
}

/**
 * 設定ファイル 1 つ分のまとまり（= トークンを割り当てる単位の「グループ」）。
 * `accessTokenEnv` は環境変数名であり、トークンの値そのものではない。
 */
export type ConfigGroup = {
  readonly accessTokenEnv: AccessTokenEnvName
  readonly repositories: readonly RepoConfig[]
}

export type Config = readonly ConfigGroup[]

export type MrCreationResult = "CREATED" | "SKIPPED" | "ERROR"

export type RunResult = "SUCCESS" | "PARTIAL_FAILURE"
