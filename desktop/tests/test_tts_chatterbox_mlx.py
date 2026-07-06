"""Chatterbox MLX 後端與後端分派測試。

與 test_tts_chatterbox.py 同樣策略：不真的載入 mlx-audio / 下載模型，
monkeypatch _import_mlx_deps 換成 fake；音訊用真的 numpy + soundfile 驗證。
"""

import numpy as np
import pytest
import soundfile as sf

import server.config as config
import server.tts_chatterbox as tts_chatterbox
import server.tts_chatterbox_mlx as tts_mlx
from server.tts_chatterbox import ChatterboxTTSError, chatterbox_synthesize_speech
from server.tts_chatterbox_mlx import ChatterboxMlxTTSService


class _FakeResult:
    def __init__(self, audio, sample_rate=24000):
        self.audio = audio
        self.sample_rate = sample_rate


class _FakeMlxModel:
    """multilingual 類別的慣例：prepare_conditionals 回傳 Conditionals、不寫回自身。"""

    sample_rate = 24000

    def __init__(self, builtin_conds="builtin", chunks=1):
        self._conds = builtin_conds
        self.prepare_calls = []
        self.generate_calls = []
        self.chunks = chunks

    def prepare_conditionals(self, ref_wav, ref_sr, exaggeration=0.5):
        self.prepare_calls.append((ref_wav, ref_sr))
        return f"conds:{ref_wav}"

    def generate(self, text, **kwargs):
        self.generate_calls.append({"text": text, **kwargs})
        for _ in range(self.chunks):
            yield _FakeResult(np.ones(1200, dtype=np.float32))


class _FakeTurboModel(_FakeMlxModel):
    """turbo 類別的慣例：prepare_conditionals 直接寫進 self._conds、回傳 None。"""

    def prepare_conditionals(self, ref_audio, sample_rate=None, exaggeration=0.5):
        self.prepare_calls.append((ref_audio, sample_rate))
        self._conds = f"conds:{ref_audio}"


class _FakeMx:
    """記錄 seed 呼叫的最小 mlx.core stub。"""

    seeds: list = []

    class random:
        @staticmethod
        def seed(value):
            _FakeMx.seeds.append(value)


def _fake_mlx_deps(model):
    def load_model(repo):
        return model

    return lambda: (np, sf, _FakeMx, load_model)


def _reset_service_state():
    ChatterboxMlxTTSService._model = None
    ChatterboxMlxTTSService._builtin_conds = None
    ChatterboxMlxTTSService._prepared_prompt = None
    _FakeMx.seeds = []


@pytest.fixture(autouse=True)
def _reset(monkeypatch):
    _reset_service_state()
    monkeypatch.setattr(config, "CHATTERBOX_BACKEND", "mlx", raising=False)
    monkeypatch.setattr(config, "CHATTERBOX_MLX_MODEL", "fake/model", raising=False)
    monkeypatch.setattr(config, "CHATTERBOX_AUDIO_PROMPT_PATH", None, raising=False)
    monkeypatch.setattr(config, "CHATTERBOX_DEFAULT_VOICE", None, raising=False)
    monkeypatch.setattr(config, "CHATTERBOX_CFG_WEIGHT", None, raising=False)
    monkeypatch.setattr(config, "CHATTERBOX_TEMPERATURE", None, raising=False)
    monkeypatch.setattr(config, "CHATTERBOX_EXAGGERATION", None, raising=False)
    yield
    _reset_service_state()


def _write_voice(tmp_path, name="voice.wav"):
    voice_file = tmp_path / name
    sf.write(str(voice_file), np.zeros(1200, dtype=np.float32), 24000, format="WAV")
    return voice_file


def test_synthesize_returns_wav_with_builtin_voice(monkeypatch):
    model = _FakeMlxModel()
    monkeypatch.setattr(tts_mlx, "_import_mlx_deps", _fake_mlx_deps(model))

    result = chatterbox_synthesize_speech("hello world")

    assert result.content_type == "audio/wav"
    assert result.audio_data[:4] == b"RIFF"
    # 無 voice prompt → 不動 conds，交給模型內建音色。
    assert model.prepare_calls == []
    assert model._conds == "builtin"


