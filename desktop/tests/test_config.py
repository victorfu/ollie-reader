import importlib
import os

import pytest

_CONFIG_ENV_KEYS = (
    "OLLIE_CORS_ORIGINS",
    "PIPER_MODEL_PATH",
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
    assert "http://localhost:5173" in config.CORS_ORIGINS
    assert "http://127.0.0.1:5173" in config.CORS_ORIGINS
    assert "https://ollie.example.app" in config.CORS_ORIGINS
    assert "https://b.app" in config.CORS_ORIGINS


@pytest.mark.parametrize("origin", ["*", "https://*.example.com"])
def test_cors_rejects_wildcard_origin(load_config, origin):
    with pytest.raises(ValueError, match="OLLIE_CORS_ORIGINS"):
        load_config(OLLIE_CORS_ORIGINS=f"https://ollie.example.app, {origin}")
