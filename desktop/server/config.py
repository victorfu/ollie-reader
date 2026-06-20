import os
import sys
from pathlib import Path
from typing import List

VERSION = "0.1.0"
HOST = "127.0.0.1"
DEFAULT_PORT = 8765

_PIPER_MODEL_RELATIVE_PATH = Path("models") / "en_US-lessac-medium.onnx"


def _resource_root() -> Path:
    if hasattr(sys, "_MEIPASS"):
        return Path(sys._MEIPASS).resolve()
    return Path(__file__).resolve().parents[1]


def _configure_bundled_hf_cache() -> None:
    """When frozen, point Hugging Face Hub at the bundled offline cache.

    Kokoro loads its config/weights/voices via huggingface_hub.hf_hub_download,
    which respects HF_HOME/HF_HUB_CACHE/HF_HUB_OFFLINE. The PyInstaller bundle
    ships the cache under <_MEIPASS>/hf, so the desktop app needs no network.
    Must run before huggingface_hub is imported (Kokoro import is lazy, so this
    module-level call is early enough).
    """
    if not hasattr(sys, "_MEIPASS"):
        return
    bundled_hf = _resource_root() / "hf"
    if not (bundled_hf / "hub").exists():
        return
    os.environ.setdefault("HF_HOME", str(bundled_hf))
    os.environ.setdefault("HF_HUB_CACHE", str(bundled_hf / "hub"))
    os.environ.setdefault("HF_HUB_OFFLINE", "1")


_configure_bundled_hf_cache()


def _default_piper_model_path() -> str:
    return str(_resource_root() / _PIPER_MODEL_RELATIVE_PATH)


_piper_model_path_override = os.getenv("PIPER_MODEL_PATH")
PIPER_MODEL_PATH = (
    _piper_model_path_override
    if _piper_model_path_override is not None
    else _default_piper_model_path()
)
KOKORO_LANG = os.getenv("KOKORO_LANG", "a")
KOKORO_DEFAULT_VOICE = os.getenv("KOKORO_DEFAULT_VOICE", "af_heart")
# Repo backing the bundled offline cache; passing it to KPipeline also silences
# kokoro's "Defaulting repo_id" warning.
KOKORO_REPO_ID = os.getenv("KOKORO_REPO_ID", "hexgrad/Kokoro-82M")


def _cors_origins() -> List[str]:
    raw = os.getenv("OLLIE_CORS_ORIGINS", "")
    extra = [o.strip() for o in raw.split(",") if o.strip()]
    if any("*" in origin for origin in extra):
        raise ValueError("OLLIE_CORS_ORIGINS 不可使用 wildcard '*'")
    return ["http://localhost:5173", "http://127.0.0.1:5173", *extra]


CORS_ORIGINS = _cors_origins()
