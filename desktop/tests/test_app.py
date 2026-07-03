import pymupdf
import pytest
from fastapi.testclient import TestClient

import server.app as app_module
from server.fetch_url import FetchError, FetchResult
from server.oikid import OikidError
from server.pdf_extract import PDFError, PDFExtractResult, PageText
from server.tts_piper import TTSError, TTSResult
from server.tts_kokoro import KokoroTTSError, KokoroTTSResult
from server.tts_chatterbox import ChatterboxTTSError, ChatterboxTTSResult


@pytest.fixture
def client():
    return TestClient(app_module.app)


@pytest.fixture
def client_no_raise():
    return TestClient(app_module.app, raise_server_exceptions=False)


def _pdf_bytes(text="Hello"):
    doc = pymupdf.open()
    page = doc.new_page()
    page.insert_text((72, 72), text)
    data = doc.tobytes()
    doc.close()
    return data


def test_version(client):
    resp = client.get("/api/version")
    assert resp.status_code == 200
    assert "version" in resp.json()


def test_pdf_extract_contract(client):
    files = {"file": ("a.pdf", _pdf_bytes("Hello Ollie"), "application/pdf")}
    resp = client.post("/api/pdf/extract", files=files)
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "success"
    assert body["total_pages"] == 1
    assert "Hello Ollie" in body["pages"][0]["text"]
    assert body["pages"][0]["page_number"] == 1


def test_pdf_extract_runs_in_threadpool(client, monkeypatch):
    captured = {}

    def fake_extract(content, filename):
        return PDFExtractResult(
            filename=filename,
            total_pages=1,
            pages=[PageText(page_number=1, text="threaded", text_length=8)],
        )

    async def fake_run_in_threadpool(func, *args):
        captured["func"] = func
        captured["args"] = args
        return func(*args)

    monkeypatch.setattr(app_module, "extract_text_from_pdf", fake_extract)
    monkeypatch.setattr(app_module, "run_in_threadpool", fake_run_in_threadpool)

    files = {"file": ("a.pdf", _pdf_bytes("Hello Ollie"), "application/pdf")}
    resp = client.post("/api/pdf/extract", files=files)

    assert resp.status_code == 200
    assert captured["func"] is fake_extract
    assert captured["args"][1] == "a.pdf"


def test_pdf_error_returns_status_and_detail(client, monkeypatch):
    def fake_extract(content, filename):
        raise PDFError("bad pdf", status_code=422)

    monkeypatch.setattr(app_module, "extract_text_from_pdf", fake_extract)
    files = {"file": ("a.pdf", _pdf_bytes("Hello Ollie"), "application/pdf")}
    resp = client.post("/api/pdf/extract", files=files)

    assert resp.status_code == 422
    assert resp.json()["detail"] == "bad pdf"


def test_pdf_read_error_returns_500(client_no_raise, monkeypatch):
    from starlette.datastructures import UploadFile as StarletteUploadFile

    async def boom(self, size=-1):
        raise RuntimeError("read failed")

    monkeypatch.setattr(StarletteUploadFile, "read", boom)
    files = {"file": ("a.pdf", _pdf_bytes("Hello Ollie"), "application/pdf")}
    resp = client_no_raise.post("/api/pdf/extract", files=files)

    assert resp.status_code == 500
    assert resp.json()["detail"] == "PDF 處理失敗"


def test_pdf_unexpected_error_returns_500(client, monkeypatch):
    def fake_extract(content, filename):
        raise RuntimeError("boom")

    monkeypatch.setattr(app_module, "extract_text_from_pdf", fake_extract)
    files = {"file": ("a.pdf", _pdf_bytes("Hello Ollie"), "application/pdf")}
    resp = client.post("/api/pdf/extract", files=files)

    assert resp.status_code == 500
    assert resp.json()["detail"] == "PDF 處理失敗"


