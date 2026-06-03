import { main } from "./index.js"
import { logger } from "./utils/logger.js"

main().catch((err: unknown) => {
  logger.error({ event: "unhandled_error", message: String(err) })
  process.exit(1)
})
