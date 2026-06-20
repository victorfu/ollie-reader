import pytest

import server.tts_kokoro as k
from server.tts_kokoro import (
  KokoroTTSService,
  KokoroTTSError,
  kokoro_synthesize_speech,
  _lang_from_voice,
)


def test_lang_from_voice_prefix():
  assert _lang_from_voice("af_heart", "a") == "a"
  assert _lang_from_voice("bf_emma", "a") == "b"
  assert _lang_from_voice("xyz", "a") == "a"


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


def test_pipeline_init_failure_synthesize_raises_503(monkeypatch):
  import numpy as real_np

  class _BrokenPipeline:
    def __init__(self, lang_code="a"):
      raise RuntimeError(f"runtime unavailable for {lang_code}")

  class _FakeSF:
    @staticmethod
    def write(buf, audio, samplerate, format="WAV"):
      raise AssertionError("soundfile should not write when pipeline init fails")

  monkeypatch.setattr(
    k, "_import_kokoro_deps", lambda: (real_np, _FakeSF, _BrokenPipeline)
  )

  assert KokoroTTSService.is_available() is True
  with pytest.raises(KokoroTTSError) as exc:
    kokoro_synthesize_speech("hello", voice="af_heart")
  assert exc.value.status_code == 503


def test_synthesize_reuses_pipeline_per_lang_and_passes_voice_speed(monkeypatch):
  import numpy as real_np

  created_langs = []
  created_repo_ids = []
  calls = []

  class _RecordingPipeline:
    def __init__(self, lang_code="a", repo_id=None):
      self.lang_code = lang_code
      created_langs.append(lang_code)
      created_repo_ids.append(repo_id)

    def __call__(self, text, voice=None, speed=1.0):
      calls.append(
        {
          "lang_code": self.lang_code,
          "text": text,
          "voice": voice,
          "speed": speed,
        }
      )
      yield ("g", "p", real_np.zeros(2400, dtype="float32"))

  class _FakeSF:
    @staticmethod
    def write(buf, audio, samplerate, format="WAV"):
      buf.write(b"RIFFfake-wav")

  monkeypatch.setattr(
    k, "_import_kokoro_deps", lambda: (real_np, _FakeSF, _RecordingPipeline)
  )

  kokoro_synthesize_speech("one", speed=1.25, voice="af_heart")
  kokoro_synthesize_speech("two", speed=0.8, voice="af_heart")
  kokoro_synthesize_speech("three", speed=1.1, voice="bf_emma")

  from server.config import KOKORO_REPO_ID

  assert created_langs == ["a", "b"]
  # repo_id must be forwarded so the bundled offline HF cache is used.
  assert created_repo_ids == [KOKORO_REPO_ID, KOKORO_REPO_ID]
  assert calls == [
    {"lang_code": "a", "text": "one", "voice": "af_heart", "speed": 1.25},
    {"lang_code": "a", "text": "two", "voice": "af_heart", "speed": 0.8},
    {"lang_code": "b", "text": "three", "voice": "bf_emma", "speed": 1.1},
  ]
