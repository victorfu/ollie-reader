import type { DecodedIdToken } from "firebase-admin/auth";
import { ApiError } from "./api";

// Read the user's own allow-list entry under the same Firestore rules as the web
// app. Using their ID token avoids requiring Admin credentials on the server.
export async function verifyTranslationAccess(request: Request, identity: DecodedIdToken): Promise<void> {
  if (!identity.email_verified || !identity.email || identity.email.includes("/")) {
    throw new ApiError("此帳號沒有使用翻譯服務的權限", 403);
  }
  const project = encodeURIComponent(identity.aud);
  const email = encodeURIComponent(identity.email);
  const headers = new Headers({ Authorization: request.headers.get("authorization")! });
  const appCheck = request.headers.get("X-Firebase-AppCheck");
  if (appCheck) headers.set("X-Firebase-AppCheck", appCheck);
  const response = await fetch(
    `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents/allowedUsers/${email}`,
    { headers, cache: "no-store", signal: AbortSignal.any([request.signal, AbortSignal.timeout(10_000)]) },
  );
  await response.body?.cancel();
  if ([401, 403, 404].includes(response.status)) throw new ApiError("此帳號沒有使用翻譯服務的權限", 403);
  if (!response.ok) throw new ApiError("無法確認翻譯服務權限，請稍後再試", 503);
}
