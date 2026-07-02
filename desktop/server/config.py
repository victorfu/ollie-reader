import os
import sys
from pathlib import Path
from typing import List

VERSION = "0.1.1"
HOST = "127.0.0.1"
DEFAULT_PORT = 8765

_PIPER_MODEL_RELATIVE_PATH = Path("models") / "en_US-lessac-medium.onnx"
_KOKORO_MODEL_RELATIVE_PATH = Path("models") / "kokoro-v1.0.fp16.onnx"
_KOKORO_VOICES_RELATIVE_PATH = Path("models") / "voices-v1.0.bin"


def _resource_root() -> Path:
    if hasattr(sys, "_MEIPASS"):
        return Path(sys._MEIPASS).resolve()
    return Path(__file__).resolve().parents[1]


# Directory holding the TTS model files (bundled when frozen, downloaded in dev).
MODELS_DIR = _resource_root() / "models"


def _default_piper_model_path() -> str:
    return str(_resource_root() / _PIPER_MODEL_RELATIVE_PATH)


_piper_model_path_override = os.getenv("PIPER_MODEL_PATH")
PIPER_MODEL_PATH = (
    _piper_model_path_override
    if _piper_model_path_override is not None
    else _default_piper_model_path()
)

# Kokoro (ONNX) model + voices: bundled under models/, overridable via env.
KOKORO_MODEL_PATH = os.getenv("KOKORO_MODEL_PATH") or str(
    _resource_root() / _KOKORO_MODEL_RELATIVE_PATH
)
KOKORO_VOICES_PATH = os.getenv("KOKORO_VOICES_PATH") or str(
    _resource_root() / _KOKORO_VOICES_RELATIVE_PATH
)
KOKORO_DEFAULT_VOICE = os.getenv("KOKORO_DEFAULT_VOICE", "af_heart")
KOKORO_DEFAULT_LANG = os.getenv("KOKORO_LANG", "en-us")


# Web origins allowed to call the local sidecar:
#  - Vite dev server (localhost:5173)
#  - Production Firebase Hosting domains (the deployed web app reaches the local
#    sidecar at http://127.0.0.1:8765 when in local/auto compute mode).
# Append more via OLLIE_CORS_ORIGINS (comma-separated). Wildcards are rejected.
_DEFAULT_CORS_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "https://ollie-reader.web.app",
    "https://ollie-reader.firebaseapp.com",
]


def _cors_origins() -> List[str]:
    raw = os.getenv("OLLIE_CORS_ORIGINS", "")
    extra = [o.strip() for o in raw.split(",") if o.strip()]
    if any("*" in origin for origin in extra):
        raise ValueError("OLLIE_CORS_ORIGINS 不可使用 wildcard '*'")
    return [*_DEFAULT_CORS_ORIGINS, *extra]


CORS_ORIGINS = _cors_origins()
