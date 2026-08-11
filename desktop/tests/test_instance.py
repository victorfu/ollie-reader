import os
import subprocess
import sys
import threading

from server import instance


class _Resp:
    status = 200

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False

    def read(self):
        return b'{"version": "0.2.0", "engine": "local-sidecar"}'


def test_pid_file_roundtrip(tmp_path, monkeypatch):
    monkeypatch.setattr("server.instance.tempfile.gettempdir", lambda: str(tmp_path))

    instance.write_pid_file(8765)
    assert instance.read_pid(8765) == os.getpid()

    instance.remove_pid_file(8765)
    assert instance.read_pid(8765) is None


def test_claim_pid_file_is_atomic_between_competing_starters(tmp_path, monkeypatch):
    monkeypatch.setattr("server.instance.tempfile.gettempdir", lambda: str(tmp_path))
    pid = {"value": 111}
    monkeypatch.setattr("server.instance.os.getpid", lambda: pid["value"])
    monkeypatch.setattr("server.instance.pid_alive", lambda _pid: True)

    assert instance.claim_pid_file(8765) is True
    pid["value"] = 222
    assert instance.claim_pid_file(8765) is False

    # The losing starter's cleanup must not remove the winner's claim.
    instance.remove_pid_file(8765)
    assert instance.read_pid(8765) == 111


def test_claim_pid_file_replaces_dead_owner(tmp_path, monkeypatch):
    monkeypatch.setattr("server.instance.tempfile.gettempdir", lambda: str(tmp_path))
    with open(instance.pid_file_path(8765), "w", encoding="utf-8") as f:
        f.write("111")
    monkeypatch.setattr("server.instance.pid_alive", lambda _pid: False)
    monkeypatch.setattr("server.instance.os.getpid", lambda: 222)

    assert instance.claim_pid_file(8765) is True
    assert instance.read_pid(8765) == 222


def test_claim_pid_file_serializes_stale_owner_replacement(tmp_path, monkeypatch):
    """A stale check cannot unlink the winner that replaced the stale inode."""
    monkeypatch.setattr("server.instance.tempfile.gettempdir", lambda: str(tmp_path))
    with open(instance.pid_file_path(8765), "w", encoding="utf-8") as f:
        f.write("999")

    actual_pid = os.getpid()
    thread_pids = {"claim-a": 111, "claim-b": 222}
    monkeypatch.setattr(
        "server.instance.os.getpid",
        lambda: thread_pids.get(threading.current_thread().name, actual_pid),
    )

    stale_checked = threading.Event()
    allow_a_to_replace = threading.Event()

    def fake_pid_alive(pid):
        if pid == 999:
            stale_checked.set()
            assert allow_a_to_replace.wait(timeout=5)
            return False
        return True

    monkeypatch.setattr("server.instance.pid_alive", fake_pid_alive)

    original_flock = instance.fcntl.flock
    b_waiting_on_lock = threading.Event()

    def tracked_flock(fd, operation):
        if (
            threading.current_thread().name == "claim-b"
            and operation == instance.fcntl.LOCK_EX
        ):
            b_waiting_on_lock.set()
        return original_flock(fd, operation)

    monkeypatch.setattr("server.instance.fcntl.flock", tracked_flock)

    results = {}
    errors = []

    def claim(name):
        try:
            results[name] = instance.claim_pid_file(8765)
        except BaseException as exc:  # surface thread failures in the test thread
            errors.append(exc)

    starter_a = threading.Thread(target=claim, args=("a",), name="claim-a")
    starter_b = threading.Thread(target=claim, args=("b",), name="claim-b")
    starter_a.start()
    assert stale_checked.wait(timeout=5)
    starter_b.start()
    assert b_waiting_on_lock.wait(timeout=5)

    allow_a_to_replace.set()
    starter_a.join(timeout=5)
    starter_b.join(timeout=5)

    assert not starter_a.is_alive()
    assert not starter_b.is_alive()
    assert errors == []
    assert results == {"a": True, "b": False}
    assert instance.read_pid(8765) == 111


