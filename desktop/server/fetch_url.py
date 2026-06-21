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

# 常見 MIME → 副檔名:優先用顯式對映(避免 mimetypes.guess_extension 跨平台
# 結果不確定),未命中再回退 mimetypes。
_MIME_EXTENSION_MAP = {
    "application/pdf": ".pdf",
    "text/html": ".html",
    "text/plain": ".txt",
    "application/json": ".json",
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/gif": ".gif",
    "application/epub+zip": ".epub",
}


def _guess_extension(content_type: str) -> Optional[str]:
    mime = content_type.split(";")[0].strip().lower()
    return _MIME_EXTENSION_MAP.get(mime) or mimetypes.guess_extension(mime)


@dataclass
class FetchResult:
    content: bytes
    content_type: str
    final_url: str
    redirect_count: int
    filename: str
    file_extension: str
    content_disposition: str


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
        filename = os.path.basename(url_path) or "downloaded_file"

        if "." not in filename or filename.endswith(".php"):
            extension = _guess_extension(content_type)
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
