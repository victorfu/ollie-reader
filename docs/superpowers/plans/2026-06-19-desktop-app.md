# macOS Desktop Sidecar + PySide6 殼 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 `ollie-reader` 內建一個 macOS 桌面服務：本機 FastAPI sidecar 跑 PDF 提取 + Piper/Kokoro TTS，由 PySide6 系統匣 app 監督；web app 探測得到本機就用、否則 fallback 回 Cloud Run。

**Architecture:** 自包含的 Python sidecar（`ollie-reader/desktop/server/`，REST，合約與雲端一致）+ PySide6 殼（系統匣 icon + 設定視窗，子行程啟動 sidecar）。web app 加一層 `resolveApiBase()`：pdf/tts/ktts 採 localhost 優先、雲端 fallback；OIKID/translate/gcs 永遠走雲端。v1 內建 Piper + Kokoro（含 torch）。

**Tech Stack:** Python 3.10、FastAPI、uvicorn、PyMuPDF、piper-tts、kokoro + torch、PySide6（LGPL）、PyInstaller；前端 TypeScript/React/Vite。

**Spec:** `docs/superpowers/specs/2026-06-19-desktop-app-design.md`

**重要慣例：**
- 所有路徑相對於 `ollie-reader/` repo 根目錄。
- Python 指令在 `ollie-reader/desktop/` 下執行（該目錄在 `sys.path`，故 `import server.*` 可用）。
- 前端目前**沒有單元測試 runner**（`package.json` 只有 `lint`、`build`）。前端任務沿用既有做法：`npx tsc -b` + `npx eslint` + 手動驗證，**不新增 vitest**。Python sidecar 則用 pytest 做 TDD。
- engine wrapper（Piper/Kokoro/PDF）是從 `purism-ev-bot` 複製精簡而來，合約必須與雲端一致。

> **實作後變更（2026-06-20）**：本 plan 原規劃 `/api/fetch-url` **維持雲端**（見下方 File Structure 與 Task 7/8 的相關註記）。實際實作時已改為**走 compute-base 並放進本機 sidecar**：`desktop/server/fetch_url.py` + `app.py` 的 `GET /api/fetch-url`，前端 `PdfContext` 經 `fetchWithComputeBase(FETCH_URL_PATH)` 採 localhost 優先、雲端 fallback。下方步驟內凡標「fetch-url 維持雲端」者均已過時，**以本註記為準**（spec `2026-06-19-desktop-app-design.md` 已同步更新）。

---

## File Structure

```
ollie-reader/
├── src/
│   ├── services/localBackend.ts      # 新：resolveApiBase() / getComputeBase()（探測 + 快取 + fallback）
│   ├── constants/api.ts              # 改：新增 LOCAL_BASE_URL + TTS_ENGINE_PATH，pdf/tts/ktts 改用動態 base
│   ├── contexts/SpeechContext.tsx    # 改：fetchTTSBlob 用 getComputeBase()；ktts 503 → 降級 Piper
│   └── contexts/PdfContext.tsx       # 改：pdf/extract + fetch-url 皆走 getComputeBase()（見頂部「實作後變更」）
└── desktop/                          # 新：Python（不納入 tsconfig/eslint）
    ├── main.py                       # 進入點：無旗標→殼；--serve→uvicorn
    ├── requirements.txt
    ├── requirements-dev.txt
    ├── pyproject.toml                # pytest 設定（pythonpath=.）
    ├── .gitignore
    ├── README.md
    ├── server/
    │   ├── __init__.py
    │   ├── config.py                 # port / CORS origins / 模型路徑 / 版本
    │   ├── models.py                 # SpeechRequest
    │   ├── pdf_extract.py            # PyMuPDF（複製自 pdf_service）
    │   ├── tts_piper.py              # Piper（複製自 tts_service）
    │   ├── tts_kokoro.py             # Kokoro guarded（複製自 kokoro_service）
    │   └── app.py                    # FastAPI factory + CORS + 路由
    ├── shell/
    │   ├── __init__.py
    │   ├── sidecar.py                # 子行程啟停 + 健康檢查
    │   ├── autostart.py              # LaunchAgent 安裝/移除
    │   └── app.py                    # QApplication / 系統匣 / 設定視窗
    ├── tests/
    │   ├── __init__.py
    │   ├── conftest.py               # singleton reset + 共用 fixtures
    │   ├── test_pdf_extract.py
    │   ├── test_tts_piper.py
    │   ├── test_tts_kokoro.py
    │   ├── test_app.py
    │   ├── test_sidecar.py
    │   └── test_autostart.py
    └── ollie-reader-desktop.spec     # PyInstaller
```

---

# Phase P0 — 本機 sidecar（pytest TDD）

## Task 1: 專案骨架 + config + models

**Files:**
- Create: `desktop/server/__init__.py`（空檔）
- Create: `desktop/tests/__init__.py`（空檔）
- Create: `desktop/server/config.py`
- Create: `desktop/server/models.py`
- Create: `desktop/requirements.txt`
- Create: `desktop/requirements-dev.txt`
- Create: `desktop/pyproject.toml`
- Create: `desktop/.gitignore`
- Test: `desktop/tests/test_config.py`

- [ ] **Step 1: 建立空套件檔與相依清單**

`desktop/server/__init__.py` 與 `desktop/tests/__init__.py`：空檔。

`desktop/requirements.txt`:
```
fastapi
uvicorn[standard]
pymupdf
piper-tts
soundfile
numpy
kokoro>=0.9.4
torch
PySide6
```

`desktop/requirements-dev.txt`:
```
-r requirements.txt
pytest
httpx
pyinstaller
```

`desktop/pyproject.toml`:
```toml
[tool.pytest.ini_options]
pythonpath = ["."]
testpaths = ["tests"]
```

`desktop/.gitignore`:
```
__pycache__/
*.pyc
.venv/
build/
dist/
*.spec.bak
models/
```

- [ ] **Step 2: 寫 config 的失敗測試**

`desktop/tests/test_config.py`:
```python
import importlib


def test_default_port_and_host():
    from server import config
    importlib.reload(config)
    assert config.DEFAULT_PORT == 8765
    assert config.HOST == "127.0.0.1"


def test_cors_includes_localhost_dev():
    from server import config
    importlib.reload(config)
    assert "http://localhost:5173" in config.CORS_ORIGINS
    assert "http://127.0.0.1:5173" in config.CORS_ORIGINS


def test_cors_appends_env_origins(monkeypatch):
    monkeypatch.setenv("OLLIE_CORS_ORIGINS", "https://ollie.example.app, https://b.app")
    from server import config
    importlib.reload(config)
    assert "https://ollie.example.app" in config.CORS_ORIGINS
    assert "https://b.app" in config.CORS_ORIGINS
```

- [ ] **Step 3: 跑測試確認失敗**

Run: `cd desktop && python -m pytest tests/test_config.py -v`
Expected: FAIL（`ModuleNotFoundError: No module named 'server.config'`）

- [ ] **Step 4: 實作 config.py**

`desktop/server/config.py`:
```python
import os
from typing import List

VERSION = "0.1.0"
HOST = "127.0.0.1"
DEFAULT_PORT = 8765

# Piper ONNX 模型路徑（打包時放在 models/ 下，可用環境變數覆寫）
PIPER_MODEL_PATH = os.getenv("PIPER_MODEL_PATH", "models/en_US-lessac-medium.onnx")

# Kokoro 設定（與雲端一致）
KOKORO_LANG = os.getenv("KOKORO_LANG", "a")
KOKORO_DEFAULT_VOICE = os.getenv("KOKORO_DEFAULT_VOICE", "af_heart")


def _cors_origins() -> List[str]:
    """允許呼叫本機 sidecar 的 web app origin：localhost dev 內建，prod 用 OLLIE_CORS_ORIGINS 補。"""
    raw = os.getenv("OLLIE_CORS_ORIGINS", "")
    extra = [o.strip() for o in raw.split(",") if o.strip()]
    return ["http://localhost:5173", "http://127.0.0.1:5173", *extra]


CORS_ORIGINS = _cors_origins()
```

- [ ] **Step 5: 實作 models.py**

