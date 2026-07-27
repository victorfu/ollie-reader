import asyncio

import pytest

import server.tts_edge as e
from server.tts_edge import (
  DEFAULT_EDGE_VOICE,
  EdgeTTSError,
  _friendly_error,
  _rate_from_speed,
  edge_synthesize_speech,
  is_available,
  list_edge_voices,
)


def test_rate_from_speed_maps_to_percent_string():
  assert _rate_from_speed(1.0) == "+0%"
  assert _rate_from_speed(1.5) == "+50%"
  assert _rate_from_speed(0.75) == "-25%"


def test_rate_from_speed_clamps_and_handles_bad_input():
  # 服務端只吃 ±100% 內的整數百分比
  assert _rate_from_speed(5.0) == "+100%"
  assert _rate_from_speed(0.01) == "-50%"
  assert _rate_from_speed(0) == "+0%"
  assert _rate_from_speed(-3) == "+0%"


def test_unavailable_raises_503(monkeypatch):
  def _boom():
    raise EdgeTTSError("no edge-tts", status_code=503)

  monkeypatch.setattr(e, "_import_edge_tts", _boom)
  assert is_available() is False


def test_blank_text_rejected():
  with pytest.raises(EdgeTTSError) as exc:
    asyncio.run(edge_synthesize_speech("   "))
  assert exc.value.status_code == 400


def test_403_gets_actionable_message():
  # Sec-MS-GEC token 過期是這個引擎的主要故障模式，訊息要講得出「升級套件」
  err = _friendly_error(RuntimeError("WSServerHandshakeError: 403, message='Invalid response status'"))
  assert err.status_code == 502
  assert "403" in err.message
  assert "edge-tts" in err.message


def test_other_errors_are_502_not_500():
  err = _friendly_error(RuntimeError("boom"))
  assert err.status_code == 502


class _FakeCommunicate:
  """記錄建構參數，並吐出兩塊 audio chunk 加一塊該被忽略的 WordBoundary。"""

  last_kwargs: dict = {}

  def __init__(self, text, voice=None, rate=None):
    type(self).last_kwargs = {"text": text, "voice": voice, "rate": rate}

  async def stream(self):
    yield {"type": "audio", "data": b"\xff\xf3"}
    yield {"type": "WordBoundary", "offset": 0}
    yield {"type": "audio", "data": b"rest"}


@pytest.fixture
def fake_edge_tts(monkeypatch):
  class _Module:
    Communicate = _FakeCommunicate

    @staticmethod
    async def list_voices():
      return [
        {"ShortName": "en-US-EmmaMultilingualNeural", "Locale": "en-US", "Gender": "Female"},
        {"ShortName": "en-GB-RyanNeural", "Locale": "en-GB", "Gender": "Male"},
        {"ShortName": "zh-TW-HsiaoChenNeural", "Locale": "zh-TW", "Gender": "Female"},
      ]

  monkeypatch.setattr(e, "_import_edge_tts", lambda: _Module)
  return _Module


def test_synthesize_concatenates_audio_chunks_only(fake_edge_tts):
  result = asyncio.run(edge_synthesize_speech("hello", speed=1.25, voice="en-US-AriaNeural"))
  assert result.content_type == "audio/mpeg"
  assert result.audio_data == b"\xff\xf3rest"  # WordBoundary 不進音檔
  assert _FakeCommunicate.last_kwargs["voice"] == "en-US-AriaNeural"
  assert _FakeCommunicate.last_kwargs["rate"] == "+25%"


def test_blank_voice_falls_back_to_default(fake_edge_tts):
  asyncio.run(edge_synthesize_speech("hello", voice="   "))
  assert _FakeCommunicate.last_kwargs["voice"] == DEFAULT_EDGE_VOICE


def test_no_audio_chunks_raises(monkeypatch, fake_edge_tts):
  class _Silent(_FakeCommunicate):
    async def stream(self):
      yield {"type": "WordBoundary", "offset": 0}

  monkeypatch.setattr(fake_edge_tts, "Communicate", _Silent)
  with pytest.raises(EdgeTTSError) as exc:
    asyncio.run(edge_synthesize_speech("hello"))
  assert exc.value.status_code == 502


def test_list_voices_filters_by_locale_prefix(fake_edge_tts):
  en = asyncio.run(list_edge_voices("en"))
  assert [v["id"] for v in en] == [
    "en-GB-RyanNeural",
    "en-US-EmmaMultilingualNeural",
  ]  # 依 id 排序

  en_us = asyncio.run(list_edge_voices("en-US"))
  assert [v["id"] for v in en_us] == ["en-US-EmmaMultilingualNeural"]


def test_list_voices_unfiltered_returns_all(fake_edge_tts):
  assert len(asyncio.run(list_edge_voices(None))) == 3


def test_env_overrides_default_voice(fake_edge_tts, monkeypatch):
  monkeypatch.setenv("EDGE_TTS_VOICE", "en-GB-RyanNeural")
  asyncio.run(edge_synthesize_speech("hello"))
  assert _FakeCommunicate.last_kwargs["voice"] == "en-GB-RyanNeural"


def test_blank_env_falls_back_to_default_voice(fake_edge_tts, monkeypatch):
  monkeypatch.setenv("EDGE_TTS_VOICE", "   ")
  asyncio.run(edge_synthesize_speech("hello"))
  assert _FakeCommunicate.last_kwargs["voice"] == DEFAULT_EDGE_VOICE


def test_explicit_voice_beats_env_override(fake_edge_tts, monkeypatch):
  monkeypatch.setenv("EDGE_TTS_VOICE", "en-GB-RyanNeural")
  asyncio.run(edge_synthesize_speech("hello", voice="en-US-AriaNeural"))
  assert _FakeCommunicate.last_kwargs["voice"] == "en-US-AriaNeural"


# 迴歸鎖：Emma(Multilingual) 在 st-/sp- 字首會吞掉 /s/（"spell" 起音 4-10kHz
# 佔比僅 9%），不得再被設回單字聽力題的預設聲音
def test_default_voice_is_not_emma():
  assert "Emma" not in DEFAULT_EDGE_VOICE
