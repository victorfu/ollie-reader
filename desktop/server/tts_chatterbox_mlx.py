"""Chatterbox TTS 的 MLX 後端（mlx-audio，Apple Silicon 原生）。

與 tts_chatterbox.py（PyTorch/MPS 後端）介面對齊：同樣的 dataclass 結果、
狀態碼式例外、thread-safe singleton 與 voice-prompt conditionals 快取。
mlx-audio 相依延遲載入，sidecar 啟動時不會碰到；缺相依或載入失敗一律回
ChatterboxTTSError(503)。權重（CHATTERBOX_MLX_MODEL）由 Hugging Face 下載
快取，不打包進 bundle；預設 repo 內建 conds.safetensors（預設音色），不設定
voice prompt 也能發聲。

預設模型是 mlx-community/chatterbox-turbo-fp16（英文專用的 Chatterbox-Turbo，
對應 mlx-audio 的 chatterbox_turbo 類別）。注意**不要**用 mlx-community/
chatterbox-fp16 當英文引擎——那是 23 語的 multilingual 權重，英文發音明顯
比英文專用版差。兩種類別的 prepare_conditionals 慣例不同（multilingual 回傳
Conditionals、turbo 直接寫進 self._conds），本 wrapper 兩者都支援。
"""

import hashlib
import io
import logging
from pathlib import Path
from threading import Lock
from typing import Any, Optional

from server.tts_chatterbox import (
  ChatterboxTTSError,
  ChatterboxTTSResult,
  _generation_kwargs,
  _resolve_audio_prompt,
  _to_audio_ndarray,
)

logger = logging.getLogger(__name__)

_FALLBACK_SAMPLE_RATE = 24000  # Chatterbox 的 S3GEN 輸出取樣率


def _import_mlx_deps():
  """延遲載入 mlx-audio 生態。任一缺失視為「不可用」→ 503。"""
  try:
    import mlx.core as mx
    import numpy as np
    import soundfile as sf
    from mlx_audio.tts.utils import load_model

    return np, sf, mx, load_model
  except Exception as e:
    raise ChatterboxTTSError(
      f"Chatterbox MLX 後端不可用（缺少相依套件）: {type(e).__name__}: {e}",
      status_code=503,
    )


def _stable_seed(*parts: str) -> int:
  """把輸入內容映射成固定的 RNG 種子（跨機器、跨程序都相同）。"""
  digest = hashlib.sha256("\x1f".join(parts).encode("utf-8")).digest()
  return int.from_bytes(digest[:8], "big") & 0x7FFFFFFFFFFFFFFF