`desktop/server/models.py`:
```python
from typing import Optional
from pydantic import BaseModel


class SpeechRequest(BaseModel):
    """統一 TTS 請求格式（與雲端 purism-ev-bot 一致）。"""

    text: str
    speed: float = 1.0
    voice: Optional[str] = None
```

- [ ] **Step 6: 跑測試確認通過**

Run: `cd desktop && python -m pytest tests/test_config.py -v`
Expected: PASS（3 passed）

- [ ] **Step 7: Commit**

```bash
cd /Users/victor/Documents/ollie-reader
git add desktop/server/__init__.py desktop/tests/__init__.py desktop/server/config.py desktop/server/models.py desktop/requirements.txt desktop/requirements-dev.txt desktop/pyproject.toml desktop/.gitignore desktop/tests/test_config.py
git commit -m "feat(desktop): scaffold sidecar config + models"
```

---

## Task 2: PDF 提取（複製自 pdf_service）

**Files:**
- Create: `desktop/server/pdf_extract.py`
- Test: `desktop/tests/test_pdf_extract.py`

- [ ] **Step 1: 寫失敗測試（用 pymupdf 真的造一份 PDF）**

`desktop/tests/test_pdf_extract.py`:
```python
import pymupdf
import pytest

from server.pdf_extract import extract_text_from_pdf, PDFError


def _make_pdf(text: str) -> bytes:
    doc = pymupdf.open()
    page = doc.new_page()
    page.insert_text((72, 72), text)
    data = doc.tobytes()
    doc.close()
    return data


def test_extract_returns_pages_with_text():
    pdf = _make_pdf("Hello Ollie")
    result = extract_text_from_pdf(pdf, "sample.pdf")
    assert result.total_pages == 1
    assert result.filename == "sample.pdf"
    assert "Hello Ollie" in result.pages[0].text
    assert result.pages[0].page_number == 1
    assert result.pages[0].text_length == len(result.pages[0].text)


def test_extract_rejects_non_pdf_filename():
    with pytest.raises(PDFError) as exc:
        extract_text_from_pdf(b"%PDF-1.4", "note.txt")
    assert exc.value.status_code == 400


def test_extract_rejects_empty_filename():
    with pytest.raises(PDFError) as exc:
        extract_text_from_pdf(b"%PDF-1.4", "")
    assert exc.value.status_code == 400
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `cd desktop && python -m pytest tests/test_pdf_extract.py -v`
Expected: FAIL（`ModuleNotFoundError: No module named 'server.pdf_extract'`）

- [ ] **Step 3: 實作 pdf_extract.py**

`desktop/server/pdf_extract.py`:
```python
"""PDF 文字提取（複製自 purism-ev-bot services/pdf_service.py，合約一致）。"""

import logging
import os
import shutil
import tempfile
from dataclasses import dataclass
from typing import List

import pymupdf

logger = logging.getLogger(__name__)


@dataclass
class PageText:
    page_number: int
    text: str
    text_length: int


@dataclass
class PDFExtractResult:
    filename: str
    total_pages: int
    pages: List[PageText]


class PDFError(Exception):
    def __init__(self, message: str, status_code: int = 500):
        self.message = message
        self.status_code = status_code
        super().__init__(self.message)


def extract_text_from_pdf(file_content: bytes, filename: str) -> PDFExtractResult:
    if not filename:
        raise PDFError("檔案名稱不能為空", status_code=400)
    if not filename.lower().endswith(".pdf"):
        raise PDFError("只允許上傳 PDF 檔案", status_code=400)

    temp_dir = tempfile.mkdtemp()
    temp_file_path = None
    try:
        temp_file_path = os.path.join(temp_dir, filename)
        with open(temp_file_path, "wb") as buffer:
            buffer.write(file_content)

        doc = pymupdf.open(temp_file_path)
        page_count = len(doc)
        pages_text: List[PageText] = []
        for page_num, page in enumerate(doc):
            page_text = page.get_text()
            pages_text.append(
                PageText(
                    page_number=page_num + 1,
                    text=page_text,
                    text_length=len(page_text),
                )
            )
        doc.close()
        return PDFExtractResult(
            filename=filename, total_pages=page_count, pages=pages_text
        )
    except PDFError:
        raise
    except Exception as e:
        logger.error(f"PDF 處理失敗: {e}", exc_info=True)
        raise PDFError(f"PDF 處理失敗: {e}", status_code=500)
    finally:
        if temp_file_path and os.path.exists(temp_file_path):
            os.remove(temp_file_path)
        if os.path.exists(temp_dir):
            shutil.rmtree(temp_dir)
```

- [ ] **Step 4: 跑測試確認通過**

Run: `cd desktop && python -m pytest tests/test_pdf_extract.py -v`
Expected: PASS（3 passed）

- [ ] **Step 5: Commit**

```bash
cd /Users/victor/Documents/ollie-reader
git add desktop/server/pdf_extract.py desktop/tests/test_pdf_extract.py
git commit -m "feat(desktop): PDF text extraction (PyMuPDF)"
```

---

## Task 3: Piper TTS wrapper（複製自 tts_service）

**Files:**
- Create: `desktop/server/tts_piper.py`
- Test: `desktop/tests/test_tts_piper.py`

- [ ] **Step 1: 寫失敗測試（mock PiperVoice，不需要真模型）**

`desktop/tests/test_tts_piper.py`:
```python
import pytest

import server.tts_piper as tts_piper
from server.tts_piper import TTSService, TTSError, generate_speech


class _FakeVoice:
    def synthesize_wav(self, text, wav_file, syn_config=None):
        # 寫入合法的 WAV frame，讓 wave 模組產生非空輸出
        wav_file.setnchannels(1)
        wav_file.setsampwidth(2)
        wav_file.setframerate(22050)
        wav_file.writeframes(b"\x00\x01" * 100)


@pytest.fixture(autouse=True)
def _reset_and_fake_voice(monkeypatch):
    TTSService._instance = None
    TTSService._voice = _FakeVoice()
    TTSService._initialized = True
    yield
    TTSService._instance = None
    TTSService._voice = None
    TTSService._initialized = False


def test_generate_speech_returns_wav_bytes():
    result = generate_speech("hello", speaker=0, length_scale=1.0)
    assert result.content_type == "audio/wav"
    assert result.audio_data[:4] == b"RIFF"
    assert len(result.audio_data) > 44  # 大於 WAV header


def test_synth_failure_raises_ttserror(monkeypatch):
    class _BoomVoice:
        def synthesize_wav(self, *a, **k):
            raise RuntimeError("boom")

    TTSService._voice = _BoomVoice()
    with pytest.raises(TTSError) as exc:
        generate_speech("hi")
    assert exc.value.status_code == 500
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `cd desktop && python -m pytest tests/test_tts_piper.py -v`
Expected: FAIL（`ModuleNotFoundError: No module named 'server.tts_piper'`）

- [ ] **Step 3: 實作 tts_piper.py**

