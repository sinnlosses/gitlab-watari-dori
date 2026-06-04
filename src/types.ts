declare const projectIdBrand: unique symbol
export type ProjectId = number & { readonly [projectIdBrand]: never }
export function toProjectId(n: number): ProjectId {
  return n as ProjectId
}

declare const branchNameBrand: unique symbol
export type BranchName = string & { readonly [branchNameBrand]: never }
export function toBranchName(s: string): BranchName {
  return s as BranchName
}

declare const gitLabUrlBrand: unique symbol
export type GitLabUrl = string & { readonly [gitLabUrlBrand]: never }

export type BranchPair = {
  readonly source: BranchName
  readonly target: BranchName
}

export type RepoConfig = {
  readonly projectId: ProjectId
  readonly projectName: string
  readonly branchPairs: readonly BranchPair[]
}

export type Config = {
  readonly repositories: readonly RepoConfig[]
}

export type Result = "CREATED" | "SKIPPED" | "ERROR"
