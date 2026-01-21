/**
 * Check if an error is an AbortError (from AbortController)
 */
export function isAbortError(err: unknown): boolean {
  return err instanceof Error && err.name === "AbortError";
}
