import { loadConfig } from "../src/lib/config.js"

const configPath = process.argv[2] ?? "config"

try {
  const { repositories } = loadConfig(configPath)
  const branchPairCount = repositories.reduce((sum, r) => sum + r.branchPairs.length, 0)
  console.log(
    `config OK: ${repositories.length} repositories, ${branchPairCount} branch pairs (${configPath})`,
  )
} catch (err) {
  console.error(`config ERROR: ${err instanceof Error ? err.message : String(err)}`)
  process.exit(1)
}
