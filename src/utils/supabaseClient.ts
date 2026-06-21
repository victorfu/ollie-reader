import { createClient } from "@supabase/supabase-js";
import { auth } from "./firebaseUtil";

/** 私有 bucket 名稱（與雲端一致，勿更動）。 */
export const STORAGE_BUCKET = "ollie-reader";

/**
 * Storage 直連用的 Supabase client。
 *
 * 身分走 Firebase Third-Party Auth：每次請求由 accessToken 動態帶上目前
 * 使用者的 Firebase ID token，Supabase 以 Firebase JWKS 驗證後，RLS 依
 * token 的 sub（= Firebase uid）控管存取。未登入時回 null（RLS 會擋下）。
 *
 * 設了 accessToken 後 client 進入第三方 auth 模式：不管理 Supabase session、
 * 不使用 Supabase Auth 方法（故無需 auth: {...} 設定）。僅用於 storage。
 */
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  {
    accessToken: async () => (await auth.currentUser?.getIdToken()) ?? null,
  },
);
