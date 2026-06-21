# Storage 前端直連 Supabase 實作計畫

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把「口說練習」與「音檔上傳」兩頁的 storage 操作(upload / signed-url / delete)從雲端 `/storage/*` 代理改為前端用 Supabase JS SDK 直連 Supabase Storage,身分走 Firebase TPA、授權走 RLS。

**Architecture:** 新增單例 Supabase client(publishable key + `accessToken` 回傳 Firebase ID token);兩個 service 內部改呼叫 `supabase.storage`,**對外 export 簽名不變** → hook/頁面/Firestore metadata 不動。授權由已建立的 `storage.objects` RLS(per-uid 資料夾)控管。desktop 跑同一份前端 → 自動受惠。

**Tech Stack:** React + TypeScript + Vite;`@supabase/supabase-js` v2;Firebase Auth(既有);Supabase Storage + RLS。

## Global Constraints

- Bucket 名稱**精確**為 `ollie-reader`(`STORAGE_BUCKET` 常數)。
- 資料夾結構不變:`speech-practice/{uid}/{recordId}.webm`、`audio-uploads/{uid}/{uploadId}.{ext}`。
- 兩個 service 的所有 **export 函式簽名一律不變**(consumers 不得修改)。
- `@supabase/supabase-js` 需 **v2 ≥ 2.40**(`accessToken` option)。
- 前端只用 **publishable / anon key**;**絕不**放 secret key。
- `createSignedUrl` 參數為**秒**:傳 `expirationMinutes * 60`。
- `upload` 一律 `{ upsert: true }`(覆寫語意,避免重傳衝突)。
- 刪除維持「找不到就略過、不報錯」語意。
- web app **無 test runner**(僅 leaf-util node:test)→ 每個前端 task 用 `npm run build`(`tsc -b && vite build`)+ `npm run lint` + 手動頁面測試驗證。
- 在 **dev 分出的 feature branch** 上實作,不在 master。

---

## File Structure

| 檔案 | 動作 | 責任 |
|---|---|---|
| `src/utils/supabaseClient.ts` | Create | 單例 Supabase client + `STORAGE_BUCKET` 常數 |
| `package.json` / `package-lock.json` | Modify | 加 `@supabase/supabase-js` 依賴 |
| `src/vite-env.d.ts` | Modify | 加 `VITE_SUPABASE_URL`、`VITE_SUPABASE_PUBLISHABLE_KEY` 型別 |
| `.env.example` | Modify | 補兩個 Supabase env 範例 |
| `src/services/audioStorageService.ts` | Modify | 口說練習 3 函式改走 SDK |
| `src/services/audioUploadService.ts` | Modify | 音檔上傳 3 個 storage 函式改走 SDK(Firestore 部分不動) |
| `src/constants/api.ts` | Modify | 移除已無引用的 `STORAGE_*` 常數 |
| `purism-ev-bot/*`(獨立 repo) | Modify/Delete | 收尾:移除 `/storage/*` + secret key(前端驗證後) |

---

## Task 1: Gating —— 實打驗證 RLS(路 2 可行性)

**這是人工 gating 步驟,不是 subagent 任務**(需要真實 Firebase token + 專案金鑰,subagent 無法取得)。**必須先通過才往下做**;不通過 → 停,改走「路 1」(附錄 A)。

**Files:** 無(只跑指令)。

- [ ] **Step 1: 準備三個輸入**

從 Supabase 後台拿 `SUPABASE_URL`、publishable key;從登入中的 app(DevTools → Network → 任一帶 `Authorization: Bearer` 的後端請求)複製一個有效 Firebase ID token。

- [ ] **Step 2: 跑 upload → sign → delete smoke test**

把三個值填入後執行(在 `ollie-reader` 目錄,需 node 與 curl):

```bash
SB_URL="https://<ref>.supabase.co"
SB_KEY="<publishable-key>"
FB_TOKEN="<firebase-id-token>"

UID=$(node -e "console.log(JSON.parse(Buffer.from(process.argv[1].split('.')[1],'base64url').toString()).sub)" "$FB_TOKEN")
echo "uid=$UID"
P="audio-uploads/$UID/__rls_test__.txt"

echo -n "upload: "; curl -s -o /dev/null -w "%{http_code}\n" -X POST \
  "$SB_URL/storage/v1/object/$P" \
  -H "Authorization: Bearer $FB_TOKEN" -H "apikey: $SB_KEY" \
  -H "Content-Type: text/plain" --data "rls test"

echo -n "sign:   "; curl -s -o /dev/null -w "%{http_code}\n" -X POST \
  "$SB_URL/storage/v1/object/sign/$P" \
  -H "Authorization: Bearer $FB_TOKEN" -H "apikey: $SB_KEY" \
  -H "Content-Type: application/json" --data '{"expiresIn":60}'

echo -n "delete: "; curl -s -o /dev/null -w "%{http_code}\n" -X DELETE \
  "$SB_URL/storage/v1/object/$P" \
  -H "Authorization: Bearer $FB_TOKEN" -H "apikey: $SB_KEY"
```

