# ollie-reader desktop（本機 sidecar + PySide6 殼）

## 開發

```bash
cd desktop
python -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
# 下載 Piper 模型到 models/en_US-lessac-medium.onnx（見下）

# 只跑 API sidecar
python main.py --serve            # http://127.0.0.1:8765

# 跑測試
python -m pytest -v
```

## Piper 模型
從 Piper releases 下載 `en_US-lessac-medium.onnx`（與 `.onnx.json`）放到 `desktop/models/`，
或用環境變數 `PIPER_MODEL_PATH` 指定。