class ChatterboxMlxTTSService:
  _model: Any = None
  _lock: Lock = Lock()
  # 與 torch 後端相同策略的 voice-prompt conditionals 快取：以（路徑, mtime）為
  # key，同一個參考音檔只算一次，結果放在 model._conds（兩種 mlx 類別的
  # generate() 都會 fallback 到它）。無 prompt 時還原載入時 snapshot 的內建
  # conds（repo 的 conds.safetensors）。
  _builtin_conds: Any = None
  _prepared_prompt: Optional[tuple] = None  # (path, mtime_ns)；None = 內建音色
  # mx 的 RNG 是 global state：seed → generate 必須成對、不可與其他請求交錯，
  # 否則種子就失去意義。與 _lock 分開，避免和 conds 快取的鎖互相巢狀。
  _synth_lock: Lock = Lock()

  @classmethod
  def is_available(cls) -> bool:
    """相依是否齊備（不觸發模型載入）。缺 mlx-audio 時為 False。"""
    try:
      _import_mlx_deps()
      return True
    except ChatterboxTTSError:
      return False

  @classmethod
  def initialize(cls) -> None:
    """預先載入模型（首次會從 HF 下載權重）。可選在背景呼叫暖機。"""
    with cls._lock:
      cls._get_model_locked()

  @classmethod
  def _get_model_locked(cls):
    if cls._model is None:
      _np, _sf, _mx, load_model = _import_mlx_deps()
      from server.config import CHATTERBOX_MLX_MODEL

      try:
        logger.info("正在載入 Chatterbox MLX 模型（%s）", CHATTERBOX_MLX_MODEL)
        cls._model = load_model(CHATTERBOX_MLX_MODEL)
        cls._builtin_conds = getattr(cls._model, "_conds", None)
        cls._prepared_prompt = None
        logger.info("Chatterbox MLX 模型載入成功")
      except ChatterboxTTSError:
        raise
      except Exception as e:
        raise ChatterboxTTSError(
          f"Chatterbox MLX 初始化失敗: {type(e).__name__}: {e}",
          status_code=503,
        ) from e
    return cls._model

  @classmethod
  def _get_model(cls):
    if cls._model is not None:
      return cls._model
    with cls._lock:
      return cls._get_model_locked()

  @classmethod
  def _ensure_conditionals(cls, model: Any, audio_prompt_path: Optional[str]) -> None:
    """讓 model._conds 對應指定的 voice prompt，只在 prompt 變動時重算。

    以（路徑, mtime）當快取 key。prompt 為 None 時還原載入時 snapshot 的內建
    conds。multilingual 類別的 prepare_conditionals 回傳 Conditionals（不寫回
    model），turbo 類別直接寫進 model._conds 並回傳 None——兩種都處理。
    """
    if audio_prompt_path is None:
      with cls._lock:
        if cls._prepared_prompt is not None:
          model._conds = cls._builtin_conds
          cls._prepared_prompt = None
      return

    try:
      mtime_ns = Path(audio_prompt_path).stat().st_mtime_ns
    except OSError:
      mtime_ns = None
    key = (audio_prompt_path, mtime_ns)
    with cls._lock:
      if cls._prepared_prompt != key:
        logger.info("正在計算 voice prompt conditionals: %s", audio_prompt_path)
        returned = model.prepare_conditionals(audio_prompt_path, _FALLBACK_SAMPLE_RATE)
        if returned is not None:
          model._conds = returned
        cls._prepared_prompt = key

  @classmethod
  def synthesize(
    cls,
    text: str,
    speed: float = 1.0,
    voice: Optional[str] = None,
  ) -> ChatterboxTTSResult:
    from server.config import CHATTERBOX_AUDIO_PROMPT_PATH, CHATTERBOX_DEFAULT_VOICE

    # speed：與 torch 後端一致——Chatterbox 沒有原生語速參數，接收但忽略。
    _ = speed

    effective_voice = voice if (voice and voice.strip()) else CHATTERBOX_DEFAULT_VOICE
    audio_prompt_path = _resolve_audio_prompt(effective_voice, CHATTERBOX_AUDIO_PROMPT_PATH)

    try:
      np, sf, mx, _load_model = _import_mlx_deps()
      model = cls._get_model()

      # 生成參數只放使用者用 env 明確設定的（cfg_weight/temperature/exaggeration）；
      # 沒設就用各模型類別自己的預設。turbo 類別會忽略 cfg_weight/exaggeration
      # 並記 warning——那是使用者設了不適用旋鈕的正確回饋，不在這裡吞掉。
      gen_kwargs = _generation_kwargs()

      cls._ensure_conditionals(model, audio_prompt_path)
      if getattr(model, "_conds", None) is None:
        raise ChatterboxTTSError(
          "Chatterbox MLX 模型沒有內建音色（缺 conds.safetensors），"
          "請設定 voice 或 CHATTERBOX_AUDIO_PROMPT_PATH",
          status_code=400,
        )

      # 發音一致性：Chatterbox 是隨機取樣的生成模型，不固定種子的話同一個字在
      # 不同機器（甚至同機器不同次）可能唸法不同——對單字學習是大問題（例如
      # comb 有機率被唸出 b 音且各機不一致）。以（文字, voice prompt）的 hash
      # 當種子，同樣輸入在任何機器都走同一條取樣路徑、輸出相同語音。
      # generate() 是 generator，長文本可能分段 yield；全部收集後串接。
      chunks = []
      sample_rate = None
      with cls._synth_lock:
        mx.random.seed(_stable_seed(text, audio_prompt_path or ""))
        for result in model.generate(text, verbose=False, **gen_kwargs):
          chunks.append(_to_audio_ndarray(result.audio, np))
          sample_rate = getattr(result, "sample_rate", None) or sample_rate

      audio_np = (
        np.concatenate(chunks) if len(chunks) > 1 else (chunks[0] if chunks else np.zeros(0))
      )
      if audio_np.size == 0:
        raise ChatterboxTTSError("Chatterbox MLX 未產生任何音訊", status_code=500)

      if sample_rate is None:
        sample_rate = getattr(model, "sample_rate", _FALLBACK_SAMPLE_RATE)

      audio_buffer = io.BytesIO()
      sf.write(audio_buffer, audio_np, int(sample_rate), format="WAV")
      return ChatterboxTTSResult(
        audio_data=audio_buffer.getvalue(),
        content_type="audio/wav",
      )
    except ChatterboxTTSError:
      raise
    except Exception as e:
      raise ChatterboxTTSError(
        f"Chatterbox MLX 語音合成失敗: {type(e).__name__}: {e}",
        status_code=500,
      ) from e
