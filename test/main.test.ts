import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { MockInstance } from "vitest"

vi.mock("../src/lib/gitlab.js")
vi.mock("../src/lib/config.js")
vi.mock("../src/lib/env.js", () => ({
  GITLAB_URL: "https://gitlab.test",
  ACCESS_TOKEN: "test-token",
  SKIP_PROJECT_IDS: undefined,
  CONFIG_PATH: undefined,
  CONCURRENCY_LIMIT: 5,
  DRY_RUN: false,
}))
vi.mock("../src/utils/logger.js", () => ({
  logger: { info: vi.fn(), error: vi.fn() },
}))

import { loadConfig } from "../src/lib/config.js"
import {
  branchExists,
  hasDiff,
  openMergeRequestExists,
  createMergeRequest,
  createClient,
} from "../src/lib/gitlab.js"
import type { GitlabClient } from "../src/lib/gitlab.js"
import { parseSkipProjectIds, createMrIfNeeded, main } from "../src/main.js"
import { FatalError } from "../src/utils/errors.js"
import { makeHttpError } from "./helpers.js"

const mockGitlab = {} as unknown as GitlabClient
const branchPair = { source: "develop", target: "main" }

describe("parseSkipProjectIds", () => {
  it("undefined のとき空の Set を返す", () => {
    expect(parseSkipProjectIds(undefined)).toEqual(new Set())
  })

  it("空文字のとき空の Set を返す", () => {
    expect(parseSkipProjectIds("")).toEqual(new Set())
  })

  it("スペースのみのとき空の Set を返す", () => {
    expect(parseSkipProjectIds("   ")).toEqual(new Set())
  })

  it("単一の ID をパースする", () => {
    expect(parseSkipProjectIds("123")).toEqual(new Set([123]))
  })

  it("カンマ区切りの複数 ID をパースする", () => {
    expect(parseSkipProjectIds("1,2,3")).toEqual(new Set([1, 2, 3]))
  })

  it("各 ID の前後のスペースを除去する", () => {
    expect(parseSkipProjectIds(" 1 , 2 , 3 ")).toEqual(new Set([1, 2, 3]))
  })

  it("数値に変換できない値を除外する", () => {
    expect(parseSkipProjectIds("1,abc,3")).toEqual(new Set([1, 3]))
  })

  it("連続するカンマによる空セグメントを除外する", () => {
    expect(parseSkipProjectIds("1,,3")).toEqual(new Set([1, 3]))
  })

  it("小数を除外する", () => {
    expect(parseSkipProjectIds("1,1.5,3")).toEqual(new Set([1, 3]))
  })

  it("0 以下の値を除外する", () => {
    expect(parseSkipProjectIds("0,-1,3")).toEqual(new Set([3]))
  })
})

