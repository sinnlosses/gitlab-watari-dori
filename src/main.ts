import pLimit from "p-limit"

import { loadConfig } from "./lib/config.js"
import {
  ACCESS_TOKEN,
  CONCURRENCY_LIMIT,
  CONFIG_PATH,
  DRY_RUN,
  GITLAB_URL,
  SKIP_PROJECT_IDS,
} from "./lib/env.js"
import {
  type GitlabClient,
  createClient,
  branchExists,
  hasDiff,
  openMergeRequestExists,
  createMergeRequest,
} from "./lib/gitlab.js"
import type {
  BranchName,
  BranchPair,
  MrCreationResult,
  ProjectId,
  ProjectName,
  RunResult,
} from "./types.js"
import { toProjectId } from "./types.js"
import { FatalError } from "./utils/errors.js"
import { extractHttpStatus, isFatalError, toErrorMessage } from "./utils/http.js"
import { logger } from "./utils/logger.js"
import { timed } from "./utils/timer.js"

export async function run(): Promise<RunResult> {
  logger.info({ event: "run_start", dryRun: DRY_RUN, concurrencyLimit: CONCURRENCY_LIMIT })
  const { value: resultCounts, duration_ms } = await timed(process)
  logger.info({ event: "summary", ...resultCounts })
  logger.info({ event: "run_end", duration_ms })
  return resultCounts.ERROR === 0 ? "SUCCESS" : "PARTIAL_FAILURE"
}

/**
 * 設定ファイルを読み込み、全リポジトリ・ブランチペアに対してMR作成を並列実行する。
 * DRY_RUN=true のときはMRを作成せず、作成対象のログのみ出力する。
 */
export async function process(): Promise<Record<MrCreationResult, number>> {
  const gitlabClient = createClient(GITLAB_URL, ACCESS_TOKEN)
  const { repositories } = loadConfig(CONFIG_PATH)

  const skippedProjectIds = parseSkipProjectIds(SKIP_PROJECT_IDS)
  if (skippedProjectIds.size > 0) {
    logger.info({ event: "skip_projects", projectIds: [...skippedProjectIds] })
  }
  const targetRepositories = repositories.filter(
    ({ projectId }) => !skippedProjectIds.has(projectId),
  )

  const limit = pLimit(CONCURRENCY_LIMIT)
  const mrCreationTasks = targetRepositories.flatMap(({ projectId, projectName, branchPairs }) =>
    branchPairs.map((branchPair) =>
      limit(() => createMrIfNeeded(gitlabClient, projectId, projectName, branchPair, DRY_RUN)),
    ),
  )

  const results = await Promise.all(mrCreationTasks)

  const resultCounts = results.reduce<Record<MrCreationResult, number>>(
    (counts, result) => ({ ...counts, [result]: counts[result] + 1 }),
    { CREATED: 0, SKIPPED: 0, ERROR: 0 },
  )

  return resultCounts
}

/**
 * カンマ区切りの文字列をプロジェクト ID の Set に変換する。
 * 数値に変換できない値や空セグメントは除外する。
 */
export function parseSkipProjectIds(raw: string | undefined): Set<ProjectId> {
  if (!raw?.trim()) return new Set()
  return new Set(
    raw
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s !== "")
      .map(Number)
      .filter((n) => Number.isInteger(n) && n > 0)
      .map(toProjectId),
  )
}

/**
 * 指定したブランチペアに対して MR の作成が必要か判定し、必要であれば作成する。
 *
 * 以下のいずれかに該当する場合は SKIPPED を返す:
 * - source → target に差分コミットがない
 * - 同じブランチペアのオープン中の MR がすでに存在する
 *
 * source または target ブランチが存在しない場合は設定ミスとみなし ERROR を返す。
 *
 * 401 / 5xx などの fatal なエラーは FatalError としてスローし、呼び出し元で即時終了させる。
 * それ以外のエラーは ERROR を返してログに記録し、処理を継続する。
 *
 * dryRun が true のときは MR を作成せず SKIPPED を返す。
 */
export async function createMrIfNeeded(
  gitlab: GitlabClient,
  projectId: ProjectId,
  projectName: ProjectName,
  branchPair: BranchPair,
  dryRun = false,
): Promise<MrCreationResult> {
  const logContext = {
    projectId,
    projectName,
    source: branchPair.source,
    target: branchPair.target,
  }

  try {
    const [sourceExists, targetExists] = await Promise.all([
      branchExists(gitlab, projectId, branchPair.source),
      branchExists(gitlab, projectId, branchPair.target),
    ])
    if (!sourceExists || !targetExists) {
      const missingBranches = [
        !sourceExists ? branchPair.source : null,
        !targetExists ? branchPair.target : null,
      ].filter((b): b is BranchName => b !== null)
      logger.error({
        ...logContext,
        result: "ERROR",
        reason: `branch_not_found. missingBranches: ${missingBranches}`,
      })
      return "ERROR"
    }

    const diffExists = await hasDiff(gitlab, projectId, branchPair)
    if (!diffExists) {
      logger.info({ ...logContext, result: "SKIPPED", reason: "no_diff" })
      return "SKIPPED"
    }

    if (await openMergeRequestExists(gitlab, projectId, branchPair)) {
      logger.info({ ...logContext, result: "SKIPPED", reason: "mr_exists" })
      return "SKIPPED"
    }

    if (dryRun) {
      logger.info({ ...logContext, result: "SKIPPED", reason: "dry_run" })
      return "SKIPPED"
    }

    await createMergeRequest(gitlab, projectId, branchPair)
    logger.info({ ...logContext, result: "CREATED" })
    return "CREATED"
  } catch (err) {
    // 認証エラーや 5xx など回復不能なエラーは即時終了する
    if (isFatalError(err)) {
      throw new FatalError(extractHttpStatus(err), err)
    }
    logger.error({
      ...logContext,
      result: "ERROR",
      reason: `httpStatus: ${extractHttpStatus(err)}, message: ${toErrorMessage(err)}`,
    })
    return "ERROR"
  }
}
