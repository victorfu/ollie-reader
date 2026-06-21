# fetch-url 移植到 desktop sidecar 實作計畫

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把雲端 `GET /api/fetch-url` 以相同合約移植到本機 sidecar,並讓 web app 透過 `fetchWithComputeBase` 路由它,使「從 URL 載入 PDF」在 local/auto 模式全程留在本機。

**Architecture:** desktop sidecar(FastAPI `127.0.0.1:8765`)新增一支與雲端同合約的 `GET /api/fetch-url`,抓取邏輯抽成純模組 `server/fetch_url.py`(移植自 backend `services/utility_service.py` 的 async/httpx 版)。前端把 `PdfContext` 的直接 `fetch` 改走既有的 compute-mode helper。

**Tech Stack:** Python 3.10+ / FastAPI / httpx / pytest(desktop);React 19 + TS + Vite(web)。

## Global Constraints

- Python `requires-python = ">=3.10"`(desktop)。
- sidecar 端點**合約必須與雲端一致**:同 query params(`url` / `follow_redirects` / `max_redirects` / `timeout`)、同 response headers(`Content-Type` / `Content-Length` / `X-Final-URL` / `X-Redirect-Count` / `X-File-Extension` / `Content-Disposition`)、同錯誤碼(404/429/408/其餘 >=400 透傳)。
- `httpx` 須為 desktop **runtime** 依賴(目前僅在 `dev` 群組)。
- desktop 測試慣例:`fastapi.testclient.TestClient` + `monkeypatch.setattr(app_module, name, fake)`;**無 `pytest-asyncio`**,模組層 async 函式以 `asyncio.run(...)` 在同步測試中執行。
- web app **無 test runner**(僅 leaf-util node:test);前端改動以 `npm run build` + `npm run lint` + 手動驗證為準。
- TS 2-space 縮排;Conventional Commits。

---

### Task 1: desktop `fetch_url.py` 抓取模組

**Files:**
- Create: `desktop/server/fetch_url.py`
- Test: `desktop/tests/test_fetch_url.py`

**Interfaces:**
- Consumes: `httpx`(runtime;Task 2 會把它移進 runtime deps,但本模組與其測試只需 httpx 可 import,dev 群組已有,故 Task 1 可獨立跑綠)。
- Produces:
  - `FetchResult`(dataclass):`content: bytes`、`content_type: str`、`final_url: str`、`redirect_count: int`、`filename: str`、`file_extension: str`、`content_disposition: Optional[str]`。
  - `FetchError(Exception)`:屬性 `message: str`、`status_code: int`。
  - `async def fetch_url_content_async(url: str, follow_redirects: bool = True, max_redirects: int = 10, timeout: int = 30, client: Optional[httpx.AsyncClient] = None) -> FetchResult`。

- [ ] **Step 1: 寫失敗測試**

建立 `desktop/tests/test_fetch_url.py`:

```python
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
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `cd desktop && uv run pytest tests/test_fetch_url.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'server.fetch_url'`。

- [ ] **Step 3: 寫最小實作**

建立 `desktop/server/fetch_url.py`:

```python
"""本機 sidecar 的 URL 抓取:server-side fetch,繞過瀏覽器 CORS。

合約與雲端 /api/fetch-url 一致(移植自 purism-ev-bot
services/utility_service.py 的 async/httpx 版)。
"""

import logging
import mimetypes
import os
from dataclasses import dataclass
from typing import Optional
from urllib.parse import unquote, urlparse

import httpx

logger = logging.getLogger(__name__)


@dataclass
class FetchResult:
    content: bytes
    content_type: str
    final_url: str
    redirect_count: int
    filename: str
    file_extension: str
    content_disposition: Optional[str] = None


class FetchError(Exception):
    def __init__(self, message: str, status_code: int = 500):
        self.message = message
        self.status_code = status_code
        super().__init__(self.message)


