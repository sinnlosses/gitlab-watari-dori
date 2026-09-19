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
accessTokenEnv: ACCESS_TOKEN_TEAM_A
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
    ).toEqual([
      {
        accessTokenEnv: "ACCESS_TOKEN_TEAM_A",
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
      },
    ])
  })

  it("複数リポジトリをすべてパースする", () => {
    const [group] = loadConfig(
      writeConfigFile(`
accessTokenEnv: ACCESS_TOKEN_TEAM_A
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
    expect(group?.repositories).toHaveLength(2)
    expect(group?.repositories[0]?.projectId).toBe(1)
    expect(group?.repositories[1]?.projectId).toBe(2)
  })

  it("repositories が空配列のとき正常にパースする", () => {
    expect(
      loadConfig(
        writeConfigFile(`
accessTokenEnv: ACCESS_TOKEN_TEAM_A
repositories: []
`),
      ),
    ).toEqual([{ accessTokenEnv: "ACCESS_TOKEN_TEAM_A", repositories: [] }])
  })

  it("YAML がオブジェクトでないとき例外をスローする", () => {
    expect(() => loadConfig(writeConfigFile("just a string"))).toThrow("形式が不正です")
  })

  it("repositories キーがないとき例外をスローする", () => {
    expect(() =>
      loadConfig(writeConfigFile("accessTokenEnv: ACCESS_TOKEN_TEAM_A\nother_key: []")),
    ).toThrow("形式が不正です")
  })

  it("projectId が数値でないとき例外をスローする", () => {
    expect(() =>
      loadConfig(
        writeConfigFile(`
accessTokenEnv: ACCESS_TOKEN_TEAM_A
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
accessTokenEnv: ACCESS_TOKEN_TEAM_A
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
accessTokenEnv: ACCESS_TOKEN_TEAM_A
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
accessTokenEnv: ACCESS_TOKEN_TEAM_A
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
accessTokenEnv: ACCESS_TOKEN_TEAM_A
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

describe("loadConfig（accessTokenEnv）", () => {
  function writeWithAccessTokenEnv(line: string): string {
    return writeConfigFile(`
${line}
repositories: []
`)
  }

  it("accessTokenEnv を環境変数名としてそのまま保持する", () => {
    const [group] = loadConfig(writeWithAccessTokenEnv("accessTokenEnv: ACCESS_TOKEN_TEAM_A"))
    expect(group?.accessTokenEnv).toBe("ACCESS_TOKEN_TEAM_A")
  })

  it("accessTokenEnv がないとき例外をスローする", () => {
    expect(() => loadConfig(writeConfigFile("repositories: []"))).toThrow("形式が不正です")
  })

  it("accessTokenEnv が ACCESS_TOKEN_ で始まらないとき例外をスローする", () => {
    expect(() => loadConfig(writeWithAccessTokenEnv("accessTokenEnv: MY_TOKEN"))).toThrow(
      "形式が不正です",
    )
  })

  it("accessTokenEnv が ACCESS_TOKEN_ だけで接尾辞がないとき例外をスローする", () => {
    expect(() => loadConfig(writeWithAccessTokenEnv("accessTokenEnv: ACCESS_TOKEN_"))).toThrow(
      "形式が不正です",
    )
  })

  it("accessTokenEnv に小文字が含まれるとき例外をスローする", () => {
    expect(() =>
      loadConfig(writeWithAccessTokenEnv("accessTokenEnv: ACCESS_TOKEN_team_a")),
    ).toThrow("形式が不正です")
  })

  it("accessTokenEnv が文字列でないとき例外をスローする", () => {
    expect(() => loadConfig(writeWithAccessTokenEnv("accessTokenEnv: 123"))).toThrow(
      "形式が不正です",
    )
  })
})

describe("loadConfig（ディレクトリ）", () => {
  it("ディレクトリ内のファイルをファイル単位のまとまりのまま返す", () => {
    const dirPath = writeConfigDir({
      "team-a.yaml": `
accessTokenEnv: ACCESS_TOKEN_TEAM_A
repositories:
  - projectId: 1
    projectName: service-a
    branchPairs:
      - source: develop
        target: main
`,
      "team-b.yaml": `
accessTokenEnv: ACCESS_TOKEN_TEAM_B
repositories:
  - projectId: 2
    projectName: service-b
    branchPairs:
      - source: develop
        target: main
`,
    })
    const groups = loadConfig(dirPath)
    expect(groups).toHaveLength(2)
    expect(groups[0]?.accessTokenEnv).toBe("ACCESS_TOKEN_TEAM_A")
    expect(groups[0]?.repositories[0]?.projectId).toBe(1)
    expect(groups[1]?.accessTokenEnv).toBe("ACCESS_TOKEN_TEAM_B")
    expect(groups[1]?.repositories[0]?.projectId).toBe(2)
  })

  it("ファイルをアルファベット順に読み込む", () => {
    const dirPath = writeConfigDir({
      "team-b.yaml": `
accessTokenEnv: ACCESS_TOKEN_TEAM_B
repositories:
  - projectId: 2
    projectName: service-b
    branchPairs: []
`,
      "team-a.yaml": `
accessTokenEnv: ACCESS_TOKEN_TEAM_A
repositories:
  - projectId: 1
    projectName: service-a
    branchPairs: []
`,
    })
    const groups = loadConfig(dirPath)
    expect(groups[0]?.accessTokenEnv).toBe("ACCESS_TOKEN_TEAM_A")
    expect(groups[1]?.accessTokenEnv).toBe("ACCESS_TOKEN_TEAM_B")
  })

  it("空のディレクトリのとき空配列を返す", () => {
    expect(loadConfig(writeConfigDir({}))).toEqual([])
  })

  it(".yaml / .yml 以外のファイルは無視する", () => {
    const dirPath = writeConfigDir({
      "team-a.yaml": `
accessTokenEnv: ACCESS_TOKEN_TEAM_A
repositories:
  - projectId: 1
    projectName: service-a
    branchPairs: []
`,
      "README.md": "# readme",
      ".gitkeep": "",
    })
    expect(loadConfig(dirPath)).toHaveLength(1)
  })

  it("ディレクトリ内のファイルに不正な YAML があるとき例外をスローする", () => {
    const dirPath = writeConfigDir({
      "team-a.yaml": "just a string",
    })
    expect(() => loadConfig(dirPath)).toThrow("形式が不正です")
  })

  it("ディレクトリ内のファイルに accessTokenEnv がないとき例外をスローする", () => {
    const dirPath = writeConfigDir({
      "team-a.yaml": `
repositories:
  - projectId: 1
    projectName: service-a
    branchPairs: []
`,
    })
    expect(() => loadConfig(dirPath)).toThrow("形式が不正です")
  })
})
