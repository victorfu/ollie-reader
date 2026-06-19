import pytest

import server.config as server_config
import server.tts_piper as tts_piper
from server.tts_piper import TTSService, TTSError, generate_speech


class _FakeVoice:
  def synthesize_wav(self, text, wav_file, syn_config=None):
    wav_file.setnchannels(1)
    wav_file.setsampwidth(2)
    wav_file.setframerate(22050)
    wav_file.writeframes(b"\x00\x01" * 100)


@pytest.fixture(autouse=True)
def _reset_and_fake_voice(monkeypatch):
  TTSService._instance = None
  TTSService._voice = _FakeVoice()
  TTSService._initialized = True
  if hasattr(TTSService, "_model_path"):
    TTSService._model_path = None
  yield
  TTSService._instance = None
  TTSService._voice = None
  TTSService._initialized = False
  if hasattr(TTSService, "_model_path"):
    TTSService._model_path = None


def _clear_tts_state():
  TTSService._instance = None
  TTSService._voice = None
  TTSService._initialized = False
  if hasattr(TTSService, "_model_path"):
    TTSService._model_path = None


def test_generate_speech_returns_wav_bytes():
  result = generate_speech("hello", speaker=0, length_scale=1.0)
  assert result.content_type == "audio/wav"
  assert result.audio_data[:4] == b"RIFF"
  assert len(result.audio_data) > 44


def test_synth_failure_raises_ttserror(monkeypatch):
  class _BoomVoice:
    def synthesize_wav(self, *a, **k):
      raise RuntimeError("boom")

  TTSService._voice = _BoomVoice()
  with pytest.raises(TTSError) as exc:
    generate_speech("hi")
  assert exc.value.status_code == 500


def test_initialize_rejects_non_onnx_model(tmp_path):
  model_path = tmp_path / "voice.txt"
  model_path.write_bytes(b"not an onnx model")
  _clear_tts_state()

  with pytest.raises(TTSError) as exc:
    TTSService.initialize(str(model_path))

  assert exc.value.status_code == 400


def test_initialize_maps_memory_error_to_503(monkeypatch, tmp_path):
  model_path = tmp_path / "voice.onnx"
  model_path.write_bytes(b"fake onnx")
  _clear_tts_state()

  def _raise_memory_error(path):
    raise MemoryError("no memory")

  monkeypatch.setattr(tts_piper.PiperVoice, "load", staticmethod(_raise_memory_error))

  with pytest.raises(TTSError) as exc:
    TTSService.initialize(str(model_path))

  assert exc.value.status_code == 503


def test_generate_speech_warns_and_ignores_model_path(caplog):
  caplog.set_level("WARNING", logger="server.tts_piper")

  result = generate_speech("hello", model_path="/missing/ignored.onnx")

  assert result.content_type == "audio/wav"
  assert "model_path" in caplog.text


def test_initialize_uses_server_config_piper_model_path(monkeypatch, tmp_path):
  model_path = tmp_path / "voice.onnx"
  model_path.write_bytes(b"fake onnx")
  loaded = {}
  _clear_tts_state()

  def _load(path):
    loaded["path"] = path
    return _FakeVoice()

  monkeypatch.setattr(server_config, "PIPER_MODEL_PATH", str(model_path))
  monkeypatch.setattr(tts_piper.PiperVoice, "load", staticmethod(_load))

  TTSService.initialize()

  assert loaded["path"] == str(model_path)
  assert TTSService.is_initialized()
