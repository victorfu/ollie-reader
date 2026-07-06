import signal
import subprocess

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


class _SlowProc(_FakeProc):
    def __init__(self):
        super().__init__()
        self.killed = False
        self.wait_calls = 0

    def terminate(self):
        pass

    def wait(self, timeout=None):
        self.wait_calls += 1
        if self.wait_calls == 1:
            raise subprocess.TimeoutExpired(cmd=["sidecar"], timeout=timeout)
        return 0

    def kill(self):
        self.killed = True
        self._alive = False


def _no_existing_sidecar(monkeypatch):
    """start() 現在會先 health_check；spawn 路徑的測試要先讓它回 False。"""
    monkeypatch.setattr(
        SidecarManager, "health_check", lambda self, timeout=1.0: False
    )


def _forbid_spawn(monkeypatch):
    def boom(*a, **k):
        raise AssertionError("subprocess.Popen 不應被呼叫")

    monkeypatch.setattr("shell.sidecar.subprocess.Popen", boom)


def test_start_spawns_process(monkeypatch):
    _no_existing_sidecar(monkeypatch)
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


def test_start_uses_frozen_executable(monkeypatch):
    _no_existing_sidecar(monkeypatch)
    spawned = {}

    def fake_popen(cmd, *a, **k):
        spawned["cmd"] = cmd
        return _FakeProc()

    monkeypatch.setattr("shell.sidecar.subprocess.Popen", fake_popen)
    monkeypatch.setattr("shell.sidecar.sys.frozen", True, raising=False)
    monkeypatch.setattr("shell.sidecar.sys.executable", "/Applications/Ollie.app/ollie")

    mgr = SidecarManager(port=8766, main_path="/x/main.py")
    mgr.start()

    assert spawned["cmd"] == [
        "/Applications/Ollie.app/ollie",
        "--serve",
        "--port",
        "8766",
    ]


def test_stop_terminates(monkeypatch):
    _no_existing_sidecar(monkeypatch)
    monkeypatch.setattr("shell.sidecar.subprocess.Popen", lambda *a, **k: _FakeProc())
    mgr = SidecarManager(port=8765, main_path="/x/main.py")
    mgr.start()
    mgr.stop()
    assert mgr.is_running() is False


def test_stop_kills_and_waits_when_terminate_times_out(monkeypatch):
    _no_existing_sidecar(monkeypatch)
    proc = _SlowProc()
    monkeypatch.setattr("shell.sidecar.subprocess.Popen", lambda *a, **k: proc)

    mgr = SidecarManager(port=8765, main_path="/x/main.py")
    mgr.start()
    mgr.stop()

    assert proc.killed is True
    assert proc.wait_calls == 2
    assert mgr.is_running() is False


def test_health_check_true_on_200_with_version(monkeypatch):
    class _Resp:
        status = 200

        def __enter__(self):
            return self

        def __exit__(self, *a):
            return False

        def read(self):
            return b'{"version": "0.2.0", "engine": "local-sidecar"}'

    monkeypatch.setattr(
        "server.instance.urllib.request.urlopen", lambda url, timeout=1.0: _Resp()
    )
    mgr = SidecarManager(port=8765, main_path="/x/main.py")
    assert mgr.health_check() is True


def test_health_check_false_on_error(monkeypatch):
    def boom(url, timeout=1.0):
        raise OSError("refused")

    monkeypatch.setattr("server.instance.urllib.request.urlopen", boom)
    mgr = SidecarManager(port=8765, main_path="/x/main.py")
    assert mgr.health_check() is False


# ---- 收養（adopt）既有 sidecar ----


def _adoptable(monkeypatch, pid=4242, alive=None):
    """port 上有活的自家 sidecar；alive 為可變 dict 讓測試翻轉存活狀態。"""
    if alive is None:
        alive = {"v": True}
    monkeypatch.setattr(
        SidecarManager, "health_check", lambda self, timeout=1.0: True
    )
    monkeypatch.setattr("shell.sidecar.instance.read_pid", lambda port: pid)
    monkeypatch.setattr(
        "shell.sidecar.instance.pid_alive", lambda p: alive["v"]
    )
    return alive


