import os
from typing import List

VERSION = "0.1.0"
HOST = "127.0.0.1"
DEFAULT_PORT = 8765

PIPER_MODEL_PATH = os.getenv("PIPER_MODEL_PATH", "models/en_US-lessac-medium.onnx")
KOKORO_LANG = os.getenv("KOKORO_LANG", "a")
KOKORO_DEFAULT_VOICE = os.getenv("KOKORO_DEFAULT_VOICE", "af_heart")


def _cors_origins() -> List[str]:
    raw = os.getenv("OLLIE_CORS_ORIGINS", "")
    extra = [o.strip() for o in raw.split(",") if o.strip()]
    if any("*" in origin for origin in extra):
        raise ValueError("OLLIE_CORS_ORIGINS 不可使用 wildcard '*'")
    return ["http://localhost:5173", "http://127.0.0.1:5173", *extra]


CORS_ORIGINS = _cors_origins()