`desktop/server/tts_piper.py`:
```python
"""Piper TTS（複製自 purism-ev-bot services/tts_service.py，改用 server.config）。"""

import io
import logging
import wave
from dataclasses import dataclass
from pathlib import Path
from threading import Lock
from typing import Optional

from piper import PiperVoice
from piper.config import SynthesisConfig

logger = logging.getLogger(__name__)


@dataclass
class TTSResult:
    audio_data: bytes
    content_type: str = "audio/wav"


class TTSError(Exception):
    def __init__(self, message: str, status_code: int = 500):
        self.message = message
        self.status_code = status_code
        super().__init__(self.message)


class TTSService:
    _instance: Optional["TTSService"] = None
    _voice: Optional[PiperVoice] = None
    _lock: Lock = Lock()
    _initialized: bool = False

    def __new__(cls) -> "TTSService":
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super().__new__(cls)
        return cls._instance

    @classmethod
    def initialize(cls, model_path: Optional[str] = None) -> None:
        if cls._initialized and cls._voice is not None:
            return
        with cls._lock:
            if cls._initialized and cls._voice is not None:
                return
            if model_path is None:
                from server.config import PIPER_MODEL_PATH

                model_path = PIPER_MODEL_PATH
            model_file = Path(model_path)
            if not model_file.exists():
                raise TTSError(
                    f"Piper 模型檔案不存在: {model_file.absolute()}", status_code=404
                )
            try:
                cls._voice = PiperVoice.load(model_path)
                cls._initialized = True
                logger.info(f"Piper 模型載入成功: {model_path}")
            except Exception as e:
                raise TTSError(
                    f"Piper 模型載入失敗: {type(e).__name__}: {e}", status_code=500
                )

    @classmethod
    def get_voice(cls) -> PiperVoice:
        if cls._voice is None:
            cls.initialize()
        return cls._voice

    @classmethod
    def synthesize(
        cls,
        text: str,
        speaker: int = 0,
        length_scale: float = 1.0,
        noise_scale: float = 0.667,
        noise_w_scale: float = 0.8,
    ) -> TTSResult:
        voice = cls.get_voice()
        try:
            syn_config = SynthesisConfig(
                speaker_id=speaker,
                length_scale=length_scale,
                noise_scale=noise_scale,
                noise_w_scale=noise_w_scale,
            )
            audio_buffer = io.BytesIO()
            with wave.open(audio_buffer, "wb") as wav_file:
                voice.synthesize_wav(text, wav_file, syn_config=syn_config)
            return TTSResult(audio_data=audio_buffer.getvalue(), content_type="audio/wav")
        except Exception as e:
            raise TTSError(
                f"語音合成失敗: {type(e).__name__}: {e}", status_code=500
            )


def generate_speech(
    text: str,
    speaker: int = 0,
    length_scale: float = 1.0,
    noise_scale: float = 0.667,
    noise_w_scale: float = 0.8,
) -> TTSResult:
    return TTSService.synthesize(
        text=text,
        speaker=speaker,
        length_scale=length_scale,
        noise_scale=noise_scale,
        noise_w_scale=noise_w_scale,
    )
```

- [ ] **Step 4: 跑測試確認通過**

Run: `cd desktop && python -m pytest tests/test_tts_piper.py -v`
Expected: PASS（2 passed）

- [ ] **Step 5: Commit**

```bash
cd /Users/victor/Documents/ollie-reader
git add desktop/server/tts_piper.py desktop/tests/test_tts_piper.py
git commit -m "feat(desktop): Piper TTS wrapper"
```

---

## Task 4: Kokoro TTS wrapper（複製自 kokoro_service，guarded import）

**Files:**
- Create: `desktop/server/tts_kokoro.py`
- Test: `desktop/tests/test_tts_kokoro.py`
- Modify: `desktop/tests/conftest.py`（建立）

- [ ] **Step 1: 建立 conftest（reset singleton + mock_kokoro fixture）**

`desktop/tests/conftest.py`:
```python
import io
import wave

import pytest


@pytest.fixture(autouse=True)
def _reset_kokoro_singleton():
    """每個測試前後重置 Kokoro singleton，避免互相污染。"""
    import server.tts_kokoro as k

    k.KokoroTTSService._instance = None
    k.KokoroTTSService._pipelines = {}
    k.KokoroTTSService._initialized = False
    yield
    k.KokoroTTSService._instance = None
    k.KokoroTTSService._pipelines = {}
    k.KokoroTTSService._initialized = False


def _wav_bytes() -> bytes:
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(24000)
        w.writeframes(b"\x00\x01" * 100)
    return buf.getvalue()


@pytest.fixture
def mock_kokoro(monkeypatch):
    """把 _import_kokoro_deps 換成假的 numpy/soundfile/KPipeline，使測試不需要 torch。"""
    import numpy as real_np  # numpy 為輕量相依，CI 可用
    import server.tts_kokoro as k

    class _FakePipeline:
        def __init__(self, lang_code="a"):
            self.lang_code = lang_code

        def __call__(self, text, voice=None, speed=1.0):
            # 產生一個 chunk：(graphemes, phonemes, audio)
            yield ("g", "p", real_np.zeros(2400, dtype="float32"))

    class _FakeSF:
        @staticmethod
        def write(buf, audio, samplerate, format="WAV"):
            buf.write(_wav_bytes())

    monkeypatch.setattr(
        k, "_import_kokoro_deps", lambda: (real_np, _FakeSF, _FakePipeline)
    )
    return k
```

- [ ] **Step 2: 寫失敗測試**

`desktop/tests/test_tts_kokoro.py`:
```python
import pytest

import server.tts_kokoro as k
from server.tts_kokoro import (
    KokoroTTSService,
    KokoroTTSError,
    kokoro_synthesize_speech,
    _lang_from_voice,
)


def test_lang_from_voice_prefix():
    assert _lang_from_voice("af_heart", "a") == "a"
    assert _lang_from_voice("bf_emma", "a") == "b"
    assert _lang_from_voice("xyz", "a") == "a"  # 未知前綴用 default


def test_unavailable_raises_503(monkeypatch):
    def _boom():
        raise KokoroTTSError("no torch", status_code=503)

    monkeypatch.setattr(k, "_import_kokoro_deps", _boom)
    assert KokoroTTSService.is_available() is False
    with pytest.raises(KokoroTTSError) as exc:
        kokoro_synthesize_speech("hello")
    assert exc.value.status_code == 503


def test_synthesize_returns_wav(mock_kokoro):
    result = kokoro_synthesize_speech("hello", speed=1.0, voice="af_heart")
    assert result.content_type == "audio/wav"
    assert result.audio_data[:4] == b"RIFF"


def test_is_available_true_when_deps_present(mock_kokoro):
    assert KokoroTTSService.is_available() is True
```

- [ ] **Step 3: 跑測試確認失敗**

Run: `cd desktop && python -m pytest tests/test_tts_kokoro.py -v`
Expected: FAIL（`ModuleNotFoundError: No module named 'server.tts_kokoro'`）

- [ ] **Step 4: 實作 tts_kokoro.py**

`desktop/server/tts_kokoro.py`:
```python
"""Kokoro TTS（複製自 purism-ev-bot services/kokoro_service.py，改用 server.config）。

所有重量級 import 延遲到 _import_kokoro_deps；缺相依時回 KokoroTTSError(503)。
"""

import io
import logging
from dataclasses import dataclass
from threading import Lock
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)

_KNOWN_LANG_PREFIXES = {"a", "b", "e", "f", "h", "i", "j", "p", "z"}


@dataclass
class KokoroTTSResult:
    audio_data: bytes
    content_type: str = "audio/wav"


class KokoroTTSError(Exception):
    def __init__(self, message: str, status_code: int = 500):
        self.message = message
        self.status_code = status_code
        super().__init__(self.message)


def _import_kokoro_deps():
    try:
        import numpy as np
        import soundfile as sf
        from kokoro import KPipeline

        return np, sf, KPipeline
    except Exception as e:
        raise KokoroTTSError(
            f"Kokoro 不可用（缺少相依套件或模型）: {type(e).__name__}: {e}",
            status_code=503,
        )


def _lang_from_voice(voice: str, default_lang: str) -> str:
    if voice and voice[0] in _KNOWN_LANG_PREFIXES:
        return voice[0]
    return default_lang


class KokoroTTSService:
    _instance: Optional["KokoroTTSService"] = None
    _pipelines: Dict[str, Any] = {}
    _lock: Lock = Lock()
    _initialized: bool = False

    def __new__(cls) -> "KokoroTTSService":
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super().__new__(cls)
        return cls._instance

    @classmethod
    def is_available(cls) -> bool:
        try:
            _import_kokoro_deps()
            return True
        except KokoroTTSError:
            return False

    @classmethod
    def initialize(cls, lang_code: Optional[str] = None) -> None:
        if lang_code is None:
            from server.config import KOKORO_LANG

            lang_code = KOKORO_LANG
        with cls._lock:
            cls._get_pipeline_locked(lang_code)
            cls._initialized = True

    @classmethod
    def _get_pipeline_locked(cls, lang_code: str):
        pipeline = cls._pipelines.get(lang_code)
        if pipeline is None:
            _np, _sf, KPipeline = _import_kokoro_deps()
            pipeline = KPipeline(lang_code=lang_code)
            cls._pipelines[lang_code] = pipeline
        return pipeline

    @classmethod
    def _get_pipeline(cls, lang_code: str):
        if cls._pipelines.get(lang_code) is not None:
            return cls._pipelines[lang_code]
        with cls._lock:
            return cls._get_pipeline_locked(lang_code)

    @classmethod
    def synthesize(
        cls,
        text: str,
        speed: float = 1.0,
        voice: Optional[str] = None,
        lang_code: Optional[str] = None,
    ) -> KokoroTTSResult:
        from server.config import KOKORO_DEFAULT_VOICE, KOKORO_LANG

        voice = voice or KOKORO_DEFAULT_VOICE
        if lang_code is None:
            lang_code = _lang_from_voice(voice, KOKORO_LANG)

        np, sf, _KPipeline = _import_kokoro_deps()
        pipeline = cls._get_pipeline(lang_code)
        try:
            chunks = [
                np.asarray(audio)
                for _, _, audio in pipeline(text, voice=voice, speed=speed)
            ]
            if not chunks:
                raise KokoroTTSError("Kokoro 未產生任何音訊", status_code=500)
            audio = np.concatenate(chunks)
            audio_buffer = io.BytesIO()
            sf.write(audio_buffer, audio, 24000, format="WAV")
            return KokoroTTSResult(
                audio_data=audio_buffer.getvalue(), content_type="audio/wav"
            )
        except KokoroTTSError:
            raise
        except Exception as e:
            raise KokoroTTSError(
                f"Kokoro 語音合成失敗: {type(e).__name__}: {e}", status_code=500
            )


def kokoro_synthesize_speech(
    text: str, speed: float = 1.0, voice: Optional[str] = None
) -> KokoroTTSResult:
    return KokoroTTSService.synthesize(text=text, speed=speed, voice=voice)
```

