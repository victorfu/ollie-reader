import asyncio

import pytest
from fastapi.testclient import TestClient

import server.app as app_module
from server.fetch_url import FetchError, FetchResult, fetch_url_content_async


@pytest.fixture
def client():
    return TestClient(app_module.app)


def _fake_result() -> FetchResult:
    return FetchResult(
        content=b"%PDF-1.4 fake",
        content_type="application/pdf",
        final_url="https://example.com/doc.pdf",
        redirect_count=2,
        filename="doc.pdf",
        file_extension=".pdf",
        content_disposition='inline; filename="doc.pdf"',
    )


def test_fetch_url_returns_content_and_metadata_headers(client, monkeypatch):
    captured = {}

    async def fake_fetch(url, follow_redirects=True, max_redirects=10, timeout=30):
        captured["url"] = url
        captured["follow_redirects"] = follow_redirects
        return _fake_result()

    monkeypatch.setattr(app_module, "fetch_url_content_async", fake_fetch)

    resp = client.get("/api/fetch-url?url=https://example.com/doc.pdf&follow_redirects=true")

    assert resp.status_code == 200
    assert resp.content == b"%PDF-1.4 fake"
    assert resp.headers["content-type"] == "application/pdf"
    assert resp.headers["x-final-url"] == "https://example.com/doc.pdf"
    assert resp.headers["x-redirect-count"] == "2"
    assert resp.headers["x-file-extension"] == ".pdf"
    assert captured["url"] == "https://example.com/doc.pdf"
    assert captured["follow_redirects"] is True


def test_fetch_url_maps_fetch_error_status_and_detail(client, monkeypatch):
    async def boom(url, follow_redirects=True, max_redirects=10, timeout=30):
        raise FetchError("找不到指定的資源", status_code=404)

    monkeypatch.setattr(app_module, "fetch_url_content_async", boom)

    resp = client.get("/api/fetch-url?url=https://example.com/missing.pdf")

    assert resp.status_code == 404
    assert resp.json()["detail"] == "找不到指定的資源"


def test_fetch_url_requires_url_param(client):
    resp = client.get("/api/fetch-url")
    assert resp.status_code == 422


def test_fetch_url_content_async_rejects_non_http_scheme():
    with pytest.raises(FetchError) as exc:
        asyncio.run(fetch_url_content_async("ftp://example.com/a.pdf"))
    assert exc.value.status_code == 400
