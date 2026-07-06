import os
import sys
from pathlib import Path

os.environ.setdefault("QT_QPA_PLATFORM", "offscreen")

import pytest
from PySide6.QtWidgets import QApplication

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


@pytest.fixture(scope="module")
def qapp():
    app = QApplication.instance() or QApplication([])
    yield app


class _StubManager:
    port = 8765

    def is_running(self):
        return False

    def start(self):
        pass

    def stop(self):
        pass


@pytest.fixture
def settings_dialog(qapp, monkeypatch):
    # Isolate __init__ from external state dependencies
    monkeypatch.setattr(app_module.autostart, "is_installed", lambda: False)
    monkeypatch.setattr(app_module, "get_oikid_credentials", lambda: None)
    return app_module.SettingsDialog(_StubManager())


def test_save_oikid_credentials_writes_to_keychain(settings_dialog, monkeypatch):
    saved = {}
    monkeypatch.setattr(
        app_module, "set_oikid_credentials",
        lambda u, p: saved.update(username=u, password=p),
    )
    settings_dialog.oikid_user_edit.setText("alice")
    settings_dialog.oikid_pw_edit.setText("secret")

    settings_dialog._save_oikid_credentials()

    assert saved == {"username": "alice", "password": "secret"}


def test_clear_oikid_credentials_calls_clear(settings_dialog, monkeypatch):
    called = {"n": 0}
    monkeypatch.setattr(
        app_module, "clear_oikid_credentials", lambda: called.__setitem__("n", called["n"] + 1)
    )
    settings_dialog._clear_oikid_credentials()
    assert called["n"] == 1


class _StubGuard:
    def __init__(self, acquired):
        self._acquired = acquired
        self.notified = False
        self.released = False
        self.on_activate = None

    def acquire(self):
        return self._acquired

    def notify_existing(self, timeout_ms=500):
        self.notified = True
        return True

    def release(self):
        self.released = True


def test_run_shell_second_instance_notifies_and_exits(qapp, monkeypatch):
    guard = _StubGuard(acquired=False)
    monkeypatch.setattr(app_module, "SingleInstance", lambda: guard)

    def boom(*a, **k):
        raise AssertionError("TrayApp 不應被建立")

    monkeypatch.setattr(app_module, "TrayApp", boom)

    app_module.run_shell()  # 應直接 return，不進入 event loop

    assert guard.notified is True


def test_run_shell_first_instance_wires_activate_to_settings(qapp, monkeypatch):
    guard = _StubGuard(acquired=True)
    monkeypatch.setattr(app_module, "SingleInstance", lambda: guard)

    created = {}

    class _StubTray:
        def __init__(self, app):
            created["tray"] = self
            self.opened = 0

        def _open_settings(self, _checked=False):
            self.opened += 1

        def start(self):
            pass

    monkeypatch.setattr(app_module, "TrayApp", _StubTray)
    monkeypatch.setattr(type(qapp), "exec", lambda self: 0)

    with pytest.raises(SystemExit):
        app_module.run_shell()

    assert guard.on_activate is not None
    guard.on_activate()
    assert created["tray"].opened == 1