Expected(路 2 成立):三行皆 **`200`**。

- [ ] **Step 3: 判定**

- 全 `200` → 路 2 成立,繼續 Task 2。
- 出現 `401/403/400` → storage 在 `anon` role 不放行 → **停止本計畫**,改走附錄 A(路 1)。

決策記錄一行到 ledger 或 commit message(無程式碼變更,不需 commit)。

---

## Task 2: Supabase client + 依賴 + 環境變數

**Files:**
- Create: `src/utils/supabaseClient.ts`
- Modify: `package.json`, `package-lock.json`
- Modify: `src/vite-env.d.ts:26`
- Modify: `.env.example:23`

**Interfaces:**
- Produces: `supabase`(`SupabaseClient`)、`STORAGE_BUCKET: "ollie-reader"`,供 Task 3/4 import。

- [ ] **Step 1: 安裝依賴**

```bash
npm i @supabase/supabase-js
```
Expected:`package.json` 出現 `"@supabase/supabase-js": "^2...."`(版本 ≥ 2.40),`package-lock.json` 更新。

- [ ] **Step 2: 建立 client**

Create `src/utils/supabaseClient.ts`:

```ts
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
```

- [ ] **Step 3: 加環境變數型別**

Modify `src/vite-env.d.ts` —— 在 `// Backend API` 區塊後、`}` 前加:

```ts
  // Backend API
  readonly VITE_API_BASE_URL?: string;

  // Supabase Storage（前端直連）
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY: string;
```

- [ ] **Step 4: 補 .env.example**

Modify `.env.example` —— 檔尾加:

```
# Supabase Storage（前端直連；publishable key 為公開 key，勿放 secret key）
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
```

並在本機 `.env.local` 填入真實值(否則 app 啟動時 `createClient` 會丟錯)。

- [ ] **Step 5: build + lint**

```bash
npm run build && npm run lint
```
Expected:build 成功(0 TS error)、lint 0 error。

- [ ] **Step 6: Commit**

```bash
git add src/utils/supabaseClient.ts src/vite-env.d.ts .env.example package.json package-lock.json
git commit -m "feat(storage): add Supabase client for client-direct storage (Firebase TPA)"
```

---

## Task 3: 改寫 audioStorageService(口說練習)

**Files:**
- Modify: `src/services/audioStorageService.ts`(整檔替換)

**Interfaces:**
- Consumes: `supabase`, `STORAGE_BUCKET`(Task 2)。
- Produces(簽名不變,consumers `useSpeechPractice.ts`、`speechPracticeService.ts`、`PracticeHistory.tsx` 不動):
  - `uploadPracticeAudio(userId: string, recordId: string, audioBlob: Blob): Promise<string>`
  - `deletePracticeAudio(userId: string, recordId: string): Promise<void>`
  - `getAudioSignedUrl(path: string, expirationMinutes?: number): Promise<string>`
  - `MAX_AUDIO_SIZE_BYTES`、`MAX_AUDIO_SIZE_MB`

- [ ] **Step 1: 整檔替換**

Replace 全部內容為:

```ts
import { supabase, STORAGE_BUCKET } from "../utils/supabaseClient";

// 10MB max audio file size
export const MAX_AUDIO_SIZE_BYTES = 10 * 1024 * 1024;
export const MAX_AUDIO_SIZE_MB = 10;

/** 取得錄音檔在 storage 的路徑。 */
function getAudioPath(userId: string, recordId: string): string {
  return `speech-practice/${userId}/${recordId}.webm`;
}

/** 上傳練習錄音（webm）。回傳儲存路徑。 */
export async function uploadPracticeAudio(
  userId: string,
  recordId: string,
  audioBlob: Blob,
): Promise<string> {
  if (audioBlob.size > MAX_AUDIO_SIZE_BYTES) {
    throw new Error(
      `錄音檔案過大，最大允許 ${MAX_AUDIO_SIZE_MB}MB，目前大小 ${(
        audioBlob.size /
        1024 /
        1024
      ).toFixed(2)}MB`,
    );
  }

  const path = getAudioPath(userId, recordId);

  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(path, audioBlob, { contentType: "audio/webm", upsert: true });

  if (error) {
    throw new Error(error.message || "上傳錄音失敗");
  }

  return path;
}

/** 刪除練習錄音（找不到不視為錯誤）。 */
export async function deletePracticeAudio(
  userId: string,
  recordId: string,
): Promise<void> {
  const path = getAudioPath(userId, recordId);

  const { error } = await supabase.storage.from(STORAGE_BUCKET).remove([path]);

  if (error) {
    if (error.message?.includes("not found")) {
      console.warn(`Audio file not found: ${path}`);
      return;
    }
    throw new Error(error.message || "刪除錄音失敗");
  }
}

/** 取得錄音播放用的短效簽名 URL（expirationMinutes 預設 60）。 */
export async function getAudioSignedUrl(
  path: string,
  expirationMinutes: number = 60,
): Promise<string> {
  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(path, expirationMinutes * 60);

  if (error || !data?.signedUrl) {
    throw new Error(error?.message || "取得音訊 URL 失敗");
  }

  return data.signedUrl;
}
```