async def fetch_url_content_async(
    url: str,
    follow_redirects: bool = True,
    max_redirects: int = 10,
    timeout: int = 30,
    client: Optional[httpx.AsyncClient] = None,
) -> FetchResult:
    if not url.startswith(("http://", "https://")):
        raise FetchError("URL 必須以 http:// 或 https:// 開頭", status_code=400)

    should_close_client = False
    if client is None:
        client = httpx.AsyncClient(
            timeout=httpx.Timeout(float(timeout)),
            follow_redirects=follow_redirects,
            max_redirects=max_redirects,
        )
        should_close_client = True

    try:
        response = await client.get(url)

        if response.status_code == 404:
            raise FetchError("找不到指定的資源", status_code=404)
        elif response.status_code == 429:
            raise FetchError("請求過於頻繁,請稍後再試", status_code=429)
        elif response.status_code >= 400:
            raise FetchError(
                f"HTTP 錯誤: {response.status_code}",
                status_code=response.status_code,
            )

        redirect_count = len(response.history)
        final_url = str(response.url)
        content_type = response.headers.get(
            "Content-Type", "application/octet-stream"
        )
        content = response.content

        parsed_url = urlparse(final_url)
        url_path = unquote(parsed_url.path)
        filename = os.path.basename(url_path) if url_path else "downloaded_file"

        if "." not in filename or filename.endswith(".php"):
            extension = mimetypes.guess_extension(content_type.split(";")[0].strip())
            if extension:
                if filename.endswith(".php"):
                    filename = filename.rsplit(".", 1)[0] + extension
                else:
                    filename = filename + extension

        file_extension = os.path.splitext(filename)[1] if "." in filename else ""

        content_disposition = response.headers.get("Content-Disposition")
        if not content_disposition:
            content_disposition = f'inline; filename="{filename}"'

        return FetchResult(
            content=content,
            content_type=content_type,
            final_url=final_url,
            redirect_count=redirect_count,
            filename=filename,
            file_extension=file_extension,
            content_disposition=content_disposition,
        )

    except httpx.TimeoutException as e:
        raise FetchError("請求超時", status_code=408) from e
    except httpx.TooManyRedirects as e:
        raise FetchError(
            f"重定向次數超過限制 ({max_redirects} 次)", status_code=500
        ) from e
    except httpx.ConnectError as e:
        raise FetchError(f"無法連線到目標伺服器: {str(e)}", status_code=500) from e
    except httpx.RequestError as e:
        raise FetchError(f"抓取失敗: {str(e)}", status_code=500) from e
    except FetchError:
        raise
    except Exception as e:
        logger.error("URL 抓取未預期錯誤: %s", str(e), exc_info=True)
        raise FetchError(f"伺服器錯誤: {str(e)}", status_code=500) from e
    finally:
        if should_close_client:
            await client.aclose()
```

註:當呼叫端傳入 `client`(如測試的 MockTransport)時 `should_close_client=False`,函式不關它,由呼叫端負責。

- [ ] **Step 4: 跑測試確認通過**

Run: `cd desktop && uv run pytest tests/test_fetch_url.py -v`
Expected: PASS(5 passed)。

- [ ] **Step 5: Commit**

```bash
git add desktop/server/fetch_url.py desktop/tests/test_fetch_url.py
git commit -m "feat(desktop): add fetch_url module for sidecar URL fetching"
```

---

### Task 2: desktop sidecar `GET /api/fetch-url` 路由 + httpx runtime 依賴

**Files:**
- Modify: `desktop/server/app.py`(imports + `create_app()` 內新增路由)
- Modify: `desktop/pyproject.toml`(httpx 移到 runtime deps)
- Test: `desktop/tests/test_app.py`(新增 fetch-url 路由測試)

**Interfaces:**
- Consumes(來自 Task 1):`from server.fetch_url import FetchError, fetch_url_content_async`、`FetchResult`。
- Produces:`GET /api/fetch-url`,回傳 `fastapi.responses.Response`(binary body + metadata headers);錯誤經 `FetchError` 轉 `HTTPException`。

- [ ] **Step 1: 寫失敗測試**

在 `desktop/tests/test_app.py` **新增**以下(沿用檔內既有 `client` fixture;在檔案頂部 import 區加入 `from server.fetch_url import FetchError, FetchResult`):

```python
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
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `cd desktop && uv run pytest tests/test_app.py -k fetch_url -v`
Expected: FAIL — import error(`cannot import name 'FetchError'`…只有在 Task 1 已合併時才有此模組;若 Task 1 已完成,則為路由 404 / `AttributeError: ... fetch_url_content_async`)。

