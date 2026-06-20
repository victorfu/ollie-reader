import io
import wave

import pytest


@pytest.fixture(autouse=True)
def _reset_kokoro_singleton():
  """每個測試前後重置 Kokoro singleton，避免互相污染。"""
  import server.tts_kokoro as k

  k.KokoroTTSService._instance = None
  k.KokoroTTSService._engine = None
  yield
  k.KokoroTTSService._instance = None
  k.KokoroTTSService._engine = None


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
  """把 _import_kokoro_deps 換成假的 numpy/soundfile/Kokoro，使測試不需要 onnx 模型。"""
  import numpy as real_np
  import server.tts_kokoro as k

  class _FakeKokoro:
    def __init__(self, model_path, voices_path):
      self.model_path = model_path
      self.voices_path = voices_path

    def create(self, text, voice="af_heart", speed=1.0, lang="en-us", **kwargs):
      return real_np.zeros(2400, dtype="float32"), 24000

  class _FakeSF:
    @staticmethod
    def write(buf, audio, samplerate, format="WAV"):
      buf.write(_wav_bytes())

  monkeypatch.setattr(
    k, "_import_kokoro_deps", lambda: (real_np, _FakeSF, _FakeKokoro)
  )
  return k
