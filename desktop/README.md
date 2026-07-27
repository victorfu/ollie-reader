# ollie-reader desktop（本機 sidecar + PySide6 殼）

以 [uv](https://docs.astral.sh/uv/) 管理 Python 環境與相依套件，相依定義在 `pyproject.toml`。

## 開發

```bash
cd desktop
uv sync                           # 建立 .venv 並安裝相依（含 dev 工具）
# 下載 Piper 模型到 models/en_US-lessac-medium.onnx（見下）

# 只跑 API sidecar
uv run python main.py --serve     # http://127.0.0.1:8765

# 跑 PySide6 托盤殼（內部會自己管理 sidecar 子行程）
uv run python main.py

# 跑測試
uv run pytest -v
```

也可以從 repo 根目錄用 Makefile：`make desktop-setup`、`make desktop-serve`、`make desktop-run`、`make desktop-test`、`make desktop-package`。

## Single instance

- 重複啟動 app 時，第二個實例會喚醒既有實例（打開設定視窗）後直接退出
  （`QLockFile` + `QLocalServer`，鎖檔在暫存目錄 `ollie-reader-shell.lock`）。
- `--serve` 啟動時若 port 上已有活的 sidecar（`/api/version` 驗證），會直接
  exit 0 不搶 port；sidecar 會在暫存目錄寫 `ollie-reader-sidecar-<port>.pid`
  （結束時清除，含 SIGTERM/SIGINT 路徑）。
- 殼啟動時若發現已有 sidecar 在跑（例如開機自啟的），會「收養」它：狀態
  顯示運行中，「停止本機服務」會對該行程送 SIGTERM。

## 打包（PyInstaller）

```bash
make desktop-package
# 產物：dist/ollie-reader.app（macOS .app bundle，托盤 App，不顯示於 Dock）
```

要產生「已簽章 + 公證」的 dmg 並發佈到 GitHub，見「發佈 dmg」一節。

Piper 與 Kokoro 的模型檔都放在 `models/`、由 spec 一起收進 bundle，frozen 後從
`sys._MEIPASS/models/` 載入，**完全離線、不需網路、不需 PyTorch**（Kokoro 走 ONNX Runtime）。

## 模型檔（放在 `desktop/models/`）

| 引擎 | 檔案 | 來源 | env 覆寫 |
|------|------|------|----------|
| Piper | `en_US-lessac-medium.onnx`（+ `.onnx.json`） | Piper releases | `PIPER_MODEL_PATH` |
| Kokoro | `kokoro-v1.0.fp16.onnx` | [kokoro-onnx releases](https://github.com/thewh1teagle/kokoro-onnx/releases/tag/model-files-v1.0) | `KOKORO_MODEL_PATH` |
| Kokoro | `voices-v1.0.bin` | 同上 | `KOKORO_VOICES_PATH` |

Kokoro 還有 `kokoro-v1.0.onnx`（fp32, 310MB）與 `kokoro-v1.0.int8.onnx`（88MB）可選；
換檔後同步調整 `server/config.py` 的 `_KOKORO_MODEL_RELATIVE_PATH`（或用 env）。

## 雲端語音引擎（Edge TTS / Azure AI Speech）

除了上面三個離線引擎，sidecar 另外提供兩個**需要網路**的引擎。兩者端出來的是
**同一批 Azure Neural 聲音**（`en-US-EmmaMultilingualNeural` 等），差別只在怎麼進門：

| 引擎 | 端點 | 金鑰 | 相依 | 特性 |
|------|------|------|------|------|
| Edge TTS | `/api/etts` | 不需要 | `edge-tts`（預設安裝） | 走 Edge「大聲朗讀」的未公開端點。純 Python、無模型檔 |
| Azure AI Speech | `/api/azure-tts` | **需要**，使用者自行輸入 | `uv sync --group azure` | 官方 SDK，支援完整 SSML |

兩個引擎都輸出 **MP3**（`audio/mpeg`），離線那三個是 WAV。

**Edge TTS 用的套件**是 [`rany2/edge-tts`](https://github.com/rany2/edge-tts)（PyPI `edge-tts`，
import 名 `edge_tts`）—— 逆向 Edge「大聲朗讀」的未公開端點，非 Azure 官方 SDK。

**已知脆弱點**：它依賴一個會隨 Edge 改版輪替的 `Sec-MS-GEC` token，過期時服務端回
403。`server/tts_edge.py` 會把 403 轉成「升級 edge-tts 套件」的明確訊息而非靜默失敗。

**授權是 LGPL-3.0**（7.2.8 隨附的 LICENSE：除 `srt_composer.py` 為 MIT 外其餘 LGPLv3）。
弱 copyleft，打包進 MIT 的 .app 沒問題，只要釋出時附上授權聲明與副本即可。
順帶一提，bundle 裡真正是 **GPL-3.0-or-later** 的是 `piper-tts` 與 `phonemizer-fork`，
那是既有狀況，與本引擎無關。

**Azure 金鑰不進 bundle**：金鑰由使用者在設定視窗的「語音測試」頁輸入，存在
OS keychain（`server/tts_secrets.py`，service `ollie-reader-azure-tts`）。
spec 刻意不收 Azure SDK —— 沒有金鑰的 frozen build 會對 `/api/azure-tts` 回 503。

`GET /api/tts/voices?engine=<edge|azure|kokoro|piper>&locale=en`
可列出該引擎的聲音清單（`locale` 留空 = 不過濾）。設定視窗的試聽頁就是用這支。

## 語音測試頁（設定視窗）

`make desktop-run` 開啟托盤 →「開啟設定…」→ **語音測試** 分頁，可以挑引擎、挑聲音、
改語速，直接試聽比較。它走的是 sidecar HTTP，因此測到的就是網頁端會用的同一條路。
Azure 的 key / region 也在這頁輸入。

## 發佈 dmg（簽章 + 公證 + GitHub Release）

需要 repo 根目錄的 `.env.package`（Apple 憑證/帳號,已 gitignore)與 Xcode CLT、
`create-dmg`、已登入的 `gh`。

```bash
make desktop-dmg       # 產生 dist/ollie-reader-<版本>.dmg(已簽章、公證、staple)
make desktop-release   # 把 dmg + .sha256 發佈為 GitHub Release desktop-v<版本>
```

打包前會自動跑安全掃描(`release/verify_bundle.py`),若 `.app` 內含任何
`.env`/憑證/私鑰就中止,確保機密不會進入發佈物。版本號以 `pyproject.toml` 為準。
僅支援 Apple Silicon(arm64)。
