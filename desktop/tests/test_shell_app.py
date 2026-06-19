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
