import { describe, expect, it, vi } from "vitest"

import type { GitlabClient } from "../../src/lib/gitlab.js"
import {
  branchExists,
  createMergeRequest,
  hasDiff,
  openMergeRequestExists,
} from "../../src/lib/gitlab.js"
import { toBranchName, toProjectId } from "../../src/types.js"
import { makeHttpError } from "../helpers.js"

function makeClient(
  overrides: Partial<{
    Branches: { show: ReturnType<typeof vi.fn> }
    Repositories: { compare: ReturnType<typeof vi.fn> }
    MergeRequests: { all: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn> }
  }>,
): GitlabClient {
  return {
    Branches: { show: vi.fn(), ...overrides.Branches },
    Repositories: { compare: vi.fn(), ...overrides.Repositories },
    MergeRequests: { all: vi.fn(), create: vi.fn(), ...overrides.MergeRequests },
  } as unknown as GitlabClient
}

describe("branchExists", () => {
  it("ブランチが存在するとき true を返す", async () => {
    const client = makeClient({ Branches: { show: vi.fn().mockResolvedValue({}) } })
    expect(await branchExists(client, toProjectId(1), toBranchName("main"))).toBe(true)
  })

  it("404 のとき false を返す", async () => {
    const client = makeClient({
      Branches: { show: vi.fn().mockRejectedValue(makeHttpError(404)) },
    })
    expect(await branchExists(client, toProjectId(1), toBranchName("nonexistent"))).toBe(false)
  })

  it("404 以外のエラーは再スローする", async () => {
    const err = makeHttpError(500)
    const client = makeClient({ Branches: { show: vi.fn().mockRejectedValue(err) } })
    await expect(branchExists(client, toProjectId(1), toBranchName("main"))).rejects.toBe(err)
  })

  it("正しい引数で Branches.show を呼び出す", async () => {
    const showFn = vi.fn().mockResolvedValue({})
    const client = makeClient({ Branches: { show: showFn } })
    await branchExists(client, toProjectId(42), toBranchName("develop"))
    expect(showFn).toHaveBeenCalledWith(42, "develop")
  })
})

describe("hasDiff", () => {
  it("コミットが存在するとき true を返す", async () => {
    const client = makeClient({
      Repositories: { compare: vi.fn().mockResolvedValue({ commits: [{ id: "abc" }] }) },
    })
    expect(
      await hasDiff(client, toProjectId(1), {
        source: toBranchName("develop"),
        target: toBranchName("main"),
      }),
    ).toBe(true)
  })

  it("コミットが空配列のとき false を返す", async () => {
    const client = makeClient({
      Repositories: { compare: vi.fn().mockResolvedValue({ commits: [] }) },
    })
    expect(
      await hasDiff(client, toProjectId(1), {
        source: toBranchName("develop"),
        target: toBranchName("main"),
      }),
    ).toBe(false)
  })

  it("commits が undefined のとき false を返す", async () => {
    const client = makeClient({
      Repositories: { compare: vi.fn().mockResolvedValue({}) },
    })
    expect(
      await hasDiff(client, toProjectId(1), {
        source: toBranchName("develop"),
        target: toBranchName("main"),
      }),
    ).toBe(false)
  })

  it("from=target, to=source で比較する (source にあって target にないコミットを検出)", async () => {
    const compareFn = vi.fn().mockResolvedValue({ commits: [] })
    const client = makeClient({ Repositories: { compare: compareFn } })
    await hasDiff(client, toProjectId(1), {
      source: toBranchName("develop"),
      target: toBranchName("main"),
    })
    expect(compareFn).toHaveBeenCalledWith(1, "main", "develop")
  })
})

describe("openMergeRequestExists", () => {
  it("オープン中の MR が存在するとき true を返す", async () => {
    const client = makeClient({
      MergeRequests: { all: vi.fn().mockResolvedValue([{ iid: 1 }]), create: vi.fn() },
    })
    expect(
      await openMergeRequestExists(client, toProjectId(1), {
        source: toBranchName("develop"),
        target: toBranchName("main"),
      }),
    ).toBe(true)
  })

  it("オープン中の MR がないとき false を返す", async () => {
    const client = makeClient({
      MergeRequests: { all: vi.fn().mockResolvedValue([]), create: vi.fn() },
    })
    expect(
      await openMergeRequestExists(client, toProjectId(1), {
        source: toBranchName("develop"),
        target: toBranchName("main"),
      }),
    ).toBe(false)
  })

  it("正しいパラメータで MergeRequests.all を呼び出す", async () => {
    const allFn = vi.fn().mockResolvedValue([])
    const client = makeClient({ MergeRequests: { all: allFn, create: vi.fn() } })
    await openMergeRequestExists(client, toProjectId(42), {
      source: toBranchName("feature"),
      target: toBranchName("main"),
    })
    expect(allFn).toHaveBeenCalledWith({
      projectId: 42,
      sourceBranch: "feature",
      targetBranch: "main",
      state: "opened",
    })
  })
})

describe("createMergeRequest", () => {
  it("正しいプロジェクト ID とブランチ名で MergeRequests.create を呼び出す", async () => {
    const createFn = vi.fn().mockResolvedValue({})
    const client = makeClient({ MergeRequests: { all: vi.fn(), create: createFn } })
    await createMergeRequest(client, toProjectId(1), {
      source: toBranchName("develop"),
      target: toBranchName("main"),
    })
    expect(createFn).toHaveBeenCalledWith(1, "develop", "main", expect.any(String))
  })

  it("MR タイトルに source ブランチ名と target ブランチ名を含む", async () => {
    const createFn = vi.fn().mockResolvedValue({})
    const client = makeClient({ MergeRequests: { all: vi.fn(), create: createFn } })
    await createMergeRequest(client, toProjectId(1), {
      source: toBranchName("develop"),
      target: toBranchName("main"),
    })
    const title: string = createFn.mock.calls[0]?.[3]
    expect(title).toContain("develop")
    expect(title).toContain("main")
  })
})
