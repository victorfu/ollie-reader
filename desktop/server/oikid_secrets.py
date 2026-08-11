"""OIKID 帳密存取：存於 OS keychain（keyring），不落檔、不進 git。"""

import json
import logging
from typing import Optional

import keyring
from keyring.errors import KeyringError, PasswordDeleteError

logger = logging.getLogger(__name__)

_SERVICE = "ollie-reader-oikid"
_KEY = "credentials"


class OikidSecretsError(RuntimeError):
    """The OS credential store could not be accessed safely."""


def get_oikid_credentials() -> Optional[tuple[str, str]]:
    try:
        raw = keyring.get_password(_SERVICE, _KEY)
    except KeyringError as exc:
        logger.warning("無法從系統鑰匙圈讀取 OIKID 帳密: %s", exc)
        raise OikidSecretsError("無法存取系統鑰匙圈，請確認鑰匙圈已解鎖") from exc
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
    try:
        keyring.set_password(
            _SERVICE,
            _KEY,
            json.dumps({"username": username, "password": password}),
        )
    except KeyringError as exc:
        logger.warning("無法寫入 OIKID 帳密到系統鑰匙圈: %s", exc)
        raise OikidSecretsError("無法寫入系統鑰匙圈，請確認鑰匙圈已解鎖") from exc


def clear_oikid_credentials() -> None:
    try:
        keyring.delete_password(_SERVICE, _KEY)
    except PasswordDeleteError as exc:
        # PasswordDeleteError can mean either "not found" or a real macOS
        # Security.framework failure. Verify the postcondition before treating
        # it as an idempotent success.
        try:
            remaining = keyring.get_password(_SERVICE, _KEY)
        except KeyringError as verify_exc:
            logger.warning("無法確認 OIKID 帳密是否已清除: %s", verify_exc)
            raise OikidSecretsError(
                "無法清除系統鑰匙圈，請確認鑰匙圈已解鎖"
            ) from verify_exc
        if remaining:
            logger.warning("系統鑰匙圈拒絕清除 OIKID 帳密: %s", exc)
            raise OikidSecretsError(
                "無法清除系統鑰匙圈，請確認鑰匙圈已解鎖"
            ) from exc
    except KeyringError as exc:
        logger.warning("無法清除系統鑰匙圈中的 OIKID 帳密: %s", exc)
        raise OikidSecretsError("無法清除系統鑰匙圈，請確認鑰匙圈已解鎖") from exc
