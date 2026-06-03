export const makeHttpError = (status: number): Error =>
  new Error("HTTP Error", { cause: { response: { status } } })
