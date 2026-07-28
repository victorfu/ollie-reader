# Ollie Reader Desktop

Ollie Reader Desktop 是 Web App 的選用 macOS 伴隨程式，由兩個部分組成：

- **PySide6 托盤殼**：管理本機服務、開機自啟、OIKID 與 Azure 憑證，以及 TTS 試聽。
- **FastAPI sidecar**：固定綁定 `127.0.0.1`，提供 PDF 文字擷取、URL 代抓、OIKID 預約記錄與四種 TTS 引擎。

desktop 是獨立的 Python 子專案，以 [uv](https://docs.astral.sh/uv/) 管理；不會由根目錄的 npm 安裝流程建立。runtime 依 `pyproject.toml` 支援 **Python 3.10 以上**；目前的 PyInstaller/release 腳本直接使用標準函式庫 `tomllib`，所以打包與發佈實際需要 **Python 3.11 以上**。目前正式發佈物是 **macOS 12.0+、Apple Silicon（arm64）**，不提供 Intel 或 universal build。

## 快速開始

從 repository 根目錄執行：

```bash
make desktop-setup       # 建立 desktop/.venv，安裝 runtime + dev 相依
make desktop-models      # 可選：立即下載並驗證離線 TTS 模型
make desktop-serve       # 只啟動 sidecar：http://127.0.0.1:8765
make desktop-run         # 啟動托盤殼；殼會管理 sidecar
make desktop-test        # 執行 desktop pytest suite
```

也可以直接在子專案操作：

```bash
cd desktop
uv sync
uv run python -m server.model_download
uv run python main.py --serve
uv run python main.py --serve --port 8877
uv run python main.py
uv run pytest -v
```

開發模式的「開啟 Ollie Reader」會前往 `http://localhost:5173`，因此要一併使用 Web UI 時，請在另一個終端機從 repository 根目錄執行 `npm run dev`。可用 `OLLIE_WEB_APP_URL` 改寫目標網址；frozen app 的預設值是 `https://ollie-reader.web.app`。

殼啟動的 sidecar 會把 stdout/stderr 寫入作業系統暫存目錄的 `ollie-reader-sidecar.log`。

## 離線模型

從原始碼啟動 sidecar 時，lifespan 會在背景下載缺少的 Piper/Kokoro 模型，不阻塞服務啟動。每個檔案下載完成前會先比對程式內建的 SHA-256；下載中的進度可由 `GET /api/models/status` 查詢。下載正在進行、且對應的主要模型檔仍不存在時，Piper/Kokoro API 會暫時回傳 `503`。

`make desktop-models` 可在啟動服務前同步完成同一套下載與驗證：

| 引擎 | `desktop/models/` 檔案 | 來源 | 執行期覆寫 |
|---|---|---|---|
| Piper | `en_US-lessac-medium.onnx` | [rhasspy/piper-voices](https://huggingface.co/rhasspy/piper-voices) | `PIPER_MODEL_PATH` |
| Piper | `en_US-lessac-medium.onnx.json` | 同上 | 跟隨 ONNX 模型路徑 |
| Kokoro | `kokoro-v1.0.fp16.onnx` | [kokoro-onnx model files](https://github.com/thewh1teagle/kokoro-onnx/releases/tag/model-files-v1.0) | `KOKORO_MODEL_PATH` |
| Kokoro | `voices-v1.0.bin` | 同上 | `KOKORO_VOICES_PATH` |

PyInstaller spec 只會收進上表四個「實際存在」的檔案，不會整包複製 `models/`，也不會收進 fp32、int8 或實驗模型。frozen app 不會自動下載模型，所以建立可發佈 bundle 前務必先執行 `make desktop-models`，並確認四個檔案都存在。若要更換正式 bundle 的模型，除了 runtime 路徑外，還要同步調整 `server/model_download.py` 的 manifest 與 `ollie-reader-desktop.spec` 的 `_BUNDLED_MODELS`。

## TTS 引擎

| 引擎 | API | 網路 | 輸出 | 預設聲音／模型 | 備註 |
|---|---|---|---|---|---|
| Piper | `POST /api/tts` | 不需要 | WAV | `en_US-lessac-medium`、speaker `0` | `voice` 必須是可轉成整數的 speaker id |
| Kokoro | `POST /api/ktts` | 不需要 | WAV | `af_heart`、fp16 ONNX | 使用 `kokoro-onnx`/ONNX Runtime，不需要 PyTorch |
| Edge TTS | `POST /api/etts` | **需要** | MP3 | `en-US-JennyNeural` | `edge-tts` 的非官方 Edge Read Aloud 端點，不需要 API key |
| Azure AI Speech | `POST /api/azure-tts` | **需要** | MP3 | `en-US-JennyNeural`、48 kHz/192 kbps mono | 官方 SDK；需要使用者自己的 key 與 region |

所有 TTS POST 端點共用 JSON request：

```json
{
  "text": "Hello Ollie",
  "speed": 1.0,
  "voice": null
}
```

設定視窗將語速限制在 `0.5`–`2.0`。Edge/Azure 會將語速轉為 `-50%`–`+100%`；Piper 會轉為反向的 `length_scale`；Kokoro 則直接接收 speed。

### Edge TTS

Edge TTS 由預設相依 `edge-tts` 提供，會連線至 Microsoft Edge「大聲朗讀」的未公開服務。服務使用的 `Sec-MS-GEC` token 可能隨 Edge 改版失效；sidecar 會把服務端 `403` 映射成帶有升級 `edge-tts` 提示的 `502`，不會靜默吞掉錯誤。

目前預設採單語的 `en-US-JennyNeural`，避免多語聲音在缺少上下文的單字上誤判語言，也避開已知的 Emma 字首擦音問題。可用 `EDGE_TTS_VOICE` 覆寫。

目前 lockfile 中的 `edge-tts` 7.2.8 隨附 LGPL-3.0 授權；發佈 bundle 時仍需一併處理它與 `piper-tts`、`phonemizer-fork` 等第三方套件的授權聲明。不要把相依套件授權相容性視為 README 的法律保證。

### Azure AI Speech

Azure SDK 是選用 dependency group，從原始碼實際使用或試聽 Azure 引擎前需安裝：

```bash
uv sync --directory desktop --group azure
```

key 與 region 只能由設定視窗的「語音測試」頁儲存，資料透過 `keyring` 放在 OS keychain（service：`ollie-reader-azure-tts`），不讀取環境變數或設定檔。region 預設為 `eastasia`。

標準 release 環境不安裝 `azure` group，PyInstaller spec 也不主動 collect Azure SDK；因此預設 frozen bundle 即使 keychain 已有憑證，`/api/azure-tts` 仍會回傳 `503`。spec 並未設定強制 exclude，所以不要在 release 環境預先安裝 `azure` group；正式 bundle 請使用免 key 的 Edge 引擎。Azure 目前支援從原始碼、且已安裝 `azure` group 的環境。

## 托盤殼與設定

托盤選單提供 sidecar 狀態、啟動／停止服務、開啟設定、開啟 Web App 與結束程式。設定視窗包含：

- **一般**：sidecar 狀態與 port、開機自啟、啟動／停止服務、OIKID 帳密。
- **語音測試**：四種引擎、聲音清單、英文聲音篩選、語速與文字試聽，以及 Azure key/region。

OIKID 帳密透過 `keyring` 存在 OS keychain（service：`ollie-reader-oikid`），不落地為一般設定檔，也不會進入 bundle。`GET /api/oikid/booking-records` 會用這組帳密登入 OIKID 並抓取第一頁預約記錄。

macOS 的「開機時自動啟動」會建立：

```text
~/Library/LaunchAgents/com.ollie-reader.desktop.plist
```

LaunchAgent 設為 `RunAtLoad=true`、`KeepAlive=false`，啟動的是 `--serve` sidecar，不是托盤 UI。取消勾選會刪除 plist。

## Single instance 與 sidecar 收養

- 托盤殼以 `QLockFile` 保證 single instance，鎖檔位於暫存目錄的 `ollie-reader-shell.lock`。重複啟動時，新實例會經 `QLocalServer` 喚醒既有實例的設定視窗後退出。
- `--serve` 啟動前會以 `/api/version` 確認指定 port 是否已有 Ollie sidecar；若存在便正常 exit 0，不搶 port。
- sidecar 會在暫存目錄寫入 `ollie-reader-sidecar-<port>.pid`，在正常結束、SIGTERM 或 SIGINT 時清除；清除前會驗證 PID 檔屬於目前行程，避免競態誤刪另一個 sidecar 的 PID。
- 托盤殼若發現由 LaunchAgent 或其他實例啟動的 sidecar，會收養該行程而不重複 spawn。停止服務時先送 SIGTERM，五秒未結束才送 SIGKILL。
- 舊 sidecar 若可通過健康檢查但沒有 PID 檔，殼可以顯示其狀態，卻無法代為停止該行程。

## 設定

sidecar host 固定為 `127.0.0.1`，預設 port 為 `8765`；可用 `main.py --serve --port <port>` 改變 port。其餘執行期設定如下：

| 設定 | 預設值 | 用途 |
|---|---|---|
| `PIPER_MODEL_PATH` | bundle/source 下的 `models/en_US-lessac-medium.onnx` | Piper ONNX 路徑 |
| `KOKORO_MODEL_PATH` | `models/kokoro-v1.0.fp16.onnx` | Kokoro ONNX 路徑 |
| `KOKORO_VOICES_PATH` | `models/voices-v1.0.bin` | Kokoro voices 路徑 |
| `KOKORO_DEFAULT_VOICE` | `af_heart` | Kokoro 預設 voice id |
| `KOKORO_LANG` | `en-us` | 無法由 voice prefix 判斷時的 Kokoro 語言 |
| `EDGE_TTS_VOICE` | `en-US-JennyNeural` | Edge 預設聲音 |
| `AZURE_TTS_VOICE` | `en-US-JennyNeural` | Azure 預設聲音 |
| `AZURE_TTS_FORMAT` | `Audio48Khz192KBitRateMonoMp3` | Azure SDK 的 `SpeechSynthesisOutputFormat` 名稱；無效值會退回預設 |
| `OLLIE_CORS_ORIGINS` | 空 | 以逗號追加允許的 Web origin；禁止 `*` wildcard |
| `OLLIE_WEB_APP_URL` | dev/frozen 預設網址 | 托盤「開啟 Ollie Reader」的網址 |

CORS 預設允許：

- `http://localhost:5173`
- `http://127.0.0.1:5173`
- `https://ollie-reader.web.app`
- `https://ollie-reader.firebaseapp.com`

sidecar 也會回應受信任 origin 的 Private Network Access preflight。新增 origin 時必須列出完整 scheme/host/port，例如：

```bash
OLLIE_CORS_ORIGINS="https://reader.example.com,http://localhost:4173" \
  uv run --directory desktop python main.py --serve
```

版本發佈的單一來源是 `desktop/pyproject.toml`。由於 frozen bundle 內沒有 pyproject，`server/config.py` 仍保留一份 `VERSION`；修改版本時兩處都要同步，`tests/test_config.py` 會檢查兩者一致。`OLLIE_BUNDLE_VERSION` 只供 PyInstaller **build-time** 覆寫，正式腳本會自動從 pyproject 設定，不是執行期選項。

## HTTP API

預設 base URL 是 `http://127.0.0.1:8765`。FastAPI 的互動文件可由 `/docs` 開啟。

| Method | Path | 輸入 | 輸出／用途 |
|---|---|---|---|
| GET | `/api/version` | — | `{"version":"…","engine":"local-sidecar"}`；同時作健康檢查 |
| GET | `/api/models/status` | — | 背景模型下載的整體與逐檔狀態 |
| GET | `/api/fetch-url` | `url`、`follow_redirects=true`、`max_redirects=10`、`timeout=30` | 回傳遠端原始 bytes，並帶 `X-Final-URL`、`X-Redirect-Count`、`X-File-Extension` |
| POST | `/api/pdf/extract` | multipart 欄位 `file` | 每頁文字、字數與總頁數 |
| POST | `/api/tts` | `SpeechRequest` JSON | Piper WAV |
| POST | `/api/ktts` | `SpeechRequest` JSON | Kokoro WAV |
| POST | `/api/etts` | `SpeechRequest` JSON | Edge MP3 |
| POST | `/api/azure-tts` | `SpeechRequest` JSON | Azure MP3 |
| GET | `/api/tts/voices` | `engine=edge|azure|kokoro|piper`、`locale=en` | 指定引擎的聲音清單；`locale=` 空字串代表不過濾 |
| GET | `/api/oikid/booking-records` | — | 以 keychain 帳密取得 `{"Token":"…","Data":[…]}` |

範例：

```bash
curl http://127.0.0.1:8765/api/version
curl http://127.0.0.1:8765/api/models/status

curl -F "file=@sample.pdf" \
  http://127.0.0.1:8765/api/pdf/extract

curl -H "Content-Type: application/json" \
  -d '{"text":"Hello Ollie","speed":1.0,"voice":"af_heart"}' \
  http://127.0.0.1:8765/api/ktts --output speech.wav

curl --get http://127.0.0.1:8765/api/fetch-url \
  --data-urlencode "url=https://example.com/book.pdf" \
  --output book.pdf
```

`/api/fetch-url` 的 `max_redirects` 範圍是 1–30，`timeout` 範圍是 1–120 秒；只接受 `http://` 與 `https://` URL。

## 測試

完整 suite：

```bash
make desktop-test
# 等價：uv run --directory desktop pytest -v
```

只跑特定模組或快速輸出：

```bash
uv run --directory desktop pytest -q
uv run --directory desktop pytest tests/test_app.py -q
uv run --directory desktop pytest tests/test_verify_bundle.py -q
```

測試涵蓋 API contract、CORS/PNA、PDF/URL/OIKID、四種 TTS、模型下載與 checksum、keychain adapter、single instance、PID/sidecar 管理、托盤 UI、版本同步及 bundle 安全掃描。網路服務、真實 keychain、完整模型與 Apple 公證流程皆以 mock 或獨立 release 步驟處理，不屬於一般單元測試。

## 本機 PyInstaller 打包

下列命令從 repository 根目錄執行：

```bash
make desktop-models          # frozen app 不會下載模型，先準備四個模型檔
make desktop-icon            # 由 tray-icon.png 產生 gitignored AppIcon.icns（macOS）
make desktop-package         # incremental build
make desktop-verify          # 掃描 desktop/dist/ollie-reader.app 的機密資料

# 需要排除 PyInstaller cache 影響時
make desktop-package-clean

# 移除 desktop/build 與 desktop/dist
make desktop-clean
```

產物是 `desktop/dist/ollie-reader.app`。spec 的主要行為：

- bundle id：`com.victorfu.ollie-reader`
- `LSUIElement=true`，只顯示托盤 icon，不顯示 Dock icon
- minimum macOS：12.0
- `CFBundleShortVersionString` 與 `CFBundleVersion` 取自 `pyproject.toml`
- 收入 Piper、Kokoro、Edge 與必要的 native/runtime 檔；標準 release 環境不安裝 Azure group，spec 也不主動 collect Azure SDK
- 只收入固定四個模型檔；忽略 `models/` 內其他檔案
- 移除未使用的 Qt QML/Quick/PDF/VirtualKeyboard payload，並只保留 Babel root/英文 locale data

## 簽章、公證與 GitHub Release

release 流程只能在 macOS 執行。官方 arm64 發佈必須使用 arm64 Mac 與 arm64 Python 環境；目前腳本不會替 build host 強制或驗證 target architecture。需要：

- Python 3.11+、`uv`、`make` 與 Xcode Command Line Tools（`codesign`、`security`、`xcrun notarytool`、`stapler`、`hdiutil`、`spctl`、`sips`、`iconutil`）
- Developer ID Application 憑證的 `.p12` 與密碼
- Apple ID、Team ID、app-specific password
- 已認證的 `gh` CLI（只有發佈 GitHub Release 時需要）
- 選用的 `create-dmg`；未安裝或建立失敗時會改用 `hdiutil`

在 repository 根目錄建立已被 gitignore 的 `.env.package`：

```bash
APPLE_ID="developer@example.com"
APPLE_TEAM_ID="ABCDE12345"
APPLE_APP_PASSWORD="xxxx-xxxx-xxxx-xxxx"
APPLE_CERTIFICATE_PASSWORD="p12-password"
APPLE_CERTIFICATE="<base64-encoded Developer ID Application .p12>"
```

不得提交此檔。GitHub 發佈腳本也會確認 `.env.package` 已被 ignore 且未受 git 追蹤。

建立已簽章、公證並 staple 的 DMG：

```bash
make desktop-models
make desktop-dmg
```

`release/package_macos.sh` 依序執行：

1. 從 `pyproject.toml` 讀取版本，產生 icon 並建置 `.app`。
2. 以 `release/verify_bundle.py` 做 denylist 型掃描，阻擋 `.env*`、`.p12/.pfx`、private key、service account JSON 與常見 token 等機密內容。檔名會全量檢查；內容檢查只涵蓋未排除格式、且不超過 1 MiB 的檔案。
3. 移除裁剪 Qt payload 後留下的 dangling symlink。
4. 把 Developer ID 憑證匯入一次性的暫存 keychain，從內到外以 hardened runtime 簽署 Mach-O、主程式與 `.app`；離開時還原原本 keychain search list 並刪除暫存資料。
5. 以 `create-dmg` 或 `hdiutil` 建立並簽署 DMG。
6. 以 `notarytool submit --wait` 等待 Apple 結果；只有 `Accepted` 才繼續 staple、validate 與 Gatekeeper 驗證。失敗時會嘗試輸出 notarization log。
7. 產生 SHA-256 checksum。

產物：

```text
desktop/dist/ollie-reader-<version>.dmg
desktop/dist/ollie-reader-<version>.dmg.sha256
```

發佈到 GitHub Releases：

```bash
make desktop-release
```

`desktop-release` 依賴 `desktop-dmg`，因此會重新完成 build/sign/notarize。`release/release_github.sh` 從 `origin` 推導 GitHub repository，拒絕覆蓋已存在的 `desktop-v<version>` release，並上傳 DMG 與 checksum。

## 現有限制與安全邊界

- 正式 bundle 僅支援 macOS 12.0+ arm64；開機自啟與 release scripts 都是 macOS 專用。build pipeline 不會強制架構，必須由發佈者使用 arm64 host/Python。
- 雖然 runtime 宣告 Python 3.10+，目前 PyInstaller spec 與 release version helper 使用 `tomllib`，打包／發佈需 Python 3.11+。
- 預設正式 bundle 沒有 Azure SDK；spec 未強制 exclude，因此 release 環境也不應安裝 Azure group。Edge 與 Azure 都需要網路，Edge 又依賴非官方、可能變動的服務端點。
- OIKID 需要網路與使用者憑證，也依賴第三方網站目前的登入／回應格式。
- frozen app 不會補下載模型；缺少模型的 bundle 無法使用對應的離線引擎。
- PDF 只做 PyMuPDF 文字層擷取，沒有 OCR；掃描型 PDF 不會自動辨識圖片文字。上傳內容會完整讀入記憶體後再處理。
- `/api/fetch-url` 沒有回應大小上限或 private-network/SSRF 過濾，且會把遠端內容完整讀入記憶體；它只適合由受信任的本機 UI 呼叫、抓取受信任 URL。
- sidecar 沒有 API authentication。安全邊界是 loopback 綁定與 CORS allowlist；CORS 不是非瀏覽器客戶端的授權機制，請勿改成對外網卡監聽。
- release spec 針對英文學習裁剪 Babel 非英文 locale data；非英文 Kokoro 聲音不屬於正式 bundle 的保證範圍。
- `pyproject.toml` 與 `server/config.py` 各保存一份版本；版本測試會防止兩者不同步，但 bump 時仍需同時修改。
