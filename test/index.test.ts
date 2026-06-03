import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("../src/lib/gitlab.js")
vi.mock("../src/lib/config.js")
vi.mock("../src/utils/logger.js", () => ({
  logger: { info: vi.fn(), error: vi.fn() },
}))

import { parseSkipProjectIds, createMrIfNeeded, main } from "../src/index.js"
import { loadConfig } from "../src/lib/config.js"
import {
  branchExists,
  hasDiff,
  openMergeRequestExists,
  createMergeRequest,
  createClient,
} from "../src/lib/gitlab.js"
import type { GitlabClient } from "../src/lib/gitlab.js"
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

  it.each([401, 500])("HTTP %i エラーのとき FatalError をスローする", async (status) => {
    vi.mocked(branchExists).mockRejectedValue(makeHttpError(status))
    await expect(createMrIfNeeded(mockGitlab, 1, "repo", branchPair)).rejects.toThrow(FatalError)
  })
})

describe("main", () => {
  let exitSpy: ReturnType<typeof vi.spyOn>

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
})
