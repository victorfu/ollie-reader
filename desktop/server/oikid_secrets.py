"""OIKID 帳密存取：存於 OS keychain（keyring），不落檔、不進 git。"""

import json
import logging
from typing import Optional

import keyring
from keyring.errors import PasswordDeleteError

logger = logging.getLogger(__name__)

_SERVICE = "ollie-reader-oikid"
_KEY = "credentials"


def get_oikid_credentials() -> Optional[tuple[str, str]]:
    raw = keyring.get_password(_SERVICE, _KEY)
    if not raw:
        return None
    try:
        data = json.loads(raw)
        username = data["username"]
        password = data["password"]
    except (ValueError, KeyError, TypeError):
        logger.warning("OIKID keychain 資料毀損，視為未設定")
        return None
    if not username or not password:
        return None
    return username, password


def set_oikid_credentials(username: str, password: str) -> None:
    keyring.set_password(
        _SERVICE,
        _KEY,
        json.dumps({"username": username, "password": password}),
    )


def clear_oikid_credentials() -> None:
    try:
        keyring.delete_password(_SERVICE, _KEY)
    except PasswordDeleteError:
        pass  # 本來就沒有，視為成功
