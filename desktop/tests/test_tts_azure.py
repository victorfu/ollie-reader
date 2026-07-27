import pytest

import server.tts_azure as a
from server.tts_azure import (
  DEFAULT_AZURE_FORMAT,
  DEFAULT_AZURE_VOICE,
  AzureTTSError,
  _build_ssml,
  azure_synthesize_speech,
  is_available,
  list_azure_voices,
)


def test_build_ssml_carries_voice_and_rate():
  ssml = _build_ssml("hello", "en-US-EmmaMultilingualNeural", 1.25)
  assert 'name="en-US-EmmaMultilingualNeural"' in ssml
  assert 'rate="+25%"' in ssml
  assert 'xml:lang="en-US"' in ssml
  assert ">hello<" in ssml


def test_build_ssml_clamps_and_defaults_speed():
  assert 'rate="+100%"' in _build_ssml("x", "en-US-AriaNeural", 9.0)
  assert 'rate="-50%"' in _build_ssml("x", "en-US-AriaNeural", 0.01)
  assert 'rate="+0%"' in _build_ssml("x", "en-US-AriaNeural", 0)


def test_build_ssml_escapes_text_and_voice():
  # 使用者輸入的試聽文字會進 SSML，未轉義的 & / < 會讓整份 XML 失效
  ssml = _build_ssml("fish & chips <b>", "en-US-AriaNeural", 1.0)
  assert "&amp;" in ssml
  assert "&lt;b&gt;" in ssml
  assert "<b>" not in ssml


def test_unavailable_raises_503(monkeypatch):
  def _boom():
    raise AzureTTSError("no sdk", status_code=503)

  monkeypatch.setattr(a, "_import_speechsdk", _boom)
  assert is_available() is False
  with pytest.raises(AzureTTSError) as exc:
    azure_synthesize_speech("hello")
  assert exc.value.status_code == 503


def test_blank_text_rejected(monkeypatch):
  monkeypatch.setattr(a, "_import_speechsdk", lambda: object())
  with pytest.raises(AzureTTSError) as exc:
    azure_synthesize_speech("  ")
  assert exc.value.status_code == 400


def test_missing_key_raises_503_with_actionable_message(monkeypatch, fake_speechsdk):
  monkeypatch.setattr("server.tts_secrets.get_azure_credentials", lambda: None)
  with pytest.raises(AzureTTSError) as exc:
    azure_synthesize_speech("hello")
  assert exc.value.status_code == 503
  assert "金鑰" in exc.value.message


class _Reason:
  SynthesizingAudioCompleted = "ok"
  VoicesListRetrieved = "voices-ok"


class _Voice:
  def __init__(self, short_name, locale, gender):
    self.short_name = short_name
    self.locale = locale
    self.gender = type("G", (), {"name": gender})()


@pytest.fixture
def fake_speechsdk(monkeypatch):
  """最小可用的 speechsdk 替身，記錄 SpeechConfig 收到的憑證。"""
  captured = {}

  class _Config:
    def __init__(self, subscription=None, region=None):
      captured["subscription"] = subscription
      captured["region"] = region

    def set_speech_synthesis_output_format(self, fmt):
      captured["format"] = fmt

  class _Result:
    reason = _Reason.SynthesizingAudioCompleted
    audio_data = b"\xff\xf3audio"

  class _VoicesResult:
    reason = _Reason.VoicesListRetrieved
    voices = [
      _Voice("en-US-EmmaMultilingualNeural", "en-US", "Female"),
      _Voice("zh-TW-HsiaoChenNeural", "zh-TW", "Female"),
    ]

  class _Synth:
    def __init__(self, speech_config=None, audio_config=None):
      captured["audio_config"] = audio_config

    def speak_ssml_async(self, ssml):
      captured["ssml"] = ssml
      return type("F", (), {"get": staticmethod(lambda: _Result())})()

    def get_voices_async(self):
      return type("F", (), {"get": staticmethod(lambda: _VoicesResult())})()

  class _Module:
    SpeechConfig = _Config
    SpeechSynthesizer = _Synth
    ResultReason = _Reason
    SpeechSynthesisOutputFormat = type(
      "F",
      (),
      {
        "Audio48Khz192KBitRateMonoMp3": "hq-mp3",
        "Audio24Khz48KBitRateMonoMp3": "lq-mp3",
      },
    )

  monkeypatch.setattr(a, "_import_speechsdk", lambda: _Module)
  monkeypatch.setattr(
    "server.tts_secrets.get_azure_credentials", lambda: ("KEY123", "eastasia")
  )
  _Module.captured = captured
  return _Module


