import server  # noqa: F401
from fastapi.testclient import TestClient

from server import app as app_module
from server import model_download as md


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
    monkeypatch.setattr(md, "is_downloading", lambda: True)

    app = app_module.create_app()
    with TestClient(app) as client:
        r = client.post("/api/tts", json={"text": "hi", "speed": 1.0, "voice": "0"})
    assert r.status_code == 503
    assert "下載" in r.json()["detail"]
