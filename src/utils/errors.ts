export class FatalError extends Error {
  constructor(
    public readonly httpStatus: number | undefined,
    cause: unknown,
  ) {
    super(cause instanceof Error ? cause.message : String(cause), { cause })
    this.name = "FatalError"
  }
}
