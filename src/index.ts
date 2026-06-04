import { main } from "./main.js"
import { FatalError } from "./utils/errors.js"
import { logger } from "./utils/logger.js"

main().catch((err: unknown) => {
  if (err instanceof FatalError) {
    logger.error({ event: "fatal_error", httpStatus: err.httpStatus, message: err.message })
  } else {
    logger.error({ event: "unhandled_error", message: String(err) })
  }
  process.exit(1)
})
