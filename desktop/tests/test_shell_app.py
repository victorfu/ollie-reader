import sys
from pathlib import Path

from shell import app as app_module


def test_resource_path_uses_desktop_root_in_dev():
    expected = Path(__file__).resolve().parents[1] / "assets" / "tray-icon.png"

    assert app_module._resource_path("assets", "tray-icon.png") == expected
    assert expected.is_file()


def test_resource_path_uses_pyinstaller_meipass(monkeypatch, tmp_path):
    monkeypatch.setattr(sys, "frozen", True, raising=False)
    monkeypatch.setattr(sys, "_MEIPASS", str(tmp_path), raising=False)

    assert app_module._resource_path("assets", "tray-icon.png") == tmp_path / "assets" / "tray-icon.png"


def test_web_app_url_dev_uses_localhost(monkeypatch):
    monkeypatch.delenv("OLLIE_WEB_APP_URL", raising=False)
    monkeypatch.setattr(sys, "frozen", False, raising=False)

    assert app_module._web_app_url() == "http://localhost:5173"


def test_web_app_url_production_uses_deployed_site(monkeypatch):
    monkeypatch.delenv("OLLIE_WEB_APP_URL", raising=False)
    monkeypatch.setattr(sys, "frozen", True, raising=False)

    assert app_module._web_app_url() == "https://ollie-reader.web.app"


def test_web_app_url_env_override_wins(monkeypatch):
    monkeypatch.setattr(sys, "frozen", True, raising=False)
    monkeypatch.setenv("OLLIE_WEB_APP_URL", "https://staging.example.app")

    assert app_module._web_app_url() == "https://staging.example.app"
