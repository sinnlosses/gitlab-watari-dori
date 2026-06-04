import { run } from "./main.js"
import { FatalError } from "./utils/errors.js"
import { logger } from "./utils/logger.js"

run()
  .then((result) => {
    if (result === "SUCCESS") process.exit(0)
    else process.exit(1)
  })
  .catch((err: unknown) => {
    if (err instanceof FatalError) {
      logger.error({ event: "fatal_error", httpStatus: err.httpStatus, message: err.message })
    } else {
      logger.error({ event: "unhandled_error", message: String(err) })
    }
    process.exit(1)
  })
