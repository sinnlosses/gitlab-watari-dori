import { run } from "./main.js"
import { logger } from "./utils/logger.js"

run().catch((err: unknown) => {
  logger.error({ event: "unhandled_error", message: String(err) })
  process.exit(1)
})