- [ ] **Step 5: 跑測試確認通過**

Run: `cd desktop && python -m pytest tests/test_tts_kokoro.py -v`
Expected: PASS（4 passed）

- [ ] **Step 6: Commit**

```bash
cd /Users/victor/Documents/ollie-reader
git add desktop/server/tts_kokoro.py desktop/tests/test_tts_kokoro.py desktop/tests/conftest.py
git commit -m "feat(desktop): Kokoro TTS wrapper (guarded import)"
```

---

## Task 5: FastAPI app（合約與雲端一致，TestClient TDD）

**Files:**
- Create: `desktop/server/app.py`
- Test: `desktop/tests/test_app.py`

- [ ] **Step 1: 寫失敗測試**

`desktop/tests/test_app.py`:
```python
import io

import pymupdf
import pytest
from fastapi.testclient import TestClient

import server.app as app_module
import server.tts_piper as tts_piper
import server.tts_kokoro as tts_kokoro
from server.tts_piper import TTSResult
from server.tts_kokoro import KokoroTTSError, KokoroTTSResult


@pytest.fixture
def client():
    return TestClient(app_module.app)


def _pdf_bytes(text="Hello"):
    doc = pymupdf.open()
    page = doc.new_page()
    page.insert_text((72, 72), text)
    data = doc.tobytes()
    doc.close()
    return data


def test_version(client):
    resp = client.get("/api/version")
    assert resp.status_code == 200
    assert "version" in resp.json()


def test_pdf_extract_contract(client):
    files = {"file": ("a.pdf", _pdf_bytes("Hello Ollie"), "application/pdf")}
    resp = client.post("/api/pdf/extract", files=files)
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "success"
    assert body["total_pages"] == 1
    assert "Hello Ollie" in body["pages"][0]["text"]
    assert body["pages"][0]["page_number"] == 1


def test_tts_speed_to_length_scale(client, monkeypatch):
    captured = {}

    def fake_generate(text, speaker, length_scale):
        captured["speaker"] = speaker
        captured["length_scale"] = length_scale
        return TTSResult(audio_data=b"RIFFfake", content_type="audio/wav")

    monkeypatch.setattr(app_module, "generate_speech", fake_generate)
    resp = client.post("/api/tts", json={"text": "hi", "speed": 2.0})
    assert resp.status_code == 200
    assert resp.headers["content-type"] == "audio/wav"
    assert captured["length_scale"] == 0.5  # 1/2.0
    assert captured["speaker"] == 0


def test_tts_bad_voice_returns_400(client):
    resp = client.post("/api/tts", json={"text": "hi", "voice": "not-an-int"})
    assert resp.status_code == 400


def test_ktts_503_when_unavailable(client, monkeypatch):
    def boom(text, speed, voice):
        raise KokoroTTSError("no torch", status_code=503)

    monkeypatch.setattr(app_module, "kokoro_synthesize_speech", boom)
    resp = client.post("/api/ktts", json={"text": "hi"})
    assert resp.status_code == 503


def test_ktts_success(client, monkeypatch):
    monkeypatch.setattr(
        app_module,
        "kokoro_synthesize_speech",
        lambda text, speed, voice: KokoroTTSResult(audio_data=b"RIFFfake"),
    )
    resp = client.post("/api/ktts", json={"text": "hi"})
    assert resp.status_code == 200
    assert resp.headers["content-type"] == "audio/wav"


def test_cors_allows_localhost_origin(client):
    resp = client.get("/api/version", headers={"Origin": "http://localhost:5173"})
    assert resp.headers.get("access-control-allow-origin") == "http://localhost:5173"
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `cd desktop && python -m pytest tests/test_app.py -v`
Expected: FAIL（`ModuleNotFoundError: No module named 'server.app'`）

- [ ] **Step 3: 實作 app.py**

`desktop/server/app.py`:
```python
"""ollie-reader 本機 sidecar：pdf/tts/ktts + version，REST，合約與雲端一致。"""

import io
import logging

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from server.config import CORS_ORIGINS, VERSION
from server.models import SpeechRequest
from server.pdf_extract import extract_text_from_pdf, PDFError
from server.tts_piper import generate_speech, TTSError
from server.tts_kokoro import kokoro_synthesize_speech, KokoroTTSError

logger = logging.getLogger(__name__)


def create_app() -> FastAPI:
    app = FastAPI(title="ollie-reader local sidecar", version=VERSION)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=CORS_ORIGINS,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/api/version", tags=["meta"])
    async def version():
        return {"version": VERSION, "engine": "local-sidecar"}

    @app.post("/api/pdf/extract", tags=["pdf"])
    async def extract_pdf(file: UploadFile = File(...)):
        content = await file.read()
        try:
            result = extract_text_from_pdf(content, file.filename or "unknown.pdf")
        except PDFError as e:
            raise HTTPException(status_code=e.status_code, detail=e.message)
        return {
            "status": "success",
            "filename": result.filename,
            "total_pages": result.total_pages,
            "pages": [
                {
                    "page_number": p.page_number,
                    "text": p.text,
                    "text_length": p.text_length,
                }
                for p in result.pages
            ],
        }

    @app.post("/api/tts", tags=["tts"])
    async def tts(request: SpeechRequest):
        length_scale = (
            min(2.0, max(0.1, 1.0 / request.speed)) if request.speed > 0 else 1.0
        )
        try:
            speaker = int(request.voice) if request.voice else 0
        except (ValueError, TypeError):
            raise HTTPException(
                status_code=400, detail="Piper 的 voice 必須為整數 speaker id"
            )
        try:
            result = await run_in_threadpool(
                generate_speech, request.text, speaker, length_scale
            )
        except TTSError as e:
            raise HTTPException(status_code=e.status_code, detail=e.message)
        return StreamingResponse(
            io.BytesIO(result.audio_data),
            media_type=result.content_type,
            headers={"Content-Disposition": 'attachment; filename="speech.wav"'},
        )

    @app.post("/api/ktts", tags=["tts"])
    async def ktts(request: SpeechRequest):
        try:
            result = await run_in_threadpool(
                kokoro_synthesize_speech, request.text, request.speed, request.voice
            )
        except KokoroTTSError as e:
            raise HTTPException(status_code=e.status_code, detail=e.message)
        return StreamingResponse(
            io.BytesIO(result.audio_data),
            media_type=result.content_type,
            headers={"Content-Disposition": 'attachment; filename="speech.wav"'},
        )

    return app


