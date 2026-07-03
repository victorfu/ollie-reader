"""Chatterbox-Turbo TTS（PyTorch-based，高品質英文 AI 語音）。

這是可選的重量級引擎：所有 torch / torchaudio / chatterbox 相依都延遲到
_import_chatterbox_deps，sidecar 啟動時不會載入。缺相依、模型載入失敗或機器不
支援時一律回 ChatterboxTTSError(503)（前端不做引擎降級，會直接顯示錯誤）。
模型權重不打包進 bundle，由 chatterbox / Hugging Face 自行 cache。

設計刻意對齊 tts_kokoro.py：dataclass 結果、狀態碼式例外、thread-safe singleton。
"""

import inspect
import io
import logging
from dataclasses import dataclass
from pathlib import Path
from threading import Lock
from typing import Any, Optional

logger = logging.getLogger(__name__)


@dataclass
class ChatterboxTTSResult:
  audio_data: bytes
  content_type: str = "audio/wav"


class ChatterboxTTSError(Exception):
  def __init__(self, message: str, status_code: int = 500):
    self.message = message
    self.status_code = status_code
    super().__init__(self.message)


# Chatterbox 各版本把模型類別放在不同模組。依序嘗試，優先用「Turbo」變體（若某個
# 版本 / fork 有提供），否則退回目前 PyPI 穩定版 chatterbox-tts 的 ChatterboxTTS。
# 這些類別的 API 相容：from_pretrained(device) / generate(text, audio_prompt_path=...)
# 回傳 (1, N) 的 torch tensor / .sr 為取樣率——本 wrapper 的輸出轉檔對兩者皆適用。
# 注意：published chatterbox-tts 0.1.3 目前「沒有」ChatterboxTurboTTS，實際會用
# ChatterboxTTS；保留 turbo 候選是為了相容未來版本，不會讓現況壞掉。
_CHATTERBOX_CLASS_CANDIDATES = (
  ("chatterbox.tts_turbo", "ChatterboxTurboTTS"),
  ("chatterbox.tts", "ChatterboxTTS"),
)


def _import_chatterbox_deps():
  """延遲載入 torch 生態系與 chatterbox。任何一個缺失都視為「不可用」→ 503。"""
  try:
    import importlib

    import numpy as np
    import soundfile as sf
    import torch
    import torchaudio  # noqa: F401 -- chatterbox 需要；此處作為可用性檢查

    model_cls = None
    tried = []
    for module_name, class_name in _CHATTERBOX_CLASS_CANDIDATES:
      try:
        module = importlib.import_module(module_name)
        model_cls = getattr(module, class_name)
        break
      except (ImportError, AttributeError) as e:
        tried.append(f"{module_name}.{class_name} ({type(e).__name__})")
    if model_cls is None:
      raise ImportError(
        "找不到可用的 Chatterbox 模型類別；嘗試過: " + "; ".join(tried)
      )

    return np, sf, torch, model_cls
  except Exception as e:
    raise ChatterboxTTSError(
      f"Chatterbox Turbo 不可用（缺少相依套件）: {type(e).__name__}: {e}",
      status_code=503,
    )


def _select_device(torch: Any) -> str:
  """CHATTERBOX_DEVICE 優先；否則 cuda → macOS mps → cpu。"""
  from server.config import CHATTERBOX_DEVICE

  if CHATTERBOX_DEVICE:
    return CHATTERBOX_DEVICE
  try:
    if torch.cuda.is_available():
      return "cuda"
  except Exception:
    pass
  try:
    if torch.backends.mps.is_available():
      return "mps"
  except Exception:
    pass
  return "cpu"


