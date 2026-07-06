import os
import subprocess
import sys

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
