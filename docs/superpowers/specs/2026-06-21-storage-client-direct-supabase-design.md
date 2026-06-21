# Storage 前端直連 Supabase(Firebase TPA + RLS)設計

> 狀態:草案,待 review
> 日期:2026-06-21
> 程式碼位置:**`ollie-reader` repo** —— web 前端(`src/`)。雲端 `purism-ev-bot` 的 `/storage/*` 在前端切換完成、驗證後**移除**(獨立收尾)。
> 範圍:把「口說練習」與「音檔上傳」兩頁用到的 storage 操作(upload / signed-url / delete)從「經雲端 `/storage/*` 代理」改為「前端用 Supabase JS SDK **直連** Supabase Storage」,身分用既有 Firebase Auth 透過 Supabase **Third-Party Auth (TPA)** 橋接,存取由 **RLS** 控管。desktop 因跑同一份前端而**自動受惠**,無需 sidecar 程式碼。

---

## 1. 背景與目標

目前 storage 走雲端代理:前端 `apiFetch(STORAGE_*)` →(帶 Firebase Bearer)→ `purism-ev-bot` 驗 Firebase token → 用 **Supabase secret key**(service_role,權限極高)代操作私有 bucket `ollie-reader`。

問題:
- 多一個雲端 hop。
- secret key 是高權限憑證,且這條代理是唯一原因讓 storage 無法在 desktop sidecar 直接做(把 secret key 下放桌面不可接受)。

**目標**:前端直連 Supabase Storage,移除這條代理。身分沿用 Firebase Auth —— Supabase TPA 已對本專案 **enabled**(Firebase Project ID `ollie-reader`),Supabase 直接信任 Firebase 簽出的 ID token,RLS 用 token 的 `sub`(= Firebase uid)做 per-user 資料夾隔離。

**結果**:
- 少一個 hop;secret key 從前端/桌面路徑徹底消失(雲端那條代理移除後 secret key 不再被任何使用者路徑需要)。
- desktop 跑同一份前端 → storage 直連**自動可用**,sidecar **零** storage 程式碼。
- 既有檔案 path/bucket 不變 → **不需資料搬移**。

**已驗證(機制面)**:Supabase 官方說明,第三方 JWT 不含 `role` claim 時請求以 **`anon`** role 執行,但 `auth.jwt() ->> 'sub'` 在 RLS 內**照樣可讀**。本設計即採此「路 2」:不在 Firebase 端打 `role: authenticated` claim,改由 RLS 直接比對 `auth.jwt()->>'sub'`。
**待驗證(實打面)**:storage 在 `anon` role 下會不會真的放行 —— 列為實作 **Task 1** 的 gating 測試;不通則退「路 1」(Firebase 端補 `role: authenticated` claim + backfill + Cloud Function)。

---

## 2. 鎖定的決策

| 主題 | 決策 | 理由 |
|---|---|---|
| 連線方式 | 前端 **Supabase JS SDK 直連**,不經 `purism-ev-bot` | 去掉 hop + secret key;desktop 自動受惠 |
| 身分橋接 | **Firebase TPA**(已 enabled),前端用 `accessToken` callback 回傳 Firebase ID token | 「登入 Firebase ≈ 登入 Supabase」;不建 Supabase 帳號、不搬使用者 |
| 前端 Supabase 憑證 | **publishable / anon key**(可公開) | 設計上即可進前端;secret key 不下放 |
| 授權 | **RLS**:`storage.objects` per-uid 資料夾隔離(路 2,`TO public` + 比對 `auth.jwt()->>'sub'`) | 不依賴 `role` claim → 免動 Firebase |
| bucket | 維持私有 `ollie-reader`;不變更路徑結構 | 既有檔案沿用,免搬移 |
| 簽 URL | 前端 `createSignedUrl`(短效) | 播放沿用 signed URL;`<audio>` 直接吃 |
| 合約對前端上層 | 兩個 service 的 **export 函式簽名不變** | hook/頁面/Firestore metadata **完全不動** |
| 雲端 `/storage/*` | 前端切換、驗證 OK 後**移除**(含 `supabase_storage.py`、secret key) | 收尾,減少攻擊面;非阻塞前端 |
| desktop | **不新增程式碼** | 同一份前端直連 |

---

## 3. 元件與邊界

### 3.1 `src/utils/supabaseClient.ts`(新增)
單例 Supabase client,storage 直連用。

```ts
import { createClient } from "@supabase/supabase-js";
import { auth } from "./firebaseUtil";

export const STORAGE_BUCKET = "ollie-reader";

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  {
    // TPA:每次請求動態帶 Firebase ID token;Supabase 用 Firebase JWKS 驗證
    accessToken: async () => (await auth.currentUser?.getIdToken()) ?? null,
  },
);
```
- 使用 `accessToken` option(supabase-js v2.40+)→ 該 client 進入第三方 auth 模式,**完全不**管理 Supabase session、**不**使用 Supabase Auth 方法,僅 storage,符合需求(故不需 `auth: {...}` 設定)。
- 未登入時 `accessToken` 回 `null` → 請求以 anon 身分送出 → RLS 擋下(`auth.jwt()` 為 null)。

### 3.2 `@supabase/supabase-js` 依賴(新增)
`npm i @supabase/supabase-js`(取 v2 最新,需 ≥ 2.40 以支援 `accessToken`)。寫入 `package.json` + `package-lock.json`。

### 3.3 環境變數
- `src/vite-env.d.ts`:加 `readonly VITE_SUPABASE_URL: string;` 與 `readonly VITE_SUPABASE_PUBLISHABLE_KEY: string;`。
- `.env.example`(若有)補兩個 key 的說明。
- `VITE_SUPABASE_URL` = `https://<ref>.supabase.co`;`VITE_SUPABASE_PUBLISHABLE_KEY` = 公開 key。

