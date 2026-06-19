# 設計:音訊儲存從 GCS 遷移到 Supabase Storage

<status>Approved — 待後端 repo 實作</status>
<date>2026-06-19</date>

## 背景與問題

Ollie Reader 的兩類音訊檔(演講練習錄音、音訊庫上傳檔)目前存在 **Google Cloud Storage (GCS)**。GCS 現在必須啟用付費/綁信用卡才能使用,不再符合需求。

**硬限制**:替代方案**完全不綁信用卡**。這排除了 Cloudflare R2、Backblaze B2、AWS S3、以及 Firebase Storage(現需 Blaze 付費方案)——它們即使有免費額度也要求先綁卡。

**選定**:**Supabase Storage**(免費帳號不需信用卡)。

## 關鍵架構事實

前端(本 repo)**不直接碰 GCS**。儲存被抽象在後端(獨立 repo,FastAPI `:8080`)的三個端點後面:

```
src/constants/api.ts
  GCS_UPLOAD_URL  = `${API_BASE_URL}/gcs/upload`
  GCS_DELETE_URL  = `${API_BASE_URL}/gcs/delete`
  GCS_SIGNED_URL  = `${API_BASE_URL}/gcs/signed-url`
```

消費者:
- `src/services/audioStorageService.ts` — 演講練習錄音,path `speech-practice/{uid}/{recordId}.webm`
- `src/services/audioUploadService.ts` — 音訊庫上傳,path `audio-uploads/{uid}/{uploadId}.{ext}`

Firestore 裡存的 `audioUrl` 欄位其實是**儲存路徑(path)**,不是 URL;播放時一律向後端要 signed URL。前端從不自己拼 GCS 網址。

## 決策摘要

| 項目 | 決定 |
|---|---|
| 方向 | **A — 只改後端,前端零改動** |
| 儲存後端 | Supabase Storage(private bucket) |
| 前端改動 | **無**(端點路徑 `/gcs/*` 名稱保留即可) |
| 安全模型 | 不變:後端驗 Firebase ID token + 用 service-role key 簽 URL |
| 舊資料 | **歸零重來,不搬遷**(舊紀錄播放會 404,可接受) |

## 前端契約(後端必須照樣實作)

新後端只要對這三個端點維持以下行為,前端就 100% 不用改:

### `POST /gcs/upload`
- **送入**:`multipart/form-data` — `file`(blob/檔案)+ `path`(字串);Header `Authorization: Bearer <Firebase ID token>`。
- **回傳**:任意 **2xx** 即可(前端只檢查 `response.ok`,**不取用 response body**)。
- **失敗**:非 2xx + JSON `{ "detail": "<訊息>" }`。

### `DELETE /gcs/delete?path=<url-encoded path>`
- **送入**:`path` query;Firebase token。
- **回傳**:2xx 成功;**404 前端視為可忽略**(檔案不存在不算錯)。
- **失敗**:其他非 2xx + JSON `{ "detail" }`。

### `GET /gcs/signed-url?path=<path>&expiration_minutes=<n>`
- **送入**:`path` + `expiration_minutes`(分鐘);Firebase token。
- **回傳**:JSON **`{ "url": "<可播放網址>" }`**。
- **失敗**:非 2xx + JSON `{ "detail" }`。

## 後端實作對應(`supabase-py`)

```python
# 上傳:upsert=true 必要 — 同一 recordId 重錄要能覆蓋(GCS 預設覆蓋)
supabase.storage.from_(BUCKET).upload(
    path, file_bytes,
    {"content-type": mime, "upsert": "true"},
)

# 刪除
supabase.storage.from_(BUCKET).remove([path])
# 找不到時 Supabase 通常不報錯;對應前端「404 可忽略」語意即可

# 簽名 URL:參數是「秒」,前端傳的是「分鐘」→ 要 ×60
res = supabase.storage.from_(BUCKET).create_signed_url(path, expiration_minutes * 60)
# 取出 signed URL 欄位(版本不同可能是 signedURL / signedUrl / signed_url),
# 統一包成 { "url": ... } 回傳
```

## Supabase 設定

1. 註冊 Supabase 帳號(**免信用卡**)。
2. 建立一個 **private bucket**,例如 `ollie-audio`。
3. 後端環境變數:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`(後端專用,**絕不可外洩到前端**)
   - `SUPABASE_BUCKET`(如 `ollie-audio`)
4. 後端用 service-role key 初始化 client;bucket 維持私有,所有讀取都透過後端簽出的短期 URL。

## 安全模型(不變)

- 後端**繼續**驗證 Firebase ID token(沿用現有中介層),確認呼叫者身分。
- Bucket **私有**;前端永遠拿不到長期憑證。
- 後端以 service-role key 簽出有時效的 URL 給前端播放。
- → **不需要** Supabase RLS、也**不需要**把 Firebase Auth 橋接成 Supabase JWT。這是 Direction A 相對「前端直連」最大的省事點。

## 免費額度注意事項

- 儲存 **1GB**、流量 **5GB/月**(超過需升級)。
- 專案**閒置 7 天會自動暫停**,需手動喚醒;個人/低流量 app 要留意。
- 若日後容量吃緊,因為已是 S3 相容模型,改投其他 S3 後端的成本很低。

## 非目標 / 範圍外

- **不**改動本前端 repo 的任何程式碼(端點契約不變)。
- **不**搬遷 GCS 既有檔案(歸零)。
- **不**導入 RLS 或 Firebase↔Supabase Auth 橋接。
- **不**改 Firestore schema(`audioUrl` 仍存 path)。

## 下一步(在後端 repo 進行)

本前端 repo 無需變更。實作落在獨立的後端 repo:

1. 加入 `supabase` 套件與上述環境變數。
2. 依「前端契約」重寫 `/gcs/upload`、`/gcs/delete`、`/gcs/signed-url` 三個 handler 的內部,GCS client → Supabase。
3. 端對端測試:錄音上傳 → 列表播放(signed URL)→ 刪除。
4. (可選)端點路徑可日後更名為 `/storage/*`,但**那會需要同步改前端**,屬另一個變更,本次不做。
