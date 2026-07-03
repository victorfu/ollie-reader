"""Chatterbox-Turbo wrapper 測試。

刻意「不」真的載入 torch / chatterbox 或下載模型：所有相依都靠 monkeypatch
_import_chatterbox_deps 換成 fake，音訊用真的 numpy + soundfile 產生 WAV bytes。
即使機器沒裝 chatterbox，這些測試也應該全綠。
"""

import numpy as np
import pytest
import soundfile as sf

import server.config as config
import server.tts_chatterbox as tts_chatterbox
from server.tts_chatterbox import (
    ChatterboxTTSError,
    ChatterboxTurboTTSService,
    chatterbox_synthesize_speech,
)


class _FakeTorch:
    """最小 torch stub：_select_device 只用到這兩個查詢（都回 False → cpu）。"""

    class cuda:
        @staticmethod
        def is_available():
            return False

    class backends:
        class mps:
            @staticmethod
            def is_available():
                return False


class _FakeModel:
    sr = 24000

    def __init__(self):
        self.calls = []

    def generate(self, text, audio_prompt_path=None):
        self.calls.append({"text": text, "audio_prompt_path": audio_prompt_path})
        return np.zeros(2400, dtype=np.float32)


class _FakeTurboTTS:
    @classmethod
    def from_pretrained(cls, device="cpu"):
        return _FakeModel()


def _fake_deps(model_cls=_FakeTurboTTS):
    """回傳一個能當作 _import_chatterbox_deps 的 lambda。"""
    return lambda: (np, sf, _FakeTorch, model_cls)


@pytest.fixture(autouse=True)
def _reset(monkeypatch):
    # 每個 test 前後重置 singleton，避免上個 test 快取的 model 影響 init/failure 測試。
    ChatterboxTurboTTSService._model = None
    ChatterboxTurboTTSService._device = None
    # 隔離 env：預設不套用任何 device / 預設音色 / audio prompt / 生成參數。
    monkeypatch.setattr(config, "CHATTERBOX_DEVICE", None, raising=False)
    monkeypatch.setattr(config, "CHATTERBOX_AUDIO_PROMPT_PATH", None, raising=False)
    monkeypatch.setattr(config, "CHATTERBOX_DEFAULT_VOICE", None, raising=False)
    monkeypatch.setattr(config, "CHATTERBOX_CFG_WEIGHT", None, raising=False)
    monkeypatch.setattr(config, "CHATTERBOX_TEMPERATURE", None, raising=False)
    monkeypatch.setattr(config, "CHATTERBOX_EXAGGERATION", None, raising=False)
    yield
    ChatterboxTurboTTSService._model = None
    ChatterboxTurboTTSService._device = None


def test_unavailable_when_deps_missing(monkeypatch):
    def boom():
        raise ChatterboxTTSError("no torch", status_code=503)

    monkeypatch.setattr(tts_chatterbox, "_import_chatterbox_deps", boom)

    assert ChatterboxTurboTTSService.is_available() is False

    with pytest.raises(ChatterboxTTSError) as exc:
        chatterbox_synthesize_speech("hello")
    assert exc.value.status_code == 503


def test_synthesize_returns_wav_bytes(monkeypatch):
    monkeypatch.setattr(tts_chatterbox, "_import_chatterbox_deps", _fake_deps())

    result = chatterbox_synthesize_speech("hello world")

    assert result.content_type == "audio/wav"
    # 真的 soundfile WAV header：RIFF....WAVE
    assert result.audio_data[:4] == b"RIFF"
    assert result.audio_data[8:12] == b"WAVE"


def test_existing_voice_passed_as_audio_prompt(monkeypatch, tmp_path):
    captured = {}

    class CapModel:
        sr = 24000

        def generate(self, text, audio_prompt_path=None):
            captured["audio_prompt_path"] = audio_prompt_path
            return np.ones(1200, dtype=np.float32)

    class CapTTS:
        @classmethod
        def from_pretrained(cls, device="cpu"):
            return CapModel()

    voice_file = tmp_path / "voice.wav"
    sf.write(str(voice_file), np.zeros(1200, dtype=np.float32), 24000, format="WAV")

    monkeypatch.setattr(tts_chatterbox, "_import_chatterbox_deps", _fake_deps(CapTTS))

    result = chatterbox_synthesize_speech("hi", voice=str(voice_file))

    assert captured["audio_prompt_path"] == str(voice_file)
    assert result.audio_data[:4] == b"RIFF"


def test_missing_voice_file_returns_400(monkeypatch):
    monkeypatch.setattr(tts_chatterbox, "_import_chatterbox_deps", _fake_deps())

    with pytest.raises(ChatterboxTTSError) as exc:
        chatterbox_synthesize_speech("hi", voice="/no/such/voice.wav")
    assert exc.value.status_code == 400


def test_model_init_failure_returns_503(monkeypatch):
    class BoomTTS:
        @classmethod
        def from_pretrained(cls, device="cpu"):
            raise RuntimeError("cannot load weights")

    monkeypatch.setattr(tts_chatterbox, "_import_chatterbox_deps", _fake_deps(BoomTTS))

    with pytest.raises(ChatterboxTTSError) as exc:
        chatterbox_synthesize_speech("hi")
    assert exc.value.status_code == 503


