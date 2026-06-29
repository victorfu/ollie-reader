# Desktop dev 模式自動下載 TTS 模型 — 設計

日期：2026-06-29
狀態：設計（待實作）

## 問題

desktop sidecar 的兩個 TTS 引擎需要模型檔放在 `desktop/models/`：

| # | 檔案 | 引擎 | 大小 (bytes) |
|---|------|------|------|
| 1 | `en_US-lessac-medium.onnx` | Piper | 63,201,294 |
| 2 | `en_US-lessac-medium.onnx.json` | Piper（config，必要） | 4,885 |
| 3 | `kokoro-v1.0.fp16.onnx` | Kokoro | 177,464,787 |
| 4 | `voices-v1.0.bin` | Kokoro | 28,214,398 |

`models/` 在 `.gitignore`，這些大二進位檔不進 git。打包（`.spec`）只有在
`Path("models").exists()` 時才把目錄收進 `.app`，所以**連 release 都得先手動下載**。
dev 模式下目錄不存在 → `/api/tts` 回 404、`/api/ktts` 回 503。

目前沒有任何下載自動化，README 只列出來源網址要人工抓。

## 目標

dev 模式啟動 sidecar 時，自動在背景把缺少的模型檔下載到 `desktop/models/`，
**不阻塞**伺服器上線。frozen build 不做（模型已 bundle）。

## 範圍與觸發

- **僅 dev 模式**：以 `not getattr(sys, "frozen", False)` 把整段邏輯 gate 起來。
  frozen 時模型已在 bundle，跳過。
- 掛在 FastAPI **lifespan startup**（`server/app.py`）：sidecar 一上線就在
  **背景 daemon thread** 啟動下載，uvicorn 不被阻塞，GUI 立刻顯示「運行中」。
- 下載失敗（離線/中斷）→ 記 log、保留缺檔狀態、標記 `failed`，伺服器照常運行，
  下次啟動重試。不讓下載錯誤影響 sidecar 本身。

## 元件

### 新模組 `server/model_download.py`（單一職責、可獨立測試）

**Manifest** — 4 個檔案，各含：`filename`、`url`、`sha256`、`size`（bytes）。
sha256 於實作時實際下載一次算出並釘住。URL：

- Piper onnx：`https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/medium/en_US-lessac-medium.onnx`
- Piper json：同上 `…/en_US-lessac-medium.onnx.json`
- Kokoro onnx：`https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/kokoro-v1.0.fp16.onnx`
- Kokoro voices：`https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/voices-v1.0.bin`

注意 HuggingFace 會 302 轉到 CDN，下載必須 `follow_redirects=True`。

**`ensure_models(models_dir) -> None`** — 逐檔處理：
1. 若正式檔已存在且 sha256 正確 → 跳過。
2. 否則串流下載到 `<filename>.part`（`httpx.stream("GET", url, follow_redirects=True)`），
   每 ~10MB 寫一次進度 log（百分比）。
3. 下載完驗 sha256：
   - 符合 → 原子 `os.replace(.part, 正式檔)`。
   - 不符 → 刪 `.part`、該檔標記 `failed`、拋例外（由背景 thread 接住記 log）。

下載一律用 **httpx + `server.ssl_compat.create_ssl_context()`**，重用 Windows OpenSSL
applink 修正（否則下載本身就會 crash）。

**`DownloadStatus`** — 模組層級、thread-safe（`threading.Lock`）狀態：
- 整體 state：`idle` / `running` / `done` / `failed`
- per-file 進度：已下載 bytes / 總 bytes、各檔狀態
- 最後錯誤訊息（若有）
- 存取函式：`get_status() -> dict`、`is_running() -> bool`、`is_ready() -> bool`

**`start_background_download(models_dir) -> None`** — 以 `threading.Lock` 確保同時只有
一個下載 thread；已在跑就直接 return。thread 為 daemon，跑 `ensure_models` 並更新
`DownloadStatus`，例外只記 log 不外拋。

**CLI**：`python -m server.model_download`（同步呼叫 `ensure_models`，印進度到 stdout），
給打包/release 維護者打包前備齊模型用。

### `server/app.py` 整合

- 加 FastAPI **lifespan**。startup 時若 `not frozen` → 呼叫
  `start_background_download(models_dir)`（`models_dir` 取 `server.config` 的
  resource root / `models`）。
- `/api/tts`、`/api/ktts`：進函式先檢查——若 `DownloadStatus.is_running()` 且該引擎
  模型尚未就緒 → 回 **503「模型下載中，請稍候」**（比現有 404/503 更清楚）。
- 新增 `GET /api/models/status` → 回 `DownloadStatus.get_status()`，方便除錯與
  未來 GUI 顯示進度。

### `server/config.py`

新增 helper 取得 `models_dir`（即 `_resource_root() / "models"`）供下載與引擎共用，
避免路徑重複定義。模型路徑 env 覆寫（`PIPER_MODEL_PATH` 等）維持不變。

### Makefile

新增 target `desktop-models` → `cd desktop && uv run python -m server.model_download`。

## 資料流

```
sidecar 啟動 (uvicorn)
  └─ FastAPI lifespan startup
       └─ if not frozen: start_background_download(models_dir)   ← 不阻塞
            └─ daemon thread: ensure_models()
                 ├─ 每檔: 存在且 sha256 OK? → skip
                 ├─ 否則 stream 下載 → .part → 驗 sha256 → os.replace
                 └─ 更新 DownloadStatus（running → done / failed）

下載期間:
  /api/tts、/api/ktts → 503「模型下載中」
  /api/models/status   → 進度 JSON
下載完成後:
  TTS 端點正常合成
```

## 錯誤處理

- 離線 / 連線錯誤 / 逾時：該檔標記 `failed`，記 log，伺服器續跑，下次啟動重試。
- sha256 不符：刪 `.part`，不留壞檔，標記 `failed`。
- 磁碟寫入錯誤：同上，記 log。
- 背景 thread 的例外一律在 thread 內接住 → 不影響 sidecar。

## 測試（`tests/test_model_download.py`，全 mock，不碰真實網路）

- 正式檔已存在且 sha256 正確 → 不下載（mock httpx 不被呼叫）。
- 缺檔 → 下載、驗 sha256、原子 rename 出正式檔。
- sha256 不符 → 刪 `.part`、標記 `failed`、不留正式檔。
- `frozen=True` → `start_background_download` 不啟動下載。
- `DownloadStatus` 狀態轉換正確（idle→running→done / failed）。
- 重入：已在跑時再呼叫 `start_background_download` 不會開第二個 thread。
- 用 `tmp_path` + monkeypatch `httpx.stream`，避免真實下載。

## 非目標（YAGNI）

- 不做 GUI 進度條（只先提供 `/api/models/status`，未來要再接）。
- 不做斷點續傳（`.part` 失敗就整檔重下）。
- 不做 URL 的 env 覆寫（manifest 寫死；要換檔用現有的 `*_MODEL_PATH` env 指到別處）。
- 不在 frozen build 下載。