describe("createMrIfNeeded", () => {
  beforeEach(() => {
    vi.mocked(branchExists).mockResolvedValue(true)
    vi.mocked(hasDiff).mockResolvedValue(true)
    vi.mocked(openMergeRequestExists).mockResolvedValue(false)
    vi.mocked(createMergeRequest).mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it("MR 作成に成功したとき 'CREATED' を返す", async () => {
    expect(await createMrIfNeeded(mockGitlab, 1, "repo", branchPair)).toBe("CREATED")
    expect(createMergeRequest).toHaveBeenCalledOnce()
  })

  it("dryRun=true のとき MR を作成せず 'SKIPPED' を返す", async () => {
    expect(await createMrIfNeeded(mockGitlab, 1, "repo", branchPair, true)).toBe("SKIPPED")
    expect(createMergeRequest).not.toHaveBeenCalled()
  })

  it("source ブランチが存在しないとき 'ERROR' を返す", async () => {
    vi.mocked(branchExists).mockImplementation(async (_client, _id, branch) => branch !== "develop")
    expect(await createMrIfNeeded(mockGitlab, 1, "repo", branchPair)).toBe("ERROR")
    expect(createMergeRequest).not.toHaveBeenCalled()
  })

  it("target ブランチが存在しないとき 'ERROR' を返す", async () => {
    vi.mocked(branchExists).mockImplementation(async (_client, _id, branch) => branch !== "main")
    expect(await createMrIfNeeded(mockGitlab, 1, "repo", branchPair)).toBe("ERROR")
    expect(createMergeRequest).not.toHaveBeenCalled()
  })

  it("差分がないとき 'SKIPPED' を返す", async () => {
    vi.mocked(hasDiff).mockResolvedValue(false)
    expect(await createMrIfNeeded(mockGitlab, 1, "repo", branchPair)).toBe("SKIPPED")
    expect(createMergeRequest).not.toHaveBeenCalled()
  })

  it("オープン中の MR が既に存在するとき 'SKIPPED' を返す", async () => {
    vi.mocked(openMergeRequestExists).mockResolvedValue(true)
    expect(await createMrIfNeeded(mockGitlab, 1, "repo", branchPair)).toBe("SKIPPED")
    expect(createMergeRequest).not.toHaveBeenCalled()
  })

  it("非 fatal な API エラーのとき 'ERROR' を返す", async () => {
    vi.mocked(branchExists).mockRejectedValue(new Error("Network error"))
    expect(await createMrIfNeeded(mockGitlab, 1, "repo", branchPair)).toBe("ERROR")
  })

  it("source ブランチが存在しないとき欠損ブランチ名をログに含める", async () => {
    const { logger } = await import("../src/utils/logger.js")
    vi.mocked(branchExists).mockImplementation(async (_client, _id, branch) => branch !== "develop")
    await createMrIfNeeded(mockGitlab, 1, "repo", branchPair)
    expect(vi.mocked(logger.error)).toHaveBeenCalledWith(
      expect.objectContaining({ missingBranches: ["develop"] }),
    )
  })

  it("両ブランチが存在しないとき両方の欠損ブランチ名をログに含める", async () => {
    const { logger } = await import("../src/utils/logger.js")
    vi.mocked(branchExists).mockResolvedValue(false)
    await createMrIfNeeded(mockGitlab, 1, "repo", branchPair)
    expect(vi.mocked(logger.error)).toHaveBeenCalledWith(
      expect.objectContaining({ missingBranches: ["develop", "main"] }),
    )
  })

  it("非 fatal な HTTP エラーのとき httpStatus をエラーログに含める", async () => {
    const { logger } = await import("../src/utils/logger.js")
    vi.mocked(branchExists).mockRejectedValue(makeHttpError(403))
    await createMrIfNeeded(mockGitlab, 1, "repo", branchPair)
    expect(vi.mocked(logger.error)).toHaveBeenCalledWith(
      expect.objectContaining({ httpStatus: 403 }),
    )
  })

  it.each([401, 500])("HTTP %i エラーのとき FatalError をスローする", async (status) => {
    vi.mocked(branchExists).mockRejectedValue(makeHttpError(status))
    await expect(createMrIfNeeded(mockGitlab, 1, "repo", branchPair)).rejects.toThrow(FatalError)
  })

  it("HTTP 401 エラーのとき FatalError.httpStatus が 401 になる", async () => {
    vi.mocked(branchExists).mockRejectedValue(makeHttpError(401))
    const err = await createMrIfNeeded(mockGitlab, 1, "repo", branchPair).catch((e) => e)
    expect(err).toBeInstanceOf(FatalError)
    expect(err.httpStatus).toBe(401)
  })

  it("createMergeRequest が 403 エラーを投げたとき 'ERROR' を返す", async () => {
    vi.mocked(createMergeRequest).mockRejectedValue(makeHttpError(403))
    expect(await createMrIfNeeded(mockGitlab, 1, "repo", branchPair)).toBe("ERROR")
  })

  it("createMergeRequest が 500 エラーを投げたとき FatalError をスローする", async () => {
    vi.mocked(createMergeRequest).mockRejectedValue(makeHttpError(500))
    const err = await createMrIfNeeded(mockGitlab, 1, "repo", branchPair).catch((e) => e)
    expect(err).toBeInstanceOf(FatalError)
    expect(err.httpStatus).toBe(500)
  })

  it.each([
    ["hasDiff", () => vi.mocked(hasDiff).mockRejectedValue(makeHttpError(500))],
    [
      "openMergeRequestExists",
      () => vi.mocked(openMergeRequestExists).mockRejectedValue(makeHttpError(401)),
    ],
  ] as const)("%s が fatal エラーのとき FatalError をスローする", async (_name, setup) => {
    setup()
    await expect(createMrIfNeeded(mockGitlab, 1, "repo", branchPair)).rejects.toThrow(FatalError)
  })

  it("ネットワーク障害（ECONNREFUSED）のとき FatalError をスローする", async () => {
    const err = Object.assign(new Error("connect ECONNREFUSED"), { code: "ECONNREFUSED" })
    vi.mocked(branchExists).mockRejectedValue(err)
    await expect(createMrIfNeeded(mockGitlab, 1, "repo", branchPair)).rejects.toThrow(FatalError)
  })
})

describe("main", () => {
  let exitSpy: MockInstance

  beforeEach(() => {
    exitSpy = vi.spyOn(process, "exit").mockImplementation(() => undefined as never)
    vi.mocked(createClient).mockReturnValue(mockGitlab)
    vi.mocked(loadConfig).mockReturnValue({ repositories: [] })
    vi.mocked(branchExists).mockResolvedValue(true)
    vi.mocked(hasDiff).mockResolvedValue(true)
    vi.mocked(openMergeRequestExists).mockResolvedValue(false)
    vi.mocked(createMergeRequest).mockResolvedValue(undefined)
  })

  afterEach(() => {
    exitSpy.mockRestore()
    vi.clearAllMocks()
  })

  it("リポジトリがないとき exit を呼ばない", async () => {
    await main()
    expect(exitSpy).not.toHaveBeenCalled()
  })

  it("全件 CREATED のとき exit を呼ばない", async () => {
    vi.mocked(loadConfig).mockReturnValue({
      repositories: [{ projectId: 1, projectName: "repo", branchPairs: [branchPair] }],
    })
    await main()
    expect(exitSpy).not.toHaveBeenCalled()
  })

  it("1 件でも ERROR があるとき exit(1) を呼ぶ", async () => {
    vi.mocked(loadConfig).mockReturnValue({
      repositories: [{ projectId: 1, projectName: "repo", branchPairs: [branchPair] }],
    })
    vi.mocked(branchExists).mockResolvedValue(false)
    await main()
    expect(exitSpy).toHaveBeenCalledWith(1)
  })

  it("FatalError が発生したとき exit(1) を呼ぶ", async () => {
    vi.mocked(loadConfig).mockReturnValue({
      repositories: [{ projectId: 1, projectName: "repo", branchPairs: [branchPair] }],
    })
    vi.mocked(branchExists).mockRejectedValue(makeHttpError(401))
    await main()
    expect(exitSpy).toHaveBeenCalledWith(1)
  })

  it("createClient に GITLAB_URL と ACCESS_TOKEN を渡す", async () => {
    await main()
    expect(createClient).toHaveBeenCalledWith("https://gitlab.test", "test-token")
  })

  it("全件 CREATED のとき summary に正しい件数を出力する", async () => {
    const { logger } = await import("../src/utils/logger.js")
    vi.mocked(loadConfig).mockReturnValue({
      repositories: [
        { projectId: 1, projectName: "repo-a", branchPairs: [branchPair] },
        { projectId: 2, projectName: "repo-b", branchPairs: [branchPair] },
      ],
    })
    await main()
    expect(vi.mocked(logger.info)).toHaveBeenCalledWith(
      expect.objectContaining({ event: "summary", CREATED: 2, SKIPPED: 0, ERROR: 0 }),
    )
  })

  it("一部 SKIPPED を含む場合 summary の件数が正しい", async () => {
    const { logger } = await import("../src/utils/logger.js")
    vi.mocked(loadConfig).mockReturnValue({
      repositories: [{ projectId: 1, projectName: "repo-a", branchPairs: [branchPair] }],
    })
    vi.mocked(hasDiff).mockResolvedValue(false)
    await main()
    expect(vi.mocked(logger.info)).toHaveBeenCalledWith(
      expect.objectContaining({ event: "summary", CREATED: 0, SKIPPED: 1, ERROR: 0 }),
    )
    expect(exitSpy).not.toHaveBeenCalled()
  })

  it("run_start イベントをログ出力する", async () => {
    const { logger } = await import("../src/utils/logger.js")
    await main()
    expect(vi.mocked(logger.info)).toHaveBeenCalledWith(
      expect.objectContaining({ event: "run_start" }),
    )
  })

  it("run_end イベントに duration_ms を含めてログ出力する", async () => {
    const { logger } = await import("../src/utils/logger.js")
    await main()
    expect(vi.mocked(logger.info)).toHaveBeenCalledWith(
      expect.objectContaining({ event: "run_end", duration_ms: expect.any(Number) }),
    )
  })
})
