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
uv run pyinstaller ollie-reader-desktop.spec --noconfirm
# 產物：dist/ollie-reader/ollie-reader
```

打包時 spec 會把本機 HF cache 內的 Kokoro 模型（`hexgrad/Kokoro-82M`：config + 權重 + voices）
一起收進 bundle（`_internal/hf/`），frozen 後自動設 `HF_HOME` 並開 `HF_HUB_OFFLINE=1`，
所以 Kokoro 與 Piper 都能完全離線。前提是打包機器先跑過一次 Kokoro（讓模型進 HF cache）；
若 cache 不存在,spec 會印 warning 並略過,該包的 Kokoro 就需要連網下載。

## Piper 模型

從 Piper releases 下載 `en_US-lessac-medium.onnx`（與 `.onnx.json`）放到 `desktop/models/`，
或用環境變數 `PIPER_MODEL_PATH` 指定。
