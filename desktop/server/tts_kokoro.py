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
      try:
        _np, _sf, KPipeline = _import_kokoro_deps()
        pipeline = KPipeline(lang_code=lang_code)
      except KokoroTTSError:
        raise
      except Exception as e:
        raise KokoroTTSError(
          f"Kokoro 初始化失敗: {type(e).__name__}: {e}",
          status_code=503,
        ) from e
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

    try:
      np, sf, _KPipeline = _import_kokoro_deps()
      pipeline = cls._get_pipeline(lang_code)
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
        audio_data=audio_buffer.getvalue(),
        content_type="audio/wav",
      )
    except KokoroTTSError:
      raise
    except Exception as e:
      raise KokoroTTSError(
        f"Kokoro 語音合成失敗: {type(e).__name__}: {e}",
        status_code=500,
      )


def kokoro_synthesize_speech(
  text: str,
  speed: float = 1.0,
  voice: Optional[str] = None,
) -> KokoroTTSResult:
  return KokoroTTSService.synthesize(text=text, speed=speed, voice=voice)