def test_read_pid_missing_file_returns_none(tmp_path, monkeypatch):
    monkeypatch.setattr("server.instance.tempfile.gettempdir", lambda: str(tmp_path))
    assert instance.read_pid(8765) is None


def test_read_pid_garbage_returns_none(tmp_path, monkeypatch):
    monkeypatch.setattr("server.instance.tempfile.gettempdir", lambda: str(tmp_path))
    with open(instance.pid_file_path(8765), "w", encoding="utf-8") as f:
        f.write("not-a-pid")
    assert instance.read_pid(8765) is None


def test_remove_pid_file_missing_is_silent(tmp_path, monkeypatch):
    monkeypatch.setattr("server.instance.tempfile.gettempdir", lambda: str(tmp_path))
    instance.remove_pid_file(8765)  # 不應丟例外


def test_remove_pid_file_keeps_foreign_pid(tmp_path, monkeypatch):
    monkeypatch.setattr("server.instance.tempfile.gettempdir", lambda: str(tmp_path))
    foreign_pid = os.getpid() + 1
    with open(instance.pid_file_path(8765), "w", encoding="utf-8") as f:
        f.write(str(foreign_pid))

    instance.remove_pid_file(8765)

    assert instance.read_pid(8765) == foreign_pid


def test_remove_pid_file_keeps_garbage_file(tmp_path, monkeypatch):
    monkeypatch.setattr("server.instance.tempfile.gettempdir", lambda: str(tmp_path))
    with open(instance.pid_file_path(8765), "w", encoding="utf-8") as f:
        f.write("not-a-pid")

    instance.remove_pid_file(8765)

    assert os.path.exists(instance.pid_file_path(8765))


def test_pid_alive_self_is_true():
    assert instance.pid_alive(os.getpid()) is True


def test_pid_alive_dead_process_is_false():
    proc = subprocess.Popen([sys.executable, "-c", "pass"])
    proc.wait(timeout=10)
    assert instance.pid_alive(proc.pid) is False


def test_sidecar_alive_true_on_200_with_version(monkeypatch):
    monkeypatch.setattr(
        "server.instance.urllib.request.urlopen", lambda url, timeout=1.0: _Resp()
    )
    assert instance.sidecar_alive(8765) is True


def test_sidecar_alive_false_without_version_field(monkeypatch):
    class _Foreign(_Resp):
        def read(self):
            return b'{"hello": "world"}'

    monkeypatch.setattr(
        "server.instance.urllib.request.urlopen", lambda url, timeout=1.0: _Foreign()
    )
    assert instance.sidecar_alive(8765) is False


def test_sidecar_alive_false_on_non_json_body(monkeypatch):
    class _Html(_Resp):
        def read(self):
            return b"<html>not ours</html>"

    monkeypatch.setattr(
        "server.instance.urllib.request.urlopen", lambda url, timeout=1.0: _Html()
    )
    assert instance.sidecar_alive(8765) is False


def test_sidecar_alive_false_on_connection_error(monkeypatch):
    def boom(url, timeout=1.0):
        raise OSError("refused")

    monkeypatch.setattr("server.instance.urllib.request.urlopen", boom)
    assert instance.sidecar_alive(8765) is False


def test_install_signal_cleanup_removes_pid_file_and_reraises(tmp_path, monkeypatch):
    import signal as signal_mod

    monkeypatch.setattr("server.instance.tempfile.gettempdir", lambda: str(tmp_path))
    instance.write_pid_file(8765)

    installed = {}
    monkeypatch.setattr(
        "server.instance.signal.signal",
        lambda sig, handler: installed.__setitem__(sig, handler),
    )
    kills = []
    monkeypatch.setattr(
        "server.instance.os.kill", lambda pid, sig: kills.append((pid, sig))
    )

    instance.install_signal_cleanup(8765)
    assert set(installed) == {signal_mod.SIGTERM, signal_mod.SIGINT}

    installed[signal_mod.SIGTERM](signal_mod.SIGTERM, None)

    assert instance.read_pid(8765) is None  # PID 檔已清
    assert installed[signal_mod.SIGTERM] is signal_mod.SIG_DFL  # 還原預設 handler
    assert kills == [(os.getpid(), signal_mod.SIGTERM)]  # 重送訊號
