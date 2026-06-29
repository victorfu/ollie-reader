# Desktop dev-mode TTS Model Auto-Download — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** In dev mode, the desktop sidecar auto-downloads missing Piper/Kokoro TTS model files into `desktop/models/` on startup, in the background, without blocking the server.

**Architecture:** A new `server/model_download.py` holds a pinned manifest (filename, URL, sha256, size), a thread-safe status object, and download logic (stream → `.part` → verify sha256 → atomic rename). FastAPI's lifespan kicks off a background daemon thread when `not frozen`. TTS endpoints return a clear 503 while the model they need is still downloading; `GET /api/models/status` exposes progress.

**Tech Stack:** Python 3.12, FastAPI, httpx (reusing `server.ssl_compat.create_ssl_context` for the Windows OpenSSL fix), pytest. Run everything from `desktop/` via `uv run`.

**Working directory for all commands:** `desktop/` (i.e. `cd /d/Documents/ollie-reader/desktop`).

---

## File Structure

- **Create** `desktop/server/model_download.py` — manifest, `ModelFile`, `DownloadStatus`, `_verify`, `_download_one`, `ensure_models`, `should_auto_download`, `start_background_download`, module singletons (`STATUS`, `is_downloading`, `get_status`), and a `__main__` CLI.
- **Modify** `desktop/server/config.py` — add `MODELS_DIR` constant.
- **Modify** `desktop/server/app.py` — lifespan startup trigger, 503-while-downloading checks in `/api/tts` and `/api/ktts`, new `GET /api/models/status`.
- **Create** `desktop/tests/test_model_download.py` — unit tests (all mocked, no real network).
- **Modify** `Makefile` (repo root) — add `desktop-models` target.

Pinned manifest values (verified 2026-06-29):

| filename | size (bytes) | sha256 |
|---|---|---|
| `en_US-lessac-medium.onnx` | 63201294 | `5efe09e69902187827af646e1a6e9d269dee769f9877d17b16b1b46eeaaf019f` |
| `en_US-lessac-medium.onnx.json` | 4885 | `efe19c417bed055f2d69908248c6ba650fa135bc868b0e6abb3da181dab690a0` |
| `kokoro-v1.0.fp16.onnx` | 177464787 | `c1610a859f3bdea01107e73e50100685af38fff88f5cd8e5c56df109ec880204` |
| `voices-v1.0.bin` | 28214398 | `bca610b8308e8d99f32e6fe4197e7ec01679264efed0cac9140fe9c29f1fbf7d` |

URLs:
- `https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/medium/en_US-lessac-medium.onnx`
- `https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/medium/en_US-lessac-medium.onnx.json`
- `https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/kokoro-v1.0.fp16.onnx`
- `https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/voices-v1.0.bin`

---

## Task 1: Add `MODELS_DIR` to config

**Files:**
- Modify: `desktop/server/config.py`

- [ ] **Step 1: Add the constant**

In `desktop/server/config.py`, immediately after the `_resource_root()` function definition (it returns `Path(__file__).resolve().parents[1]` in dev, `sys._MEIPASS` when frozen), add:

```python
# Directory holding the TTS model files (bundled when frozen, downloaded in dev).
MODELS_DIR = _resource_root() / "models"
```

- [ ] **Step 2: Verify it imports**

Run: `uv run python -c "from server.config import MODELS_DIR; print(MODELS_DIR)"`
Expected: prints a path ending in `desktop\models` (or `/models`), no error.

- [ ] **Step 3: Commit**

```bash
git add server/config.py
git commit -m "feat(desktop): add MODELS_DIR config constant"
```

---

## Task 2: Manifest + `DownloadStatus`

**Files:**
- Create: `desktop/server/model_download.py`
- Test: `desktop/tests/test_model_download.py`

- [ ] **Step 1: Write the failing test**

Create `desktop/tests/test_model_download.py`:

```python
import hashlib

import pytest

import server  # noqa: F401  确保 server 套件可 import
from server import model_download as md


def test_manifest_has_four_files():
    names = {m.filename for m in md.MANIFEST}
    assert names == {
        "en_US-lessac-medium.onnx",
        "en_US-lessac-medium.onnx.json",
        "kokoro-v1.0.fp16.onnx",
        "voices-v1.0.bin",
    }
    for m in md.MANIFEST:
        assert m.url.startswith("https://")
        assert len(m.sha256) == 64
        assert m.size > 0


def test_status_transitions():
    s = md.DownloadStatus()
    assert s.snapshot()["state"] == "idle"
    assert s.is_running() is False

    s.set_state("running")
    assert s.is_running() is True
    assert s.snapshot()["state"] == "running"

    s.mark_file("a.onnx", "running", 5, 10)
    snap = s.snapshot()
    assert snap["files"]["a.onnx"] == {"state": "running", "downloaded": 5, "total": 10}

    s.update_progress("a.onnx", 8)
    assert s.snapshot()["files"]["a.onnx"]["downloaded"] == 8

    s.set_error("boom")
    s.set_state("failed")
    snap = s.snapshot()
    assert snap["state"] == "failed"
    assert snap["error"] == "boom"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run pytest tests/test_model_download.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'server.model_download'`.

- [ ] **Step 3: Write minimal implementation**

Create `desktop/server/model_download.py`:

```python
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `uv run pytest tests/test_model_download.py -v`
Expected: both tests PASS.

- [ ] **Step 5: Commit**

```bash
git add server/model_download.py tests/test_model_download.py
git commit -m "feat(desktop): model-download manifest and status object"
```

---

## Task 3: Download one file (skip / download / bad checksum)

**Files:**
- Modify: `desktop/server/model_download.py`
- Test: `desktop/tests/test_model_download.py`

- [ ] **Step 1: Write the failing tests**

Append to `desktop/tests/test_model_download.py`:

```python
class _FakeStream:
    """模擬 httpx.stream(...) 的 context manager。"""

    def __init__(self, data: bytes):
        self._data = data

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False

    def raise_for_status(self):
        return None

    def iter_bytes(self, chunk_size: int = 65536):
        # 切成兩塊，確保進度累加路徑被走到
        mid = max(1, len(self._data) // 2)
        yield self._data[:mid]
        yield self._data[mid:]


def _model(tmp_name: str, data: bytes) -> "md.ModelFile":
    return md.ModelFile(
        filename=tmp_name,
        url="https://example.test/x",
        sha256=hashlib.sha256(data).hexdigest(),
        size=len(data),
    )


def test_skips_existing_valid_file(tmp_path, monkeypatch):
    data = b"hello-model"
    mf = _model("a.onnx", data)
    (tmp_path / "a.onnx").write_bytes(data)

    def boom(*a, **k):
        raise AssertionError("不應該下載已存在且正確的檔案")

    monkeypatch.setattr(md.httpx, "stream", boom)
    st = md.DownloadStatus()
    md._download_one(mf, tmp_path, st)
    assert st.snapshot()["files"]["a.onnx"]["state"] == "done"


def test_downloads_missing_file(tmp_path, monkeypatch):
    data = b"x" * 5000
    mf = _model("b.bin", data)
    monkeypatch.setattr(md.httpx, "stream", lambda *a, **k: _FakeStream(data))

    st = md.DownloadStatus()
    md._download_one(mf, tmp_path, st)

    assert (tmp_path / "b.bin").read_bytes() == data
    assert not (tmp_path / "b.bin.part").exists()
    assert st.snapshot()["files"]["b.bin"]["state"] == "done"


def test_bad_checksum_discards_part(tmp_path, monkeypatch):
    data = b"real-bytes"
    mf = md.ModelFile("c.onnx", "https://example.test/x", "0" * 64, len(data))
    monkeypatch.setattr(md.httpx, "stream", lambda *a, **k: _FakeStream(data))

    st = md.DownloadStatus()
    with pytest.raises(ValueError):
        md._download_one(mf, tmp_path, st)

    assert not (tmp_path / "c.onnx").exists()
    assert not (tmp_path / "c.onnx.part").exists()
    assert st.snapshot()["files"]["c.onnx"]["state"] == "failed"
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `uv run pytest tests/test_model_download.py -v -k "skips or downloads or bad_checksum"`
Expected: FAIL with `AttributeError: module 'server.model_download' has no attribute '_download_one'`.

- [ ] **Step 3: Write minimal implementation**

Append to `desktop/server/model_download.py`:

```python
_CHUNK = 1024 * 1024
_LOG_EVERY = 10 * 1024 * 1024


def _verify(path: Path, expected_sha256: str) -> bool:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(_CHUNK), b""):
            h.update(chunk)
    return h.hexdigest() == expected_sha256


def _download_one(mf: ModelFile, models_dir: Path, status: DownloadStatus) -> None:
    final = models_dir / mf.filename
    if final.exists() and _verify(final, mf.sha256):
        status.mark_file(mf.filename, "done", mf.size, mf.size)
        return

    models_dir.mkdir(parents=True, exist_ok=True)
    part = models_dir / (mf.filename + ".part")
    status.mark_file(mf.filename, "running", 0, mf.size)

    h = hashlib.sha256()
    downloaded = 0
    next_log = _LOG_EVERY
    with httpx.stream(
        "GET",
        mf.url,
        follow_redirects=True,
        timeout=60.0,
        verify=create_ssl_context(),
    ) as resp:
        resp.raise_for_status()
        with open(part, "wb") as f:
            for chunk in resp.iter_bytes(chunk_size=_CHUNK):
                f.write(chunk)
                h.update(chunk)
                downloaded += len(chunk)
                status.update_progress(mf.filename, downloaded)
                if downloaded >= next_log:
                    logger.info(
                        "下載 %s: %d/%d MB",
                        mf.filename,
                        downloaded // (1024 * 1024),
                        mf.size // (1024 * 1024),
                    )
                    next_log += _LOG_EVERY

    if h.hexdigest() != mf.sha256:
        part.unlink(missing_ok=True)
        status.mark_file(mf.filename, "failed", downloaded, mf.size)
        raise ValueError(f"sha256 不符: {mf.filename}")

    os.replace(part, final)
    status.mark_file(mf.filename, "done", mf.size, mf.size)
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `uv run pytest tests/test_model_download.py -v`
Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add server/model_download.py tests/test_model_download.py
git commit -m "feat(desktop): download one model file with sha256 verify and atomic rename"
```

---

## Task 4: `ensure_models`, `should_auto_download`, background thread

**Files:**
- Modify: `desktop/server/model_download.py`
- Test: `desktop/tests/test_model_download.py`

- [ ] **Step 1: Write the failing tests**

Append to `desktop/tests/test_model_download.py`:

```python
def test_ensure_models_continues_after_one_failure(tmp_path, monkeypatch):
    good = b"good-data"
    bad = b"bad-data"
    manifest = [
        md.ModelFile("g.bin", "https://e/g", hashlib.sha256(good).hexdigest(), len(good)),
        md.ModelFile("b.bin", "https://e/b", "0" * 64, len(bad)),
    ]
    monkeypatch.setattr(md, "MANIFEST", manifest)

    def fake_stream(method, url, **k):
        return _FakeStream(good if url.endswith("/g") else bad)

    monkeypatch.setattr(md.httpx, "stream", fake_stream)

    st = md.DownloadStatus()
    md.ensure_models(tmp_path, st)

    assert (tmp_path / "g.bin").exists()          # 好的有下成功
    assert not (tmp_path / "b.bin").exists()       # 壞的被丟棄
    snap = st.snapshot()
    assert snap["state"] == "failed"               # 整體標記 failed
    assert snap["files"]["g.bin"]["state"] == "done"
    assert snap["files"]["b.bin"]["state"] == "failed"


def test_ensure_models_all_ok(tmp_path, monkeypatch):
    data = b"ok"
    manifest = [md.ModelFile("o.bin", "https://e/o", hashlib.sha256(data).hexdigest(), len(data))]
    monkeypatch.setattr(md, "MANIFEST", manifest)
    monkeypatch.setattr(md.httpx, "stream", lambda *a, **k: _FakeStream(data))

    st = md.DownloadStatus()
    md.ensure_models(tmp_path, st)
    assert st.snapshot()["state"] == "done"


def test_should_auto_download_respects_frozen(monkeypatch):
    monkeypatch.setattr(md.sys, "frozen", False, raising=False)
    assert md.should_auto_download() is True
    monkeypatch.setattr(md.sys, "frozen", True, raising=False)
    assert md.should_auto_download() is False


def test_start_background_download_is_reentrant(tmp_path, monkeypatch):
    started = []
    release = threading.Event()

    def blocking_ensure(models_dir, status=None):
        started.append(1)
        release.wait(timeout=5)

    monkeypatch.setattr(md, "ensure_models", blocking_ensure)
    monkeypatch.setattr(md, "_thread", None, raising=False)

    md.start_background_download(tmp_path)
    md.start_background_download(tmp_path)  # 第二次應被 lock 擋掉
    release.set()
    md._thread.join(timeout=5)

    assert len(started) == 1
```

Add `import threading` is already at top of test? No — add it. At the top of `tests/test_model_download.py`, ensure `import threading` is present (add it next to `import hashlib`).

- [ ] **Step 2: Run tests to verify they fail**

Run: `uv run pytest tests/test_model_download.py -v -k "ensure or should_auto or reentrant"`
Expected: FAIL with `AttributeError: ... has no attribute 'ensure_models'`.

- [ ] **Step 3: Write minimal implementation**

Append to `desktop/server/model_download.py`:

```python
def ensure_models(models_dir: Path, status: Optional["DownloadStatus"] = None) -> None:
    status = status or STATUS
    status.set_state("running")
    any_failed = False
    for mf in MANIFEST:
        try:
            _download_one(mf, Path(models_dir), status)
        except Exception as e:  # 單檔失敗不影響其他檔
            any_failed = True
            logger.exception("模型下載失敗: %s", mf.filename)
            status.set_error(f"{mf.filename}: {e}")
    status.set_state("failed" if any_failed else "done")


def should_auto_download() -> bool:
    return not getattr(sys, "frozen", False)


_thread_lock = threading.Lock()
_thread: Optional[threading.Thread] = None


def start_background_download(models_dir: Path) -> None:
    global _thread
    with _thread_lock:
        if _thread is not None and _thread.is_alive():
            return
        _thread = threading.Thread(
            target=ensure_models,
            args=(models_dir,),
            daemon=True,
            name="model-download",
        )
        _thread.start()


STATUS = DownloadStatus()


def is_downloading() -> bool:
    return STATUS.is_running()


def get_status() -> dict:
    return STATUS.snapshot()
```

Note: `STATUS` is referenced by `ensure_models`'s default arg at call time (not def time), so defining it after `ensure_models` is fine.

- [ ] **Step 4: Run tests to verify they pass**

Run: `uv run pytest tests/test_model_download.py -v`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add server/model_download.py tests/test_model_download.py
git commit -m "feat(desktop): ensure_models, frozen gate, and background download thread"
```

---

## Task 5: CLI entry point + Makefile target

**Files:**
- Modify: `desktop/server/model_download.py`
- Modify: `Makefile` (repo root)

- [ ] **Step 1: Add the CLI**

Append to `desktop/server/model_download.py`:

```python
def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    from server.config import MODELS_DIR

    logger.info("下載 TTS 模型到 %s …", MODELS_DIR)
    ensure_models(MODELS_DIR)
    snap = STATUS.snapshot()
    if snap["state"] != "done":
        logger.error("部分模型下載失敗: %s", snap["error"])
        raise SystemExit(1)
    logger.info("完成。")


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Add the Makefile target**

Open the repo-root `Makefile`. Find an existing `desktop-*` target (e.g. `desktop-setup` or `desktop-serve`) to copy the style/`.PHONY` convention. Add, next to the other `desktop-*` targets:

```make
desktop-models: ## 下載 dev 用的 TTS 模型檔到 desktop/models/
	cd desktop && uv run python -m server.model_download
```

If the file lists targets in `.PHONY`, add `desktop-models` there too (match the existing pattern exactly — only do this if `.PHONY` is already used for the other desktop targets).

- [ ] **Step 3: Verify the CLI is wired (no real download)**

Run: `uv run python -c "from server.model_download import main; print(callable(main))"`
Expected: prints `True`.

Run: `make -n desktop-models` (from repo root) — dry-run shows the command.
Expected: prints `cd desktop && uv run python -m server.model_download` (no execution).

- [ ] **Step 4: Commit**

```bash
git add server/model_download.py ../Makefile
git commit -m "feat(desktop): model-download CLI and 'make desktop-models' target"
```

(Note: `../Makefile` because commands run from `desktop/`. If git complains about the path, run `git add Makefile server/model_download.py` from the repo root instead.)

---

## Task 6: Wire into `server/app.py` (lifespan, 503, status endpoint)

**Files:**
- Modify: `desktop/server/app.py`
- Test: `desktop/tests/test_app_model_download.py`

- [ ] **Step 1: Write the failing test**

Create `desktop/tests/test_app_model_download.py`:

```python
import server  # noqa: F401
from fastapi.testclient import TestClient

from server import app as app_module
from server import model_download as md


def test_lifespan_triggers_download_when_not_frozen(monkeypatch):
    called = {}
    monkeypatch.setattr(md, "should_auto_download", lambda: True)
    monkeypatch.setattr(
        md, "start_background_download", lambda d: called.setdefault("dir", d)
    )
    app = app_module.create_app()
    with TestClient(app):  # 進出 context 觸發 lifespan
        pass
    assert "dir" in called


def test_lifespan_skips_download_when_frozen(monkeypatch):
    called = {}
    monkeypatch.setattr(md, "should_auto_download", lambda: False)
    monkeypatch.setattr(
        md, "start_background_download", lambda d: called.setdefault("dir", d)
    )
    app = app_module.create_app()
    with TestClient(app):
        pass
    assert "dir" not in called


def test_status_endpoint(monkeypatch):
    monkeypatch.setattr(md, "should_auto_download", lambda: False)
    app = app_module.create_app()
    with TestClient(app) as client:
        r = client.get("/api/models/status")
    assert r.status_code == 200
    assert "state" in r.json()


def test_tts_returns_503_while_downloading(monkeypatch, tmp_path):
    monkeypatch.setattr(md, "should_auto_download", lambda: False)
    monkeypatch.setattr(app_module, "MODELS_DIR", tmp_path)  # 空目錄 → 模型不存在
    monkeypatch.setattr(md, "is_downloading", lambda: True)

    app = app_module.create_app()
    with TestClient(app) as client:
        r = client.post("/api/tts", json={"text": "hi", "speed": 1.0, "voice": "0"})
    assert r.status_code == 503
    assert "下載" in r.json()["detail"]
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run pytest tests/test_app_model_download.py -v`
Expected: FAIL (no `/api/models/status` route → 404; lifespan tests fail because `start_background_download` not called).

- [ ] **Step 3: Modify `server/app.py`**

At the top of `desktop/server/app.py`, update imports — add `sys` and `asynccontextmanager`, import `MODELS_DIR`, and import the module:

```python
import io
import logging
import sys
from contextlib import asynccontextmanager

from fastapi import FastAPI, File, HTTPException, Query, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response, StreamingResponse

from server.config import CORS_ORIGINS, MODELS_DIR, VERSION
from server import model_download
from server.fetch_url import FetchError, fetch_url_content_async
from server.oikid import OikidError, search_booking_records
from server.models import SpeechRequest
from server.pdf_extract import PDFError, extract_text_from_pdf
from server.tts_kokoro import KokoroTTSError, kokoro_synthesize_speech
from server.tts_piper import TTSError, generate_speech
```

Just above `def create_app()`, add the lifespan:

```python
@asynccontextmanager
async def _lifespan(app: FastAPI):
    # Dev 模式：背景下載缺少的 TTS 模型，不阻塞啟動。frozen build 已 bundle，跳過。
    if model_download.should_auto_download():
        model_download.start_background_download(MODELS_DIR)
    yield
```

Change the `FastAPI(...)` constructor to pass the lifespan:

```python
    app = FastAPI(
        title="ollie-reader local sidecar",
        version=VERSION,
        lifespan=_lifespan,
    )
```

In `/api/tts`, add this as the FIRST statement inside the function (before computing `length_scale`):

```python
        if model_download.is_downloading() and not (
            MODELS_DIR / "en_US-lessac-medium.onnx"
        ).exists():
            raise HTTPException(status_code=503, detail="模型下載中，請稍候")
```

In `/api/ktts`, add this as the FIRST statement inside the function (before the `try`):

```python
        _kokoro_needed = (
            MODELS_DIR / "kokoro-v1.0.fp16.onnx",
            MODELS_DIR / "voices-v1.0.bin",
        )
        if model_download.is_downloading() and not all(
            p.exists() for p in _kokoro_needed
        ):
            raise HTTPException(status_code=503, detail="模型下載中，請稍候")
```

Add the status route just after the `/api/version` route:

```python
    @app.get("/api/models/status", tags=["meta"])
    async def models_status():
        return model_download.get_status()
```

- [ ] **Step 4: Run test to verify it passes**

Run: `uv run pytest tests/test_app_model_download.py -v`
Expected: all PASS.

- [ ] **Step 5: Run the full suite (no regressions)**

Run: `uv run pytest -q`
Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add server/app.py tests/test_app_model_download.py
git commit -m "feat(desktop): trigger model download on startup, 503 while downloading, status endpoint"
```

---

## Task 7: End-to-end manual verification

**Files:** none (verification only)

- [ ] **Step 1: Download the models for real**

Run from repo root: `make desktop-models`
Expected: progress logs; ends with `完成。`. Then `desktop/models/` contains all 4 files.

Verify: `uv run python -c "from server.config import MODELS_DIR; import os; print(sorted(os.listdir(MODELS_DIR)))"`
Expected: `['en_US-lessac-medium.onnx', 'en_US-lessac-medium.onnx.json', 'kokoro-v1.0.fp16.onnx', 'voices-v1.0.bin']`.

- [ ] **Step 2: Confirm idempotency (second run skips)**

Run: `make desktop-models` again.
Expected: finishes quickly, `完成。`, no re-download (files pass sha256 and are skipped).

- [ ] **Step 3: Start the sidecar and hit the endpoints**

Run (background): `uv run python main.py --serve --port 8765`
Then in another shell:
- `curl -s http://127.0.0.1:8765/api/models/status` → JSON with `"state": "done"` (models already present).
- `curl -s -X POST http://127.0.0.1:8765/api/tts -H "Content-Type: application/json" -d '{"text":"hello","speed":1.0,"voice":"0"}' -o out.wav -w "%{http_code}\n"` → `200`, `out.wav` is a non-empty WAV.
- `curl -s -X POST http://127.0.0.1:8765/api/ktts -H "Content-Type: application/json" -d '{"text":"hello","speed":1.0,"voice":"af_heart"}' -o kout.wav -w "%{http_code}\n"` → `200`, `kout.wav` non-empty.

Stop the sidecar process when done.

- [ ] **Step 4: Final confirmation**

Confirm `desktop/models/` is git-ignored (already in `.gitignore`) so the downloaded files are NOT staged: `git status --short` shows no `models/` entries.

No commit needed (verification only). If any step fails, return to the relevant task.
