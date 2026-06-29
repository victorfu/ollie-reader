"""共用的 httpx TLS 設定（避開 Windows 上的 OpenSSL applink crash）。

uv 的 standalone Python（python-build-standalone）在 Windows 上，只要透過
``ssl.create_default_context()`` 或從「檔案」載入 CA 憑證（httpx 預設會用
certifi 的 cacert.pem 走 ``cafile=``），OpenSSL 就會印出
``OPENSSL_Uplink(...): no OPENSSL_Applink`` 並讓整個行程 crash。

改法：自己建一個 ``PROTOCOL_TLS_CLIENT`` 的 SSLContext（預設已強制 TLS 1.2+、
檢查 hostname、CERT_REQUIRED），並用「記憶體字串」``cadata`` 載入同一份 certifi
CA，避開檔案 API 與 ``create_default_context``。TLS 驗證強度不變。

httpx 的 client 以 ``verify=create_ssl_context()`` 套用即可。
"""

import functools
import ssl

import certifi


@functools.lru_cache(maxsize=1)
def create_ssl_context() -> ssl.SSLContext:
    context = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
    context.check_hostname = True
    context.verify_mode = ssl.CERT_REQUIRED
    context.load_verify_locations(cadata=certifi.contents())
    return context
