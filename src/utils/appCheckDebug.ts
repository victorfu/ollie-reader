export type AppCheckDebugToken = string | true;

/**
 * Firebase App Check uses the boolean `true` to generate a fresh debug token.
 * A string, including the string `"true"`, is instead treated as a literal
 * token that must already be registered in Firebase Console.
 */
export function resolveAppCheckDebugToken(
  configuredToken?: string,
): AppCheckDebugToken {
  const normalizedToken = configuredToken?.trim();
  return normalizedToken || true;
}