- [ ] **Step 3: 加路由與 imports**

修改 `desktop/server/app.py` 的 import 區:

把
```python
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
```
改為
```python
from fastapi import FastAPI, File, HTTPException, Query, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response, StreamingResponse
```

並在
```python
from server.tts_piper import TTSError, generate_speech
```
之後新增一行:
```python
from server.fetch_url import FetchError, fetch_url_content_async
```

在 `create_app()` 內、`ktts` 路由之後、`return app` 之前,新增:

```python
    @app.get("/api/fetch-url", tags=["utility"])
    async def fetch_url(
        url: str = Query(..., description="要抓取的網址 URL"),
        follow_redirects: bool = Query(True, description="是否自動跟隨重定向"),
        max_redirects: int = Query(10, ge=1, le=30, description="最大重定向次數"),
        timeout: int = Query(30, ge=1, le=120, description="請求超時時間(秒)"),
    ):
        try:
            result = await fetch_url_content_async(
                url=url,
                follow_redirects=follow_redirects,
                max_redirects=max_redirects,
                timeout=timeout,
            )
        except FetchError as e:
            raise HTTPException(status_code=e.status_code, detail=e.message) from e
        except Exception as e:
            logger.exception("URL 抓取未預期錯誤")
            raise HTTPException(
                status_code=500, detail="伺服器錯誤,請稍後再試"
            ) from e

        headers = {
            "Content-Type": result.content_type,
            "Content-Length": str(len(result.content)),
            "X-Final-URL": result.final_url,
            "X-Redirect-Count": str(result.redirect_count),
            "X-File-Extension": result.file_extension,
            "Content-Disposition": result.content_disposition,
        }
        return Response(
            content=result.content,
            headers=headers,
            media_type=result.content_type,
        )
```

- [ ] **Step 4: httpx 移到 runtime 依賴**

修改 `desktop/pyproject.toml`:在 `[project].dependencies` 清單(`en-core-web-sm` 之前)加入一行 `"httpx",`;並把 `[dependency-groups].dev` 內的 `"httpx",` 移除(避免重複)。

```toml
dependencies = [
    "fastapi",
    "starlette>=1.3.1",
    "python-multipart",
    "uvicorn[standard]",
    "pymupdf",
    "piper-tts",
    "soundfile",
    "numpy",
    "kokoro>=0.9.4",
    "torch",
    "PySide6",
    "httpx",
    # spaCy model used by misaki/kokoro for English G2P; not on PyPI, pinned below.
    "en-core-web-sm",
]

[dependency-groups]
dev = [
    "pytest",
    "pyinstaller",
]
```

然後同步環境:
```bash
cd desktop && uv sync
```

- [ ] **Step 5: 跑 fetch-url 路由測試確認通過**

Run: `cd desktop && uv run pytest tests/test_app.py -k fetch_url -v`
Expected: PASS(4 passed)。

- [ ] **Step 6: 跑整包 desktop 測試確認無回歸**

Run: `cd desktop && uv run pytest -q`
Expected: 全部 PASS(含既有 version/pdf/tts 等測試)。

- [ ] **Step 7: Commit**

```bash
git add desktop/server/app.py desktop/pyproject.toml desktop/uv.lock desktop/tests/test_app.py
git commit -m "feat(desktop): expose /api/fetch-url on local sidecar"
```

---

### Task 3: 前端改走 compute-mode helper

**Files:**
- Modify: `src/constants/api.ts`(新增 `FETCH_URL_PATH`、移除已不用的 `FETCH_URL_API`、修註解)
- Modify: `src/contexts/PdfContext.tsx`(import + 第 ~201–208 行的抓取呼叫)

