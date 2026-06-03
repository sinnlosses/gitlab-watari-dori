import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { loadEnv, loadOptionalEnv, parseConcurrencyLimit } from "../../src/lib/env.js"

const TEST_KEY = "WATARI_DORI_TEST_VAR"

describe("loadEnv", () => {
  beforeEach(() => {
    process.env[TEST_KEY] = "hello"
  })

  afterEach(() => {
    delete process.env[TEST_KEY]
  })

  it("設定済みの環境変数の値を返す", () => {
    expect(loadEnv(TEST_KEY)).toBe("hello")
  })

  it("未設定のとき例外をスローする", () => {
    delete process.env[TEST_KEY]
    expect(() => loadEnv(TEST_KEY)).toThrow(TEST_KEY)
  })

  it("空文字のとき例外をスローする", () => {
    process.env[TEST_KEY] = ""
    expect(() => loadEnv(TEST_KEY)).toThrow(TEST_KEY)
  })

  it("スペースのみのとき例外をスローする", () => {
    process.env[TEST_KEY] = "   "
    expect(() => loadEnv(TEST_KEY)).toThrow(TEST_KEY)
  })
})

describe("loadOptionalEnv", () => {
  afterEach(() => {
    delete process.env[TEST_KEY]
  })

  it("設定済みの環境変数の値を返す", () => {
    process.env[TEST_KEY] = "world"
    expect(loadOptionalEnv(TEST_KEY)).toBe("world")
  })

  it("未設定のとき undefined を返す", () => {
    expect(loadOptionalEnv(TEST_KEY)).toBeUndefined()
  })

  it("空文字のとき undefined を返す", () => {
    process.env[TEST_KEY] = ""
    expect(loadOptionalEnv(TEST_KEY)).toBeUndefined()
  })
})

describe("parseConcurrencyLimit", () => {
  it("undefined のとき 5 を返す (デフォルト値)", () => {
    expect(parseConcurrencyLimit(undefined)).toBe(5)
  })

  it("正の整数文字列のとき数値に変換して返す", () => {
    expect(parseConcurrencyLimit("3")).toBe(3)
    expect(parseConcurrencyLimit("10")).toBe(10)
  })

  it("0 のとき例外をスローする", () => {
    expect(() => parseConcurrencyLimit("0")).toThrow("CONCURRENCY_LIMIT")
  })

  it("負の整数のとき例外をスローする", () => {
    expect(() => parseConcurrencyLimit("-1")).toThrow("CONCURRENCY_LIMIT")
  })

  it("小数のとき例外をスローする", () => {
    expect(() => parseConcurrencyLimit("3.7")).toThrow("CONCURRENCY_LIMIT")
  })

  it("数値に変換できない文字列のとき例外をスローする", () => {
    expect(() => parseConcurrencyLimit("abc")).toThrow("CONCURRENCY_LIMIT")
  })
})
