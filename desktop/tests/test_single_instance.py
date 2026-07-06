import os
import time

os.environ.setdefault("QT_QPA_PLATFORM", "offscreen")

import pytest
from PySide6.QtWidgets import QApplication

from shell.single_instance import SingleInstance


@pytest.fixture(scope="module")
def qapp():
    app = QApplication.instance() or QApplication([])
    yield app


def test_first_instance_acquires_lock(qapp, tmp_path):
    guard = SingleInstance(
        server_name="ollie-test-first", lock_path=str(tmp_path / "shell.lock")
    )
    try:
        assert guard.acquire() is True
    finally:
        guard.release()


def test_second_instance_fails_and_wakes_first(qapp, tmp_path):
    activated = []
    first = SingleInstance(
        on_activate=lambda: activated.append(1),
        server_name="ollie-test-wake",
        lock_path=str(tmp_path / "shell.lock"),
    )
    second = SingleInstance(
        server_name="ollie-test-wake", lock_path=str(tmp_path / "shell.lock")
    )
    try:
        assert first.acquire() is True
        assert second.acquire() is False
        assert second.notify_existing() is True

        deadline = time.monotonic() + 2.0
        while not activated and time.monotonic() < deadline:
            qapp.processEvents()
        assert activated == [1]
    finally:
        second.release()
        first.release()


def test_notify_without_listener_returns_false(qapp, tmp_path):
    guard = SingleInstance(
        server_name="ollie-test-nobody", lock_path=str(tmp_path / "shell.lock")
    )
    assert guard.notify_existing(timeout_ms=100) is False


def test_release_allows_reacquire(qapp, tmp_path):
    first = SingleInstance(
        server_name="ollie-test-re", lock_path=str(tmp_path / "shell.lock")
    )
    assert first.acquire() is True
    first.release()

    second = SingleInstance(
        server_name="ollie-test-re", lock_path=str(tmp_path / "shell.lock")
    )
    try:
        assert second.acquire() is True
    finally:
        second.release()