def test_tts_speed_to_length_scale(client, monkeypatch):
    captured = {}

    def fake_generate(text, speaker, length_scale):
        captured["speaker"] = speaker
        captured["length_scale"] = length_scale
        return TTSResult(audio_data=b"RIFFfake", content_type="audio/wav")

    monkeypatch.setattr(app_module, "generate_speech", fake_generate)
    resp = client.post("/api/tts", json={"text": "hi", "speed": 2.0})
    assert resp.status_code == 200
    assert resp.headers["content-type"] == "audio/wav"
    assert captured["length_scale"] == 0.5
    assert captured["speaker"] == 0


def test_tts_bad_voice_returns_400(client):
    resp = client.post("/api/tts", json={"text": "hi", "voice": "not-an-int"})
    assert resp.status_code == 400


def test_tts_error_returns_status_and_detail(client, monkeypatch):
    def fake_generate(text, speaker, length_scale):
        raise TTSError("tts down", status_code=503)

    monkeypatch.setattr(app_module, "generate_speech", fake_generate)
    resp = client.post("/api/tts", json={"text": "hi"})

    assert resp.status_code == 503
    assert resp.json()["detail"] == "tts down"


def test_ktts_503_when_unavailable(client, monkeypatch):
    def boom(text, speed, voice):
        raise KokoroTTSError("no torch", status_code=503)

    monkeypatch.setattr(app_module, "kokoro_synthesize_speech", boom)
    resp = client.post("/api/ktts", json={"text": "hi"})
    assert resp.status_code == 503


def test_ktts_success(client, monkeypatch):
    monkeypatch.setattr(
        app_module,
        "kokoro_synthesize_speech",
        lambda text, speed, voice: KokoroTTSResult(audio_data=b"RIFFfake"),
    )
    resp = client.post("/api/ktts", json={"text": "hi"})
    assert resp.status_code == 200
    assert resp.headers["content-type"] == "audio/wav"


def test_chatterbox_tts_503_when_unavailable(client, monkeypatch):
    def boom(text, speed, voice):
        raise ChatterboxTTSError("no torch", status_code=503)

    monkeypatch.setattr(app_module, "chatterbox_synthesize_speech", boom)
    resp = client.post("/api/chatterbox-tts", json={"text": "hi"})
    assert resp.status_code == 503
    assert resp.json()["detail"] == "no torch"


def test_chatterbox_tts_success(client, monkeypatch):
    monkeypatch.setattr(
        app_module,
        "chatterbox_synthesize_speech",
        lambda text, speed, voice: ChatterboxTTSResult(audio_data=b"RIFFfake"),
    )
    resp = client.post("/api/chatterbox-tts", json={"text": "hi"})
    assert resp.status_code == 200
    assert resp.headers["content-type"] == "audio/wav"


def test_cors_allows_localhost_origin(client):
    resp = client.get("/api/version", headers={"Origin": "http://localhost:5173"})
    assert resp.headers.get("access-control-allow-origin") == "http://localhost:5173"


def test_cors_allows_trusted_origin_pna_preflight(client):
    resp = client.options(
        "/api/version",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "GET",
            "Access-Control-Request-Private-Network": "true",
        },
    )

    assert resp.status_code == 200
    assert resp.headers.get("access-control-allow-origin") == "http://localhost:5173"
    assert resp.headers.get("access-control-allow-private-network") == "true"


def test_cors_rejects_untrusted_origin_pna_preflight(client):
    resp = client.options(
        "/api/version",
        headers={
            "Origin": "https://evil.example",
            "Access-Control-Request-Method": "GET",
            "Access-Control-Request-Private-Network": "true",
        },
    )

    assert resp.status_code == 400
    assert "origin" in resp.text
    assert resp.headers.get("access-control-allow-origin") is None


