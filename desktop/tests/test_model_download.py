import hashlib
import threading

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


class _FakeStream:
    """模擬 httpx.stream(...) 的 context manager。"""

    def __init__(self, data: bytes):
        self._data = data

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False

    def raise_for_status(self):
        return None

    def iter_bytes(self, chunk_size: int = 65536):
        # 切成兩塊，確保進度累加路徑被走到
        mid = max(1, len(self._data) // 2)
        yield self._data[:mid]
        yield self._data[mid:]


def _model(tmp_name: str, data: bytes) -> "md.ModelFile":
    return md.ModelFile(
        filename=tmp_name,
        url="https://example.test/x",
        sha256=hashlib.sha256(data).hexdigest(),
        size=len(data),
    )


def test_skips_existing_valid_file(tmp_path, monkeypatch):
    data = b"hello-model"
    mf = _model("a.onnx", data)
    (tmp_path / "a.onnx").write_bytes(data)

    def boom(*a, **k):
        raise AssertionError("不應該下載已存在且正確的檔案")

    monkeypatch.setattr(md.httpx, "stream", boom)
    st = md.DownloadStatus()
    md._download_one(mf, tmp_path, st)
    assert st.snapshot()["files"]["a.onnx"]["state"] == "done"


def test_downloads_missing_file(tmp_path, monkeypatch):
    data = b"x" * 5000
    mf = _model("b.bin", data)
    monkeypatch.setattr(md.httpx, "stream", lambda *a, **k: _FakeStream(data))

    st = md.DownloadStatus()
    md._download_one(mf, tmp_path, st)

    assert (tmp_path / "b.bin").read_bytes() == data
    assert not (tmp_path / "b.bin.part").exists()
    assert st.snapshot()["files"]["b.bin"]["state"] == "done"


def test_bad_checksum_discards_part(tmp_path, monkeypatch):
    data = b"real-bytes"
    mf = md.ModelFile("c.onnx", "https://example.test/x", "0" * 64, len(data))
    monkeypatch.setattr(md.httpx, "stream", lambda *a, **k: _FakeStream(data))

    st = md.DownloadStatus()
    with pytest.raises(ValueError):
        md._download_one(mf, tmp_path, st)

    assert not (tmp_path / "c.onnx").exists()
    assert not (tmp_path / "c.onnx.part").exists()
    assert st.snapshot()["files"]["c.onnx"]["state"] == "failed"


def test_ensure_models_continues_after_one_failure(tmp_path, monkeypatch):
    good = b"good-data"
    bad = b"bad-data"
    manifest = [
        md.ModelFile("g.bin", "https://e/g", hashlib.sha256(good).hexdigest(), len(good)),
        md.ModelFile("b.bin", "https://e/b", "0" * 64, len(bad)),
    ]
    monkeypatch.setattr(md, "MANIFEST", manifest)

    def fake_stream(method, url, **k):
        return _FakeStream(good if url.endswith("/g") else bad)

    monkeypatch.setattr(md.httpx, "stream", fake_stream)

    st = md.DownloadStatus()
    md.ensure_models(tmp_path, st)

    assert (tmp_path / "g.bin").exists()          # 好的有下成功
    assert not (tmp_path / "b.bin").exists()       # 壞的被丟棄
    snap = st.snapshot()
    assert snap["state"] == "failed"               # 整體標記 failed
    assert snap["files"]["g.bin"]["state"] == "done"
    assert snap["files"]["b.bin"]["state"] == "failed"


def test_ensure_models_all_ok(tmp_path, monkeypatch):
    data = b"ok"
    manifest = [md.ModelFile("o.bin", "https://e/o", hashlib.sha256(data).hexdigest(), len(data))]
    monkeypatch.setattr(md, "MANIFEST", manifest)
    monkeypatch.setattr(md.httpx, "stream", lambda *a, **k: _FakeStream(data))

    st = md.DownloadStatus()
    md.ensure_models(tmp_path, st)
    assert st.snapshot()["state"] == "done"


def test_should_auto_download_respects_frozen(monkeypatch):
    monkeypatch.setattr(md.sys, "frozen", False, raising=False)
    assert md.should_auto_download() is True
    monkeypatch.setattr(md.sys, "frozen", True, raising=False)
    assert md.should_auto_download() is False


def test_start_background_download_is_reentrant(tmp_path, monkeypatch):
    started = []
    release = threading.Event()

    def blocking_ensure(models_dir, status=None):
        started.append(1)
        release.wait(timeout=5)

    monkeypatch.setattr(md, "ensure_models", blocking_ensure)
    monkeypatch.setattr(md, "_thread", None, raising=False)

    md.start_background_download(tmp_path)
    md.start_background_download(tmp_path)  # 第二次應被 lock 擋掉
    release.set()
    md._thread.join(timeout=5)

    assert len(started) == 1
