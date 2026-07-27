"""Edge TTS：走 Microsoft Edge「大聲朗讀」的線上服務。

套件是 rany2/edge-tts（PyPI `edge-tts`，import `edge_tts`，LGPL-3.0），
逆向 Edge 的未公開端點而來，**不是** Azure 官方 SDK（官方那條走 tts_azure.py）。

注意這是**雲端**引擎，需要網路 —— 和 Piper/Kokoro 的離線定位不同，UI 要標清楚。
它端出來的是 Azure Neural 的同一批聲音，但不需要任何金鑰。

已知脆弱點：edge-tts 依賴會隨 Edge 改版輪替的 Sec-MS-GEC token，
過期時服務端回 403。這裡把 403 原樣轉成有意義的訊息，讓呼叫端看得見，
而不是靜默失敗（聽力題的音檔就是題目本身，靜默失敗等於無解）。
"""

import logging
from dataclasses import dataclass
from typing import Any, Optional

logger = logging.getLogger(__name__)

DEFAULT_EDGE_VOICE = "en-US-EmmaMultilingualNeural"


@dataclass
class EdgeTTSResult:
  audio_data: bytes
  content_type: str = "audio/mpeg"


class EdgeTTSError(Exception):
  def __init__(self, message: str, status_code: int = 500):
    self.message = message
    self.status_code = status_code
    super().__init__(self.message)


def _import_edge_tts() -> Any:
  try:
    import edge_tts

    return edge_tts
  except Exception as e:
    raise EdgeTTSError(
      f"Edge TTS 不可用（缺少 edge-tts 套件）: {type(e).__name__}: {e}",
      status_code=503,
    ) from e


def is_available() -> bool:
  try:
    _import_edge_tts()
    return True
  except EdgeTTSError:
    return False


def _rate_from_speed(speed: float) -> str:
  """速率轉成 edge-tts 的百分比字串：1.0→"+0%"、1.5→"+50%"、0.5→"-50%"。

  服務端只接受 ±100% 內的整數百分比，超出會被拒，故先 clamp。
  """
  if not speed or speed <= 0:
    speed = 1.0
  percent = round((speed - 1.0) * 100)
  percent = max(-50, min(100, percent))
  return f"{percent:+d}%"


def _friendly_error(exc: Exception) -> EdgeTTSError:
  text = f"{type(exc).__name__}: {exc}"
  if "403" in text:
    return EdgeTTSError(
      "Edge TTS 被服務端拒絕（403）。這通常是 edge-tts 的 Sec-MS-GEC token "
      "隨 Edge 改版失效，升級 edge-tts 套件即可。",
      status_code=502,
    )
  return EdgeTTSError(f"Edge TTS 語音合成失敗: {text}", status_code=502)


async def edge_synthesize_speech(
  text: str,
  speed: float = 1.0,
  voice: Optional[str] = None,
) -> EdgeTTSResult:
  """合成語音並回傳 MP3。edge-tts 本身是 asyncio，直接 await，不要丟到 threadpool。"""
  if not text or not text.strip():
    raise EdgeTTSError("text 不可為空", status_code=400)

  edge_tts = _import_edge_tts()
  chosen_voice = (voice or DEFAULT_EDGE_VOICE).strip() or DEFAULT_EDGE_VOICE

  try:
    communicate = edge_tts.Communicate(
      text,
      voice=chosen_voice,
      rate=_rate_from_speed(speed),
    )
    chunks = bytearray()
    async for chunk in communicate.stream():
      if chunk.get("type") == "audio" and chunk.get("data"):
        chunks.extend(chunk["data"])
  except Exception as e:
    raise _friendly_error(e) from e

  if not chunks:
    raise EdgeTTSError("Edge TTS 未產生任何音訊", status_code=502)

  return EdgeTTSResult(audio_data=bytes(chunks))


async def list_edge_voices(locale_prefix: Optional[str] = "en") -> list[dict]:
  """列出可用聲音；locale_prefix 為 None 表示不過濾（約 300+ 個）。"""
  edge_tts = _import_edge_tts()
  try:
    voices = await edge_tts.list_voices()
  except Exception as e:
    raise _friendly_error(e) from e

  result = []
  for v in voices:
    short_name = v.get("ShortName") or ""
    if locale_prefix and not short_name.lower().startswith(locale_prefix.lower()):
      continue
    result.append(
      {
        "id": short_name,
        "locale": v.get("Locale") or "",
        "gender": v.get("Gender") or "",
        "label": f"{short_name} ({v.get('Gender') or '?'})",
      }
    )
  result.sort(key=lambda item: item["id"])
  return result
