import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { logger } from "../../src/utils/logger.js"

describe("logger", () => {
  let lastLog = ""
  let lastError = ""
  let logSpy: ReturnType<typeof vi.spyOn>
  let errorSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    lastLog = ""
    lastError = ""
    logSpy = vi.spyOn(console, "log").mockImplementation((...args) => {
      lastLog = String(args[0])
    })
    errorSpy = vi.spyOn(console, "error").mockImplementation((...args) => {
      lastError = String(args[0])
    })
  })

  afterEach(() => {
    logSpy.mockRestore()
    errorSpy.mockRestore()
  })

  describe("info", () => {
    it("level: info を含む JSON を出力する", () => {
      logger.info({ event: "test" })
      const output = JSON.parse(lastLog)
      expect(output.level).toBe("info")
    })

    it("渡したフィールドを含む", () => {
      logger.info({ event: "test", projectId: 1 })
      const output = JSON.parse(lastLog)
      expect(output.event).toBe("test")
      expect(output.projectId).toBe(1)
    })

    it("timestamp フィールドを含む", () => {
      logger.info({ event: "test" })
      const output = JSON.parse(lastLog)
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
      const output = JSON.parse(lastError)
      expect(output.level).toBe("error")
    })

    it("console.error を使う", () => {
      logger.error({ event: "test" })
      expect(errorSpy).toHaveBeenCalledOnce()
      expect(logSpy).not.toHaveBeenCalled()
    })
  })
})
