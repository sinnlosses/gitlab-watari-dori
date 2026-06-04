import { Gitlab } from "@gitbeaker/rest"

import type { BranchName, BranchPair, GitLabUrl, ProjectId } from "../types.js"
import { isNotFoundError } from "../utils/http.js"
import { withRetry } from "../utils/retry.js"

export type GitlabClient = InstanceType<typeof Gitlab>

export function createClient(host: GitLabUrl, token: string): GitlabClient {
  return new Gitlab({ host, token })
}

export async function branchExists(
  gitlab: GitlabClient,
  projectId: ProjectId,
  branch: BranchName,
): Promise<boolean> {
  return withRetry(async () => {
    try {
      await gitlab.Branches.show(projectId, branch)
      return true
    } catch (error) {
      if (isNotFoundError(error)) return false
      throw error
    }
  })
}

export async function hasDiff(
  gitlab: GitlabClient,
  projectId: ProjectId,
  branchPair: BranchPair,
): Promise<boolean> {
  // target を base として source との差分を取得する（source にあって target にないコミットを検出）
  const comparison = await withRetry(() =>
    gitlab.Repositories.compare(projectId, branchPair.target, branchPair.source),
  )
  return (comparison.commits?.length ?? 0) > 0
}

export async function openMergeRequestExists(
  gitlab: GitlabClient,
  projectId: ProjectId,
  branchPair: BranchPair,
): Promise<boolean> {
  const mergeRequests = await withRetry(() =>
    gitlab.MergeRequests.all({
      projectId,
      sourceBranch: branchPair.source,
      targetBranch: branchPair.target,
      state: "opened",
    }),
  )
  return mergeRequests.length > 0
}

function buildMrTitle(source: string, target: string): string {
  return `Auto MR by Watari-Dori : ${source} into ${target}`
}

export async function createMergeRequest(
  gitlab: GitlabClient,
  projectId: ProjectId,
  branchPair: BranchPair,
): Promise<void> {
  await withRetry(() =>
    gitlab.MergeRequests.create(
      projectId,
      branchPair.source,
      branchPair.target,
      buildMrTitle(branchPair.source, branchPair.target),
    ),
  )
}