def _resolve_audio_prompt(voice: Optional[str], default_path: Optional[str]) -> Optional[str]:
  """決定要用哪個 audio_prompt_path（voice clone 參考音檔）。

  策略（與 spec 一致）：
    - voice 為非空字串 → 當作 audio_prompt_path；
    - 否則退回 CHATTERBOX_AUDIO_PROMPT_PATH（env 預設）；
    - 兩者皆空 → None（使用模型內建音色）。
  若最終選定的檔案不存在，回 400 而非安靜地忽略——避免使用者以為套用了 voice
  clone，實際上卻用了預設音色。
  """
  candidate = voice.strip() if (voice and voice.strip()) else default_path
  if not candidate:
    return None
  if not Path(candidate).is_file():
    raise ChatterboxTTSError(
      f"Chatterbox voice/audio_prompt_path 檔案不存在: {candidate}",
      status_code=400,
    )
  return candidate


def _generation_kwargs() -> dict:
  """從 env 組出 generate() 的可調參數；未設定的就不放（沿用 library 預設，不改音質）。

  這些是「品質/語氣」旋鈕，不是速度旋鈕。原本想用 cfg_weight=0 關掉 CFG 的雙倍 T3
  計算來加速，但實測 chatterbox-tts 0.1.3 的 t3 inference 迴圈寫死 batch=2
  （bos_embed 一律複製成 2、logits 讀 [0:1]/[1:2]），而 generate() 只有在
  cfg_weight>0 時才把 text_tokens 複製成 2 → cfg_weight=0 會 batch 1 vs 2 shape
  mismatch（RuntimeError）。因此在此版本 cfg_weight<=0 不可用（且 >0 的任何值仍是
  batch=2、不會加速）。這裡把 <=0 擋掉避免 crash。
  """
  from server.config import (
    CHATTERBOX_CFG_WEIGHT,
    CHATTERBOX_EXAGGERATION,
    CHATTERBOX_TEMPERATURE,
  )

  kwargs: dict = {}
  if CHATTERBOX_CFG_WEIGHT is not None:
    if CHATTERBOX_CFG_WEIGHT > 0:
      kwargs["cfg_weight"] = CHATTERBOX_CFG_WEIGHT
    else:
      logger.warning(
        "CHATTERBOX_CFG_WEIGHT=%s 會關閉 CFG，但目前安裝的 chatterbox 版本不支援"
        "（t3 inference 寫死 batch=2，會 shape mismatch）；已忽略，改用模型預設。",
        CHATTERBOX_CFG_WEIGHT,
      )
  if CHATTERBOX_TEMPERATURE is not None:
    kwargs["temperature"] = CHATTERBOX_TEMPERATURE
  if CHATTERBOX_EXAGGERATION is not None:
    kwargs["exaggeration"] = CHATTERBOX_EXAGGERATION
  return kwargs


def _filter_supported_kwargs(func: Any, kwargs: dict) -> dict:
  """只保留 func 簽名吃得下的關鍵字參數；有 **kwargs 就全放。

  讓 generate() 的參數（cfg_weight 等）在不同 chatterbox 類別/版本間安全傳遞：某個
  變體若不支援某參數，就靜默略過而非 TypeError。
  """
  try:
    sig = inspect.signature(func)
  except (TypeError, ValueError):
    return dict(kwargs)
  params = list(sig.parameters.values())
  if any(p.kind == inspect.Parameter.VAR_KEYWORD for p in params):
    return dict(kwargs)
  allowed = {p.name for p in params}
  return {k: v for k, v in kwargs.items() if k in allowed}


def _to_audio_ndarray(wav: Any, np: Any):
  """把 model.generate 產出的 torch.Tensor 或 ndarray 轉成 soundfile 可寫的一維陣列。

  用 duck typing 處理 tensor（detach/cpu/numpy），避免在此再 import torch。
  """
  if hasattr(wav, "detach"):
    wav = wav.detach()
  if hasattr(wav, "cpu"):
    wav = wav.cpu()
  if hasattr(wav, "numpy"):
    wav = wav.numpy()
  audio = np.asarray(wav)
  audio = np.squeeze(audio)  # (1, N) -> (N,)
  return np.ascontiguousarray(audio)


