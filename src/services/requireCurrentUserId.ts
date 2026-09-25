import { auth } from "../utils/firebaseUtil";

/** 所有題庫 service 呼叫前都先檢查登入（spec §13）。 */
export function requireCurrentUserId(): string {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("尚未登入");
  return uid;
}
