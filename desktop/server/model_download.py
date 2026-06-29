"""Dev 模式下自動下載 TTS 模型檔（Piper + Kokoro）。

frozen build 會把模型 bundle 進 .app，不走這支；dev 模式 sidecar 啟動時在背景
下載缺少的檔案到 desktop/models/。下載一律重用 server.ssl_compat 的 SSLContext，
避開 Windows 上的 OpenSSL applink crash。
"""

import hashlib
import logging
import os
import sys
import threading
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

import httpx

from server.ssl_compat import create_ssl_context

logger = logging.getLogger(__name__)

_PIPER_BASE = (
    "https://huggingface.co/rhasspy/piper-voices/resolve/main/"
    "en/en_US/lessac/medium"
)
_KOKORO_BASE = (
    "https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0"
)


@dataclass(frozen=True)
class ModelFile:
    filename: str
    url: str
    sha256: str
    size: int


MANIFEST: list[ModelFile] = [
    ModelFile(
        "en_US-lessac-medium.onnx",
        f"{_PIPER_BASE}/en_US-lessac-medium.onnx",
        "5efe09e69902187827af646e1a6e9d269dee769f9877d17b16b1b46eeaaf019f",
        63201294,
    ),
    ModelFile(
        "en_US-lessac-medium.onnx.json",
        f"{_PIPER_BASE}/en_US-lessac-medium.onnx.json",
        "efe19c417bed055f2d69908248c6ba650fa135bc868b0e6abb3da181dab690a0",
        4885,
    ),
    ModelFile(
        "kokoro-v1.0.fp16.onnx",
        f"{_KOKORO_BASE}/kokoro-v1.0.fp16.onnx",
        "c1610a859f3bdea01107e73e50100685af38fff88f5cd8e5c56df109ec880204",
        177464787,
    ),
    ModelFile(
        "voices-v1.0.bin",
        f"{_KOKORO_BASE}/voices-v1.0.bin",
        "bca610b8308e8d99f32e6fe4197e7ec01679264efed0cac9140fe9c29f1fbf7d",
        28214398,
    ),
]


class DownloadStatus:
    """Thread-safe 下載狀態（整體 + per-file 進度）。"""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._state = "idle"  # idle | running | done | failed
        self._files: dict[str, dict] = {}
        self._error: Optional[str] = None

    def set_state(self, state: str) -> None:
        with self._lock:
            self._state = state

    def set_error(self, error: str) -> None:
        with self._lock:
            self._error = error

    def mark_file(self, name: str, state: str, downloaded: int, total: int) -> None:
        with self._lock:
            self._files[name] = {
                "state": state,
                "downloaded": downloaded,
                "total": total,
            }

    def update_progress(self, name: str, downloaded: int) -> None:
        with self._lock:
            if name in self._files:
                self._files[name]["downloaded"] = downloaded

    def is_running(self) -> bool:
        with self._lock:
            return self._state == "running"

    def snapshot(self) -> dict:
        with self._lock:
            return {
                "state": self._state,
                "error": self._error,
                "files": {k: dict(v) for k, v in self._files.items()},
            }