- [ ] **Step 2: build + lint**

```bash
npm run build && npm run lint
```
Expected:0 error(確認簽名相容、無殘留 `apiFetch`/`STORAGE_*` import)。

- [ ] **Step 3: 手動測試(口說練習頁)**

`.env.local` 設好後 `npm run dev` → `/speech-practice`:錄音→上傳成功;歷史列表能播放(signed URL);刪除後檔案消失、無 console 錯誤。

- [ ] **Step 4: Commit**

```bash
git add src/services/audioStorageService.ts
git commit -m "feat(storage): route speech-practice audio through Supabase SDK"
```

---

## Task 4: 改寫 audioUploadService(音檔上傳,僅 storage 函式)

**Files:**
- Modify: `src/services/audioUploadService.ts`(import 區塊 + 3 個 storage 函式;Firestore 函式不動)

**Interfaces:**
- Consumes: `supabase`, `STORAGE_BUCKET`(Task 2)。
- Produces(簽名不變,consumer `useAudioUploads.ts` 不動):
  - `uploadAudioFile(userId: string, uploadId: string, audioFile: File | Blob, mimeType: string): Promise<string>`
  - `deleteAudioFile(audioUrl: string): Promise<void>`
  - `getAudioUploadSignedUrl(path: string, expirationMinutes?: number): Promise<string>`
- 不變更:`addAudioUpload`、`getUserAudioUploads`、`updateAudioUpload`、`deleteAudioUpload`、`getAudioUploadPath`、`getExtensionFromMimeType`、`convertToAudioUpload`、`COLLECTION_NAME`。

- [ ] **Step 1: 替換 import 區塊**

把檔案最上方 import 區塊(目前第 1–28 行,含 `apiFetch` 與 `STORAGE_*`)替換為:

```ts
import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  query,
  where,
  getDocs,
  Timestamp,
  orderBy,
  limit,
  updateDoc,
  type DocumentData,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { db } from "../utils/firebaseUtil";
import { supabase, STORAGE_BUCKET } from "../utils/supabaseClient";
import type { AudioUpload, AudioUploadUpdateInput } from "../types/audioUpload";
import {
  MAX_UPLOAD_SIZE_BYTES,
  MAX_UPLOAD_SIZE_MB,
  SUPPORTED_AUDIO_TYPES,
} from "../types/audioUpload";
```

- [ ] **Step 2: 替換 `uploadAudioFile`**

```ts
export async function uploadAudioFile(
  userId: string,
  uploadId: string,
  audioFile: File | Blob,
  mimeType: string,
): Promise<string> {
  if (audioFile.size > MAX_UPLOAD_SIZE_BYTES) {
    throw new Error(
      `檔案過大，最大允許 ${MAX_UPLOAD_SIZE_MB}MB，目前大小 ${(
        audioFile.size /
        1024 /
        1024
      ).toFixed(2)}MB`,
    );
  }

  if (!SUPPORTED_AUDIO_TYPES.includes(mimeType)) {
    throw new Error(
      `不支援的音訊格式。支援格式：MP3, WAV, M4A, WebM, OGG, AAC, MP4`,
    );
  }

  const extension = getExtensionFromMimeType(mimeType);
  const path = getAudioUploadPath(userId, uploadId, extension);

  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(path, audioFile, { contentType: mimeType, upsert: true });

  if (error) {
    throw new Error(error.message || "上傳音訊失敗");
  }

  return path;
}
```

- [ ] **Step 3: 替換 `deleteAudioFile`**

```ts
export async function deleteAudioFile(audioUrl: string): Promise<void> {
  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .remove([audioUrl]);

  if (error) {
    if (error.message?.includes("not found")) {
      console.warn(`Audio file not found: ${audioUrl}`);
      return;
    }
    throw new Error(error.message || "刪除音訊失敗");
  }
}
```

- [ ] **Step 4: 替換 `getAudioUploadSignedUrl`**

