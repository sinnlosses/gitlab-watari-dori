import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => undefined as never)

describe("index", () => {
  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('run が "SUCCESS" を返したとき process.exit(0) を呼ぶ', async () => {
    vi.doMock("../src/main.js", () => ({ run: vi.fn().mockResolvedValue("SUCCESS") }))
    vi.doMock("../src/utils/logger.js", () => ({ logger: { error: vi.fn() } }))
    await import("../src/index.js")
    await new Promise<void>((resolve) => setTimeout(resolve, 0))
    expect(exitSpy).toHaveBeenCalledWith(0)
  })

  it('run が "PARTIAL_FAILURE" を返したとき process.exit(1) を呼ぶ', async () => {
    vi.doMock("../src/main.js", () => ({ run: vi.fn().mockResolvedValue("PARTIAL_FAILURE") }))
    vi.doMock("../src/utils/logger.js", () => ({ logger: { error: vi.fn() } }))
    await import("../src/index.js")
    await new Promise<void>((resolve) => setTimeout(resolve, 0))
    expect(exitSpy).toHaveBeenCalledWith(1)
  })

  it("FatalError のとき httpStatus と message をログに出力して process.exit(1) を呼ぶ", async () => {
    const { FatalError } = await import("../src/utils/errors.js")
    const loggerError = vi.fn()
    vi.doMock("../src/main.js", () => ({
      run: vi.fn().mockRejectedValue(new FatalError(401, new Error("Unauthorized"))),
    }))
    vi.doMock("../src/utils/logger.js", () => ({ logger: { error: loggerError } }))
    await import("../src/index.js")
    await new Promise<void>((resolve) => setTimeout(resolve, 0))
    expect(loggerError).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "fatal_error",
        httpStatus: 401,
        message: "Unauthorized",
      }),
    )
    expect(exitSpy).toHaveBeenCalledWith(1)
  })

  it("FatalError 以外のとき message を文字列化してログに出力して process.exit(1) を呼ぶ", async () => {
    const loggerError = vi.fn()
    vi.doMock("../src/main.js", () => ({
      run: vi.fn().mockRejectedValue(new Error("unexpected")),
    }))
    vi.doMock("../src/utils/logger.js", () => ({ logger: { error: loggerError } }))
    await import("../src/index.js")
    await new Promise<void>((resolve) => setTimeout(resolve, 0))
    expect(loggerError).toHaveBeenCalledWith(
      expect.objectContaining({ event: "unhandled_error", message: "Error: unexpected" }),
    )
    expect(exitSpy).toHaveBeenCalledWith(1)
  })
})
