import importlib
import os
import sys
from pathlib import Path

import pytest

_CONFIG_ENV_KEYS = (
    "OLLIE_CORS_ORIGINS",
    "PIPER_MODEL_PATH",
    "KOKORO_MODEL_PATH",
    "KOKORO_VOICES_PATH",
    "KOKORO_LANG",
    "KOKORO_DEFAULT_VOICE",
)


def _reload_config(**env):
    for key in _CONFIG_ENV_KEYS:
        os.environ.pop(key, None)

    for key, value in env.items():
        os.environ[key] = value

    from server import config

    return importlib.reload(config)


def _desktop_model_path():
    return Path(__file__).resolve().parents[1] / "models" / "en_US-lessac-medium.onnx"


def _desktop_kokoro_model_path():
    return Path(__file__).resolve().parents[1] / "models" / "kokoro-v1.0.fp16.onnx"


def _desktop_kokoro_voices_path():
    return Path(__file__).resolve().parents[1] / "models" / "voices-v1.0.bin"


@pytest.fixture
def load_config():
    original_env = {key: os.environ.get(key) for key in _CONFIG_ENV_KEYS}
    yield _reload_config

    for key, value in original_env.items():
        if value is None:
            os.environ.pop(key, None)
        else:
            os.environ[key] = value
    _reload_config(
        **{key: value for key, value in original_env.items() if value is not None}
    )


def test_default_port_and_host(load_config):
    config = load_config()
    assert config.DEFAULT_PORT == 8765
    assert config.HOST == "127.0.0.1"


def test_default_model_settings(load_config):
    config = load_config()
    assert config.PIPER_MODEL_PATH == str(_desktop_model_path())
    assert config.KOKORO_MODEL_PATH == str(_desktop_kokoro_model_path())
    assert config.KOKORO_VOICES_PATH == str(_desktop_kokoro_voices_path())
    assert config.KOKORO_DEFAULT_LANG == "en-us"
    assert config.KOKORO_DEFAULT_VOICE == "af_heart"


def test_model_settings_use_env_overrides(load_config):
    config = load_config(
        PIPER_MODEL_PATH="models/custom.onnx",
        KOKORO_MODEL_PATH="models/custom-kokoro.onnx",
        KOKORO_VOICES_PATH="models/custom-voices.bin",
        KOKORO_LANG="en-gb",
        KOKORO_DEFAULT_VOICE="bf_emma",
    )
    assert config.PIPER_MODEL_PATH == "models/custom.onnx"
    assert config.KOKORO_MODEL_PATH == "models/custom-kokoro.onnx"
    assert config.KOKORO_VOICES_PATH == "models/custom-voices.bin"
    assert config.KOKORO_DEFAULT_LANG == "en-gb"
    assert config.KOKORO_DEFAULT_VOICE == "bf_emma"


def test_frozen_default_model_uses_meipass(load_config, monkeypatch, tmp_path):
    monkeypatch.setattr(sys, "_MEIPASS", str(tmp_path), raising=False)

    config = load_config()

    assert config.PIPER_MODEL_PATH == str(
        tmp_path / "models" / "en_US-lessac-medium.onnx"
    )
    assert config.KOKORO_MODEL_PATH == str(
        tmp_path / "models" / "kokoro-v1.0.fp16.onnx"
    )
    assert config.KOKORO_VOICES_PATH == str(tmp_path / "models" / "voices-v1.0.bin")


def test_cors_includes_localhost_dev(load_config):
    config = load_config()
    assert "http://localhost:5173" in config.CORS_ORIGINS
    assert "http://127.0.0.1:5173" in config.CORS_ORIGINS


def test_cors_includes_production_web_app(load_config):
    config = load_config()
    # Deployed web app calls the local sidecar; its origins must be allowed.
    assert "https://ollie-reader.web.app" in config.CORS_ORIGINS
    assert "https://ollie-reader.firebaseapp.com" in config.CORS_ORIGINS


def test_cors_appends_env_origins(load_config):
    config = load_config(
        OLLIE_CORS_ORIGINS="https://ollie.example.app, https://b.app",
    )
    assert "http://localhost:5173" in config.CORS_ORIGINS
    assert "http://127.0.0.1:5173" in config.CORS_ORIGINS
    assert "https://ollie.example.app" in config.CORS_ORIGINS
    assert "https://b.app" in config.CORS_ORIGINS


@pytest.mark.parametrize("origin", ["*", "https://*.example.com"])
def test_cors_rejects_wildcard_origin(load_config, origin):
    with pytest.raises(ValueError, match="OLLIE_CORS_ORIGINS"):
        load_config(OLLIE_CORS_ORIGINS=f"https://ollie.example.app, {origin}")
