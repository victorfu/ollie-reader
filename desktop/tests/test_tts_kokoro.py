import pytest

import server.tts_kokoro as k
from server.tts_kokoro import (
  KokoroTTSService,
  KokoroTTSError,
  kokoro_synthesize_speech,
  _lang_from_voice,
)


def test_lang_from_voice_prefix():
  assert _lang_from_voice("af_heart", "en-us") == "en-us"
  assert _lang_from_voice("bf_emma", "en-us") == "en-gb"
  assert _lang_from_voice("xyz", "en-us") == "en-us"


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


def test_engine_init_failure_synthesize_raises_503(monkeypatch):
  import numpy as real_np

  class _BrokenKokoro:
    def __init__(self, model_path, voices_path):
      raise RuntimeError(f"onnx model unavailable: {model_path}")

  class _FakeSF:
    @staticmethod
    def write(buf, audio, samplerate, format="WAV"):
      raise AssertionError("soundfile should not write when engine init fails")

  monkeypatch.setattr(
    k, "_import_kokoro_deps", lambda: (real_np, _FakeSF, _BrokenKokoro)
  )

  assert KokoroTTSService.is_available() is True
  with pytest.raises(KokoroTTSError) as exc:
    kokoro_synthesize_speech("hello", voice="af_heart")
  assert exc.value.status_code == 503


def test_engine_reused_and_passes_voice_speed_lang(monkeypatch):
  import numpy as real_np

  created = []
  calls = []

  class _RecordingKokoro:
    def __init__(self, model_path, voices_path):
      created.append((model_path, voices_path))

    def create(self, text, voice="af_heart", speed=1.0, lang="en-us", **kwargs):
      calls.append({"text": text, "voice": voice, "speed": speed, "lang": lang})
      return real_np.zeros(2400, dtype="float32"), 24000

  class _FakeSF:
    @staticmethod
    def write(buf, audio, samplerate, format="WAV"):
      buf.write(b"RIFFfake-wav")

  monkeypatch.setattr(
    k, "_import_kokoro_deps", lambda: (real_np, _FakeSF, _RecordingKokoro)
  )

  kokoro_synthesize_speech("one", speed=1.25, voice="af_heart")
  kokoro_synthesize_speech("two", speed=0.8, voice="af_heart")
  kokoro_synthesize_speech("three", speed=1.1, voice="bf_emma")

  # Single engine is built once and reused across calls.
  assert len(created) == 1
  # voice/speed forwarded; lang derived from the voice prefix (a->en-us, b->en-gb).
  assert calls == [
    {"text": "one", "voice": "af_heart", "speed": 1.25, "lang": "en-us"},
    {"text": "two", "voice": "af_heart", "speed": 0.8, "lang": "en-us"},
    {"text": "three", "voice": "bf_emma", "speed": 1.1, "lang": "en-gb"},
  ]
