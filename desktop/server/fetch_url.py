"""URL 代抓（移植自 purism-ev-bot services/utility_service.py，合約一致）。

讓本機 sidecar 也能代抓遠端檔案（主要用途：繞過瀏覽器 CORS 抓 PDF），
使 local / auto 連線模式下「從 URL 載入 PDF」也走本機。
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
    """URL 抓取結果。"""

    content: bytes
    content_type: str
    final_url: str
    redirect_count: int
    filename: str
    file_extension: str
    content_disposition: Optional[str] = None


class FetchError(Exception):
    """URL 抓取錯誤。"""

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
    """非同步抓取指定 URL 的檔案內容（httpx AsyncClient）。

    Args:
        url: 要抓取的網址
        follow_redirects: 是否自動跟隨重定向
        max_redirects: 最大重定向次數
        timeout: 請求超時時間(秒)
        client: 可選的 httpx.AsyncClient，若未提供會建立臨時客戶端

    Raises:
        FetchError: 抓取失敗時拋出
    """
    if not url.startswith(("http://", "https://")):
        raise FetchError("URL 必須以 http:// 或 https:// 開頭", status_code=400)

    logger.info(f"開始抓取 URL: {url}")

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
            raise FetchError("請求過於頻繁，請稍後再試", status_code=429)
        elif response.status_code >= 400:
            raise FetchError(
                f"HTTP 錯誤: {response.status_code}", status_code=response.status_code
            )

        redirect_count = len(response.history)
        final_url = str(response.url)
        content_type = response.headers.get("Content-Type", "application/octet-stream")
        content = response.content

        # 從 URL 或 Content-Type 推測檔名與副檔名
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

        logger.info(f"成功抓取檔案: {filename} ({len(content)} bytes)")

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
        logger.error(f"請求超時: {url}")
        raise FetchError("請求超時", status_code=408) from e
    except httpx.TooManyRedirects as e:
        logger.error(f"重定向次數過多: {url}")
        raise FetchError(
            f"重定向次數超過限制 ({max_redirects} 次)", status_code=500
        ) from e
    except httpx.ConnectError as e:
        logger.error(f"連線錯誤: {e}")
        raise FetchError(f"無法連線到目標伺服器: {e}", status_code=500) from e
    except httpx.RequestError as e:
        logger.error(f"請求失敗: {e}")
        raise FetchError(f"抓取失敗: {e}", status_code=500) from e
    except FetchError:
        raise
    except Exception as e:
        logger.error(f"未預期的錯誤: {e}", exc_info=True)
        raise FetchError(f"伺服器錯誤: {e}", status_code=500) from e
    finally:
        if should_close_client:
            await client.aclose()
