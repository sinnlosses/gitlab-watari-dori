import { afterEach, beforeEach, describe, expect, it } from "vitest"

import {
  assertAccessTokensPresent,
  loadAccessToken,
  loadEnv,
  loadOptionalEnv,
  parseConcurrencyLimit,
  validateGitlabUrl,
} from "../../src/lib/env.js"
import type { AccessTokenEnvName } from "../../src/types.js"
import { toAccessTokenEnvName } from "../../src/types.js"

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

  it("スペースのみのとき undefined を返す", () => {
    process.env[TEST_KEY] = "   "
    expect(loadOptionalEnv(TEST_KEY)).toBeUndefined()
  })
})

describe("validateGitlabUrl", () => {
  it("https:// の URL を受け入れる", () => {
    expect(validateGitlabUrl("https://gitlab.example.com")).toBe("https://gitlab.example.com")
  })

  it("http:// の URL を受け入れる", () => {
    expect(validateGitlabUrl("http://gitlab.internal")).toBe("http://gitlab.internal")
  })

  it("有効でない URL のとき例外をスローする", () => {
    expect(() => validateGitlabUrl("not-a-url")).toThrow("GITLAB_URL")
  })

  it("file:// スキームのとき例外をスローする", () => {
    expect(() => validateGitlabUrl("file:///etc/passwd")).toThrow("GITLAB_URL")
  })

  it("ftp:// スキームのとき例外をスローする", () => {
    expect(() => validateGitlabUrl("ftp://gitlab.example.com")).toThrow("GITLAB_URL")
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

  it("20 のとき正常に変換する", () => {
    expect(parseConcurrencyLimit("20")).toBe(20)
  })

  it("21 のとき例外をスローする", () => {
    expect(() => parseConcurrencyLimit("21")).toThrow("CONCURRENCY_LIMIT")
  })
})

describe("loadAccessToken", () => {
  const envName = toAccessTokenEnvName("ACCESS_TOKEN_WATARI_DORI_TEST")

  afterEach(() => {
    delete process.env[envName]
  })

  it("設定済みの環境変数からトークンの値を返す", () => {
    process.env[envName] = "glpat-test"
    expect(loadAccessToken(envName)).toBe("glpat-test")
  })

  it("未設定のとき環境変数名を含む例外をスローする", () => {
    expect(() => loadAccessToken(envName)).toThrow(envName)
  })
})

/** `assertAccessTokensPresent` がスローした例外のメッセージを取り出す。 */
function missingMessage(envNames: readonly AccessTokenEnvName[]): string {
  try {
    assertAccessTokensPresent(envNames)
    return ""
  } catch (err) {
    return err instanceof Error ? err.message : String(err)
  }
}

describe("assertAccessTokensPresent", () => {
  const first = toAccessTokenEnvName("ACCESS_TOKEN_WATARI_DORI_A")
  const second = toAccessTokenEnvName("ACCESS_TOKEN_WATARI_DORI_B")

  afterEach(() => {
    delete process.env[first]
    delete process.env[second]
  })

  it("空配列のとき例外をスローしない", () => {
    expect(() => assertAccessTokensPresent([])).not.toThrow()
  })

  it("すべて設定済みのとき例外をスローしない", () => {
    process.env[first] = "token-a"
    process.env[second] = "token-b"
    expect(() => assertAccessTokensPresent([first, second])).not.toThrow()
  })

  it("未設定の環境変数があるときその名前を含む例外をスローする", () => {
    process.env[first] = "token-a"
    expect(() => assertAccessTokensPresent([first, second])).toThrow(second)
  })

  it("未設定の環境変数が複数あるときすべての名前を1つの例外にまとめる", () => {
    expect(missingMessage([first, second])).toContain(first)
    expect(missingMessage([first, second])).toContain(second)
  })

  it("空文字の環境変数を未設定として扱う", () => {
    process.env[first] = ""
    expect(() => assertAccessTokensPresent([first])).toThrow(first)
  })

  it("同じ環境変数名が重複してもエラーメッセージに1回だけ載せる", () => {
    expect(missingMessage([first, first]).match(new RegExp(first, "g"))).toHaveLength(1)
  })
})
