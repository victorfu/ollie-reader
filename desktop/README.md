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

`GET /api/tts/voices?engine=<edge|azure|kokoro|piper|chatterbox>&locale=en`
可列出該引擎的聲音清單（`locale` 留空 = 不過濾）。設定視窗的試聽頁就是用這支。

## 語音測試頁（設定視窗）

`make desktop-run` 開啟托盤 →「開啟設定…」→ **語音測試** 分頁，可以挑引擎、挑聲音、
改語速，直接試聽比較。它走的是 sidecar HTTP，因此測到的就是網頁端會用的同一條路。
Azure 的 key / region 也在這頁輸入。

## Chatterbox-Turbo（可選的高品質英文 AI 語音）

Chatterbox 是重量級 TTS，英文品質比 Kokoro / Piper 更好，但也更吃算力
（記憶體、首次載入時間）。開發環境它**不會**被預設的 `uv sync` 安裝（要帶
group，見下）；release bundle 自 **v0.2.0** 起**內建 MLX 後端**（torch 後端
仍不打包）。權重一律由 Hugging Face 在首次使用時自行下載並快取，不進 bundle。
沒安裝或機器不支援時後端回 **503**——前端**不會**自動改用其他引擎（已無
fallback），會直接顯示錯誤，請確認已啟用對應引擎。

同一個 `/api/chatterbox-tts` endpoint 底下有**兩個可互換的後端**（uv group 互斥，
一個 venv 只能裝一個；未設定 `CHATTERBOX_BACKEND` 時自動偵測——裝了哪個用哪個）：

| 後端 | uv group | 說明 |
|------|----------|------|
| **MLX**（Apple Silicon 建議） | `chatterbox-mlx` | mlx-audio，Metal 原生、安裝輕量（不拉 torch）、可換量化權重 |
| PyTorch | `chatterbox` | chatterbox-tts + torch/torchaudio（MPS/CUDA/CPU） |

### 安裝（開發／本機）

```bash
cd desktop
uv sync --group chatterbox-mlx    # MLX 後端（Apple Silicon 建議）
# 或
uv sync --group chatterbox        # PyTorch 後端（會拉 torch/torchaudio）
```

預設 `uv sync`（不帶 group）兩者都不裝，Piper/Kokoro 不受影響。兩個 group 已在
`pyproject.toml` 宣告互斥（transformers 版本相依不相容），同時指定會被 uv 拒絕。

> **關於 `pkuseg` 的 build 相依**：`chatterbox-tts` 會拉一個老套件 `pkuseg==0.0.25`，
> 它在 arm64 / Python 3.12 沒有預編 wheel，必須從 sdist 編譯；而它的 `setup.py`
> 用了 numpy 卻沒宣告成 build 相依，PEP 517 build isolation 下會出現
> `No module named 'numpy'`。`pyproject.toml` 已用
> `[tool.uv.extra-build-dependencies] pkuseg = ["numpy"]` 把 numpy 注入它的 build
> 環境解決這件事，所以 `uv sync --group chatterbox` 可直接成功。sync 時 uv 會提示
> `extra-build-dependencies` 為 experimental —— 屬正常，可忽略。（這只影響
> chatterbox group 的 build；預設 `uv sync` 完全不會碰到 `pkuseg`。）

### 啟動

```bash
uv run python main.py --serve     # sidecar，含 /api/chatterbox-tts endpoint
```

在網頁 **設定 → 語音 → AI 語音** 選 **Chatterbox Turbo** 即可使用。

### 可選環境變數

| env | 說明 |
|-----|------|
| `CHATTERBOX_BACKEND` | `mlx` / `torch`；未設定＝自動（裝了 mlx-audio 就用 MLX，否則 PyTorch） |
| `CHATTERBOX_MLX_MODEL` | MLX 後端的 HF 權重 repo（預設 `mlx-community/chatterbox-turbo-fp16`，英文專用 Turbo）。可換量化版加速，如 `chatterbox-turbo-4bit` / `chatterbox-turbo-8bit`（都含內建音色）。⚠️ 英文引擎**不要**用 `chatterbox-fp16`——那是 23 語 multilingual 權重，英文發音明顯較差 |
| `CHATTERBOX_DEVICE` | **torch 後端限定**：`mps` / `cuda` / `cpu`；未設定時自動偵測（cuda > mps > cpu） |
| `CHATTERBOX_AUDIO_PROMPT_PATH` | 參考音檔（.wav）路徑，用來做 voice cloning；未設定則用模型內建音色 |
| `CHATTERBOX_DEFAULT_VOICE` | 請求未帶 voice 時的預設 voice / audio-prompt |
| `CHATTERBOX_CFG_WEIGHT` | classifier-free guidance 權重（**品質/語氣**旋鈕；未設定＝預設 `0.5`）。⚠️ `0` 在 chatterbox 0.1.3 會 crash（上游 bug），已被 wrapper 擋掉並改用預設 |
| `CHATTERBOX_TEMPERATURE` | 取樣溫度（未設定＝library 預設 `0.8`） |
| `CHATTERBOX_EXAGGERATION` | 情緒強度（未設定＝library 預設 `0.5`） |

> **關於速度**：Mac 上的軟體加速槓桿是 **MLX 後端**（Metal 原生、fp16，還可經
> `CHATTERBOX_MLX_MODEL` 換 4/8-bit 量化權重進一步減少記憶體頻寬）。torch 後端在
> Mac 只能用 MPS 且 fp32，**沒有**可用的軟體加速槓桿：原本設想用 `cfg_weight=0` 跳過
> CFG 的雙倍 T3 計算，但實測 chatterbox-tts 0.1.3 的 t3 inference 迴圈寫死 batch=2，
> `cfg_weight=0` 會 crash（上游 bug），`cfg_weight>0` 任何值也不會變快；上表參數只是
> 品質/語氣旋鈕，wrapper 已把 `cfg_weight<=0` 擋掉。兩個後端都有 voice-prompt
> conditionals 快取（同一參考音檔只算一次）。實務建議：日常朗讀用 Kokoro（即時），需
> 要最佳音質再切 Chatterbox；前端也會 cache 每個（text、語速、engine）的音訊，重複的
> 字第二次起即時。

> voice / audio-prompt 指到不存在的檔案時，sidecar 會回 **400**（而非安靜地退回
> 預設音色），避免你以為套用了 voice clone 但其實沒有。

> **發音一致性（MLX 後端）**：Chatterbox 是隨機取樣的生成模型，不固定種子的話
> 同一個字在不同機器可能唸法不同（例如 *comb*）。MLX 後端以（文字, voice
> prompt）的 hash 當 RNG 種子——同樣輸入在任何機器、任何時間都輸出**完全相同**
> 的語音。想要更保守的取樣可另設 `CHATTERBOX_TEMPERATURE`（如 `0.5`）。

### 注意

- 首次使用會有**模型載入 / 下載 / 快取**成本，之後才會快。
- 目前 Chatterbox-Turbo 沒有原生語速參數，`speed` 會被接收但忽略（避免 time-stretch
  劣化音質）；語速調整仍可用 Piper / Kokoro。
- 若不可用（未安裝、載入失敗、裝置不支援），`/api/chatterbox-tts` 回 **503**；前端
  不會自動改用其他引擎，會直接顯示錯誤。

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
