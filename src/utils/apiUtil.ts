import { auth } from "./firebaseUtil";

export interface ApiFetchOptions extends RequestInit {
  /**
   * 是否在請求中帶上 Firebase ID Token (作為 Bearer Token)
   * @default false
   */
  includeAuthToken?: boolean;
}

/**
 * 帶有 Firebase 認證支援的 fetch 封裝函式
 *
 * @param url - API endpoint URL
 * @param options - Fetch 選項，額外支援 includeAuthToken 參數
 * @returns Promise<Response>
 *
 * @example
 * // 不帶認證的 API 呼叫
 * const response = await apiFetch('/api/public-endpoint', {
 *   method: 'POST',
 *   body: JSON.stringify(data)
 * });
 *
 * @example
 * // 帶認證的 API 呼叫
 * const response = await apiFetch('/api/protected-endpoint', {
 *   method: 'GET',
 *   includeAuthToken: true
 * });
 */
export async function apiFetch(
  url: string,
  options: ApiFetchOptions = {},
): Promise<Response> {
  const { includeAuthToken = false, headers = {}, ...restOptions } = options;

  // 準備最終的 headers
  const finalHeaders = new Headers(headers);

  // 如果需要帶上認證 token
  if (includeAuthToken) {
    const currentUser = auth.currentUser;

    if (!currentUser) {
      throw new Error("使用者未登入，無法取得認證 token");
    }

    try {
      // 取得 Firebase ID Token
      const idToken = await currentUser.getIdToken();

      // 設定 Authorization header
      finalHeaders.set("Authorization", `Bearer ${idToken}`);
    } catch (error) {
      console.error("取得 Firebase ID Token 失敗:", error);
      throw new Error("認證失敗，請重新登入");
    }
  }

  // 執行 fetch
  return fetch(url, {
    ...restOptions,
    headers: finalHeaders,
  });
}