```ts
export async function getAudioUploadSignedUrl(
  path: string,
  expirationMinutes: number = 60,
): Promise<string> {
  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(path, expirationMinutes * 60);

  if (error || !data?.signedUrl) {
    throw new Error(error?.message || "取得音訊 URL 失敗");
  }

  return data.signedUrl;
}
```

- [ ] **Step 5: build + lint**

```bash
npm run build && npm run lint
```
Expected:0 error(確認 Firestore 函式未受影響、無殘留 `apiFetch`/`STORAGE_*`)。

- [ ] **Step 6: 手動測試(音檔上傳頁)**

`npm run dev` → `/audio-uploads`:上傳一個音檔成功;清單可播放;編輯標題(Firestore)仍正常;刪除後檔案與記錄都消失、無 console 錯誤。

- [ ] **Step 7: Commit**

```bash
git add src/services/audioUploadService.ts
git commit -m "feat(storage): route audio-uploads through Supabase SDK"
```

---

## Task 5: 清理未用的 STORAGE_* 常數

**Files:**
- Modify: `src/constants/api.ts:15-18`

- [ ] **Step 1: 移除常數**

刪除以下四行(註解 + 三個常數):

```ts
// Storage API endpoints (backend proxy to Supabase Storage)
export const STORAGE_UPLOAD_URL = `${API_BASE_URL}/storage/upload`;
export const STORAGE_DELETE_URL = `${API_BASE_URL}/storage/delete`;
export const STORAGE_SIGNED_URL = `${API_BASE_URL}/storage/signed-url`;
```

- [ ] **Step 2: 確認無殘留引用**

```bash
grep -rn "STORAGE_UPLOAD_URL\|STORAGE_DELETE_URL\|STORAGE_SIGNED_URL" src/
```
Expected:無輸出。

- [ ] **Step 3: build + lint**

```bash
npm run build && npm run lint
```
Expected:0 error。

- [ ] **Step 4: Commit**

```bash
git add src/constants/api.ts
git commit -m "chore(storage): drop unused cloud storage URL constants"
```

---

## Task 6:(收尾,獨立 repo)移除雲端 /storage/*

**前提:前端已上線並確認 storage 一切正常後才做。** 在 `purism-ev-bot` repo。

**Files(purism-ev-bot):**
- Delete: `routes/storage.py`
- Delete: `supabase_storage.py`
- Modify: `main.py`(移除 storage_router import + `app.include_router(storage_router)`,在 `main.py:124`)
- Modify: `config.py`(移除 `SUPABASE_URL` / `SUPABASE_SECRET_KEY` / `SUPABASE_BUCKET`,約 `config.py:48-54`)
- Modify: `.env.example`、`README.md`、`AGENTS.md`(移除 `SUPABASE_*` 相關說明)
- Delete: storage 相關測試(以 `grep -rln storage tests/` 找出)

- [ ] **Step 1: 找出所有引用點**

```bash
cd /Users/victor/Documents/purism-ev-bot
grep -rn "storage_router\|routes.storage\|supabase_storage\|SUPABASE_" --include=*.py . | grep -v __pycache__
```

- [ ] **Step 2: 移除 router 與 helper**

刪 `routes/storage.py`、`supabase_storage.py`;在 `main.py` 移除其 import 與 `app.include_router(storage_router)`;在 `config.py` 移除三個 `SUPABASE_*`。

- [ ] **Step 3: 移除測試與文件引用**

刪除 storage 相關測試檔/案例;清掉 `.env.example`、`README.md`、`AGENTS.md` 的 `SUPABASE_*` 說明。

- [ ] **Step 4: 測試**

```bash
cd /Users/victor/Documents/purism-ev-bot && pytest
```
Expected:全綠(無 import error、無殘留 storage 測試)。

- [ ] **Step 5: Commit(purism-ev-bot)**

```bash
git add -A
git commit -m "refactor(storage): remove /storage proxy now served client-direct via Supabase"
```

---

## 附錄 A:路 1 fallback(Task 1 不通過才用)

若 storage 在 `anon` role 被擋,改用官方建議的 `role: authenticated` claim:
1. **既有使用者 backfill**:在 `purism-ev-bot`(已有 `firebase-admin`)寫一次性腳本,迭代所有使用者 `auth.set_custom_user_claims(uid, {"role": "authenticated"})`。
2. **未來使用者**:新增 Firebase Cloud Function(`onCreate` 或 blocking)替新註冊者打同樣 claim(`ollie-reader` 目前僅 hosting,需新增 functions infra)。
3. **前端**:登入/註冊後 `auth.currentUser.getIdToken(true)` 強制刷新拿到含 claim 的 token。
4. RLS policy 可改 `to authenticated`(其餘 Task 2–6 不變)。
此分支需另開一份 plan 補 1、2 的細節。
