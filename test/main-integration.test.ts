import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mockEnv = vi.hoisted(() => ({
  GITLAB_URL: "https://gitlab.test" as string,
  ACCESS_TOKEN: "test-token" as string,
  SKIP_PROJECT_IDS: undefined as string | undefined,
  CONFIG_PATH: undefined as string | undefined,
  CONCURRENCY_LIMIT: 5 as number,
  DRY_RUN: false as boolean,
}))

vi.mock("../src/lib/env.js", () => mockEnv)
vi.mock("../src/lib/gitlab.js")
vi.mock("../src/lib/config.js")
vi.mock("../src/utils/logger.js", () => ({
  logger: { info: vi.fn(), error: vi.fn() },
}))
vi.mock("p-limit", () => ({
  default: vi.fn().mockImplementation(() => (fn: () => unknown) => fn()),
}))

import pLimit from "p-limit"

import { loadConfig } from "../src/lib/config.js"
import {
  branchExists,
  hasDiff,
  openMergeRequestExists,
  createMergeRequest,
  createClient,
} from "../src/lib/gitlab.js"
import type { GitlabClient } from "../src/lib/gitlab.js"
import { process as processFn } from "../src/main.js"
import { toBranchName, toProjectId, toProjectName } from "../src/types.js"

const mockGitlab = {} as unknown as GitlabClient
const branchPair = { source: toBranchName("develop"), target: toBranchName("main") }

describe("process - SKIP_PROJECT_IDS 統合", () => {
  beforeEach(() => {
    mockEnv.SKIP_PROJECT_IDS = undefined
    mockEnv.DRY_RUN = false
    mockEnv.CONCURRENCY_LIMIT = 5
    vi.mocked(createClient).mockReturnValue(mockGitlab)
    vi.mocked(branchExists).mockResolvedValue(true)
    vi.mocked(hasDiff).mockResolvedValue(true)
    vi.mocked(openMergeRequestExists).mockResolvedValue(false)
    vi.mocked(createMergeRequest).mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it("SKIP_PROJECT_IDS に含まれるプロジェクトは branchExists を呼び出さない", async () => {
    mockEnv.SKIP_PROJECT_IDS = "1"
    vi.mocked(loadConfig).mockReturnValue({
      repositories: [
        {
          projectId: toProjectId(1),
          projectName: toProjectName("repo-skip"),
          branchPairs: [branchPair],
        },
        {
          projectId: toProjectId(2),
          projectName: toProjectName("repo-ok"),
          branchPairs: [branchPair],
        },
      ],
    })

    await processFn()

    // project 2 の source/target のみ確認されるので 2 回
    expect(branchExists).toHaveBeenCalledTimes(2)
    expect(branchExists).not.toHaveBeenCalledWith(
      expect.anything(),
      toProjectId(1),
      expect.anything(),
    )
  })

  it("SKIP_PROJECT_IDS に含まれるプロジェクトを除いた件数を返す", async () => {
    mockEnv.SKIP_PROJECT_IDS = "1"
    vi.mocked(loadConfig).mockReturnValue({
      repositories: [
        {
          projectId: toProjectId(1),
          projectName: toProjectName("repo-skip"),
          branchPairs: [branchPair],
        },
        {
          projectId: toProjectId(2),
          projectName: toProjectName("repo-ok"),
          branchPairs: [branchPair],
        },
      ],
    })

    await expect(processFn()).resolves.toEqual({ CREATED: 1, SKIPPED: 0, ERROR: 0 })
  })
})

describe("process - DRY_RUN 統合", () => {
  beforeEach(() => {
    mockEnv.SKIP_PROJECT_IDS = undefined
    mockEnv.DRY_RUN = true
    mockEnv.CONCURRENCY_LIMIT = 5
    vi.mocked(createClient).mockReturnValue(mockGitlab)
    vi.mocked(loadConfig).mockReturnValue({
      repositories: [
        {
          projectId: toProjectId(1),
          projectName: toProjectName("repo-a"),
          branchPairs: [branchPair],
        },
        {
          projectId: toProjectId(2),
          projectName: toProjectName("repo-b"),
          branchPairs: [branchPair],
        },
      ],
    })
    vi.mocked(branchExists).mockResolvedValue(true)
    vi.mocked(hasDiff).mockResolvedValue(true)
    vi.mocked(openMergeRequestExists).mockResolvedValue(false)
    vi.mocked(createMergeRequest).mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.clearAllMocks()
    mockEnv.DRY_RUN = false
  })

  it("DRY_RUN=true のとき全ペアが SKIPPED になる", async () => {
    await expect(processFn()).resolves.toEqual({ CREATED: 0, SKIPPED: 2, ERROR: 0 })
  })

  it("DRY_RUN=true のとき createMergeRequest を一切呼び出さない", async () => {
    await processFn()
    expect(createMergeRequest).not.toHaveBeenCalled()
  })
})

describe("process - CONCURRENCY_LIMIT 統合", () => {
  beforeEach(() => {
    mockEnv.SKIP_PROJECT_IDS = undefined
    mockEnv.DRY_RUN = false
    mockEnv.CONCURRENCY_LIMIT = 5
    vi.mocked(createClient).mockReturnValue(mockGitlab)
    vi.mocked(loadConfig).mockReturnValue({ repositories: [] })
  })

  afterEach(() => {
    vi.clearAllMocks()
    mockEnv.CONCURRENCY_LIMIT = 5
  })

  it("pLimit を CONCURRENCY_LIMIT の値で呼び出す", async () => {
    mockEnv.CONCURRENCY_LIMIT = 3
    await processFn()
    expect(pLimit).toHaveBeenCalledWith(3)
  })
})