### 3.4 `src/services/audioStorageService.ts`(改寫)
口說練習(`speech-practice/{userId}/{recordId}.webm`)。**保留三個 export 簽名**,內部改用 SDK:
- `uploadPracticeAudio(userId, recordId, audioBlob): Promise<string>`
  → `supabase.storage.from(STORAGE_BUCKET).upload(path, audioBlob, { contentType: "audio/webm", upsert: true })`;`error` → throw;成功回 `path`。保留 10MB 檢查。
- `getAudioSignedUrl(path, expirationMinutes=60): Promise<string>`
  → `createSignedUrl(path, expirationMinutes * 60)`(**分鐘→秒**);回 `data.signedUrl`。
- `deletePracticeAudio(userId, recordId): Promise<void>`
  → `remove([path])`;檔案不存在時 SDK 不報錯(`data` 空)→ 維持「找不到就略過」語意。
- 移除 `apiFetch` / `STORAGE_*` import。

### 3.5 `src/services/audioUploadService.ts`(改寫)
音檔上傳(`audio-uploads/{userId}/{uploadId}.{ext}`)。**只改三個 storage 函式**,Firestore metadata 函式(`addAudioUpload`/`getUserAudioUploads`/`updateAudioUpload`/`deleteAudioUpload`)**不動**:
- `uploadAudioFile(userId, uploadId, audioFile, mimeType): Promise<string>`
  → `upload(path, audioFile, { contentType: mimeType, upsert: true })`;保留大小/格式檢查;回 `path`。
- `getAudioUploadSignedUrl(path, expirationMinutes=60): Promise<string>` → 同 3.4 signed-url。
- `deleteAudioFile(audioUrl): Promise<void>` → `remove([audioUrl])`;維持「找不到略過」。
- 移除 `apiFetch` / `STORAGE_*` import(`firebase/firestore`、`db` 等保留)。

### 3.6 `src/constants/api.ts`(清理)
移除 `STORAGE_UPLOAD_URL`、`STORAGE_DELETE_URL`、`STORAGE_SIGNED_URL`(改寫後無引用)。其餘常數不動。

### 3.7 Supabase RLS(已建立,納入文件)
`storage.objects` 已建 policy(`for all to public`):
```
bucket_id = 'ollie-reader'
and (storage.foldername(name))[1] in ('speech-practice','audio-uploads')
and (storage.foldername(name))[2] = (auth.jwt() ->> 'sub')
```
語意:每個 Firebase 使用者只能讀寫自己 `{feature}/{uid}/...` 下的物件。無 token / 他專案 token → `auth.jwt()` null → 全擋。雲端 service_role 繞過 RLS,故現有雲端流程不受影響。

### 3.8 雲端 `purism-ev-bot`(收尾,前端驗證後)
移除 `routes/storage.py`(`/storage/*` router)、`supabase_storage.py`、`config.py` 的 `SUPABASE_*`(secret key)及 `main.py` 的 `include_router(storage_router)`、相關測試。**前端上線並確認無誤前不執行。**

---

## 4. 資料流

```
SpeechPractice / AudioUploads 頁
  → audioStorageService / audioUploadService（簽名不變）
      → supabase.storage.from('ollie-reader').upload/createSignedUrl/remove
          → Supabase Storage REST（accessToken = Firebase ID token）
              → TPA 用 Firebase JWKS 驗 token → 無 role claim → anon role
              → RLS：(storage.foldername(name))[2] == auth.jwt()->>'sub' ? 放行 : 擋
  → 回傳 path / signedUrl / void（與原合約一致）
```
desktop:webview 跑同一份前端 → 同一條路徑(只要使用者已 Firebase 登入即可)。

---

## 5. 錯誤處理與安全

- **SDK 回傳 `{data, error}`**:每個函式檢查 `error`,有則 `throw new Error(error.message)`,維持上層既有 throw-based 合約。
- **delete「找不到略過」**:`remove` 對不存在物件不報錯 → 自然維持;`data` 空時可 `console.warn`。
- **未登入**:`accessToken` 回 null → RLS 擋 → 函式 throw(對齊原本未登入即失敗)。
- **安全邊界 = RLS**:publishable key 公開,故安全完全由 RLS 決定 → policy 已 default-deny、比對 uid、涵蓋四種操作。bucket 維持私有。
- **App Check**:Supabase storage 不使用 Firebase App Check;此路徑只需有效 Firebase ID token(desktop 亦同)。雲端 API 的 App Check 不受影響。

---

## 6. 測試

web app **無 test runner**(memory: 僅 leaf-util node:test)→ 以 `npm run build` + `npm run lint` + 手動 + 實打 RLS smoke test 驗證。
- **Task 1 gating(實打 RLS)**:用有效 Firebase token 對 `audio-uploads/{自己uid}/__rls_test__` 跑 upload→sign→delete,全 2xx 才續做;否則退路 1。
- **手動**:口說練習頁(錄音→上傳→歷史播放→刪除)、音檔上傳頁(上傳→播放→刪除)各跑一次;web 與 desktop 各驗一次。
- **build/lint**:每個改寫 task 後跑。

---

## 7. 實作順序(預告,細節留給 plan)

1. **gating**:實打 RLS smoke test(路 2 可行性);不通則停、改路 1。
2. 依賴 + `supabaseClient.ts` + env 型別/範例。
3. 改寫 `audioStorageService.ts`(口說練習)→ build/lint/手動。
4. 改寫 `audioUploadService.ts`(音檔上傳,僅 storage 函式)→ build/lint/手動。
5. 清理 `constants/api.ts` 的 `STORAGE_*`。
6. (收尾,獨立)雲端移除 `/storage/*` + secret key。
