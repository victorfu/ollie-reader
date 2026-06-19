import importlib

import pytest

_CONFIG_ENV_KEYS = (
    "OLLIE_CORS_ORIGINS",
    "PIPER_MODEL_PATH",
    "KOKORO_LANG",
    "KOKORO_DEFAULT_VOICE",
)


def _reload_config(monkeypatch, **env):
    for key in _CONFIG_ENV_KEYS:
        monkeypatch.delenv(key, raising=False)

    for key, value in env.items():
        monkeypatch.setenv(key, value)

    from server import config

    return importlib.reload(config)


@pytest.fixture
def load_config(monkeypatch):
    yield lambda **env: _reload_config(monkeypatch, **env)
    _reload_config(monkeypatch)


def test_default_port_and_host(load_config):
    config = load_config()
    assert config.DEFAULT_PORT == 8765
    assert config.HOST == "127.0.0.1"


def test_default_model_settings(load_config):
    config = load_config()
    assert config.PIPER_MODEL_PATH == "models/en_US-lessac-medium.onnx"
    assert config.KOKORO_LANG == "a"
    assert config.KOKORO_DEFAULT_VOICE == "af_heart"


def test_model_settings_use_env_overrides(load_config):
    config = load_config(
        PIPER_MODEL_PATH="models/custom.onnx",
        KOKORO_LANG="b",
        KOKORO_DEFAULT_VOICE="bf_emma",
    )
    assert config.PIPER_MODEL_PATH == "models/custom.onnx"
    assert config.KOKORO_LANG == "b"
    assert config.KOKORO_DEFAULT_VOICE == "bf_emma"


def test_cors_includes_localhost_dev(load_config):
    config = load_config()
    assert "http://localhost:5173" in config.CORS_ORIGINS
    assert "http://127.0.0.1:5173" in config.CORS_ORIGINS


def test_cors_appends_env_origins(load_config):
    config = load_config(
        OLLIE_CORS_ORIGINS="https://ollie.example.app, https://b.app",
    )
    assert "https://ollie.example.app" in config.CORS_ORIGINS
    assert "https://b.app" in config.CORS_ORIGINS
