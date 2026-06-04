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
import type { BranchPair } from "./types.js"
import { FatalError } from "./utils/errors.js"
import { extractHttpStatus, isFatalError, toErrorMessage } from "./utils/http.js"
import { logger } from "./utils/logger.js"
import { timed } from "./utils/timer.js"

/** MR 作成試行の結果。CREATED: 作成成功、SKIPPED: 条件未達でスキップ、ERROR: 非 fatal なエラー */
export type Result = "CREATED" | "SKIPPED" | "ERROR"

export async function run(): Promise<void> {
  logger.info({ event: "run_start", dryRun: DRY_RUN, concurrencyLimit: CONCURRENCY_LIMIT })
  const { duration_ms } = await timed(main)
  logger.info({ event: "run_end", duration_ms })
}

/**
 * メインロジック。設定ファイルを読み込み、全リポジトリ・ブランチペアに対して
 * MR 作成を並列実行する。1 件でも ERROR があれば throw する。
 * DRY_RUN=true のときは MR を作成せず、作成対象のログのみ出力する。
 */
export async function main(): Promise<void> {
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

  // 1 件の失敗で全タスクを中断しないよう allSettled を使用する
  const settledResults = await Promise.allSettled(mrCreationTasks)

  // 認証エラーや 5xx など回復不能なエラーは即時終了する
  for (const result of settledResults) {
    if (result.status === "rejected" && result.reason instanceof FatalError) {
      logger.error({
        event: "fatal_error",
        httpStatus: result.reason.httpStatus,
        message: result.reason.message,
      })
      throw result.reason
    }
  }

  const resultCounts = settledResults.reduce<Record<Result, number>>(
    (counts, settledResult) => {
      if (settledResult.status === "rejected") {
        logger.error({
          event: "unexpected_rejection",
          message: toErrorMessage(settledResult.reason),
        })
        return { ...counts, ERROR: counts.ERROR + 1 }
      }
      return {
        ...counts,
        [settledResult.value]: counts[settledResult.value] + 1,
      }
    },
    { CREATED: 0, SKIPPED: 0, ERROR: 0 },
  )

  logger.info({ event: "summary", ...resultCounts })
}

/**
 * カンマ区切りの文字列をプロジェクト ID の Set に変換する。
 * 数値に変換できない値や空セグメントは除外する。
 */
export function parseSkipProjectIds(raw: string | undefined): Set<number> {
  if (!raw?.trim()) return new Set()
  return new Set(
    raw
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s !== "")
      .map(Number)
      .filter((n) => Number.isInteger(n) && n > 0),
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
  projectId: number,
  projectName: string,
  branchPair: BranchPair,
  dryRun = false,
): Promise<Result> {
  const logContext = {
    projectId,
    projectName,
    source: branchPair.source,
    target: branchPair.target,
  }
  if (dryRun) {
    logger.info({ ...logContext, result: "SKIPPED", reason: "dry_run" })
    return "SKIPPED"
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
      ].filter((b): b is string => b !== null)
      logger.error({ ...logContext, result: "ERROR", reason: "branch_not_found", missingBranches })
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
    await createMergeRequest(gitlab, projectId, branchPair)
    logger.info({ ...logContext, result: "CREATED" })
    return "CREATED"
  } catch (err) {
    if (isFatalError(err)) {
      throw new FatalError(extractHttpStatus(err), err)
    }
    logger.error({
      ...logContext,
      result: "ERROR",
      message: toErrorMessage(err),
      httpStatus: extractHttpStatus(err),
    })
    return "ERROR"
  }
}
