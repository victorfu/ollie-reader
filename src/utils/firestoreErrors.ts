// Firestore reports an exhausted project quota (for example the free plan's
// daily reads) as `resource-exhausted` with only "Quota exceeded." as text.
export const FIRESTORE_QUOTA_MESSAGE = "雲端資料庫用量已達上限，請稍後再試";

const isFirestoreQuotaError = (error: unknown): boolean =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  error.code === "resource-exhausted";

/** A message for the user: quota errors in Chinese, anything else as thrown. */
export const getFirestoreErrorMessage = (
  error: unknown,
  fallback: string,
): string => {
  if (isFirestoreQuotaError(error)) return FIRESTORE_QUOTA_MESSAGE;
  return error instanceof Error ? error.message : fallback;
};
