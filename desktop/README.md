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
