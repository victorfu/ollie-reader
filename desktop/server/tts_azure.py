"""Azure AI Speech（官方 SDK）。與 tts_edge 端出同一批 Neural 聲音，差別在：

  - 需要訂閱金鑰 + region。金鑰由使用者在 desktop 設定視窗輸入，存 OS keychain
    （見 server.tts_secrets），**不得**打包進 .app。
  - 官方端點，不依賴會過期的 token，也支援完整 SSML。

同樣是雲端引擎，需要網路。SDK 為可選相依（uv sync --group azure），缺套件回 503。
"""

import logging
from dataclasses import dataclass
from html import escape
from typing import Any, Optional

logger = logging.getLogger(__name__)

DEFAULT_AZURE_VOICE = "en-US-EmmaMultilingualNeural"


@dataclass
class AzureTTSResult:
  audio_data: bytes
  content_type: str = "audio/mpeg"


class AzureTTSError(Exception):
  def __init__(self, message: str, status_code: int = 500):
    self.message = message
    self.status_code = status_code
    super().__init__(self.message)


def _import_speechsdk() -> Any:
  try:
    import azure.cognitiveservices.speech as speechsdk

    return speechsdk
  except Exception as e:
    raise AzureTTSError(
      "Azure TTS 不可用（缺少 azure-cognitiveservices-speech）。"
      "請執行 `uv sync --group azure`。"
      f" 原始錯誤: {type(e).__name__}: {e}",
      status_code=503,
    ) from e


def is_available() -> bool:
  try:
    _import_speechsdk()
    return True
  except AzureTTSError:
    return False


def _require_credentials() -> tuple[str, str]:
  from server.tts_secrets import get_azure_credentials

  creds = get_azure_credentials()
  if not creds:
    raise AzureTTSError(
      "尚未設定 Azure 金鑰。請在 desktop 設定視窗的「語音測試」頁輸入 key 與 region。",
      status_code=503,
    )
  return creds


def _speech_config(speechsdk: Any):
  key, region = _require_credentials()
  config = speechsdk.SpeechConfig(subscription=key, region=region)
  config.set_speech_synthesis_output_format(
    speechsdk.SpeechSynthesisOutputFormat.Audio24Khz48KBitRateMonoMp3
  )
  return config


def _build_ssml(text: str, voice: str, speed: float) -> str:
  """用 SSML 帶語速。官方 API 支援完整 SSML（Edge 那條側門不支援）。"""
  if not speed or speed <= 0:
    speed = 1.0
  percent = max(-50, min(100, round((speed - 1.0) * 100)))
  locale = "-".join(voice.split("-")[:2]) if "-" in voice else "en-US"
  return (
    f'<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" '
    f'xml:lang="{escape(locale, quote=True)}">'
    f'<voice name="{escape(voice, quote=True)}">'
    f'<prosody rate="{percent:+d}%">{escape(text)}</prosody>'
    f"</voice></speak>"
  )


def azure_synthesize_speech(
  text: str,
  speed: float = 1.0,
  voice: Optional[str] = None,
) -> AzureTTSResult:
  """同步合成（SDK 為阻塞式，呼叫端請用 run_in_threadpool）。"""
  if not text or not text.strip():
    raise AzureTTSError("text 不可為空", status_code=400)

  speechsdk = _import_speechsdk()
  chosen_voice = (voice or DEFAULT_AZURE_VOICE).strip() or DEFAULT_AZURE_VOICE

  try:
    synthesizer = speechsdk.SpeechSynthesizer(
      speech_config=_speech_config(speechsdk),
      audio_config=None,  # 不要播到本機喇叭，我們要拿 bytes
    )
    result = synthesizer.speak_ssml_async(
      _build_ssml(text, chosen_voice, speed)
    ).get()
  except AzureTTSError:
    raise
  except Exception as e:
    raise AzureTTSError(
      f"Azure TTS 語音合成失敗: {type(e).__name__}: {e}", status_code=502
    ) from e

  if result.reason != speechsdk.ResultReason.SynthesizingAudioCompleted:
    detail = getattr(result, "reason", "unknown")
    cancellation = getattr(result, "cancellation_details", None)
    if cancellation is not None:
      detail = f"{cancellation.reason}: {cancellation.error_details}"
    # 金鑰/region 錯誤最常見，歸到 502 讓前端顯示而非當成本機 bug
    raise AzureTTSError(f"Azure TTS 未完成合成（{detail}）", status_code=502)

  return AzureTTSResult(audio_data=bytes(result.audio_data))


def list_azure_voices(locale_prefix: Optional[str] = "en") -> list[dict]:
  speechsdk = _import_speechsdk()
  try:
    synthesizer = speechsdk.SpeechSynthesizer(
      speech_config=_speech_config(speechsdk),
      audio_config=None,
    )
    result = synthesizer.get_voices_async().get()
  except AzureTTSError:
    raise
  except Exception as e:
    raise AzureTTSError(
      f"Azure 取得聲音清單失敗: {type(e).__name__}: {e}", status_code=502
    ) from e

  if result.reason != speechsdk.ResultReason.VoicesListRetrieved:
    raise AzureTTSError(
      f"Azure 取得聲音清單失敗（{getattr(result, 'error_details', 'unknown')}）",
      status_code=502,
    )

  voices = []
  for v in result.voices:
    short_name = getattr(v, "short_name", "") or ""
    if locale_prefix and not short_name.lower().startswith(locale_prefix.lower()):
      continue
    gender = getattr(v, "gender", None)
    gender_name = getattr(gender, "name", str(gender) if gender else "")
    voices.append(
      {
        "id": short_name,
        "locale": getattr(v, "locale", "") or "",
        "gender": gender_name,
        "label": f"{short_name} ({gender_name or '?'})",
      }
    )
  voices.sort(key=lambda item: item["id"])
  return voices