app = create_app()
```

> 注意：測試用 `monkeypatch.setattr(app_module, "generate_speech", ...)` 覆寫 `generate_speech`，因此路由內必須以模組層級名稱 `generate_speech` 呼叫（如上 import）。

- [ ] **Step 4: 跑測試確認通過**

Run: `cd desktop && python -m pytest tests/test_app.py -v`
Expected: PASS（8 passed）

- [ ] **Step 5: 跑整包測試**

Run: `cd desktop && python -m pytest -v`
Expected: PASS（所有 P0 測試）

- [ ] **Step 6: Commit**

```bash
cd /Users/victor/Documents/ollie-reader
git add desktop/server/app.py desktop/tests/test_app.py
git commit -m "feat(desktop): FastAPI sidecar app (pdf/tts/ktts/version + CORS)"
```

---

## Task 6: 進入點 main.py + 手動 smoke

**Files:**
- Create: `desktop/main.py`
- Create: `desktop/README.md`

- [ ] **Step 1: 實作 main.py**

`desktop/main.py`:
```python
"""ollie-reader desktop 進入點。

無旗標 → 啟動 PySide6 殼（Task 13 之前殼尚未實作，會提示）。
--serve  → 啟動本機 API sidecar（uvicorn）。
"""

import argparse


def main():
    parser = argparse.ArgumentParser(prog="ollie-reader-desktop")
    parser.add_argument("--serve", action="store_true", help="run the local API sidecar")
    parser.add_argument("--port", type=int, default=None, help="sidecar port")
    args, _ = parser.parse_known_args()

    if args.serve:
        import uvicorn

        from server.config import DEFAULT_PORT, HOST

        uvicorn.run(
            "server.app:app",
            host=HOST,
            port=args.port or DEFAULT_PORT,
            log_level="info",
        )
    else:
        try:
            from shell.app import run_shell
        except ImportError:
            print("PySide6 殼尚未實作（見 plan Task 13）。請用 --serve 啟動 sidecar。")
            return
        run_shell()


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: 寫 README**

`desktop/README.md`:
```markdown
# ollie-reader desktop（本機 sidecar + PySide6 殼）

## 開發

\`\`\`bash
cd desktop
python -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
# 下載 Piper 模型到 models/en_US-lessac-medium.onnx（見下）

# 只跑 API sidecar
python main.py --serve            # http://127.0.0.1:8765

# 跑測試
python -m pytest -v
\`\`\`

## Piper 模型
從 Piper releases 下載 `en_US-lessac-medium.onnx`（與 `.onnx.json`）放到 `desktop/models/`，
或用環境變數 `PIPER_MODEL_PATH` 指定。
```

- [ ] **Step 3: 手動 smoke（需先備妥 Piper 模型）**

```bash
cd desktop
source .venv/bin/activate
python main.py --serve &
sleep 3
curl -s http://127.0.0.1:8765/api/version
curl -s -X POST http://127.0.0.1:8765/api/tts -H 'Content-Type: application/json' -d '{"text":"hello","speed":1.0}' --output /tmp/piper.wav && file /tmp/piper.wav
curl -s -X POST http://127.0.0.1:8765/api/ktts -H 'Content-Type: application/json' -d '{"text":"hello","speed":1.0}' --output /tmp/kokoro.wav && file /tmp/kokoro.wav
kill %1
```
Expected: `/api/version` 回 JSON；`piper.wav` 為 `RIFF (little-endian) data, WAVE audio`；`kokoro.wav` 同樣是 WAVE（若 torch/kokoro 已裝）或回 503（未裝時，證明 guard 生效）。

- [ ] **Step 4: Commit**

```bash
cd /Users/victor/Documents/ollie-reader
git add desktop/main.py desktop/README.md
git commit -m "feat(desktop): entrypoint (--serve) + dev README"
```

---

# Phase P1 — Web app 整合（localhost 優先 / 雲端 fallback）

## Task 7: localBackend resolver

**Files:**
- Create: `src/services/localBackend.ts`
- Modify: `src/constants/api.ts`

- [ ] **Step 1: 在 constants/api.ts 新增 LOCAL base 與 path 對照**

修改 `src/constants/api.ts`，在現有內容**之後**新增（不要動既有 export）：
```typescript
// 本機 sidecar（desktop app）base，與雲端 API_BASE_URL 並存
export const LOCAL_BASE_URL = "http://127.0.0.1:8765";

// 可走本機運算的端點 path（其餘如 oikid/translate/gcs 永遠走雲端）
export const TTS_ENGINE_PATH: Record<"piper" | "kokoro", string> = {
  piper: "/api/tts",
  kokoro: "/api/ktts",
};
export const PDF_EXTRACT_PATH = "/api/pdf/extract";
export const VERSION_PATH = "/api/version";
```

- [ ] **Step 2: 實作 localBackend.ts**

`src/services/localBackend.ts`:
```typescript
import { API_BASE_URL, LOCAL_BASE_URL, VERSION_PATH } from "../constants/api";
import { logger } from "../utils/logger";

// 探測結果的快取存活時間：在此期間不重複探測
const PROBE_TTL_MS = 10_000;
const PROBE_TIMEOUT_MS = 400;

let resolvedBase = API_BASE_URL; // 預設雲端
let lastProbeAt = 0;
let inflight: Promise<string> | null = null;

async function probeLocal(): Promise<boolean> {
  try {
    const resp = await fetch(`${LOCAL_BASE_URL}${VERSION_PATH}`, {
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    });
    return resp.ok;
  } catch {
    return false;
  }
}

/**
 * 回傳 pdf/tts/ktts 應使用的 base：本機探測得到用本機，否則雲端。
 * 結果快取 PROBE_TTL_MS；同時間多次呼叫共用同一個 inflight 探測。
 */
export async function getComputeBase(): Promise<string> {
  const now = Date.now();
  if (now - lastProbeAt < PROBE_TTL_MS) {
    return resolvedBase;
  }
  if (inflight) return inflight;

  inflight = (async () => {
    const ok = await probeLocal();
    resolvedBase = ok ? LOCAL_BASE_URL : API_BASE_URL;
    lastProbeAt = Date.now();
    logger.debug("compute base resolved:", resolvedBase);
    inflight = null;
    return resolvedBase;
  })();
  return inflight;
}

/** 同步取得目前已解析的 base（不觸發探測），UI 顯示用。 */
export function getResolvedBaseSync(): string {
  return resolvedBase;
}

/** 強制立即重新探測（desktop 啟停後可呼叫）。 */
export async function refreshComputeBase(): Promise<string> {
  lastProbeAt = 0;
  return getComputeBase();
}
```

- [ ] **Step 3: 型別檢查 + lint**

Run: `cd /Users/victor/Documents/ollie-reader && npx tsc -b && npx eslint src/services/localBackend.ts src/constants/api.ts`
Expected: 無錯誤（exit 0）

- [ ] **Step 4: Commit**

```bash
cd /Users/victor/Documents/ollie-reader
git add src/services/localBackend.ts src/constants/api.ts
git commit -m "feat(web): local backend resolver (localhost-first, cloud fallback)"
```

---

## Task 8: 接上 resolver（TTS + PDF）+ Kokoro 503 降級 Piper

**Files:**
- Modify: `src/contexts/SpeechContext.tsx`
- Modify: `src/contexts/PdfContext.tsx`

- [ ] **Step 1: 改 SpeechContext 的 fetchTTSBlob 用動態 base + 503 降級**

在 `src/contexts/SpeechContext.tsx`：

(a) 把 import 從 `TTS_ENGINE_URL` 換成 path 對照 + resolver：
```typescript
// 移除： import { TTS_ENGINE_URL } from "../constants/api";
import { TTS_ENGINE_PATH } from "../constants/api";
import { getComputeBase } from "../services/localBackend";
```

