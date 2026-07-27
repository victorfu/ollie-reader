"""Azure AI Speech 憑證存取：存於 OS keychain（keyring），不落檔、不進 git。

刻意不走環境變數或設定檔：金鑰由使用者在 desktop 設定視窗自行輸入，
才能避免把任何祕密打包進散布的 .app（release/verify_bundle.py 會擋）。
"""

import json
import logging
from typing import Optional

import keyring
from keyring.errors import PasswordDeleteError

logger = logging.getLogger(__name__)

_SERVICE = "ollie-reader-azure-tts"
_KEY = "credentials"

DEFAULT_AZURE_REGION = "eastasia"


def get_azure_credentials() -> Optional[tuple[str, str]]:
    """回傳 (key, region)；未設定或資料毀損回 None。"""
    raw = keyring.get_password(_SERVICE, _KEY)
    if not raw:
        return None
    try:
        data = json.loads(raw)
        key = data["key"]
        region = data.get("region") or DEFAULT_AZURE_REGION
    except (ValueError, KeyError, TypeError):
        logger.warning("Azure TTS keychain 資料毀損，視為未設定")
        return None
    if not key:
        return None
    return key, region


def set_azure_credentials(key: str, region: str) -> None:
    keyring.set_password(
        _SERVICE,
        _KEY,
        json.dumps({"key": key, "region": region or DEFAULT_AZURE_REGION}),
    )


def clear_azure_credentials() -> None:
    try:
        keyring.delete_password(_SERVICE, _KEY)
    except PasswordDeleteError:
        pass  # 本來就沒有，視為成功
