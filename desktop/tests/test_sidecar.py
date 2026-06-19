import server  # noqa: F401  確保 server 套件可 import
from shell.sidecar import SidecarManager


class _FakeProc:
    def __init__(self):
        self._alive = True

    def poll(self):
        return None if self._alive else 0

    def terminate(self):
        self._alive = False

    def wait(self, timeout=None):
        return 0

    def kill(self):
        self._alive = False


def test_start_spawns_process(monkeypatch):
    spawned = {}

    def fake_popen(cmd, *a, **k):
        spawned["cmd"] = cmd
        return _FakeProc()

    monkeypatch.setattr("shell.sidecar.subprocess.Popen", fake_popen)
    mgr = SidecarManager(port=8765, main_path="/x/main.py")
    mgr.start()
    assert mgr.is_running() is True
    assert "--serve" in spawned["cmd"]
    assert "8765" in spawned["cmd"]


def test_stop_terminates(monkeypatch):
    monkeypatch.setattr("shell.sidecar.subprocess.Popen", lambda *a, **k: _FakeProc())
    mgr = SidecarManager(port=8765, main_path="/x/main.py")
    mgr.start()
    mgr.stop()
    assert mgr.is_running() is False


def test_health_check_true_on_200(monkeypatch):
    class _Resp:
        status = 200

        def __enter__(self):
            return self

        def __exit__(self, *a):
            return False

    monkeypatch.setattr(
        "shell.sidecar.urllib.request.urlopen", lambda url, timeout=1.0: _Resp()
    )
    mgr = SidecarManager(port=8765, main_path="/x/main.py")
    assert mgr.health_check() is True


def test_health_check_false_on_error(monkeypatch):
    def boom(url, timeout=1.0):
        raise OSError("refused")

    monkeypatch.setattr("shell.sidecar.urllib.request.urlopen", boom)
    mgr = SidecarManager(port=8765, main_path="/x/main.py")
    assert mgr.health_check() is False