(b) 將 `fetchTTSBlob` 整個函式替換成：
```typescript
async function fetchTTSBlob(
  text: string,
  speechRate: number,
  engine: TTSEngine,
  signal?: AbortSignal,
): Promise<Blob> {
  const cacheKey = ttsCache.getCacheKey(text, speechRate, engine);

  const pendingRequest = ttsCache.getPendingRequest(cacheKey);
  if (pendingRequest) {
    return pendingRequest;
  }

  const cachedBlob = await ttsCache.get(cacheKey);
  if (cachedBlob) {
    return cachedBlob;
  }

  const fetchPromise = (async () => {
    const base = await getComputeBase();
    const response = await apiFetch(`${base}${TTS_ENGINE_PATH[engine]}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal,
      body: JSON.stringify({ text, speed: speechRate }),
    });

    // Kokoro 在本機/雲端都可能因缺 torch 回 503 → 自動降級 Piper，確保有聲音
    if (response.status === 503 && engine === "kokoro") {
      return fetchTTSBlob(text, speechRate, "piper", signal);
    }

    if (!response.ok) {
      throw new Error(`TTS API 錯誤: ${response.status}`);
    }

    return await response.blob();
  })();

  ttsCache.setPendingRequest(cacheKey, fetchPromise);

  const blob = await fetchPromise;
  await ttsCache.set(cacheKey, blob);

  return blob;
}
```

> 降級時 `fetchTTSBlob(... "piper" ...)` 會以 piper 的 cacheKey 自行快取，外層仍以 kokoro key 記錄同一個 blob，行為正確。

- [ ] **Step 2: 改 PdfContext 的 extract 呼叫用動態 base**

在 `src/contexts/PdfContext.tsx`：

(a) import 改成：
```typescript
// 既有： import { API_URL, FETCH_URL_API } from "../constants/api";
import { FETCH_URL_API, PDF_EXTRACT_PATH } from "../constants/api";
import { getComputeBase } from "../services/localBackend";
```
（`FETCH_URL_API` 維持雲端，OIKID 用；移除對 `API_URL` 的 import。）

(b) `uploadAndExtract` 內，將
```typescript
      const res = await fetch(API_URL, {
```
改成
```typescript
      const base = await getComputeBase();
      const res = await fetch(`${base}${PDF_EXTRACT_PATH}`, {
```

(c) `loadPdfFromUrl` 內，將
```typescript
      const extractRes = await fetch(API_URL, {
```
改成
```typescript
      const extractBase = await getComputeBase();
      const extractRes = await fetch(`${extractBase}${PDF_EXTRACT_PATH}`, {
```
（注意：此函式的 `FETCH_URL_API`（抓 OIKID PDF）維持不變、仍走雲端。）

- [ ] **Step 3: 型別檢查 + lint + build**

Run: `cd /Users/victor/Documents/ollie-reader && npx tsc -b && npx eslint src/contexts/SpeechContext.tsx src/contexts/PdfContext.tsx && npm run build`
Expected: 無錯誤、build exit 0。若 eslint 報 `API_URL` 未使用，確認已從 import 移除。

- [ ] **Step 4: Commit**

```bash
cd /Users/victor/Documents/ollie-reader
git add src/contexts/SpeechContext.tsx src/contexts/PdfContext.tsx
git commit -m "feat(web): route pdf/tts/ktts through local sidecar when available; kokoro 503 falls back to piper"
```

---

## Task 9: 瀏覽器 localhost 連線實測（最高風險，手動）

> 這是 spec §9 標記的關鍵假設。**先過這關再投資 P2/P3。**

**Files:** 無（驗證任務）。

- [ ] **Step 1: 同時啟動 sidecar 與 dev web app**

```bash
# 終端機 A
cd /Users/victor/Documents/ollie-reader/desktop && source .venv/bin/activate && python main.py --serve
# 終端機 B
cd /Users/victor/Documents/ollie-reader && npm run dev   # http://localhost:5173
```

- [ ] **Step 2: 在 Chrome 測試**

開 `http://localhost:5173`，DevTools → Console 執行：
```javascript
fetch("http://127.0.0.1:8765/api/version").then(r => r.json()).then(console.log)
```
Expected: 印出 `{version: ...}`，Network 面板該請求 200、含 `access-control-allow-origin`。
接著實際在 reader 上傳 PDF + 觸發朗讀，確認 Network 打的是 `127.0.0.1:8765`。

- [ ] **Step 3: 在 Safari 測試同上**

重點觀察 Safari 是否擋 `https→http://localhost` 或跨 origin。記錄結果。

- [ ] **Step 4: 記錄結論到 spec**

在 `docs/superpowers/specs/2026-06-19-desktop-app-design.md` §9 該列補一行實測結果（哪些瀏覽器可、哪些需備案）。若 Safari 擋且無法接受，採 spec 備案（PNA header／本機 TLS／引導用 Chrome）再回來補一個 task。

- [ ] **Step 5: Commit（doc 更新）**

```bash
cd /Users/victor/Documents/ollie-reader
git add docs/superpowers/specs/2026-06-19-desktop-app-design.md
git commit -m "docs(desktop): record browser localhost reachability test results"
```

---

# Phase P2 — 打包（PyInstaller）

## Task 10: 打包 sidecar 並 smoke

**Files:**
- Create: `desktop/ollie-reader-desktop.spec`

> PyInstaller 打包含 torch 的 app 常需依實際缺漏補 `hiddenimports`／`datas`，這是預期的迭代。先求 `--serve` 能從打包後執行檔跑起來。

- [ ] **Step 1: 寫 PyInstaller spec**

`desktop/ollie-reader-desktop.spec`:
```python
# -*- mode: python ; coding: utf-8 -*-
from PyInstaller.utils.hooks import collect_all, collect_submodules

datas = [("models", "models")]   # 內含 Piper 模型
binaries = []
hiddenimports = [
    "server.app",
    "uvicorn.logging",
    "uvicorn.loops.auto",
    "uvicorn.protocols.http.auto",
    "uvicorn.protocols.websockets.auto",
    "uvicorn.lifespan.on",
]
hiddenimports += collect_submodules("server")

for pkg in ("kokoro", "torch", "piper", "soundfile", "numpy"):
    d, b, h = collect_all(pkg)
    datas += d
    binaries += b
    hiddenimports += h

a = Analysis(
    ["main.py"],
    pathex=["."],
    binaries=binaries,
    datas=datas,
    hiddenimports=hiddenimports,
    noarchive=False,
)
pyz = PYZ(a.pure)
exe = EXE(
    pyz, a.scripts, [], exclude_binaries=True,
    name="ollie-reader-desktop", console=True,
)
coll = COLLECT(
    exe, a.binaries, a.datas, name="ollie-reader-desktop",
)
```

> v1 用 `console=True`（看得到 sidecar log）；Task 13 殼上線後可改 `console=False`。

- [ ] **Step 2: 打包**

Run:
```bash
cd /Users/victor/Documents/ollie-reader/desktop && source .venv/bin/activate
pyinstaller ollie-reader-desktop.spec --noconfirm
```
Expected: 產出 `dist/ollie-reader-desktop/ollie-reader-desktop`。若報 `ModuleNotFoundError`，把缺的模組加進 spec 的 `hiddenimports` 重打。

- [ ] **Step 3: smoke 測試打包後的 sidecar**

Run:
```bash
cd /Users/victor/Documents/ollie-reader/desktop
./dist/ollie-reader-desktop/ollie-reader-desktop --serve &
sleep 5
curl -s http://127.0.0.1:8765/api/version
curl -s -X POST http://127.0.0.1:8765/api/ktts -H 'Content-Type: application/json' -d '{"text":"hello"}' --output /tmp/k.wav && file /tmp/k.wav
kill %1
```
Expected: version 回 JSON；`k.wav` 為 WAVE（證明 torch+Kokoro 確實被打包進去）。

- [ ] **Step 4: Commit**

```bash
cd /Users/victor/Documents/ollie-reader
git add desktop/ollie-reader-desktop.spec
git commit -m "build(desktop): PyInstaller spec bundling sidecar + torch/kokoro"
```

---

# Phase P3 — PySide6 殼

## Task 11: sidecar 子行程管理 + 健康檢查（pytest TDD）

**Files:**
- Create: `desktop/shell/__init__.py`（空檔）
- Create: `desktop/shell/sidecar.py`
- Test: `desktop/tests/test_sidecar.py`

- [ ] **Step 1: 寫失敗測試**

`desktop/tests/test_sidecar.py`:
```python
import server  # noqa: F401  確保 server 套件可 import
from shell.sidecar import SidecarManager


class _FakeProc:
    def __init__(self):
        self._alive = True

    def poll(self):
        return None if self._alive else 0

    def terminate(self):
        self._alive = False

    def wait(self, timeout=None):
        return 0

    def kill(self):
        self._alive = False


def test_start_spawns_process(monkeypatch):
    spawned = {}

    def fake_popen(cmd, *a, **k):
        spawned["cmd"] = cmd
        return _FakeProc()

    monkeypatch.setattr("shell.sidecar.subprocess.Popen", fake_popen)
    mgr = SidecarManager(port=8765, main_path="/x/main.py")
    mgr.start()
    assert mgr.is_running() is True
    assert "--serve" in spawned["cmd"]
    assert "8765" in spawned["cmd"]


def test_stop_terminates(monkeypatch):
    monkeypatch.setattr("shell.sidecar.subprocess.Popen", lambda *a, **k: _FakeProc())
    mgr = SidecarManager(port=8765, main_path="/x/main.py")
    mgr.start()
    mgr.stop()
    assert mgr.is_running() is False


def test_health_check_true_on_200(monkeypatch):
    class _Resp:
        status = 200

        def __enter__(self):
            return self

        def __exit__(self, *a):
            return False

    monkeypatch.setattr(
        "shell.sidecar.urllib.request.urlopen", lambda url, timeout=1.0: _Resp()
    )
    mgr = SidecarManager(port=8765, main_path="/x/main.py")
    assert mgr.health_check() is True


def test_health_check_false_on_error(monkeypatch):
    def boom(url, timeout=1.0):
        raise OSError("refused")

    monkeypatch.setattr("shell.sidecar.urllib.request.urlopen", boom)
    mgr = SidecarManager(port=8765, main_path="/x/main.py")
    assert mgr.health_check() is False
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `cd desktop && python -m pytest tests/test_sidecar.py -v`
Expected: FAIL（`ModuleNotFoundError: No module named 'shell.sidecar'`）

- [ ] **Step 3: 實作 sidecar.py**

`desktop/shell/__init__.py`：空檔。

`desktop/shell/sidecar.py`:
```python
"""管理本機 API sidecar 子行程：啟動、停止、健康檢查。"""

import os
import subprocess
import sys
import urllib.error
import urllib.request
from typing import Optional


def _default_main_path() -> str:
    # dev：desktop/main.py；打包後（frozen）不使用此值（見 start()）
    return os.path.join(os.path.dirname(os.path.dirname(__file__)), "main.py")


class SidecarManager:
    def __init__(self, port: int, main_path: Optional[str] = None):
        self.port = port
        self.main_path = main_path or _default_main_path()
        self._proc: Optional[subprocess.Popen] = None

    def _serve_cmd(self) -> list:
        if getattr(sys, "frozen", False):
            # 打包後：執行檔自己帶 --serve
            return [sys.executable, "--serve", "--port", str(self.port)]
        return [sys.executable, self.main_path, "--serve", "--port", str(self.port)]

    def start(self) -> None:
        if self.is_running():
            return
        self._proc = subprocess.Popen(self._serve_cmd())

    def stop(self) -> None:
        if self._proc is not None:
            self._proc.terminate()
            try:
                self._proc.wait(timeout=5)
            except subprocess.TimeoutExpired:
                self._proc.kill()
            self._proc = None

    def is_running(self) -> bool:
        return self._proc is not None and self._proc.poll() is None

    def health_check(self, timeout: float = 1.0) -> bool:
        url = f"http://127.0.0.1:{self.port}/api/version"
        try:
            with urllib.request.urlopen(url, timeout=timeout) as resp:
                return resp.status == 200
        except (urllib.error.URLError, OSError):
            return False
```

- [ ] **Step 4: 跑測試確認通過**

Run: `cd desktop && python -m pytest tests/test_sidecar.py -v`
Expected: PASS（4 passed）

- [ ] **Step 5: Commit**

```bash
cd /Users/victor/Documents/ollie-reader
git add desktop/shell/__init__.py desktop/shell/sidecar.py desktop/tests/test_sidecar.py
git commit -m "feat(desktop): sidecar subprocess manager + health check"
```

---

## Task 12: 開機自啟（LaunchAgent，pytest TDD）

**Files:**
- Create: `desktop/shell/autostart.py`
- Test: `desktop/tests/test_autostart.py`

- [ ] **Step 1: 寫失敗測試**

`desktop/tests/test_autostart.py`:
```python
import plistlib

from shell import autostart


def test_install_writes_plist(tmp_path):
    path = autostart.install(["/Applications/ollie.app", "--serve"], home=tmp_path)
    assert path.exists()
    with open(path, "rb") as f:
        data = plistlib.load(f)
    assert data["Label"] == autostart.LABEL
    assert data["ProgramArguments"] == ["/Applications/ollie.app", "--serve"]
    assert data["RunAtLoad"] is True


def test_is_installed_and_uninstall(tmp_path):
    assert autostart.is_installed(home=tmp_path) is False
    autostart.install(["/x"], home=tmp_path)
    assert autostart.is_installed(home=tmp_path) is True
    autostart.uninstall(home=tmp_path)
    assert autostart.is_installed(home=tmp_path) is False
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `cd desktop && python -m pytest tests/test_autostart.py -v`
Expected: FAIL（`ImportError: cannot import name 'autostart'`）

- [ ] **Step 3: 實作 autostart.py**

`desktop/shell/autostart.py`:
```python
"""macOS 開機自啟：寫/移除 ~/Library/LaunchAgents 下的 LaunchAgent plist。"""

import plistlib
from pathlib import Path
from typing import List, Optional

LABEL = "com.ollie-reader.desktop"


def _plist_path(home: Optional[Path] = None) -> Path:
    base = home or Path.home()
    return base / "Library" / "LaunchAgents" / f"{LABEL}.plist"


def install(program_args: List[str], home: Optional[Path] = None) -> Path:
    path = _plist_path(home)
    path.parent.mkdir(parents=True, exist_ok=True)
    data = {
        "Label": LABEL,
        "ProgramArguments": program_args,
        "RunAtLoad": True,
        "KeepAlive": False,
    }
    with open(path, "wb") as f:
        plistlib.dump(data, f)
    return path


def uninstall(home: Optional[Path] = None) -> None:
    path = _plist_path(home)
    if path.exists():
        path.unlink()


def is_installed(home: Optional[Path] = None) -> bool:
    return _plist_path(home).exists()
```

- [ ] **Step 4: 跑測試確認通過**

Run: `cd desktop && python -m pytest tests/test_autostart.py -v`
Expected: PASS（2 passed）

- [ ] **Step 5: Commit**

```bash
cd /Users/victor/Documents/ollie-reader
git add desktop/shell/autostart.py desktop/tests/test_autostart.py
git commit -m "feat(desktop): login autostart via LaunchAgent"
```

---

## Task 13: PySide6 殼（系統匣 + 設定視窗，手動驗證）

**Files:**
- Create: `desktop/shell/app.py`

- [ ] **Step 1: 實作 shell/app.py**

`desktop/shell/app.py`:
```python
"""PySide6 殼：系統匣 icon + 設定視窗，監督本機 sidecar。"""

import sys

from PySide6.QtCore import QTimer
from PySide6.QtGui import QAction, QColor, QIcon, QPixmap
from PySide6.QtWidgets import (
    QApplication,
    QCheckBox,
    QDialog,
    QFormLayout,
    QLabel,
    QMenu,
    QPushButton,
    QSystemTrayIcon,
)

from server.config import DEFAULT_PORT
from shell import autostart
from shell.sidecar import SidecarManager

WEB_APP_URL = "http://localhost:5173"


def _dot_icon(color: str) -> QIcon:
    pix = QPixmap(16, 16)
    pix.fill(QColor(color))
    return QIcon(pix)


class SettingsDialog(QDialog):
    def __init__(self, manager: SidecarManager):
        super().__init__()
        self.manager = manager
        self.setWindowTitle("ollie-reader desktop 設定")
        layout = QFormLayout(self)

        self.status_label = QLabel("—")
        layout.addRow("狀態：", self.status_label)
        layout.addRow("Port：", QLabel(str(manager.port)))

        self.autostart_cb = QCheckBox("開機時自動啟動")
        self.autostart_cb.setChecked(autostart.is_installed())
        self.autostart_cb.toggled.connect(self._toggle_autostart)
        layout.addRow(self.autostart_cb)

        start_btn = QPushButton("啟動 sidecar")
        start_btn.clicked.connect(self.manager.start)
        stop_btn = QPushButton("停止 sidecar")
        stop_btn.clicked.connect(self.manager.stop)
        layout.addRow(start_btn, stop_btn)

        self._timer = QTimer(self)
        self._timer.timeout.connect(self._refresh)
        self._timer.start(2000)
        self._refresh()

    def _refresh(self):
        ok = self.manager.health_check()
        self.status_label.setText("● 運行中" if ok else "○ 已停止")

    def _toggle_autostart(self, checked: bool):
        if checked:
            autostart.install([sys.executable, "--serve", "--port", str(self.manager.port)])
        else:
            autostart.uninstall()


class TrayApp:
    def __init__(self, app: QApplication):
        self.app = app
        self.manager = SidecarManager(DEFAULT_PORT)
        self.tray = QSystemTrayIcon(_dot_icon("gray"))
        self.dialog = None

        menu = QMenu()
        self.status_action = QAction("狀態：啟動中…")
        self.status_action.setEnabled(False)
        menu.addAction(self.status_action)
        menu.addSeparator()

        start_action = QAction("啟動 sidecar")
        start_action.triggered.connect(self.manager.start)
        menu.addAction(start_action)

        stop_action = QAction("停止 sidecar")
        stop_action.triggered.connect(self.manager.stop)
        menu.addAction(stop_action)

        settings_action = QAction("開啟設定…")
        settings_action.triggered.connect(self._open_settings)
        menu.addAction(settings_action)

        web_action = QAction("開啟 web app")
        web_action.triggered.connect(self._open_web)
        menu.addAction(web_action)

        menu.addSeparator()
        quit_action = QAction("結束")
        quit_action.triggered.connect(self._quit)
        menu.addAction(quit_action)

        self.tray.setContextMenu(menu)
        self.tray.setToolTip("ollie-reader desktop")

        self._timer = QTimer()
        self._timer.timeout.connect(self._refresh)
        self._timer.start(3000)

    def start(self):
        self.manager.start()
        self.tray.show()
        self._refresh()

    def _refresh(self):
        ok = self.manager.health_check()
        self.tray.setIcon(_dot_icon("green" if ok else "gray"))
        self.status_action.setText("狀態：● 運行中" if ok else "狀態：○ 已停止")

    def _open_settings(self):
        if self.dialog is None:
            self.dialog = SettingsDialog(self.manager)
        self.dialog.show()
        self.dialog.raise_()

    def _open_web(self):
        from PySide6.QtGui import QDesktopServices
        from PySide6.QtCore import QUrl

        QDesktopServices.openUrl(QUrl(WEB_APP_URL))

    def _quit(self):
        self.manager.stop()
        self.app.quit()


def run_shell():
    app = QApplication(sys.argv)
    app.setQuitOnLastWindowClosed(False)
    tray = TrayApp(app)
    tray.start()
    sys.exit(app.exec())
```

- [ ] **Step 2: 手動驗證（dev 模式）**

Run: `cd /Users/victor/Documents/ollie-reader/desktop && source .venv/bin/activate && python main.py`
Expected:
- menubar 出現一個圖示；數秒後變綠（sidecar 啟動且健康檢查通過）。
- 選單可「開啟設定…」（出現設定視窗、顯示運行中、port 8765）、「停止 sidecar」（圖示轉灰）、「啟動 sidecar」（轉綠）、「開啟 web app」（瀏覽器開 5173）、「結束」（sidecar 一併關閉）。
- 勾「開機時自動啟動」→ 確認 `~/Library/LaunchAgents/com.ollie-reader.desktop.plist` 出現；取消勾選 → 消失。

- [ ] **Step 3: 整包測試（確認沒弄壞 Python 測試）**

Run: `cd desktop && python -m pytest -v`
Expected: 全數 PASS。

- [ ] **Step 4: Commit**

```bash
cd /Users/victor/Documents/ollie-reader
git add desktop/shell/app.py
git commit -m "feat(desktop): PySide6 tray + settings window"
```

---

## Task 14: 打包整個 app（殼為主程式）+ 端到端驗證

**Files:**
- Modify: `desktop/ollie-reader-desktop.spec`

- [ ] **Step 1: spec 改 console=False（殼為 GUI 主程式）**

把 `desktop/ollie-reader-desktop.spec` 的
```python
    name="ollie-reader-desktop", console=True,
```
改成
```python
    name="ollie-reader-desktop", console=False,
```
（main.py 無旗標時跑殼、`--serve` 時跑 sidecar；同一執行檔雙模式不變。）

- [ ] **Step 2: 重新打包**

Run: `cd /Users/victor/Documents/ollie-reader/desktop && source .venv/bin/activate && pyinstaller ollie-reader-desktop.spec --noconfirm`
Expected: 產出 `dist/ollie-reader-desktop/`。

- [ ] **Step 3: 端到端手動驗證**

```bash
# 啟動打包後的殼
/Users/victor/Documents/ollie-reader/desktop/dist/ollie-reader-desktop/ollie-reader-desktop &
# 另開 web app
cd /Users/victor/Documents/ollie-reader && npm run dev
```
Expected:
- menubar icon 變綠（殼成功 spawn 打包進去的 sidecar）。
- 瀏覽器 `http://localhost:5173` 上傳 PDF + Kokoro 朗讀 → Network 打 `127.0.0.1:8765`、回 WAV。
- 從 menubar「停止 sidecar」→ web app 再朗讀時自動 fallback 雲端（Network 變 Cloud Run，Piper 出聲）。

- [ ] **Step 4: Commit**

```bash
cd /Users/victor/Documents/ollie-reader
git add desktop/ollie-reader-desktop.spec
git commit -m "build(desktop): package PySide6 shell as the app entrypoint"
```

---

## Self-Review（plan 作者已執行）

**1. Spec 覆蓋：**
- §3 範圍 pdf/tts/ktts/version → Task 2/3/4/5 ✓；OIKID/translate/gcs 不動 → Task 8 明確只改 pdf extract + tts，fetch-url 留雲端 ✓
- §5.1 sidecar 合約一致 → Task 5 TestClient 驗 pdf/tts/ktts 形狀與雲端相同（含 speed→length_scale、bad voice 400、503）✓
- §5.2 殼 tray + 設定視窗 + 健康檢查/重啟 + 自啟 → Task 11/12/13 ✓
- §5.3 PyInstaller `--serve` 子命令、內建 torch+Kokoro → Task 6/10/14 ✓
- §5.4 resolver localhost 優先/雲端 fallback + Kokoro 503 處理 + 混合內容實測 → Task 7/8/9 ✓
- §9 最高風險（Safari/PNA）→ Task 9 專門驗證並回寫 spec ✓

**2. Placeholder 掃描：** 每個 code step 都有完整程式碼;手動驗證任務（GUI/打包/瀏覽器）本質無法 pytest，已明列具體操作與預期輸出，非 placeholder。

**3. 型別/簽名一致性：**
- `SpeechRequest{text,speed,voice}` 跨 models/app/測試一致 ✓
- `generate_speech(text, speaker, length_scale)` 在 tts_piper 與 app.py 呼叫一致;app.py 以模組層級名稱呼叫以利 monkeypatch ✓
- `kokoro_synthesize_speech(text, speed, voice)` 一致 ✓
- `getComputeBase()` 在 localBackend 定義、SpeechContext/PdfContext 使用一致 ✓
- `TTS_ENGINE_PATH`/`PDF_EXTRACT_PATH`/`VERSION_PATH` 在 constants 定義、各處引用一致 ✓
- `SidecarManager(port, main_path)` / `health_check()` 在 sidecar、測試、shell/app 一致 ✓
- `autostart.install/uninstall/is_installed(home=)` 簽名跨實作與測試一致 ✓

無發現未定義型別或不一致命名。

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-06-19-desktop-app.md`.**

> 建議里程碑：完成 **P0 + P1（Task 1–9）即可實際省成本 + 用 Kokoro**（手動跑 sidecar），是有價值的停損點;確認 Task 9 的瀏覽器實測通過後，再投資 P2 + P3 打包與殼。

Two execution options:

**1. Subagent-Driven (recommended)** — 每個 task 派一個全新 subagent 實作、task 之間我做兩段式 review，迭代快。

**2. Inline Execution** — 在本 session 直接用 executing-plans 批次執行、設檢查點 review。

**Which approach?**