def test_generate_failure_returns_500(monkeypatch):
    class BadGenModel:
        sr = 24000

        def generate(self, text, audio_prompt_path=None):
            raise RuntimeError("gen boom")

    class BadGenTTS:
        @classmethod
        def from_pretrained(cls, device="cpu"):
            return BadGenModel()

    monkeypatch.setattr(tts_chatterbox, "_import_chatterbox_deps", _fake_deps(BadGenTTS))

    with pytest.raises(ChatterboxTTSError) as exc:
        chatterbox_synthesize_speech("hi")
    assert exc.value.status_code == 500


def test_empty_audio_returns_500(monkeypatch):
    class EmptyModel:
        sr = 24000

        def generate(self, text, audio_prompt_path=None):
            return np.zeros(0, dtype=np.float32)

    class EmptyTTS:
        @classmethod
        def from_pretrained(cls, device="cpu"):
            return EmptyModel()

    monkeypatch.setattr(tts_chatterbox, "_import_chatterbox_deps", _fake_deps(EmptyTTS))

    with pytest.raises(ChatterboxTTSError) as exc:
        chatterbox_synthesize_speech("hi")
    assert exc.value.status_code == 500


def test_select_device_prefers_env(monkeypatch):
    monkeypatch.setattr(config, "CHATTERBOX_DEVICE", "cuda")
    assert tts_chatterbox._select_device(_FakeTorch) == "cuda"


def test_select_device_auto_falls_back_to_mps(monkeypatch):
    monkeypatch.setattr(config, "CHATTERBOX_DEVICE", None)

    class MpsTorch:
        class cuda:
            @staticmethod
            def is_available():
                return False

        class backends:
            class mps:
                @staticmethod
                def is_available():
                    return True

    assert tts_chatterbox._select_device(MpsTorch) == "mps"


def test_select_device_auto_falls_back_to_cpu(monkeypatch):
    monkeypatch.setattr(config, "CHATTERBOX_DEVICE", None)
    assert tts_chatterbox._select_device(_FakeTorch) == "cpu"


def test_positive_gen_params_passed_to_generate(monkeypatch):
    captured = {}

    class CfgModel:
        sr = 24000

        def generate(self, text, audio_prompt_path=None, cfg_weight=0.5, temperature=0.8):
            captured["cfg_weight"] = cfg_weight
            captured["temperature"] = temperature
            return np.ones(100, dtype=np.float32)

    class CfgTTS:
        @classmethod
        def from_pretrained(cls, device="cpu"):
            return CfgModel()

    monkeypatch.setattr(config, "CHATTERBOX_CFG_WEIGHT", 0.3)
    monkeypatch.setattr(config, "CHATTERBOX_TEMPERATURE", 0.4)
    monkeypatch.setattr(tts_chatterbox, "_import_chatterbox_deps", _fake_deps(CfgTTS))

    chatterbox_synthesize_speech("hi")

    assert captured["cfg_weight"] == 0.3
    assert captured["temperature"] == 0.4


def test_cfg_weight_zero_is_ignored(monkeypatch):
    # cfg_weight=0 在 chatterbox 0.1.3 會 crash（batch mismatch）；wrapper 要擋掉，
    # 不傳 0，改用 generate 的預設，且不能拋錯。
    captured = {}

    class CfgModel:
        sr = 24000

        def generate(self, text, audio_prompt_path=None, cfg_weight=0.5):
            captured["cfg_weight"] = cfg_weight
            return np.ones(100, dtype=np.float32)

    class CfgTTS:
        @classmethod
        def from_pretrained(cls, device="cpu"):
            return CfgModel()

    monkeypatch.setattr(config, "CHATTERBOX_CFG_WEIGHT", 0.0)
    monkeypatch.setattr(tts_chatterbox, "_import_chatterbox_deps", _fake_deps(CfgTTS))

    result = chatterbox_synthesize_speech("hi")

    assert captured["cfg_weight"] == 0.5  # 我方沒傳 0 → 用 generate 預設
    assert result.audio_data[:4] == b"RIFF"


def test_unsupported_generate_kwargs_are_dropped(monkeypatch):
    # generate 不吃 cfg_weight（模擬未來簽名不同的 turbo 類別）→ 應靜默略過而非 crash。
    captured = {}

    class NoCfgModel:
        sr = 24000

        def generate(self, text, audio_prompt_path=None):
            captured["called"] = True
            return np.ones(100, dtype=np.float32)

    class NoCfgTTS:
        @classmethod
        def from_pretrained(cls, device="cpu"):
            return NoCfgModel()

    monkeypatch.setattr(config, "CHATTERBOX_CFG_WEIGHT", 0.3)
    monkeypatch.setattr(tts_chatterbox, "_import_chatterbox_deps", _fake_deps(NoCfgTTS))

    result = chatterbox_synthesize_speech("hi")

    assert captured["called"] is True
    assert result.audio_data[:4] == b"RIFF"


def test_import_resolves_a_real_model_class_when_installed():
    # 只有裝了 chatterbox 才跑（`uv sync --group chatterbox`）；純 import 解析，
    # 不呼叫 from_pretrained，所以不會下載/載入任何模型權重。驗證 spec 指定的
    # ChatterboxTurboTTS 不存在時，resolver 會退回真實的 ChatterboxTTS。
    pytest.importorskip("chatterbox")
    _np, _sf, _torch, model_cls = tts_chatterbox._import_chatterbox_deps()
    assert hasattr(model_cls, "from_pretrained")
    assert hasattr(model_cls, "generate")
    assert ChatterboxTurboTTSService.is_available() is True
