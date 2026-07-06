import os
import sys
from pathlib import Path
from typing import List

VERSION = "0.2.0"
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

def _optional_float(name: str):
    """Parse an optional float env var; unset/blank/malformed → None (use library default)."""
    raw = os.getenv(name)
    if raw is None or raw.strip() == "":
        return None
    try:
        return float(raw)
    except ValueError:
        return None


# Chatterbox (optional). Two interchangeable backends behind the same endpoint;
# no bundled weights — loaded lazily and cached by Hugging Face on first use.
# All settings are env-only.
#  - CHATTERBOX_BACKEND: "mlx" | "torch"; unset → auto (mlx if mlx-audio is
#    installed, else torch). Install exactly one of the uv groups
#    `chatterbox-mlx` (Apple Silicon, faster) or `chatterbox` (PyTorch).
#  - CHATTERBOX_MLX_MODEL: HF repo for the MLX weights. Default is the
#    English-only Chatterbox-Turbo (ships conds.safetensors = built-in voice,
#    no cloning needed). Do NOT use mlx-community/chatterbox-fp16 for English:
#    that's the 23-language multilingual model and its English sounds worse.
#  - CHATTERBOX_DEVICE: torch backend only: "cuda" | "mps" | "cpu"; unset →
#    auto (cuda > mps > cpu).
#  - CHATTERBOX_AUDIO_PROMPT_PATH: reference wav for voice cloning (optional).
#  - CHATTERBOX_DEFAULT_VOICE: default voice/audio-prompt when request omits one.
CHATTERBOX_BACKEND = os.getenv("CHATTERBOX_BACKEND")
CHATTERBOX_MLX_MODEL = os.getenv(
    "CHATTERBOX_MLX_MODEL", "mlx-community/chatterbox-turbo-fp16"
)
CHATTERBOX_DEVICE = os.getenv("CHATTERBOX_DEVICE")
CHATTERBOX_AUDIO_PROMPT_PATH = os.getenv("CHATTERBOX_AUDIO_PROMPT_PATH")
CHATTERBOX_DEFAULT_VOICE = os.getenv("CHATTERBOX_DEFAULT_VOICE")

# Generation-QUALITY knobs (all optional; None → chatterbox library default).
# NOT a speed lever: cfg_weight=0 would skip CFG's doubled T3 batch (~halve
# compute), but chatterbox-tts 0.1.3's t3 inference loop hardcodes batch=2, so
# cfg_weight=0 crashes with a tensor shape mismatch, and any cfg_weight>0 still
# runs batch=2 (no speedup). The wrapper guards cfg_weight<=0. Unsupported knobs
# are filtered per model signature, so these stay safe across chatterbox variants.
CHATTERBOX_CFG_WEIGHT = _optional_float("CHATTERBOX_CFG_WEIGHT")
CHATTERBOX_TEMPERATURE = _optional_float("CHATTERBOX_TEMPERATURE")
CHATTERBOX_EXAGGERATION = _optional_float("CHATTERBOX_EXAGGERATION")


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
