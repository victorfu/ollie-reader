"""Kokoro TTS via ONNX Runtime（kokoro-onnx，不需 PyTorch）。

所有重量級 import 延遲到 _import_kokoro_deps；缺相依時回 KokoroTTSError(503)。
模型與 voices 檔放在 models/（打包進 bundle，路徑見 server.config）。
單一 Kokoro 引擎即可處理所有語言（lang 是 create 的逐次參數）。
"""

import io
import logging
from dataclasses import dataclass
from threading import Lock
from typing import Any, Optional

logger = logging.getLogger(__name__)

# voice 第一個字母 → kokoro-onnx 語言碼（a=美式英語、b=英式英語）。
_VOICE_PREFIX_LANG = {"a": "en-us", "b": "en-gb"}


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
    from kokoro_onnx import Kokoro

    return np, sf, Kokoro
  except Exception as e:
    raise KokoroTTSError(
      f"Kokoro 不可用（缺少相依套件）: {type(e).__name__}: {e}",
      status_code=503,
    )


def _lang_from_voice(voice: str, default_lang: str) -> str:
  if voice and voice[0] in _VOICE_PREFIX_LANG:
    return _VOICE_PREFIX_LANG[voice[0]]
  return default_lang


class KokoroTTSService:
  _instance: Optional["KokoroTTSService"] = None
  _engine: Any = None
  _lock: Lock = Lock()

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
  def initialize(cls) -> None:
    """預先載入引擎（torch-free，但仍有 onnx 模型載入成本）。

    可在 sidecar 啟動時於背景呼叫，把首次合成的延遲挪離使用者第一次朗讀。
    """
    with cls._lock:
      cls._get_engine_locked()

  @classmethod
  def _get_engine_locked(cls):
    if cls._engine is None:
      from server.config import KOKORO_MODEL_PATH, KOKORO_VOICES_PATH

      try:
        _np, _sf, Kokoro = _import_kokoro_deps()
        cls._engine = Kokoro(KOKORO_MODEL_PATH, KOKORO_VOICES_PATH)
      except KokoroTTSError:
        raise
      except Exception as e:
        raise KokoroTTSError(
          f"Kokoro 初始化失敗: {type(e).__name__}: {e}",
          status_code=503,
        ) from e
    return cls._engine

  @classmethod
  def _get_engine(cls):
    if cls._engine is not None:
      return cls._engine
    with cls._lock:
      return cls._get_engine_locked()

  @classmethod
  def synthesize(
    cls,
    text: str,
    speed: float = 1.0,
    voice: Optional[str] = None,
    lang: Optional[str] = None,
  ) -> KokoroTTSResult:
    from server.config import KOKORO_DEFAULT_LANG, KOKORO_DEFAULT_VOICE

    voice = voice or KOKORO_DEFAULT_VOICE
    if lang is None:
      lang = _lang_from_voice(voice, KOKORO_DEFAULT_LANG)

    try:
      np, sf, _Kokoro = _import_kokoro_deps()
      engine = cls._get_engine()
      samples, sample_rate = engine.create(text, voice=voice, speed=speed, lang=lang)
      if samples is None or len(samples) == 0:
        raise KokoroTTSError("Kokoro 未產生任何音訊", status_code=500)
      audio_buffer = io.BytesIO()
      sf.write(audio_buffer, np.asarray(samples), sample_rate, format="WAV")
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
