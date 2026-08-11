const MAX_REVERSIBLE_ID_BYTES = 700;

const toHex = (bytes: Uint8Array): string =>
  Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");

export const normalizeUniqueText = (value: string): string =>
  value.trim().replace(/\s+/g, " ").toLocaleLowerCase("en-US");

/**
 * Build a deterministic Firestore document id for user-owned text. The common
 * path is reversible and collision-free; unusually long text uses SHA-256 to
 * stay below Firestore's document-id limit.
 */
export const createOwnedTextDocumentId = async (
  namespace: string,
  userId: string,
  value: string,
): Promise<string> => {
  const bytes = new TextEncoder().encode(
    `${namespace}\u0000${userId}\u0000${normalizeUniqueText(value)}`,
  );

  if (bytes.length <= MAX_REVERSIBLE_ID_BYTES) {
    return `v1_${toHex(bytes)}`;
  }

  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return `v1h_${toHex(new Uint8Array(digest))}`;
};
