import { readFileSync, readdirSync, statSync } from "node:fs"
import { join, resolve, sep } from "node:path"

import { load as parseYaml } from "js-yaml"
import { z } from "zod"

import type { Config, ConfigGroup } from "../types.js"
import { toAccessTokenEnvName, toBranchName, toProjectId, toProjectName } from "../types.js"

const BranchPairSchema = z
  .object({
    source: z.string().min(1, "source ブランチ名は空にできません").transform(toBranchName),
    target: z.string().min(1, "target ブランチ名は空にできません").transform(toBranchName),
  })
  .refine((p) => p.source !== p.target, {
    message: "source と target に同じブランチは指定できません",
  })

const RepositorySchema = z.object({
  projectId: z.number().int().transform(toProjectId),
  projectName: z.string().transform(toProjectName),
  branchPairs: z.array(BranchPairSchema),
})

/**
 * 設定ファイルのトップレベルの `accessTokenEnv`。
 *
 * 必須にしているのは、書き漏らした設定ファイルが黙ってより広い権限のトークンへ流れる形を
 * 残さないため。`ACCESS_TOKEN_` で始まる名前だけを許すのは、トークンの値そのものを
 * 設定ファイルに書けないようにするため。
 */
const AccessTokenEnvNameSchema = z
  .string({
    error:
      "accessTokenEnv は必須です。設定ファイルのトップレベルに、この設定ファイルのリポジトリを" +
      "操作するトークンが入っている環境変数名を書いてください（例: 'ACCESS_TOKEN_GROUP_A'）",
  })
  .regex(
    /^ACCESS_TOKEN_[A-Z0-9_]+$/,
    'accessTokenEnv は "ACCESS_TOKEN_" に続けて英大文字・数字・アンダースコアを ' +
      "1文字以上書いた環境変数名である必要があります",
  )
  .transform(toAccessTokenEnvName)

const ConfigGroupSchema = z.object({
  accessTokenEnv: AccessTokenEnvNameSchema,
  repositories: z.array(RepositorySchema),
})

function assertSafePath(inputPath: string): void {
  const cwd = process.cwd()
  const resolved = resolve(cwd, inputPath)
  if (resolved !== cwd && !resolved.startsWith(cwd + sep)) {
    throw new Error(`CONFIG_PATH にパストラバーサルは使用できません: "${inputPath}"`)
  }
}

/**
 * 設定ファイルまたはディレクトリを読み込む。
 * ディレクトリの場合は .yaml / .yml ファイルをアルファベット順に読み込む。
 *
 * 返り値はファイル 1 つ = 要素 1 つで、ファイル単位のまとまり（グループ）は潰さない。
 * グループごとに別のアクセストークンを使うため、どのファイル由来かを呼び出し側に残す。
 */
export function loadConfig(configPath?: string): Config {
  const path = configPath ?? "config"
  assertSafePath(path)
  return statSync(path).isDirectory() ? loadConfigDir(path) : [loadConfigFile(path)]
}

function loadConfigDir(dirPath: string): Config {
  return readdirSync(dirPath)
    .filter((f) => f.endsWith(".yaml") || f.endsWith(".yml"))
    .sort()
    .map((file) => loadConfigFile(join(dirPath, file)))
}

function loadConfigFile(filePath: string): ConfigGroup {
  const rawConfig = parseYaml(readFileSync(filePath, "utf-8"))
  const result = ConfigGroupSchema.safeParse(rawConfig)
  if (!result.success) {
    throw new Error(`${filePath} の形式が不正です: ${result.error.message}`)
  }
  return result.data
}
