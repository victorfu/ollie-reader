export async function choosePdfSessionId(
  existingSessionId: string | null,
  isClaimedByAnotherTab: (
    sessionId: string,
  ) => Promise<boolean | null>,
  createSessionId: () => string,
): Promise<string> {
  if (
    existingSessionId &&
    (await isClaimedByAnotherTab(existingSessionId)) === false
  ) {
    return existingSessionId;
  }

  return createSessionId();
}

export async function claimPdfSessionId(
  existingSessionId: string | null,
  tryClaim: (sessionId: string) => Promise<boolean>,
  createSessionId: () => string,
): Promise<string> {
  let candidate = existingSessionId ?? createSessionId();

  // A generated id colliding with another live tab is extraordinarily
  // unlikely, but retrying keeps ownership exclusive even with a deterministic
  // id generator in tests or a compromised sessionStorage value.
  for (let attempt = 0; attempt < 5; attempt += 1) {
    if (await tryClaim(candidate)) return candidate;
    candidate = createSessionId();
  }

  throw new Error("Unable to claim an isolated PDF tab session");
}
