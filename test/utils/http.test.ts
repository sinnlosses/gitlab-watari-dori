import { describe, expect, it } from "vitest"

import {
  extractHttpStatus,
  isFatalError,
  isFatalStatus,
  isNotFoundError,
  toErrorMessage,
} from "../../src/utils/http.js"
import { makeHttpError } from "../helpers.js"

describe("extractHttpStatus", () => {
  it("Error でない値は undefined を返す", () => {
    expect(extractHttpStatus("string")).toBeUndefined()
    expect(extractHttpStatus(null)).toBeUndefined()
    expect(extractHttpStatus(42)).toBeUndefined()
  })

  it("cause を持たない Error は undefined を返す", () => {
    expect(extractHttpStatus(new Error("oops"))).toBeUndefined()
  })

  it("cause に response がない場合は undefined を返す", () => {
    expect(extractHttpStatus(new Error("oops", { cause: {} }))).toBeUndefined()
  })

  it("cause.response に status がない場合は undefined を返す", () => {
    expect(extractHttpStatus(new Error("oops", { cause: { response: {} } }))).toBeUndefined()
  })

  it("cause.response が null のとき undefined を返す", () => {
    expect(extractHttpStatus(new Error("oops", { cause: { response: null } }))).toBeUndefined()
  })

  it("cause.response.status が数値でないとき undefined を返す", () => {
    expect(
      extractHttpStatus(new Error("oops", { cause: { response: { status: "200" } } })),
    ).toBeUndefined()
  })

  it("cause.response.status から HTTP ステータスコードを返す", () => {
    expect(extractHttpStatus(makeHttpError(404))).toBe(404)
    expect(extractHttpStatus(makeHttpError(401))).toBe(401)
    expect(extractHttpStatus(makeHttpError(500))).toBe(500)
  })
})

describe("isNotFoundError", () => {
  it("404 エラーのとき true を返す", () => {
    expect(isNotFoundError(makeHttpError(404))).toBe(true)
  })

  it("404 以外の HTTP エラーのとき false を返す", () => {
    expect(isNotFoundError(makeHttpError(401))).toBe(false)
    expect(isNotFoundError(makeHttpError(500))).toBe(false)
  })

  it("Error でない値のとき false を返す", () => {
    expect(isNotFoundError("Not Found")).toBe(false)
    expect(isNotFoundError(null)).toBe(false)
  })
})

describe("isFatalStatus", () => {
  it("undefined のとき false を返す", () => {
    expect(isFatalStatus(undefined)).toBe(false)
  })

  it("401 のとき true を返す", () => {
    expect(isFatalStatus(401)).toBe(true)
  })

  it("403 のとき false を返す (プロジェクト固有のアクセス権限エラーの可能性があるため)", () => {
    expect(isFatalStatus(403)).toBe(false)
  })

  it("5xx 系のとき true を返す", () => {
    expect(isFatalStatus(500)).toBe(true)
    expect(isFatalStatus(502)).toBe(true)
    expect(isFatalStatus(503)).toBe(true)
  })

  it("200 のとき false を返す", () => {
    expect(isFatalStatus(200)).toBe(false)
  })

  it("404 のとき false を返す", () => {
    expect(isFatalStatus(404)).toBe(false)
  })

  it("402 (fatal リストにない) のとき false を返す", () => {
    expect(isFatalStatus(402)).toBe(false)
  })
})

describe("isFatalError", () => {
  it("HTTP 401 エラーのとき true を返す", () => {
    expect(isFatalError(makeHttpError(401))).toBe(true)
  })

  it("HTTP 500 エラーのとき true を返す", () => {
    expect(isFatalError(makeHttpError(500))).toBe(true)
  })

  it("HTTP 403 エラーのとき false を返す", () => {
    expect(isFatalError(makeHttpError(403))).toBe(false)
  })

  it("HTTP 404 エラーのとき false を返す", () => {
    expect(isFatalError(makeHttpError(404))).toBe(false)
  })

  it("ECONNREFUSED のとき true を返す", () => {
    const err = Object.assign(new Error("connect ECONNREFUSED"), { code: "ECONNREFUSED" })
    expect(isFatalError(err)).toBe(true)
  })

  it("ENOTFOUND のとき true を返す", () => {
    const err = Object.assign(new Error("getaddrinfo ENOTFOUND"), { code: "ENOTFOUND" })
    expect(isFatalError(err)).toBe(true)
  })

  it("ETIMEDOUT のとき true を返す", () => {
    const err = Object.assign(new Error("connect ETIMEDOUT"), { code: "ETIMEDOUT" })
    expect(isFatalError(err)).toBe(true)
  })

  it("HTTP ステータスも code もない通常の Error のとき false を返す", () => {
    expect(isFatalError(new Error("generic error"))).toBe(false)
  })

  it("Error でない値のとき false を返す", () => {
    expect(isFatalError("string error")).toBe(false)
    expect(isFatalError(null)).toBe(false)
  })
})

describe("toErrorMessage", () => {
  it("Error インスタンスのとき message を返す", () => {
    expect(toErrorMessage(new Error("something went wrong"))).toBe("something went wrong")
  })

  it("Error でない値のとき String() に変換して返す", () => {
    expect(toErrorMessage("raw string")).toBe("raw string")
    expect(toErrorMessage(42)).toBe("42")
    expect(toErrorMessage(null)).toBe("null")
  })
})
