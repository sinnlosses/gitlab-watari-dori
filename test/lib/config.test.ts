import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { join } from "node:path"

import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { loadConfig } from "../../src/lib/config.js"

let tmpDir: string

beforeEach(() => {
  tmpDir = mkdtempSync(join(process.cwd(), "test-tmp-"))
})

afterEach(() => {
  rmSync(tmpDir, { recursive: true })
})

function writeConfigFile(yaml: string, filename = "repos.yaml"): string {
  const filePath = join(tmpDir, filename)
  writeFileSync(filePath, yaml, "utf-8")
  return filePath
}

function writeConfigDir(files: Record<string, string>): string {
  const dirPath = join(tmpDir, "repositories")
  mkdirSync(dirPath)
  for (const [filename, yaml] of Object.entries(files)) {
    writeFileSync(join(dirPath, filename), yaml, "utf-8")
  }
  return dirPath
}

describe("loadConfig（パストラバーサル）", () => {
  it(".. を含む相対パスのとき例外をスローする", () => {
    expect(() => loadConfig("../../etc/passwd")).toThrow("CONFIG_PATH")
  })

  it(".. を含む絶対パスのとき例外をスローする", () => {
    expect(() => loadConfig("/tmp/../etc/passwd")).toThrow("CONFIG_PATH")
  })

  it("cwd() 外の絶対パスのとき例外をスローする", () => {
    expect(() => loadConfig("/etc/passwd")).toThrow("CONFIG_PATH")
  })
})

describe("loadConfig（ファイル）", () => {
  it("正常な YAML を camelCase の Config 型にパースする", () => {
    expect(
      loadConfig(
        writeConfigFile(`
repositories:
  - projectId: 1
    projectName: my-repo
    branchPairs:
      - source: develop
        target: main
      - source: develop
        target: staging
`),
      ),
    ).toEqual({
      repositories: [
        {
          projectId: 1,
          projectName: "my-repo",
          branchPairs: [
            { source: "develop", target: "main" },
            { source: "develop", target: "staging" },
          ],
        },
      ],
    })
  })

  it("複数リポジトリをすべてパースする", () => {
    const { repositories } = loadConfig(
      writeConfigFile(`
repositories:
  - projectId: 1
    projectName: repo-a
    branchPairs:
      - source: dev
        target: main
  - projectId: 2
    projectName: repo-b
    branchPairs:
      - source: dev
        target: main
`),
    )
    expect(repositories).toHaveLength(2)
    expect(repositories[0]?.projectId).toBe(1)
    expect(repositories[1]?.projectId).toBe(2)
  })

  it("repositories が空配列のとき正常にパースする", () => {
    expect(loadConfig(writeConfigFile("repositories: []"))).toEqual({ repositories: [] })
  })

  it("YAML がオブジェクトでないとき例外をスローする", () => {
    expect(() => loadConfig(writeConfigFile("just a string"))).toThrow("形式が不正です")
  })

  it("repositories キーがないとき例外をスローする", () => {
    expect(() => loadConfig(writeConfigFile("other_key: []"))).toThrow("形式が不正です")
  })

  it("projectId が数値でないとき例外をスローする", () => {
    expect(() =>
      loadConfig(
        writeConfigFile(`
repositories:
  - projectId: "not-a-number"
    projectName: repo
    branchPairs: []
`),
      ),
    ).toThrow("形式が不正です")
  })

  it("branchPairs のエントリに source がないとき例外をスローする", () => {
    expect(() =>
      loadConfig(
        writeConfigFile(`
repositories:
  - projectId: 1
    projectName: repo
    branchPairs:
      - target: main
`),
      ),
    ).toThrow("形式が不正です")
  })

  it("branchPairs の source が空文字のとき例外をスローする", () => {
    expect(() =>
      loadConfig(
        writeConfigFile(`
repositories:
  - projectId: 1
    projectName: repo
    branchPairs:
      - source: ""
        target: main
`),
      ),
    ).toThrow("形式が不正です")
  })

  it("source と target が同じブランチ名のとき例外をスローする", () => {
    expect(() =>
      loadConfig(
        writeConfigFile(`
repositories:
  - projectId: 1
    projectName: repo
    branchPairs:
      - source: main
        target: main
`),
      ),
    ).toThrow("形式が不正です")
  })

  it("branchPairs のエントリに target がないとき例外をスローする", () => {
    expect(() =>
      loadConfig(
        writeConfigFile(`
repositories:
  - projectId: 1
    projectName: repo
    branchPairs:
      - source: develop
`),
      ),
    ).toThrow("形式が不正です")
  })

  it("ファイルが存在しないとき例外をスローする", () => {
    expect(() => loadConfig(join(tmpDir, "nonexistent.yaml"))).toThrow()
    expect(() => loadConfig(join(tmpDir, "nonexistent.yaml"))).not.toThrow("CONFIG_PATH")
  })
})

describe("loadConfig（ディレクトリ）", () => {
  it("ディレクトリ内の複数ファイルを結合して返す", () => {
    const dirPath = writeConfigDir({
      "team-a.yaml": `
repositories:
  - projectId: 1
    projectName: service-a
    branchPairs:
      - source: develop
        target: main
`,
      "team-b.yaml": `
repositories:
  - projectId: 2
    projectName: service-b
    branchPairs:
      - source: develop
        target: main
`,
    })
    const { repositories } = loadConfig(dirPath)
    expect(repositories).toHaveLength(2)
    expect(repositories[0]?.projectId).toBe(1)
    expect(repositories[1]?.projectId).toBe(2)
  })

  it("ファイルをアルファベット順に読み込む", () => {
    const dirPath = writeConfigDir({
      "team-b.yaml": `
repositories:
  - projectId: 2
    projectName: service-b
    branchPairs: []
`,
      "team-a.yaml": `
repositories:
  - projectId: 1
    projectName: service-a
    branchPairs: []
`,
    })
    const { repositories } = loadConfig(dirPath)
    expect(repositories[0]?.projectId).toBe(1)
    expect(repositories[1]?.projectId).toBe(2)
  })

  it("空のディレクトリのとき空の repositories を返す", () => {
    const dirPath = writeConfigDir({})
    expect(loadConfig(dirPath)).toEqual({ repositories: [] })
  })

  it(".yaml / .yml 以外のファイルは無視する", () => {
    const dirPath = writeConfigDir({
      "team-a.yaml": `
repositories:
  - projectId: 1
    projectName: service-a
    branchPairs: []
`,
      "README.md": "# readme",
      ".gitkeep": "",
    })
    const { repositories } = loadConfig(dirPath)
    expect(repositories).toHaveLength(1)
  })

  it("ディレクトリ内のファイルに不正な YAML があるとき例外をスローする", () => {
    const dirPath = writeConfigDir({
      "team-a.yaml": "just a string",
    })
    expect(() => loadConfig(dirPath)).toThrow("形式が不正です")
  })
})