def test_synthesize_returns_mp3_and_uses_credentials(fake_speechsdk):
  result = azure_synthesize_speech("hello", speed=1.0, voice="en-US-AriaNeural")
  assert result.content_type == "audio/mpeg"
  assert result.audio_data == b"\xff\xf3audio"
  assert fake_speechsdk.captured["subscription"] == "KEY123"
  assert fake_speechsdk.captured["region"] == "eastasia"
  # audio_config 必須是 None，否則 SDK 會直接播到本機喇叭而不回傳 bytes
  assert fake_speechsdk.captured["audio_config"] is None
  assert 'name="en-US-AriaNeural"' in fake_speechsdk.captured["ssml"]


def test_blank_voice_falls_back_to_default(fake_speechsdk):
  azure_synthesize_speech("hello", voice="   ")
  assert DEFAULT_AZURE_VOICE in fake_speechsdk.captured["ssml"]


def test_failed_reason_raises_502(monkeypatch, fake_speechsdk):
  class _Bad:
    reason = "canceled"
    cancellation_details = type(
      "C", (), {"reason": "AuthenticationFailure", "error_details": "bad key"}
    )()

  class _Synth(fake_speechsdk.SpeechSynthesizer):
    def speak_ssml_async(self, ssml):
      return type("F", (), {"get": staticmethod(lambda: _Bad())})()

  monkeypatch.setattr(fake_speechsdk, "SpeechSynthesizer", _Synth)
  with pytest.raises(AzureTTSError) as exc:
    azure_synthesize_speech("hello")
  assert exc.value.status_code == 502
  assert "bad key" in exc.value.message


def test_list_voices_filters_by_locale(fake_speechsdk):
  assert [v["id"] for v in list_azure_voices("en")] == [
    "en-US-EmmaMultilingualNeural"
  ]
  assert len(list_azure_voices(None)) == 2


def test_uses_high_quality_output_format(fake_speechsdk):
  """48kbps 會把 /s/ 的擦音壓掉，官方 API 既然能選格式就不該沿用那個低位元率。"""
  assert DEFAULT_AZURE_FORMAT == "Audio48Khz192KBitRateMonoMp3"
  azure_synthesize_speech("hello")
  assert fake_speechsdk.captured["format"] == "hq-mp3"


def test_env_can_override_output_format(fake_speechsdk, monkeypatch):
  monkeypatch.setenv("AZURE_TTS_FORMAT", "Audio24Khz48KBitRateMonoMp3")
  azure_synthesize_speech("hello")
  assert fake_speechsdk.captured["format"] == "lq-mp3"


def test_unknown_env_format_falls_back_to_default(fake_speechsdk, monkeypatch):
  monkeypatch.setenv("AZURE_TTS_FORMAT", "NotARealFormat")
  azure_synthesize_speech("hello")
  assert fake_speechsdk.captured["format"] == "hq-mp3"


def test_env_overrides_default_voice(fake_speechsdk, monkeypatch):
  monkeypatch.setenv("AZURE_TTS_VOICE", "en-GB-RyanNeural")
  azure_synthesize_speech("hello")
  assert 'name="en-GB-RyanNeural"' in fake_speechsdk.captured["ssml"]


def test_default_voice_is_monolingual_and_not_emma():
  assert "Emma" not in DEFAULT_AZURE_VOICE
  assert "Multilingual" not in DEFAULT_AZURE_VOICE
