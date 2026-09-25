/** Firestore 規則擋下時的錯誤；讀別人的文件會得到這個。 */
export function isPermissionDenied(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "permission-denied"
  );
}