class ChatterboxTurboTTSService:
  _instance: Optional["ChatterboxTurboTTSService"] = None
  _model: Any = None
  _device: Optional[str] = None
  _lock: Lock = Lock()

  def __new__(cls) -> "ChatterboxTurboTTSService":
    if cls._instance is None:
      with cls._lock:
        if cls._instance is None:
          cls._instance = super().__new__(cls)
    return cls._instance

  @classmethod
  def is_available(cls) -> bool:
    """相依是否齊備（不觸發模型載入）。缺 torch/chatterbox 時為 False。"""
    try:
      _import_chatterbox_deps()
      return True
    except ChatterboxTTSError:
      return False

  @classmethod
  def initialize(cls) -> None:
    """預先載入模型（重：會拉 torch + 權重）。可選在背景呼叫暖機。"""
    with cls._lock:
      cls._get_model_locked()

  @classmethod
  def _get_model_locked(cls):
    if cls._model is None:
      _np, _sf, torch, ChatterboxTurboTTS = _import_chatterbox_deps()
      device = _select_device(torch)
      try:
        logger.info("正在載入 Chatterbox Turbo 模型（device=%s）", device)
        cls._model = ChatterboxTurboTTS.from_pretrained(device=device)
        cls._device = device
        logger.info("Chatterbox Turbo 模型載入成功（device=%s）", device)
      except ChatterboxTTSError:
        raise
      except Exception as e:
        # 模型載入失敗（下載失敗、記憶體不足、裝置不支援…）一律當作「不可用」→ 503。
        raise ChatterboxTTSError(
          f"Chatterbox Turbo 初始化失敗: {type(e).__name__}: {e}",
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
  def synthesize(
    cls,
    text: str,
    speed: float = 1.0,
    voice: Optional[str] = None,
  ) -> ChatterboxTTSResult:
    from server.config import CHATTERBOX_AUDIO_PROMPT_PATH, CHATTERBOX_DEFAULT_VOICE

    # speed：Chatterbox-Turbo 目前沒有原生語速參數。刻意「接收但忽略」——用
    # time-stretch 強行變速會明顯劣化這種 neural TTS 的音質，寧可維持原速。
    # 保留簽名一致（與 Piper/Kokoro 同介面），未來上游支援時再接上。
    _ = speed

    # voice 為空時退回 env 預設 voice，再退回 env 預設 audio_prompt_path。
    effective_voice = voice if (voice and voice.strip()) else CHATTERBOX_DEFAULT_VOICE
    audio_prompt_path = _resolve_audio_prompt(effective_voice, CHATTERBOX_AUDIO_PROMPT_PATH)

    try:
      np, sf, _torch, _model_cls = _import_chatterbox_deps()
      model = cls._get_model()

      gen_kwargs = _generation_kwargs()
      if audio_prompt_path:
        gen_kwargs["audio_prompt_path"] = audio_prompt_path
      gen_kwargs = _filter_supported_kwargs(model.generate, gen_kwargs)
      wav = model.generate(text, **gen_kwargs)

      audio_np = _to_audio_ndarray(wav, np)
      if audio_np.size == 0:
        raise ChatterboxTTSError("Chatterbox Turbo 未產生任何音訊", status_code=500)

      audio_buffer = io.BytesIO()
      sf.write(audio_buffer, audio_np, model.sr, format="WAV")
      return ChatterboxTTSResult(
        audio_data=audio_buffer.getvalue(),
        content_type="audio/wav",
      )
    except ChatterboxTTSError:
      # import 缺相依(503)、模型初始化失敗(503)、空音訊(500) 等已帶狀態碼，直接往上傳。
      raise
    except Exception as e:
      # generate / 音訊轉檔階段的未預期錯誤 → 500。
      raise ChatterboxTTSError(
        f"Chatterbox Turbo 語音合成失敗: {type(e).__name__}: {e}",
        status_code=500,
      ) from e


def chatterbox_synthesize_speech(
  text: str,
  speed: float = 1.0,
  voice: Optional[str] = None,
) -> ChatterboxTTSResult:
  return ChatterboxTurboTTSService.synthesize(text=text, speed=speed, voice=voice)
