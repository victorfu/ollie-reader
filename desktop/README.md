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

## Chatterbox-Turbo（可選的高品質英文 AI 語音）

Chatterbox-Turbo 是**可選**的重量級 PyTorch-based TTS，英文品質比 Kokoro / Piper
更好，但也更吃算力（CPU/GPU、記憶體、首次載入時間）。它**不會**被預設的
`uv sync` 安裝，也**不會**打包進 release bundle——權重由 chatterbox / Hugging Face
在首次使用時自行下載並快取。沒安裝或機器不支援時，前端會自動降級
（**chatterbox → kokoro → piper**），所以開啟這個引擎不會讓朗讀「壞掉」。

### 安裝（開發／本機）

```bash
cd desktop
uv sync --group chatterbox        # 額外安裝 chatterbox-tts（會拉 torch/torchaudio）
```

預設 `uv sync`（不帶 `--group chatterbox`）不會安裝它，Piper/Kokoro 不受影響。

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
| `CHATTERBOX_DEVICE` | `mps`（Apple Silicon）/ `cuda`（NVIDIA）/ `cpu`；未設定時自動偵測（cuda > mps > cpu） |
| `CHATTERBOX_AUDIO_PROMPT_PATH` | 參考音檔（.wav）路徑，用來做 voice cloning；未設定則用模型內建音色 |
| `CHATTERBOX_DEFAULT_VOICE` | 請求未帶 voice 時的預設 voice / audio-prompt |
| `CHATTERBOX_CFG_WEIGHT` | classifier-free guidance 權重（**品質/語氣**旋鈕；未設定＝預設 `0.5`）。⚠️ `0` 在 chatterbox 0.1.3 會 crash（上游 bug），已被 wrapper 擋掉並改用預設 |
| `CHATTERBOX_TEMPERATURE` | 取樣溫度（未設定＝library 預設 `0.8`） |
| `CHATTERBOX_EXAGGERATION` | 情緒強度（未設定＝library 預設 `0.5`） |

> **關於速度（重要）**：Chatterbox 在 Mac 只能用 MPS（無 CUDA），已是硬體上限。原本設想
> 用 `cfg_weight=0` 跳過 CFG 的雙倍 T3 計算來加速，但**實測 chatterbox-tts 0.1.3 的 t3
> inference 迴圈寫死 batch=2**：`cfg_weight=0` 會 `RuntimeError: Sizes of tensors must
> match...`，而 `cfg_weight>0` 的任何值仍是 batch=2、**不會變快**。所以這個版本**沒有可用
> 的軟體加速槓桿**；上表參數只是品質/語氣旋鈕，wrapper 已把 `cfg_weight<=0` 擋掉避免
> crash（不支援的參數也會依 signature 自動略過）。實務建議：日常朗讀用 Kokoro（即時），需
> 要最佳音質再切 Chatterbox；前端也會 cache 每個（text、語速、engine）的音訊，重複的字第
> 二次起即時。

> voice / audio-prompt 指到不存在的檔案時，sidecar 會回 **400**（而非安靜地退回
> 預設音色），避免你以為套用了 voice clone 但其實沒有。

### 注意

- 首次使用會有**模型載入 / 下載 / 快取**成本，之後才會快。
- 目前 Chatterbox-Turbo 沒有原生語速參數，`speed` 會被接收但忽略（避免 time-stretch
  劣化音質）；語速調整仍可用 Piper / Kokoro。
- 若不可用（未安裝、載入失敗、裝置不支援），`/api/chatterbox-tts` 回 **503**，前端
  依序降級到 Kokoro、Piper。

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