def test_fetch_url_contract(client, monkeypatch):
    async def fake_fetch(url, follow_redirects=True, max_redirects=10,
                         timeout=30, client=None):
        return FetchResult(
            content=b"%PDF-bytes",
            content_type="application/pdf",
            final_url="https://example.com/a.pdf",
            redirect_count=0,
            filename="a.pdf",
            file_extension=".pdf",
            content_disposition='inline; filename="a.pdf"',
        )

    monkeypatch.setattr(app_module, "fetch_url_content_async", fake_fetch)
    resp = client.get("/api/fetch-url", params={"url": "https://example.com/a.pdf"})

    assert resp.status_code == 200
    assert resp.content == b"%PDF-bytes"
    assert resp.headers["content-type"] == "application/pdf"
    assert resp.headers["x-final-url"] == "https://example.com/a.pdf"
    assert resp.headers["x-redirect-count"] == "0"
    assert resp.headers["x-file-extension"] == ".pdf"


def test_fetch_url_passes_query_params(client, monkeypatch):
    captured = {}

    async def fake_fetch(url, follow_redirects=True, max_redirects=10,
                         timeout=30, client=None):
        captured["url"] = url
        captured["follow_redirects"] = follow_redirects
        return FetchResult(
            content=b"x",
            content_type="application/pdf",
            final_url=url,
            redirect_count=0,
            filename="a.pdf",
            file_extension=".pdf",
            content_disposition='inline; filename="a.pdf"',
        )

    monkeypatch.setattr(app_module, "fetch_url_content_async", fake_fetch)
    resp = client.get(
        "/api/fetch-url",
        params={"url": "https://example.com/a.pdf", "follow_redirects": "false"},
    )

    assert resp.status_code == 200
    assert captured["url"] == "https://example.com/a.pdf"
    assert captured["follow_redirects"] is False


def test_fetch_url_error_maps_status(client, monkeypatch):
    async def fake_fetch(url, follow_redirects=True, max_redirects=10,
                         timeout=30, client=None):
        raise FetchError("找不到指定的資源", status_code=404)

    monkeypatch.setattr(app_module, "fetch_url_content_async", fake_fetch)
    resp = client.get(
        "/api/fetch-url", params={"url": "https://example.com/missing.pdf"}
    )

    assert resp.status_code == 404
    assert resp.json()["detail"] == "找不到指定的資源"


def test_fetch_url_requires_url_param(client):
    resp = client.get("/api/fetch-url")
    assert resp.status_code == 422


def test_oikid_booking_records_contract(client, monkeypatch):
    def fake_search():
        return {
            "Token": "tok",
            "Data": [
                {
                    "id": "1",
                    "Level": "L1",
                    "ClassVersion": "v",
                    "CoursesName": "Course",
                    "ClassTime": "2026-07-01 10:00",
                    "TeacherName": "Tina",
                    "OpenName": "Open",
                }
            ],
        }

    monkeypatch.setattr(app_module, "search_booking_records", fake_search)
    resp = client.get("/api/oikid/booking-records")

    assert resp.status_code == 200
    body = resp.json()
    assert body["Token"] == "tok"
    assert body["Data"][0]["CoursesName"] == "Course"


def test_oikid_missing_credentials_maps_400(client, monkeypatch):
    def fake_search():
        raise OikidError("OIKID 帳密未設定，請到桌面 App 設定", status_code=400)

    monkeypatch.setattr(app_module, "search_booking_records", fake_search)
    resp = client.get("/api/oikid/booking-records")

    assert resp.status_code == 400
    assert resp.json()["detail"] == "OIKID 帳密未設定，請到桌面 App 設定"


def test_oikid_upstream_error_maps_502(client, monkeypatch):
    def fake_search():
        raise OikidError("OIKID fetch error", status_code=502)

    monkeypatch.setattr(app_module, "search_booking_records", fake_search)
    resp = client.get("/api/oikid/booking-records")

    assert resp.status_code == 502
    assert resp.json()["detail"] == "OIKID fetch error"
