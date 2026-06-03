export type BranchPair = {
  readonly source: string
  readonly target: string
}

export type RepoConfig = {
  readonly projectId: number
  readonly projectName: string
  readonly branchPairs: readonly BranchPair[]
}

export type Config = {
  readonly repositories: readonly RepoConfig[]
}
