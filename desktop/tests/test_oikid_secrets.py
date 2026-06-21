import pytest
from keyring.backend import KeyringBackend
from keyring.errors import PasswordDeleteError

import keyring as keyring_module

from server.oikid_secrets import (
    get_oikid_credentials,
    set_oikid_credentials,
    clear_oikid_credentials,
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
def memory_keyring():
    prev = keyring_module.get_keyring()
    kr = MemoryKeyring()
    keyring_module.set_keyring(kr)
    yield kr
    keyring_module.set_keyring(prev)


def test_get_returns_none_when_unset(memory_keyring):
    assert get_oikid_credentials() is None


def test_set_then_get_round_trip(memory_keyring):
    set_oikid_credentials("alice", "secret")
    assert get_oikid_credentials() == ("alice", "secret")


def test_corrupt_json_treated_as_unset(memory_keyring):
    memory_keyring.set_password("ollie-reader-oikid", "credentials", "{not json")
    assert get_oikid_credentials() is None


def test_blank_fields_treated_as_unset(memory_keyring):
    set_oikid_credentials("", "")
    assert get_oikid_credentials() is None


def test_clear_removes_credentials(memory_keyring):
    set_oikid_credentials("alice", "secret")
    clear_oikid_credentials()
    assert get_oikid_credentials() is None


def test_clear_when_absent_is_noop(memory_keyring):
    clear_oikid_credentials()  # 不應拋例外
    assert get_oikid_credentials() is None


def test_one_sided_blank_treated_as_unset(memory_keyring):
    set_oikid_credentials("alice", "")
    assert get_oikid_credentials() is None


def test_wrong_json_keys_treated_as_unset(memory_keyring):
    import json
    memory_keyring.set_password(
        "ollie-reader-oikid", "credentials", json.dumps({"user": "alice", "pass": "x"})
    )
    assert get_oikid_credentials() is None