def test_start_adopts_existing_sidecar(monkeypatch):
    _forbid_spawn(monkeypatch)
    _adoptable(monkeypatch)

    mgr = SidecarManager(port=8765, main_path="/x/main.py")
    mgr.start()

    assert mgr.is_running() is True


def test_adopted_is_running_false_when_pid_dead(monkeypatch):
    _forbid_spawn(monkeypatch)
    alive = _adoptable(monkeypatch)

    mgr = SidecarManager(port=8765, main_path="/x/main.py")
    mgr.start()
    alive["v"] = False

    assert mgr.is_running() is False


def test_adopted_stop_sends_sigterm(monkeypatch):
    _forbid_spawn(monkeypatch)
    alive = _adoptable(monkeypatch)
    kills = []

    def fake_kill(pid, sig):
        kills.append((pid, sig))
        alive["v"] = False

    monkeypatch.setattr("shell.sidecar.os.kill", fake_kill)

    mgr = SidecarManager(port=8765, main_path="/x/main.py")
    mgr.start()
    mgr.stop()

    assert kills == [(4242, signal.SIGTERM)]
    assert mgr.is_running() is False


def test_adopted_stop_escalates_to_sigkill(monkeypatch):
    _forbid_spawn(monkeypatch)
    _adoptable(monkeypatch)  # pid_alive 恆為 True → SIGTERM 等不到 → SIGKILL
    monkeypatch.setattr("shell.sidecar._ADOPTED_STOP_TIMEOUT", 0.05)
    monkeypatch.setattr("shell.sidecar.time.sleep", lambda s: None)
    kills = []
    monkeypatch.setattr(
        "shell.sidecar.os.kill", lambda pid, sig: kills.append((pid, sig))
    )

    mgr = SidecarManager(port=8765, main_path="/x/main.py")
    mgr.start()
    mgr.stop()

    assert kills[0] == (4242, signal.SIGTERM)
    assert kills[-1] == (4242, signal.SIGKILL)


def test_adopted_without_pid_file(monkeypatch, capsys):
    """舊版 sidecar 還在跑（沒有 PID 檔）：可收養、is_running 退回 HTTP、stop 只清狀態。"""
    _forbid_spawn(monkeypatch)
    monkeypatch.setattr(
        SidecarManager, "health_check", lambda self, timeout=1.0: True
    )
    monkeypatch.setattr("shell.sidecar.instance.read_pid", lambda port: None)
    monkeypatch.setattr(
        "shell.sidecar.os.kill",
        lambda pid, sig: (_ for _ in ()).throw(AssertionError("不應呼叫 os.kill")),
    )

    mgr = SidecarManager(port=8765, main_path="/x/main.py")
    mgr.start()
    assert mgr.is_running() is True  # 退回 health_check

    mgr.stop()  # 不應丟例外
    assert mgr.is_running() is False

    assert "無 PID 檔" in capsys.readouterr().out


def test_start_respawns_after_adopted_died(monkeypatch):
    """收養的 sidecar 死掉後再按啟動 → 正常 spawn 新的。"""
    health = {"v": True}
    alive = {"v": True}
    monkeypatch.setattr(
        SidecarManager, "health_check", lambda self, timeout=1.0: health["v"]
    )
    monkeypatch.setattr("shell.sidecar.instance.read_pid", lambda port: 4242)
    monkeypatch.setattr("shell.sidecar.instance.pid_alive", lambda p: alive["v"])
    spawned = {}

    def fake_popen(cmd, *a, **k):
        spawned["cmd"] = cmd
        return _FakeProc()

    monkeypatch.setattr("shell.sidecar.subprocess.Popen", fake_popen)

    mgr = SidecarManager(port=8765, main_path="/x/main.py")
    mgr.start()  # 收養
    assert "cmd" not in spawned

    alive["v"] = False
    health["v"] = False  # 收養的 sidecar 死了
    mgr.start()  # 應改走 spawn

    assert "cmd" in spawned
    assert mgr.is_running() is True
