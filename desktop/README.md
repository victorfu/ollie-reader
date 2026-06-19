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
# 產物：dist/ollie-reader-desktop/ollie-reader-desktop
```

## Piper 模型

從 Piper releases 下載 `en_US-lessac-medium.onnx`（與 `.onnx.json`）放到 `desktop/models/`，
或用環境變數 `PIPER_MODEL_PATH` 指定。