def test_gen_params_only_passed_when_env_set(monkeypatch):
    # 未設定 env → 不傳生成參數，交給各模型類別自己的預設（turbo 類別會對
    # exaggeration/cfg_weight 記 warning，不能無條件傳）。
    model = _FakeMlxModel()
    monkeypatch.setattr(tts_mlx, "_import_mlx_deps", _fake_mlx_deps(model))

    chatterbox_synthesize_speech("hi")
    assert "exaggeration" not in model.generate_calls[0]
    assert "cfg_weight" not in model.generate_calls[0]

    monkeypatch.setattr(config, "CHATTERBOX_EXAGGERATION", 0.8)
    monkeypatch.setattr(config, "CHATTERBOX_TEMPERATURE", 0.6)
    chatterbox_synthesize_speech("hi")
    assert model.generate_calls[1]["exaggeration"] == 0.8
    assert model.generate_calls[1]["temperature"] == 0.6


@pytest.mark.parametrize("model_cls", [_FakeMlxModel, _FakeTurboModel])
def test_conditionals_prepared_once_per_prompt(monkeypatch, tmp_path, model_cls):
    voice_file = _write_voice(tmp_path)
    model = model_cls()
    monkeypatch.setattr(tts_mlx, "_import_mlx_deps", _fake_mlx_deps(model))

    chatterbox_synthesize_speech("one", voice=str(voice_file))
    chatterbox_synthesize_speech("two", voice=str(voice_file))

    assert len(model.prepare_calls) == 1
    assert model.prepare_calls[0][0] == str(voice_file)
    # 兩種類別慣例最後都要讓 model._conds 指向算好的 conditionals。
    assert model._conds == f"conds:{voice_file}"


def test_builtin_conds_restored_when_voice_removed(monkeypatch, tmp_path):
    voice_file = _write_voice(tmp_path)
    model = _FakeTurboModel()
    monkeypatch.setattr(tts_mlx, "_import_mlx_deps", _fake_mlx_deps(model))

    chatterbox_synthesize_speech("one", voice=str(voice_file))
    assert model._conds == f"conds:{voice_file}"

    chatterbox_synthesize_speech("two")
    assert model._conds == "builtin"

    # 再切回同一個 voice → 內建 conds 已被還原過，必須重算。
    chatterbox_synthesize_speech("three", voice=str(voice_file))
    assert len(model.prepare_calls) == 2


def test_conditionals_recomputed_on_prompt_change(monkeypatch, tmp_path):
    voice_a = _write_voice(tmp_path, "a.wav")
    voice_b = _write_voice(tmp_path, "b.wav")
    model = _FakeMlxModel()
    monkeypatch.setattr(tts_mlx, "_import_mlx_deps", _fake_mlx_deps(model))

    chatterbox_synthesize_speech("one", voice=str(voice_a))
    chatterbox_synthesize_speech("two", voice=str(voice_b))
    chatterbox_synthesize_speech("three", voice=str(voice_b))

    assert [c[0] for c in model.prepare_calls] == [str(voice_a), str(voice_b)]


def test_missing_voice_file_returns_400(monkeypatch):
    model = _FakeMlxModel()
    monkeypatch.setattr(tts_mlx, "_import_mlx_deps", _fake_mlx_deps(model))

    with pytest.raises(ChatterboxTTSError) as exc:
        chatterbox_synthesize_speech("hi", voice="/no/such/voice.wav")
    assert exc.value.status_code == 400


def test_no_builtin_conds_and_no_voice_returns_400(monkeypatch):
    model = _FakeMlxModel(builtin_conds=None)
    monkeypatch.setattr(tts_mlx, "_import_mlx_deps", _fake_mlx_deps(model))

    with pytest.raises(ChatterboxTTSError) as exc:
        chatterbox_synthesize_speech("hi")
    assert exc.value.status_code == 400


def test_multiple_chunks_are_concatenated(monkeypatch):
    model = _FakeMlxModel(chunks=3)
    monkeypatch.setattr(tts_mlx, "_import_mlx_deps", _fake_mlx_deps(model))

    result = chatterbox_synthesize_speech("a long text")

    audio, sr = sf.read(__import__("io").BytesIO(result.audio_data))
    assert sr == 24000
    assert len(audio) == 3 * 1200


