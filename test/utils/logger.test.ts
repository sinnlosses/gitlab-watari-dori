import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { logger } from "../../src/utils/logger.js"

describe("logger", () => {
  let logSpy: ReturnType<typeof vi.spyOn>
  let errorSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    logSpy = vi.spyOn(console, "log").mockImplementation(() => {})
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
  })

  afterEach(() => {
    logSpy.mockRestore()
    errorSpy.mockRestore()
  })

  describe("info", () => {
    it("level: info を含む JSON を出力する", () => {
      logger.info({ event: "test" })
      const output = JSON.parse(logSpy.mock.calls[0]![0])
      expect(output.level).toBe("info")
    })

    it("渡したフィールドを含む", () => {
      logger.info({ event: "test", projectId: 1 })
      const output = JSON.parse(logSpy.mock.calls[0]![0])
      expect(output.event).toBe("test")
      expect(output.projectId).toBe(1)
    })

    it("timestamp フィールドを含む", () => {
      logger.info({ event: "test" })
      const output = JSON.parse(logSpy.mock.calls[0]![0])
      expect(output.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    })

    it("console.log を使う", () => {
      logger.info({ event: "test" })
      expect(logSpy).toHaveBeenCalledOnce()
      expect(errorSpy).not.toHaveBeenCalled()
    })
  })

  describe("error", () => {
    it("level: error を含む JSON を出力する", () => {
      logger.error({ event: "test" })
      const output = JSON.parse(errorSpy.mock.calls[0]![0])
      expect(output.level).toBe("error")
    })

    it("console.error を使う", () => {
      logger.error({ event: "test" })
      expect(errorSpy).toHaveBeenCalledOnce()
      expect(logSpy).not.toHaveBeenCalled()
    })
  })
})
