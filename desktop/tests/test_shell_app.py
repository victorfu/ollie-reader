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
    """VoiceLabTab 建構時會打一次 sidecar HTTP；測試中要斷開。"""
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
    assert ids == ["edge", "piper", "kokoro"]
    assert voice_lab._endpoint("edge") == "/api/etts"
    assert voice_lab._endpoint("kokoro") == "/api/ktts"


def test_engine_labels_mark_cloud_vs_offline(voice_lab):
    labels = [voice_lab.engine_combo.itemText(i) for i in range(voice_lab.engine_combo.count())]
    # compute-mode「本機」的語意：雲端引擎一定要標出來，否則會被當成離線可用
    assert "雲端" in labels[0]
    assert all("離線" in label for label in labels[1:])


def test_base_url_follows_manager_port(voice_lab):
    assert voice_lab._base_url().endswith(":8765")


def test_voices_loaded_populates_combo(voice_lab):
    voice_lab._on_voices_loaded(
        [{"id": "en-US-EmmaMultilingualNeural", "label": "Emma (Female)"}], None
    )
    assert voice_lab.voice_combo.count() == 1
    assert voice_lab.voice_combo.itemData(0) == "en-US-EmmaMultilingualNeural"


def test_stale_voice_response_cannot_overwrite_current_engine(voice_lab):
    voice_lab.engine_combo.setCurrentIndex(1)  # piper
    voice_lab._voices_request_id = 2

    voice_lab._on_voices_loaded(
        [{"id": "en-US-JennyNeural", "label": "Jenny"}],
        None,
        request_id=1,
        engine_id="edge",
    )

    assert voice_lab.voice_combo.count() == 0

    voice_lab._on_voices_loaded(
        [{"id": "0", "label": "0（預設）"}],
        None,
        request_id=2,
        engine_id="piper",
    )
    assert voice_lab.voice_combo.itemData(0) == "0"


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


class _CapturingPool:
    def __init__(self):
        self.tasks = []

    def start(self, task):
        self.tasks.append(task)


def _complete_audition(voice_lab, result):
    pool = _CapturingPool()
    voice_lab.pool = pool
    voice_lab._audition()
    pool.tasks[-1].signals.done.emit(result, None)


def test_audition_ignores_duplicate_enter_while_same_request_is_pending(voice_lab):
    pool = _CapturingPool()
    voice_lab.pool = pool

    voice_lab._audition()
    voice_lab._audition()

    assert len(pool.tasks) == 1
    assert "合成中" in voice_lab.status_label.text()
    voice_lab.cleanup()


def test_audition_old_text_response_cannot_play_after_new_enter(voice_lab):
    pool = _CapturingPool()
    voice_lab.pool = pool
    voice_lab.text_edit.setText("first request")
    voice_lab._audition()
    old_task = pool.tasks[-1]

    voice_lab.text_edit.setText("second request")
    voice_lab._audition()
    new_task = pool.tasks[-1]

    old_task.signals.done.emit((b"OLD", "audio/wav"), None)
    assert voice_lab._audio_path is None
    assert not voice_lab.play_button.isEnabled()

    new_task.signals.done.emit((b"NEW", "audio/wav"), None)
    assert voice_lab._audio_path.read_bytes() == b"NEW"
    assert voice_lab.play_button.isEnabled()
    voice_lab.cleanup()


def test_audition_response_does_not_play_after_text_is_edited(voice_lab):
    pool = _CapturingPool()
    voice_lab.pool = pool
    voice_lab.text_edit.setText("before edit")
    voice_lab._audition()

    voice_lab.text_edit.setText("after edit")
    pool.tasks[-1].signals.done.emit((b"STALE", "audio/wav"), None)

    assert voice_lab._audio_path is None
    assert voice_lab.play_button.isEnabled()
    assert "已變更" in voice_lab.status_label.text()
    voice_lab.cleanup()


