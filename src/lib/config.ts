import { readFileSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"

import { load as parseYaml } from "js-yaml"
import { z } from "zod"

import type { Config } from "../types.js"
import { toBranchName, toProjectId, toProjectName } from "../types.js"

const BranchPairSchema = z
  .object({
    source: z.string().min(1, "source ブランチ名は空にできません").transform(toBranchName),
    target: z.string().min(1, "target ブランチ名は空にできません").transform(toBranchName),
  })
  .refine((p) => p.source !== p.target, {
    message: "source と target に同じブランチは指定できません",
  })

// YAML は慣習的に snake_case のため、transform で camelCase へ変換する。
const RepositorySchema = z
  .object({
    project_id: z.number().int().transform(toProjectId),
    project_name: z.string().transform(toProjectName),
    branch_pairs: z.array(BranchPairSchema),
  })
  .transform((raw) => ({
    projectId: raw.project_id,
    projectName: raw.project_name,
    branchPairs: raw.branch_pairs,
  }))

const ConfigSchema = z.object({
  repositories: z.array(RepositorySchema),
})

function assertSafePath(inputPath: string): void {
  if (inputPath.split(/[/\\]/).includes("..")) {
    throw new Error(`CONFIG_PATH にパストラバーサルは使用できません: "${inputPath}"`)
  }
}

/**
 * 設定ファイルまたはディレクトリを読み込む。
 * ディレクトリの場合は .yaml / .yml ファイルをアルファベット順に読み込んで結合する。
 */
export function loadConfig(configPath?: string): Config {
  const path = configPath ?? "config"
  assertSafePath(path)
  return statSync(path).isDirectory() ? loadConfigDir(path) : loadConfigFile(path)
}

function loadConfigDir(dirPath: string): Config {
  const repositories = readdirSync(dirPath)
    .filter((f) => f.endsWith(".yaml") || f.endsWith(".yml"))
    .sort()
    .flatMap((file) => loadConfigFile(join(dirPath, file)).repositories)
  return { repositories }
}

function loadConfigFile(filePath: string): Config {
  const rawConfig = parseYaml(readFileSync(filePath, "utf-8"))
  const result = ConfigSchema.safeParse(rawConfig)
  if (!result.success) {
    throw new Error(`${filePath} の形式が不正です: ${result.error.message}`)
  }
  return result.data
}
