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


@pytest.fixture(autouse=True)
def _isolate_voice_lab(monkeypatch):
    """VoiceLabTab 建構時會讀 keychain 並打一次 sidecar HTTP；測試中兩者都要斷開。"""
    monkeypatch.setattr(app_module, "get_azure_credentials", lambda: None)
    monkeypatch.setattr(app_module.VoiceLabTab, "_reload_voices", lambda self: None)


@pytest.fixture
def settings_dialog(qapp, monkeypatch):
    # Isolate __init__ from external state dependencies
    monkeypatch.setattr(app_module.autostart, "is_installed", lambda: False)
    monkeypatch.setattr(app_module, "get_oikid_credentials", lambda: None)
    return app_module.SettingsDialog(_StubManager())


@pytest.fixture
def voice_lab(qapp):
    return app_module.VoiceLabTab(_StubManager())


def test_settings_dialog_has_both_tabs(settings_dialog):
    titles = [settings_dialog.tabs.tabText(i) for i in range(settings_dialog.tabs.count())]
    assert titles == ["一般", "語音測試"]


def test_engine_combo_lists_every_engine_with_endpoint(voice_lab):
    ids = [voice_lab.engine_combo.itemData(i) for i in range(voice_lab.engine_combo.count())]
    assert ids == ["edge", "azure", "piper", "kokoro", "chatterbox"]
    assert voice_lab._endpoint("edge") == "/api/etts"
    assert voice_lab._endpoint("azure") == "/api/azure-tts"
    assert voice_lab._endpoint("kokoro") == "/api/ktts"


def test_engine_labels_mark_cloud_vs_offline(voice_lab):
    labels = [voice_lab.engine_combo.itemText(i) for i in range(voice_lab.engine_combo.count())]
    # compute-mode「本機」的語意：雲端引擎一定要標出來，否則會被當成離線可用
    assert "雲端" in labels[0] and "雲端" in labels[1]
    assert all("離線" in label for label in labels[2:])


def test_base_url_follows_manager_port(voice_lab):
    assert voice_lab._base_url().endswith(":8765")


def test_voices_loaded_populates_combo(voice_lab):
    voice_lab._on_voices_loaded(
        [{"id": "en-US-EmmaMultilingualNeural", "label": "Emma (Female)"}], None
    )
    assert voice_lab.voice_combo.count() == 1
    assert voice_lab.voice_combo.itemData(0) == "en-US-EmmaMultilingualNeural"


def test_voices_error_falls_back_to_default_entry(voice_lab):
    voice_lab._on_voices_loaded(None, RuntimeError("boom"))
    assert voice_lab.voice_combo.itemData(0) == ""
    assert "失敗" in voice_lab.status_label.text()


def test_connect_error_gets_actionable_message(voice_lab):
    import httpx

    msg = voice_lab._describe(httpx.ConnectError("refused"))
    assert "啟動本機服務" in msg


def test_http_error_surfaces_server_detail(voice_lab):
    import httpx

    request = httpx.Request("POST", "http://127.0.0.1:8765/api/etts")
    response = httpx.Response(502, json={"detail": "403 token 失效"}, request=request)
    msg = voice_lab._describe(httpx.HTTPStatusError("x", request=request, response=response))
    assert "502" in msg and "403 token 失效" in msg


def test_audio_suffix_follows_content_type(voice_lab):
    voice_lab._on_audio_ready((b"\xff\xf3x", "audio/mpeg"), None)
    assert voice_lab._audio_path.suffix == ".mp3"
    voice_lab._on_audio_ready((b"RIFFx", "audio/wav"), None)
    assert voice_lab._audio_path.suffix == ".wav"
    voice_lab.cleanup()


def test_cleanup_removes_temp_audio(voice_lab):
    voice_lab._on_audio_ready((b"RIFFx", "audio/wav"), None)
    path = voice_lab._audio_path
    assert path.exists()
    voice_lab.cleanup()
    assert not path.exists()


def test_blank_azure_key_with_no_existing_key_is_rejected(voice_lab, monkeypatch):
    called = []
    monkeypatch.setattr(app_module, "set_azure_credentials", lambda *a: called.append(a))
    voice_lab.azure_key_edit.setText("")
    voice_lab._save_azure_credentials()
    assert called == []
    assert "請輸入 Azure key" in voice_lab.status_label.text()


def test_blank_azure_key_keeps_existing_key_when_changing_region(voice_lab, monkeypatch):
    saved = {}
    monkeypatch.setattr(app_module, "get_azure_credentials", lambda: ("OLDKEY", "eastasia"))
    monkeypatch.setattr(
        app_module, "set_azure_credentials", lambda k, r: saved.update(key=k, region=r)
    )
    voice_lab.azure_key_edit.setText("")
    voice_lab.azure_region_edit.setText("westus")
    voice_lab._save_azure_credentials()
    assert saved == {"key": "OLDKEY", "region": "westus"}


def test_azure_save_uses_default_region_when_blank(voice_lab, monkeypatch):
    saved = {}
    monkeypatch.setattr(
        app_module, "set_azure_credentials", lambda k, r: saved.update(key=k, region=r)
    )
    voice_lab.azure_key_edit.setText("NEWKEY")
    voice_lab.azure_region_edit.setText("")
    voice_lab._save_azure_credentials()
    assert saved == {"key": "NEWKEY", "region": app_module.DEFAULT_AZURE_REGION}


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
