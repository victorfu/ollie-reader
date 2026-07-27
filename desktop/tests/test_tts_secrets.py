import json

import pytest
from keyring.backend import KeyringBackend
from keyring.errors import PasswordDeleteError

import keyring as keyring_module

from server.tts_secrets import (
    DEFAULT_AZURE_REGION,
    clear_azure_credentials,
    get_azure_credentials,
    set_azure_credentials,
)


class MemoryKeyring(KeyringBackend):
    priority = 1

    def __init__(self):
        self._store = {}

    def get_password(self, service, username):
        return self._store.get((service, username))

    def set_password(self, service, username, password):
        self._store[(service, username)] = password

    def delete_password(self, service, username):
        if (service, username) in self._store:
            del self._store[(service, username)]
        else:
            raise PasswordDeleteError("not found")


@pytest.fixture
def memory_keyring(monkeypatch):
    backend = MemoryKeyring()
    monkeypatch.setattr(keyring_module, "get_keyring", lambda: backend)
    monkeypatch.setattr(keyring_module, "set_keyring", lambda _b: None)
    monkeypatch.setattr(
        keyring_module, "get_password", lambda s, u: backend.get_password(s, u)
    )
    monkeypatch.setattr(
        keyring_module, "set_password", lambda s, u, p: backend.set_password(s, u, p)
    )
    monkeypatch.setattr(
        keyring_module, "delete_password", lambda s, u: backend.delete_password(s, u)
    )
    return backend


def test_unset_returns_none(memory_keyring):
    assert get_azure_credentials() is None


def test_round_trip(memory_keyring):
    set_azure_credentials("KEY123", "westus")
    assert get_azure_credentials() == ("KEY123", "westus")


def test_blank_region_falls_back_to_default(memory_keyring):
    set_azure_credentials("KEY123", "")
    assert get_azure_credentials() == ("KEY123", DEFAULT_AZURE_REGION)


def test_missing_region_in_stored_blob_uses_default(memory_keyring):
    memory_keyring.set_password(
        "ollie-reader-azure-tts", "credentials", json.dumps({"key": "K"})
    )
    assert get_azure_credentials() == ("K", DEFAULT_AZURE_REGION)


def test_corrupt_blob_treated_as_unset(memory_keyring):
    memory_keyring.set_password("ollie-reader-azure-tts", "credentials", "not-json")
    assert get_azure_credentials() is None


def test_blank_key_treated_as_unset(memory_keyring):
    set_azure_credentials("", "westus")
    assert get_azure_credentials() is None


def test_clear_removes_and_is_idempotent(memory_keyring):
    set_azure_credentials("KEY123", "westus")
    clear_azure_credentials()
    assert get_azure_credentials() is None
    clear_azure_credentials()  # 本來就沒有也不該炸
    assert get_azure_credentials() is None


def test_azure_and_oikid_use_separate_keychain_services(memory_keyring):
    from server.oikid_secrets import set_oikid_credentials

    set_azure_credentials("AZ", "westus")
    set_oikid_credentials("alice", "pw")
    # 兩者不得互相覆蓋
    assert get_azure_credentials() == ("AZ", "westus")
