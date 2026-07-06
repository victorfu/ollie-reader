import sys

import pytest
import uvicorn

import main
from server import instance


def test_serve_exits_cleanly_when_sidecar_already_running(monkeypatch):
    monkeypatch.setattr(sys, "argv", ["ollie-reader", "--serve", "--port", "8123"])
    monkeypatch.setattr(instance, "sidecar_alive", lambda port, timeout=1.0: True)

    def boom(*a, **k):
        raise AssertionError("uvicorn.run 不應被呼叫")

    monkeypatch.setattr(uvicorn, "run", boom)

    main.main()  # 正常 return（exit 0），不啟動 uvicorn


def test_serve_writes_then_removes_pid_file(monkeypatch):
    monkeypatch.setattr(sys, "argv", ["ollie-reader", "--serve", "--port", "8123"])
    monkeypatch.setattr(instance, "sidecar_alive", lambda port, timeout=1.0: False)
    events = []
    monkeypatch.setattr(
        instance, "write_pid_file", lambda port: events.append(("write", port))
    )
    monkeypatch.setattr(
        instance,
        "install_signal_cleanup",
        lambda port: events.append(("install", port)),
    )
    monkeypatch.setattr(
        instance, "remove_pid_file", lambda port: events.append(("remove", port))
    )
    monkeypatch.setattr(uvicorn, "run", lambda *a, **k: events.append(("run",)))

    main.main()

    assert events == [("write", 8123), ("install", 8123), ("run",), ("remove", 8123)]


def test_serve_removes_pid_file_when_uvicorn_raises(monkeypatch):
    monkeypatch.setattr(sys, "argv", ["ollie-reader", "--serve", "--port", "8123"])
    monkeypatch.setattr(instance, "sidecar_alive", lambda port, timeout=1.0: False)
    events = []
    monkeypatch.setattr(instance, "write_pid_file", lambda port: None)
    monkeypatch.setattr(instance, "install_signal_cleanup", lambda port: None)
    monkeypatch.setattr(
        instance, "remove_pid_file", lambda port: events.append(("remove", port))
    )

    def boom(*a, **k):
        raise RuntimeError("bind failed")

    monkeypatch.setattr(uvicorn, "run", boom)

    with pytest.raises(RuntimeError):
        main.main()
    assert events == [("remove", 8123)]


def test_serve_continues_when_pid_file_write_fails(monkeypatch):
    monkeypatch.setattr(sys, "argv", ["ollie-reader", "--serve", "--port", "8123"])
    monkeypatch.setattr(instance, "sidecar_alive", lambda port, timeout=1.0: False)
    events = []

    def bad_write(port):
        raise OSError("disk full")

    monkeypatch.setattr(instance, "write_pid_file", bad_write)
    monkeypatch.setattr(instance, "install_signal_cleanup", lambda port: None)
    monkeypatch.setattr(instance, "remove_pid_file", lambda port: None)
    monkeypatch.setattr(uvicorn, "run", lambda *a, **k: events.append(("run",)))

    main.main()  # PID 檔寫失敗不致命

    assert events == [("run",)]