def test_audition_old_engine_response_cannot_block_or_replace_new_audio(voice_lab):
    pool = _CapturingPool()
    voice_lab.pool = pool
    voice_lab._audition()
    old_task = pool.tasks[-1]

    voice_lab.engine_combo.setCurrentIndex(1)  # piper; invalidates edge request
    voice_lab._audition()
    new_task = pool.tasks[-1]

    old_task.signals.done.emit((b"EDGE", "audio/wav"), None)
    assert voice_lab._audio_path is None
    assert not voice_lab.play_button.isEnabled()

    new_task.signals.done.emit((b"PIPER", "audio/wav"), None)
    assert voice_lab._audio_path.read_bytes() == b"PIPER"
    assert voice_lab.play_button.isEnabled()
    voice_lab.cleanup()


def test_audio_suffix_follows_content_type(voice_lab):
    _complete_audition(voice_lab, (b"\xff\xf3x", "audio/mpeg"))
    assert voice_lab._audio_path.suffix == ".mp3"
    _complete_audition(voice_lab, (b"RIFFx", "audio/wav"))
    assert voice_lab._audio_path.suffix == ".wav"
    voice_lab.cleanup()


def test_cleanup_removes_temp_audio(voice_lab):
    _complete_audition(voice_lab, (b"RIFFx", "audio/wav"))
    path = voice_lab._audio_path
    assert path.exists()
    voice_lab.cleanup()
    assert not path.exists()


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


def test_save_oikid_credentials_keeps_existing_password_when_blank(
    qapp, monkeypatch
):
    monkeypatch.setattr(app_module.autostart, "is_installed", lambda: False)
    monkeypatch.setattr(
        app_module,
        "get_oikid_credentials",
        lambda: ("alice", "existing-secret"),
    )
    saved = {}
    monkeypatch.setattr(
        app_module,
        "set_oikid_credentials",
        lambda u, p: saved.update(username=u, password=p),
    )
    dialog = app_module.SettingsDialog(_StubManager())
    dialog.oikid_user_edit.setText("alice+new@example.com")
    dialog.oikid_pw_edit.clear()

    dialog._save_oikid_credentials()

    assert saved == {
        "username": "alice+new@example.com",
        "password": "existing-secret",
    }


def test_settings_dialog_surfaces_keyring_read_error(qapp, monkeypatch):
    monkeypatch.setattr(app_module.autostart, "is_installed", lambda: False)

    def locked():
        raise app_module.OikidSecretsError("鑰匙圈已鎖定")

    monkeypatch.setattr(app_module, "get_oikid_credentials", locked)

    dialog = app_module.SettingsDialog(_StubManager())

    assert "鑰匙圈已鎖定" in dialog.oikid_status_label.text()


def test_save_oikid_credentials_surfaces_keyring_write_error(
    settings_dialog, monkeypatch
):
    def locked(_username, _password):
        raise app_module.OikidSecretsError("無法寫入鑰匙圈")

    monkeypatch.setattr(app_module, "set_oikid_credentials", locked)
    settings_dialog.oikid_user_edit.setText("alice")
    settings_dialog.oikid_pw_edit.setText("secret")

    settings_dialog._save_oikid_credentials()

    assert "無法寫入鑰匙圈" in settings_dialog.oikid_status_label.text()


def test_clear_oikid_credentials_calls_clear(settings_dialog, monkeypatch):
    called = {"n": 0}
    monkeypatch.setattr(
        app_module, "clear_oikid_credentials", lambda: called.__setitem__("n", called["n"] + 1)
    )
    settings_dialog._clear_oikid_credentials()
    assert called["n"] == 1


def test_clear_oikid_credentials_surfaces_keyring_error(settings_dialog, monkeypatch):
    def locked():
        raise app_module.OikidSecretsError("無法清除鑰匙圈")

    monkeypatch.setattr(app_module, "clear_oikid_credentials", locked)
    settings_dialog.oikid_user_edit.setText("alice")

    settings_dialog._clear_oikid_credentials()

    assert settings_dialog.oikid_user_edit.text() == "alice"
    assert "無法清除鑰匙圈" in settings_dialog.oikid_status_label.text()


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
