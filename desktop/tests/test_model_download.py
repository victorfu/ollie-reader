import hashlib

import pytest

import server  # noqa: F401  確保 server 套件可 import
from server import model_download as md


def test_manifest_has_four_files():
    names = {m.filename for m in md.MANIFEST}
    assert names == {
        "en_US-lessac-medium.onnx",
        "en_US-lessac-medium.onnx.json",
        "kokoro-v1.0.fp16.onnx",
        "voices-v1.0.bin",
    }
    for m in md.MANIFEST:
        assert m.url.startswith("https://")
        assert len(m.sha256) == 64
        assert m.size > 0


def test_status_transitions():
    s = md.DownloadStatus()
    assert s.snapshot()["state"] == "idle"
    assert s.is_running() is False

    s.set_state("running")
    assert s.is_running() is True
    assert s.snapshot()["state"] == "running"

    s.mark_file("a.onnx", "running", 5, 10)
    snap = s.snapshot()
    assert snap["files"]["a.onnx"] == {"state": "running", "downloaded": 5, "total": 10}

    s.update_progress("a.onnx", 8)
    assert s.snapshot()["files"]["a.onnx"]["downloaded"] == 8

    s.set_error("boom")
    s.set_state("failed")
    snap = s.snapshot()
    assert snap["state"] == "failed"
    assert snap["error"] == "boom"
