"""Piper TTS wrapper copied from purism-ev-bot services/tts_service.py.

Uses server.config for Ollie Reader desktop settings.
"""

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
  """TTS generation result."""

  audio_data: bytes
  content_type: str = "audio/wav"


class TTSError(Exception):
  """TTS processing error with an HTTP-style status code."""

  def __init__(self, message: str, status_code: int = 500):
    self.message = message
    self.status_code = status_code
    super().__init__(self.message)


class TTSService:
  """Thread-safe singleton wrapper around a cached PiperVoice model."""

  _instance: Optional["TTSService"] = None
  _voice: Optional[PiperVoice] = None
  _model_path: Optional[str] = None
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
    """Preload the Piper model, using server.config.PIPER_MODEL_PATH by default."""
    if cls._initialized and cls._voice is not None:
      logger.info("Piper 模型已載入，跳過初始化")
      return

    with cls._lock:
      if cls._initialized and cls._voice is not None:
        return

      if model_path is None:
        from server.config import PIPER_MODEL_PATH

        model_path = PIPER_MODEL_PATH

      cls._model_path = model_path
      model_file = Path(model_path)

      if not model_file.exists():
        error_msg = f"Piper 模型檔案不存在: {model_file.absolute()}"
        logger.error(error_msg)
        raise TTSError(error_msg, status_code=404)

      if model_file.suffix.lower() != ".onnx":
        error_msg = f"Piper 模型格式錯誤，預期 .onnx 檔案: {model_path}"
        logger.error(error_msg)
        raise TTSError(error_msg, status_code=400)

      try:
        logger.info("正在載入 Piper 模型: %s", model_path)
        cls._voice = PiperVoice.load(model_path)
        cls._initialized = True
        logger.info("Piper 模型載入成功: %s", model_path)
      except MemoryError as e:
        error_msg = f"Piper 模型載入失敗 - 記憶體不足: {model_path}"
        logger.error("%s, 原始錯誤: %s", error_msg, e)
        raise TTSError(error_msg, status_code=503) from e
      except Exception as e:
        error_msg = f"Piper 模型載入失敗: {model_path}"
        logger.error("%s, 原始錯誤: %s: %s", error_msg, type(e).__name__, e)
        raise TTSError(
          f"{error_msg} - {type(e).__name__}: {e}",
          status_code=500,
        ) from e

  @classmethod
  def get_voice(cls) -> PiperVoice:
    """Return the cached PiperVoice, lazily initializing it if needed."""
    if cls._voice is None:
      cls.initialize()
    if cls._voice is None:
      raise TTSError("Piper 模型尚未載入", status_code=500)
    return cls._voice

  @classmethod
  def is_initialized(cls) -> bool:
    """Return whether the Piper model is loaded."""
    return cls._initialized and cls._voice is not None

  @classmethod
  def synthesize(
    cls,
    text: str,
    speaker: int = 0,
    length_scale: float = 1.0,
    noise_scale: float = 0.667,
    noise_w_scale: float = 0.8,
  ) -> TTSResult:
    """Convert text to WAV bytes in memory."""
    logger.info("開始 Piper TTS 轉換: %s", text[:50] + ("..." if len(text) > 50 else ""))
    logger.debug("Piper TTS 參數 - speaker: %s, length_scale: %s", speaker, length_scale)

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

      audio_data = audio_buffer.getvalue()
      logger.info("Piper TTS 轉換成功，音訊大小: %s bytes", len(audio_data))
      return TTSResult(audio_data=audio_data, content_type="audio/wav")

    except Exception as e:
      error_msg = f"語音合成失敗: {type(e).__name__}: {e}"
      logger.error(error_msg)
      raise TTSError(error_msg, status_code=500) from e


def generate_speech(
  text: str,
  speaker: int = 0,
  length_scale: float = 1.0,
  noise_scale: float = 0.667,
  noise_w_scale: float = 0.8,
  model_path: Optional[str] = None,
) -> TTSResult:
  """Backward-compatible function API for generating Piper speech."""
  if model_path is not None:
    logger.warning(
      "generate_speech() 的 model_path 參數已棄用，"
      "請使用環境變數 PIPER_MODEL_PATH 或 server.config.PIPER_MODEL_PATH 設定模型路徑"
    )

  return TTSService.synthesize(
    text=text,
    speaker=speaker,
    length_scale=length_scale,
    noise_scale=noise_scale,
    noise_w_scale=noise_w_scale,
  )
