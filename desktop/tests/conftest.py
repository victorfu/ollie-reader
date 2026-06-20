import io
import wave

import pytest


@pytest.fixture(autouse=True)
def _reset_kokoro_singleton():
  """每個測試前後重置 Kokoro singleton，避免互相污染。"""
  import server.tts_kokoro as k

  k.KokoroTTSService._instance = None
  k.KokoroTTSService._pipelines = {}
  k.KokoroTTSService._initialized = False
  yield
  k.KokoroTTSService._instance = None
  k.KokoroTTSService._pipelines = {}
  k.KokoroTTSService._initialized = False


def _wav_bytes() -> bytes:
  buf = io.BytesIO()
  with wave.open(buf, "wb") as w:
    w.setnchannels(1)
    w.setsampwidth(2)
    w.setframerate(24000)
    w.writeframes(b"\x00\x01" * 100)
  return buf.getvalue()


@pytest.fixture
def mock_kokoro(monkeypatch):
  """把 _import_kokoro_deps 換成假的 numpy/soundfile/KPipeline，使測試不需要 torch。"""
  import numpy as real_np
  import server.tts_kokoro as k

  class _FakePipeline:
    def __init__(self, lang_code="a", repo_id=None):
      self.lang_code = lang_code
      self.repo_id = repo_id

    def __call__(self, text, voice=None, speed=1.0):
      yield ("g", "p", real_np.zeros(2400, dtype="float32"))

  class _FakeSF:
    @staticmethod
    def write(buf, audio, samplerate, format="WAV"):
      buf.write(_wav_bytes())

  monkeypatch.setattr(
    k, "_import_kokoro_deps", lambda: (real_np, _FakeSF, _FakePipeline)
  )
  return k
