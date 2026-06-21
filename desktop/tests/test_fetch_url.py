import asyncio

import httpx
import pytest

from server.fetch_url import FetchError, FetchResult, fetch_url_content_async


def _run(coro):
    return asyncio.run(coro)


def _client(handler):
    return httpx.AsyncClient(transport=httpx.MockTransport(handler))


def test_rejects_non_http_scheme():
    with pytest.raises(FetchError) as exc:
        _run(fetch_url_content_async("ftp://example.com/x.pdf"))
    assert exc.value.status_code == 400


def test_success_returns_fetchresult_with_metadata():
    def handler(request):
        return httpx.Response(
            200,
            headers={"Content-Type": "application/pdf"},
            content=b"%PDF-1.4 body",
        )

    async def run():
        async with _client(handler) as client:
            return await fetch_url_content_async(
                "https://example.com/doc.pdf", client=client
            )

    result = _run(run())
    assert isinstance(result, FetchResult)
    assert result.content == b"%PDF-1.4 body"
    assert result.content_type == "application/pdf"
    assert result.final_url == "https://example.com/doc.pdf"
    assert result.filename == "doc.pdf"
    assert result.file_extension == ".pdf"
    assert result.redirect_count == 0


def test_infers_extension_from_content_type_when_path_has_none():
    def handler(request):
        return httpx.Response(
            200,
            headers={"Content-Type": "application/pdf"},
            content=b"%PDF",
        )

    async def run():
        async with _client(handler) as client:
            return await fetch_url_content_async(
                "https://example.com/download", client=client
            )

    result = _run(run())
    assert result.filename == "download.pdf"
    assert result.file_extension == ".pdf"


def test_upstream_404_maps_to_404():
    def handler(request):
        return httpx.Response(404)

    async def run():
        async with _client(handler) as client:
            await fetch_url_content_async(
                "https://example.com/missing.pdf", client=client
            )

    with pytest.raises(FetchError) as exc:
        _run(run())
    assert exc.value.status_code == 404


def test_upstream_429_maps_to_429():
    def handler(request):
        return httpx.Response(429)

    async def run():
        async with _client(handler) as client:
            await fetch_url_content_async(
                "https://example.com/x.pdf", client=client
            )

    with pytest.raises(FetchError) as exc:
        _run(run())
    assert exc.value.status_code == 429


def test_root_url_falls_back_to_downloaded_file():
    def handler(request):
        return httpx.Response(
            200, headers={"Content-Type": "application/pdf"}, content=b"%PDF"
        )

    async def run():
        async with _client(handler) as client:
            return await fetch_url_content_async(
                "https://example.com/", client=client
            )

    result = _run(run())
    assert result.filename == "downloaded_file.pdf"
    assert result.file_extension == ".pdf"


def test_content_disposition_synthesized_when_absent():
    def handler(request):
        return httpx.Response(
            200, headers={"Content-Type": "application/pdf"}, content=b"%PDF"
        )

    async def run():
        async with _client(handler) as client:
            return await fetch_url_content_async(
                "https://example.com/doc.pdf", client=client
            )

    result = _run(run())
    assert result.content_disposition == 'inline; filename="doc.pdf"'


def test_content_disposition_passthrough_from_upstream():
    def handler(request):
        return httpx.Response(
            200,
            headers={
                "Content-Type": "application/pdf",
                "Content-Disposition": 'attachment; filename="real.pdf"',
            },
            content=b"%PDF",
        )

    async def run():
        async with _client(handler) as client:
            return await fetch_url_content_async(
                "https://example.com/doc.pdf", client=client
            )

    result = _run(run())
    assert result.content_disposition == 'attachment; filename="real.pdf"'


def test_timeout_maps_to_408():
    def handler(request):
        raise httpx.ConnectTimeout("timeout")

    async def run():
        async with _client(handler) as client:
            await fetch_url_content_async("https://example.com/x.pdf", client=client)

    with pytest.raises(FetchError) as exc:
        _run(run())
    assert exc.value.status_code == 408


def test_too_many_redirects_maps_to_500():
    def handler(request):
        raise httpx.TooManyRedirects("too many")

    async def run():
        async with _client(handler) as client:
            await fetch_url_content_async("https://example.com/x.pdf", client=client)

    with pytest.raises(FetchError) as exc:
        _run(run())
    assert exc.value.status_code == 500


def test_connect_error_maps_to_500():
    def handler(request):
        raise httpx.ConnectError("refused")

    async def run():
        async with _client(handler) as client:
            await fetch_url_content_async("https://example.com/x.pdf", client=client)

    with pytest.raises(FetchError) as exc:
        _run(run())
    assert exc.value.status_code == 500
