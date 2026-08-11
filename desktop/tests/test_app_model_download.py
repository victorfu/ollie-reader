import server  # noqa: F401
from fastapi.testclient import TestClient

from server import app as app_module
from server import model_download as md
from server.tts_kokoro import KokoroTTSResult
from server.tts_piper import TTSResult


def test_lifespan_triggers_download_when_not_frozen(monkeypatch):
    called = {}
    monkeypatch.setattr(md, "should_auto_download", lambda: True)
    monkeypatch.setattr(
        md, "start_background_download", lambda d: called.setdefault("dir", d)
    )
    app = app_module.create_app()
    with TestClient(app):  # 進出 context 觸發 lifespan
        pass
    assert "dir" in called


def test_lifespan_skips_download_when_frozen(monkeypatch):
    called = {}
    monkeypatch.setattr(md, "should_auto_download", lambda: False)
    monkeypatch.setattr(
        md, "start_background_download", lambda d: called.setdefault("dir", d)
    )
    app = app_module.create_app()
    with TestClient(app):
        pass
    assert "dir" not in called


def test_status_endpoint(monkeypatch):
    monkeypatch.setattr(md, "should_auto_download", lambda: False)
    app = app_module.create_app()
    with TestClient(app) as client:
        r = client.get("/api/models/status")
    assert r.status_code == 200
    assert "state" in r.json()


def test_tts_returns_503_while_downloading(monkeypatch, tmp_path):
    monkeypatch.setattr(md, "should_auto_download", lambda: False)
    monkeypatch.setattr(app_module, "MODELS_DIR", tmp_path)  # 空目錄 → 模型不存在
    monkeypatch.setattr(
        app_module,
        "PIPER_MODEL_PATH",
        str(tmp_path / "en_US-lessac-medium.onnx"),
    )
    monkeypatch.setattr(md, "is_downloading", lambda: True)

    app = app_module.create_app()
    with TestClient(app) as client:
        r = client.post("/api/tts", json={"text": "hi", "speed": 1.0, "voice": "0"})
    assert r.status_code == 503
    assert "下載" in r.json()["detail"]


def test_custom_piper_model_is_not_blocked_by_default_download(
    monkeypatch, tmp_path
):
    default_dir = tmp_path / "default"
    custom_model = tmp_path / "custom" / "voice.onnx"
    custom_model.parent.mkdir()
    custom_model.write_bytes(b"model")
    (tmp_path / "custom" / "voice.onnx.json").write_text("{}")
    monkeypatch.setattr(md, "should_auto_download", lambda: False)
    monkeypatch.setattr(md, "is_downloading", lambda: True)
    monkeypatch.setattr(app_module, "MODELS_DIR", default_dir)
    monkeypatch.setattr(app_module, "PIPER_MODEL_PATH", str(custom_model))
    monkeypatch.setattr(
        app_module,
        "generate_speech",
        lambda *args: TTSResult(audio_data=b"RIFFfake"),
    )

    app = app_module.create_app()
    with TestClient(app) as client:
        response = client.post("/api/tts", json={"text": "hi"})

    assert response.status_code == 200


def test_custom_kokoro_models_are_not_blocked_by_default_download(
    monkeypatch, tmp_path
):
    default_dir = tmp_path / "default"
    custom_model = tmp_path / "custom" / "kokoro.onnx"
    custom_voices = tmp_path / "custom" / "voices.bin"
    custom_model.parent.mkdir()
    custom_model.write_bytes(b"model")
    custom_voices.write_bytes(b"voices")
    monkeypatch.setattr(md, "should_auto_download", lambda: False)
    monkeypatch.setattr(md, "is_downloading", lambda: True)
    monkeypatch.setattr(app_module, "MODELS_DIR", default_dir)
    monkeypatch.setattr(app_module, "KOKORO_MODEL_PATH", str(custom_model))
    monkeypatch.setattr(app_module, "KOKORO_VOICES_PATH", str(custom_voices))
    monkeypatch.setattr(
        app_module,
        "kokoro_synthesize_speech",
        lambda *args: KokoroTTSResult(audio_data=b"RIFFfake"),
    )

    app = app_module.create_app()
    with TestClient(app) as client:
        response = client.post("/api/ktts", json={"text": "hi"})

    assert response.status_code == 200