def test_deps_missing_returns_503(monkeypatch):
    def boom():
        raise ChatterboxTTSError("no mlx", status_code=503)

    monkeypatch.setattr(tts_mlx, "_import_mlx_deps", boom)

    assert ChatterboxMlxTTSService.is_available() is False
    with pytest.raises(ChatterboxTTSError) as exc:
        chatterbox_synthesize_speech("hi")
    assert exc.value.status_code == 503


def test_model_load_failure_returns_503(monkeypatch):
    def load_model(repo):
        raise RuntimeError("download failed")

    monkeypatch.setattr(
        tts_mlx, "_import_mlx_deps", lambda: (np, sf, _FakeMx, load_model)
    )

    with pytest.raises(ChatterboxTTSError) as exc:
        chatterbox_synthesize_speech("hi")
    assert exc.value.status_code == 503


def test_generate_failure_returns_500(monkeypatch):
    class BadModel(_FakeMlxModel):
        def generate(self, text, **kwargs):
            raise RuntimeError("gen boom")
            yield  # pragma: no cover -- 讓函式維持 generator 型別

    monkeypatch.setattr(tts_mlx, "_import_mlx_deps", _fake_mlx_deps(BadModel()))

    with pytest.raises(ChatterboxTTSError) as exc:
        chatterbox_synthesize_speech("hi")
    assert exc.value.status_code == 500


def test_same_text_seeds_rng_identically(monkeypatch):
    # 發音一致性的機制：同一段文字 → 同一個 RNG 種子 → 任何機器上同一條
    # 取樣路徑。種子值本身也要跨版本穩定（純內容 hash，不含時間/隨機成分）。
    model = _FakeMlxModel()
    monkeypatch.setattr(tts_mlx, "_import_mlx_deps", _fake_mlx_deps(model))

    chatterbox_synthesize_speech("comb")
    chatterbox_synthesize_speech("comb")

    assert len(_FakeMx.seeds) == 2
    assert _FakeMx.seeds[0] == _FakeMx.seeds[1]
    assert _FakeMx.seeds[0] == tts_mlx._stable_seed("comb", "")


def test_different_text_or_voice_gets_different_seed(monkeypatch, tmp_path):
    voice_file = _write_voice(tmp_path)
    model = _FakeTurboModel()
    monkeypatch.setattr(tts_mlx, "_import_mlx_deps", _fake_mlx_deps(model))

    chatterbox_synthesize_speech("comb")
    chatterbox_synthesize_speech("tomb")
    chatterbox_synthesize_speech("comb", voice=str(voice_file))

    assert len(set(_FakeMx.seeds)) == 3


# ---------- 後端分派 ----------


def test_backend_env_torch_routes_to_torch(monkeypatch):
    monkeypatch.setattr(config, "CHATTERBOX_BACKEND", "torch")
    called = {}

    def fake_torch_synth(text, speed=1.0, voice=None):
        called["torch"] = True
        return "torch-result"

    monkeypatch.setattr(
        tts_chatterbox.ChatterboxTurboTTSService, "synthesize", fake_torch_synth
    )

    assert chatterbox_synthesize_speech("hi") == "torch-result"
    assert called["torch"] is True


def test_backend_auto_prefers_mlx_when_available(monkeypatch):
    monkeypatch.setattr(config, "CHATTERBOX_BACKEND", None)
    model = _FakeMlxModel()
    monkeypatch.setattr(tts_mlx, "_import_mlx_deps", _fake_mlx_deps(model))

    result = chatterbox_synthesize_speech("hi")

    assert result.audio_data[:4] == b"RIFF"
    assert len(model.generate_calls) == 1


def test_backend_auto_falls_back_to_torch_when_mlx_missing(monkeypatch):
    monkeypatch.setattr(config, "CHATTERBOX_BACKEND", None)

    def boom():
        raise ChatterboxTTSError("no mlx", status_code=503)

    monkeypatch.setattr(tts_mlx, "_import_mlx_deps", boom)
    monkeypatch.setattr(
        tts_chatterbox.ChatterboxTurboTTSService,
        "synthesize",
        lambda text, speed=1.0, voice=None: "torch-result",
    )

    assert chatterbox_synthesize_speech("hi") == "torch-result"