**Interfaces:**
- Consumes:`fetchWithComputeBase(path: string, init: RequestInit, fetcher?) => Promise<Response>`(`src/services/localBackend.ts`,PdfContext 既有 import);新常數 `FETCH_URL_PATH`。
- Produces:無對外介面變更;行為改變為「fetch-url 走 compute-mode 路由」。

- [ ] **Step 1: 確認 `FETCH_URL_API` 無其他引用點**

Run: `grep -rn "FETCH_URL_API" src/`
Expected: 僅 `src/constants/api.ts`(定義)與 `src/contexts/PdfContext.tsx`(import + 使用)。若有其他引用點,需一併更新——本計畫假設只有這兩處。

- [ ] **Step 2: 更新 `src/constants/api.ts`**

移除這行:
```ts
export const FETCH_URL_API = `${API_BASE_URL}/api/fetch-url`;
```

在 `PDF_EXTRACT_PATH` / `VERSION_PATH` 等 path 常數區,新增:
```ts
export const FETCH_URL_PATH = "/api/fetch-url";
```

並把這行註解:
```ts
// 可走本機運算的端點 path（其餘如 oikid/translate/storage 永遠走雲端）
```
改為:
```ts
// 可走本機運算(compute-mode)的端點 path：pdf/tts/ktts/fetch-url。
// storage、oikid 永遠走雲端；translate 走 Gemini，前端未接後端。
```

- [ ] **Step 3: 更新 `src/contexts/PdfContext.tsx` import**

把第 11 行:
```ts
import { FETCH_URL_API, PDF_EXTRACT_PATH } from "../constants/api";
```
改為:
```ts
import { FETCH_URL_PATH, PDF_EXTRACT_PATH } from "../constants/api";
```

(`fetchWithComputeBase` 已在本檔 import 並於抽取步驟使用,無須新增。)

- [ ] **Step 4: 更新抓取呼叫**

把這段(約第 201–208 行):
```ts
      const apiUrl = new URL(FETCH_URL_API);
      apiUrl.searchParams.set("url", url);
      apiUrl.searchParams.set("follow_redirects", "true");

      const response = await fetch(apiUrl.toString(), {
        signal: controller.signal,
      });
```
改為:
```ts
      const params = new URLSearchParams({ url, follow_redirects: "true" });
      const response = await fetchWithComputeBase(
        `${FETCH_URL_PATH}?${params.toString()}`,
        { signal: controller.signal },
      );
```

後續的 status-code switch、Content-Type 檢查、`blob → File`、以及既有 `fetchWithComputeBase(PDF_EXTRACT_PATH, ...)` 抽取步驟**皆不動**。

- [ ] **Step 5: 型別檢查 + 建置**

Run: `npm run build`
Expected: 成功(TypeScript 0 errors,Vite build 完成)。

- [ ] **Step 6: Lint**

Run: `npm run lint`
Expected: 0 errors(特別確認 `FETCH_URL_API` 已無殘留 import、無 unused 變數)。

- [ ] **Step 7: 手動驗證(local + cloud)**

1. 啟動 sidecar:`cd desktop && uv run python main.py --serve`(或 repo 根目錄 `make desktop-serve`),確認 `http://127.0.0.1:8765/api/fetch-url?url=...` 可達。
2. `npm run dev`,設定切到 **本機/auto**,在 PDF「從 URL 載入」貼一個公開 PDF URL → 應成功載入並抽取文字;觀察請求打向 `127.0.0.1:8765`。
3. 設定切到 **雲端**,重複 → 應打向雲端 `API_BASE_URL` 並成功。
4. (auto 模式)關閉 sidecar 後再試一次 → 應自動退回雲端並成功。

- [ ] **Step 8: Commit**

```bash
git add src/constants/api.ts src/contexts/PdfContext.tsx
git commit -m "feat(web): route URL PDF fetch through compute-mode helper"
```

---

## 完成後驗證(整體)

- desktop:`cd desktop && uv run pytest -q` 全綠。
- web:`npm run build` 與 `npm run lint` 皆 0 error。
- 手動:local / auto / cloud 三模式下「從 URL 載入 PDF」皆能成功(auto 在 sidecar 關閉時退回雲端)。
