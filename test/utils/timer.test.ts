import { describe, expect, it } from "vitest"

import { timed } from "../../src/utils/timer.js"

describe("timed", () => {
  it("fn の戻り値を返す", async () => {
    const { value } = await timed(async () => 42)
    expect(value).toBe(42)
  })

  it("duration_ms に経過時間（ms）を返す", async () => {
    const { duration_ms } = await timed(async () => 0)
    expect(duration_ms).toBeGreaterThanOrEqual(0)
    expect(typeof duration_ms).toBe("number")
  })
})
