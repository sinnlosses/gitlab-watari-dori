import { Gitlab } from "@gitbeaker/rest"

import type { BranchPair } from "../types.js"
import { isNotFoundError } from "../utils/http.js"

export type GitlabClient = InstanceType<typeof Gitlab>

export function createClient(host: string, token: string): GitlabClient {
  return new Gitlab({ host, token })
}

export async function branchExists(
  gitlab: GitlabClient,
  projectId: number,
  branch: string,
): Promise<boolean> {
  try {
    await gitlab.Branches.show(projectId, branch)
    return true
  } catch (error) {
    if (isNotFoundError(error)) return false
    throw error
  }
}

export async function hasDiff(
  gitlab: GitlabClient,
  projectId: number,
  branchPair: BranchPair,
): Promise<boolean> {
  const comparison = await gitlab.Repositories.compare(
    projectId,
    branchPair.target,
    branchPair.source,
  )
  return (comparison.commits?.length ?? 0) > 0
}

export async function openMergeRequestExists(
  gitlab: GitlabClient,
  projectId: number,
  branchPair: BranchPair,
): Promise<boolean> {
  const mergeRequests = await gitlab.MergeRequests.all({
    projectId,
    sourceBranch: branchPair.source,
    targetBranch: branchPair.target,
    state: "opened",
  })
  return mergeRequests.length > 0
}

function buildMrTitle(source: string, target: string): string {
  return `Auto MR by Watari-Dori : ${source} → ${target}`
}

export async function createMergeRequest(
  gitlab: GitlabClient,
  projectId: number,
  branchPair: BranchPair,
): Promise<void> {
  await gitlab.MergeRequests.create(
    projectId,
    branchPair.source,
    branchPair.target,
    buildMrTitle(branchPair.source, branchPair.target),
  )
}
