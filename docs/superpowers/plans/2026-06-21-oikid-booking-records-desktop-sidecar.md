# OIKID booking-records 移植到 desktop sidecar 實作計畫

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在本機 sidecar 提供 hybrid 的 `GET /api/oikid/booking-records`(免 Firebase、用 OS keychain 的 OIKID 帳密),讓「課程預約記錄」在 local/auto 模式走本機;cloud 不動。

**Architecture:** desktop sidecar 新增免 auth 路由,抓取邏輯移植自雲端 `services/oikid_service.py`(改用 httpx + 從 keychain 讀帳密)。帳密由 PySide6 shell 設定頁輸入、存 OS keychain(`keyring`)。前端 `useBookingRecords` 改走 `fetchWithComputeBase`(用包了 `includeAuthToken` 的 fetcher,雲端帶 token、本機忽略)。

**Tech Stack:** Python 3.10+ / FastAPI / httpx / keyring / PySide6 / pytest(desktop);React 19 + TS + Vite(web)。

## Global Constraints

- Python `requires-python = ">=3.10"`(desktop)。
- **cloud(`purism-ev-bot`)不調整**。
- desktop sidecar 端點**合約與雲端一致**:回傳 `{"Token": str, "Data": [{"id","Level","ClassVersion","CoursesName","ClassTime","TeacherName","OpenName"}, ...]}`。
- desktop 路由**不要 Firebase auth**(sidecar 綁 127.0.0.1 + CORS 限定)。
- OIKID 帳密只存 **OS keychain**(`keyring`,service=`ollie-reader-oikid`,key=`credentials`,值為 `{"username","password"}` JSON);不寫檔、不進 git、不傳雲端。
- HTTP 用 **httpx**(已是 desktop runtime 依賴),不新增 `requests`。
- desktop 測試慣例:`fastapi.testclient.TestClient` + `monkeypatch.setattr(app_module, name, fake)`;**無 pytest-asyncio**;不打真實網路(`httpx.MockTransport`)、不碰真實 keychain(memory keyring backend)。
- missing creds:本機回 **400** 明確訊息,**不**自動退雲端。
- web app **無 test runner** → `npm run build` + `npm run lint` + 手動驗證。
- TS 2-space 縮排;Conventional Commits。

---

### Task 1: keychain 帳密封裝 `oikid_secrets.py` + `keyring` 依賴

**Files:**
- Modify: `desktop/pyproject.toml`（`[project].dependencies` 加 `"keyring"`）
- Create: `desktop/server/oikid_secrets.py`
- Test: `desktop/tests/test_oikid_secrets.py`

**Interfaces:**
- Consumes: `keyring`（runtime）。
- Produces:
  - `get_oikid_credentials() -> Optional[tuple[str, str]]`（未設定/毀損 → None）
  - `set_oikid_credentials(username: str, password: str) -> None`
  - `clear_oikid_credentials() -> None`

- [ ] **Step 1: 加 keyring 依賴並同步**

在 `desktop/pyproject.toml` 的 `[project].dependencies` 清單（`"httpx",` 之後）加一行 `"keyring",`。然後：
Run: `cd desktop && uv sync`
Expected: 成功，`keyring` 安裝進環境。

- [ ] **Step 2: 寫失敗測試**

建立 `desktop/tests/test_oikid_secrets.py`:

```python
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
```

- [ ] **Step 3: 跑測試確認失敗**

Run: `cd desktop && uv run pytest tests/test_oikid_secrets.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'server.oikid_secrets'`。

- [ ] **Step 4: 寫實作**

建立 `desktop/server/oikid_secrets.py`:

```python
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
```

- [ ] **Step 5: 跑測試確認通過**

Run: `cd desktop && uv run pytest tests/test_oikid_secrets.py -v`
Expected: PASS（6 passed）。

- [ ] **Step 6: Commit**

```bash
git add desktop/pyproject.toml desktop/uv.lock desktop/server/oikid_secrets.py desktop/tests/test_oikid_secrets.py
git commit -m "feat(desktop): add OIKID credential storage via OS keychain"
```

---

### Task 2: OIKID 抓取 service `oikid.py`（httpx 移植）

**Files:**
- Create: `desktop/server/oikid.py`
- Test: `desktop/tests/test_oikid.py`

**Interfaces:**
- Consumes（Task 1）:`get_oikid_credentials() -> Optional[tuple[str, str]]`。
- Produces:
  - `class OikidError(Exception)`（`.message: str`、`.status_code: int`）
  - `def search_booking_records(*, client: Optional[httpx.Client] = None) -> dict`（回 `{"Token", "Data":[...]}`；帳密缺 → `OikidError(400)`）

- [ ] **Step 1: 寫失敗測試**

建立 `desktop/tests/test_oikid.py`:

```python
import httpx
import pytest

import server.oikid as oikid_module
from server.oikid import OikidError, search_booking_records


def _client(handler):
    return httpx.Client(transport=httpx.MockTransport(handler))


def test_missing_credentials_raises_400(monkeypatch):
    monkeypatch.setattr(oikid_module, "get_oikid_credentials", lambda: None)
    with pytest.raises(OikidError) as exc:
        search_booking_records(client=_client(lambda r: httpx.Response(200)))
    assert exc.value.status_code == 400


def test_success_maps_fields(monkeypatch):
    monkeypatch.setattr(oikid_module, "get_oikid_credentials", lambda: ("u", "p"))

    def handler(request):
        url = str(request.url)
        if "login.php" in url:
            return httpx.Response(200)
        if "Student/Login" in url:
            return httpx.Response(200, headers={"set-cookie": "PHPSESSID=abc; Path=/"})
        if "BookingRecord" in url:
            return httpx.Response(
                200,
                json={
                    "Token": "tok",
                    "Data": [
                        {
                            "Classroom_id": "1",
                            "Level": "L1",
                            "ClassVersion": "v",
                            "CoursesName": "Course",
                            "ClassTime": "2026-07-01 10:00",
                            "TeacherName": "Tina",
                            "OpenName": "Open",
                        }
                    ],
                },
            )
        return httpx.Response(404)

    result = search_booking_records(client=_client(handler))
    assert result["Token"] == "tok"
    assert result["Data"] == [
        {
            "id": "1",
            "Level": "L1",
            "ClassVersion": "v",
            "CoursesName": "Course",
            "ClassTime": "2026-07-01 10:00",
            "TeacherName": "Tina",
            "OpenName": "Open",
        }
    ]


def test_login_without_phpsessid_raises_502(monkeypatch):
    monkeypatch.setattr(oikid_module, "get_oikid_credentials", lambda: ("u", "p"))

    def handler(request):
        if "BookingRecord" in str(request.url):
            return httpx.Response(200, json={"Token": "", "Data": []})
        return httpx.Response(200)  # login 無 set-cookie

    with pytest.raises(OikidError) as exc:
        search_booking_records(client=_client(handler))
    assert exc.value.status_code == 502


def test_search_non_json_raises_502(monkeypatch):
    monkeypatch.setattr(oikid_module, "get_oikid_credentials", lambda: ("u", "p"))

    def handler(request):
        url = str(request.url)
        if "Student/Login" in url:
            return httpx.Response(200, headers={"set-cookie": "PHPSESSID=abc; Path=/"})
        if "BookingRecord" in url:
            return httpx.Response(200, text="<html>not json</html>")
        return httpx.Response(200)

    with pytest.raises(OikidError) as exc:
        search_booking_records(client=_client(handler))
    assert exc.value.status_code == 502
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `cd desktop && uv run pytest tests/test_oikid.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'server.oikid'`。

- [ ] **Step 3: 寫實作**

建立 `desktop/server/oikid.py`:

```python
"""本機 sidecar 的 OIKID 預約記錄抓取。

移植自 purism-ev-bot services/oikid_service.py：
- 帳密改從 OS keychain（oikid_secrets）讀。
- HTTP 改用 httpx（取代 requests）。
合約與雲端一致：回傳 {"Token", "Data":[...]}。
"""

import logging
from typing import Any, Optional

import httpx

from server.oikid_secrets import get_oikid_credentials

logger = logging.getLogger(__name__)

_LOGIN_PAGE = "https://www.oikid.com/login.php"
_LOGIN_URL = (
    "https://www.oikid.com/?a=Student/Login&b=Process&t=0.8666370350207129"
)
_SEARCH_URL = "https://www.oikid.com/?a=Student/BookingRecord&b=Search"


class OikidError(Exception):
    def __init__(self, message: str, status_code: int = 500):
        self.message = message
        self.status_code = status_code
        super().__init__(self.message)


def _login(client: httpx.Client, username: str, password: str) -> dict[str, str]:
    client.get(_LOGIN_PAGE, timeout=30.0)
    resp = client.post(
        _LOGIN_URL,
        data={"Username": username, "Password": password},
        timeout=30.0,
    )
    resp.raise_for_status()

    phpsessid = resp.cookies.get("PHPSESSID")
    awsalb = resp.cookies.get("AWSALB")
    awsalbcors = resp.cookies.get("AWSALBCORS")
    if not phpsessid:
        logger.error("OIKID 登入未取得 PHPSESSID")
        raise OikidError("OIKID login failed", status_code=502)

    cookie = (
        f"location=zh-tw; PHPSESSID={phpsessid}; "
        f"AWSALB={awsalb}; AWSALBCORS={awsalbcors}"
    )
    return {
        "Accept": "application/json, text/javascript, */*; q=0.01",
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "Origin": "https://www.oikid.com",
        "Referer": "https://www.oikid.com/?a=Student/Booking2",
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
            "(KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36"
        ),
        "X-Requested-With": "XMLHttpRequest",
        "Cookie": cookie,
    }


def search_booking_records(*, client: Optional[httpx.Client] = None) -> dict[str, Any]:
    creds = get_oikid_credentials()
    if creds is None:
        raise OikidError("OIKID 帳密未設定，請到桌面 App 設定", status_code=400)
    username, password = creds

    own_client = client is None
    if own_client:
        client = httpx.Client(timeout=30.0)
    try:
        headers = _login(client, username, password)
        resp = client.post(_SEARCH_URL, headers=headers, data={"P": 1}, timeout=30.0)
        resp.raise_for_status()
        data_json = resp.json()
    except OikidError:
        raise
    except httpx.HTTPError as e:
        logger.exception("OIKID 抓取錯誤")
        raise OikidError(f"OIKID fetch error: {e}", status_code=502) from e
    except ValueError as e:
        logger.exception("OIKID 回傳非 JSON")
        raise OikidError("Invalid JSON from OIKID", status_code=502) from e
    finally:
        if own_client:
            client.close()

    output: dict[str, Any] = {"Token": data_json.get("Token", ""), "Data": []}
    for d in data_json.get("Data", []):
        output["Data"].append(
            {
                "id": d.get("Classroom_id", ""),
                "Level": d.get("Level", ""),
                "ClassVersion": d.get("ClassVersion", ""),
                "CoursesName": d.get("CoursesName", ""),
                "ClassTime": d.get("ClassTime", ""),
                "TeacherName": d.get("TeacherName", ""),
                "OpenName": d.get("OpenName", ""),
            }
        )
    return output
```

- [ ] **Step 4: 跑測試確認通過**

Run: `cd desktop && uv run pytest tests/test_oikid.py -v`
Expected: PASS（4 passed）。

- [ ] **Step 5: Commit**

```bash
git add desktop/server/oikid.py desktop/tests/test_oikid.py
git commit -m "feat(desktop): add OIKID booking-records fetch service (httpx)"
```

---

### Task 3: sidecar 路由 `GET /api/oikid/booking-records`（免 Firebase）

**Files:**
- Modify: `desktop/server/app.py`（imports + `create_app()` 內新增路由）
- Test: `desktop/tests/test_app.py`（新增 oikid 路由測試）

**Interfaces:**
- Consumes（Task 2）:`from server.oikid import OikidError, search_booking_records`。
- Produces:`GET /api/oikid/booking-records` → 200 `{"Token","Data":[...]}`；`OikidError → HTTPException`。

- [ ] **Step 1: 寫失敗測試**

在 `desktop/tests/test_app.py` 檔案頂部 import 區加入 `from server.oikid import OikidError`，並**新增**（沿用既有 `client` fixture 與 `app_module`）:

```python
def test_oikid_booking_records_contract(client, monkeypatch):
    def fake_search():
        return {
            "Token": "tok",
            "Data": [
                {
                    "id": "1",
                    "Level": "L1",
                    "ClassVersion": "v",
                    "CoursesName": "Course",
                    "ClassTime": "2026-07-01 10:00",
                    "TeacherName": "Tina",
                    "OpenName": "Open",
                }
            ],
        }

    monkeypatch.setattr(app_module, "search_booking_records", fake_search)
    resp = client.get("/api/oikid/booking-records")

    assert resp.status_code == 200
    body = resp.json()
    assert body["Token"] == "tok"
    assert body["Data"][0]["CoursesName"] == "Course"


def test_oikid_missing_credentials_maps_400(client, monkeypatch):
    def fake_search():
        raise OikidError("OIKID 帳密未設定，請到桌面 App 設定", status_code=400)

    monkeypatch.setattr(app_module, "search_booking_records", fake_search)
    resp = client.get("/api/oikid/booking-records")

    assert resp.status_code == 400
    assert resp.json()["detail"] == "OIKID 帳密未設定，請到桌面 App 設定"


def test_oikid_upstream_error_maps_502(client, monkeypatch):
    def fake_search():
        raise OikidError("OIKID fetch error", status_code=502)

    monkeypatch.setattr(app_module, "search_booking_records", fake_search)
    resp = client.get("/api/oikid/booking-records")

    assert resp.status_code == 502
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `cd desktop && uv run pytest tests/test_app.py -k oikid -v`
Expected: FAIL — `monkeypatch.setattr` raises AttributeError（app 模組尚無 `search_booking_records`）/ 路由回 404。

- [ ] **Step 3: 加路由與 imports**

在 `desktop/server/app.py` 既有的 server import 區（例如 `from server.fetch_url import ...` 之後）新增一行:
```python
from server.oikid import OikidError, search_booking_records
```

在 `create_app()` 內、`return app` 之前新增:
```python
    @app.get("/api/oikid/booking-records", tags=["oikid"])
    async def oikid_booking_records():
        try:
            return await run_in_threadpool(search_booking_records)
        except OikidError as e:
            raise HTTPException(status_code=e.status_code, detail=e.message) from e
        except Exception as e:
            logger.exception("OIKID 未預期錯誤")
            raise HTTPException(status_code=500, detail="OIKID 處理失敗") from e
```
（`run_in_threadpool`、`HTTPException`、`logger` 既有檔案已 import。）**不要**加任何 Firebase/auth 相依。

- [ ] **Step 4: 跑 oikid 路由測試確認通過**

Run: `cd desktop && uv run pytest tests/test_app.py -k oikid -v`
Expected: PASS（3 passed）。

- [ ] **Step 5: 跑整包 desktop 測試確認無回歸**

Run: `cd desktop && uv run pytest -q`
Expected: 全部 PASS。

- [ ] **Step 6: Commit**

```bash
git add desktop/server/app.py desktop/tests/test_app.py
git commit -m "feat(desktop): expose /api/oikid/booking-records on local sidecar"
```

---

### Task 4: shell `SettingsDialog` 加 OIKID 帳密欄位

**Files:**
- Modify: `desktop/shell/app.py`（import + `SettingsDialog` 加欄位與 `_save_oikid_credentials` / `_clear_oikid_credentials`）
- Test: `desktop/tests/test_shell_app.py`（offscreen QApplication 測 save/clear 接線）

**Interfaces:**
- Consumes（Task 1）:`from server.oikid_secrets import get_oikid_credentials, set_oikid_credentials, clear_oikid_credentials`。
- Produces:`SettingsDialog` 具 `oikid_user_edit`、`oikid_pw_edit`（QLineEdit）、`_save_oikid_credentials()`、`_clear_oikid_credentials()`。

- [ ] **Step 1: 寫失敗測試**

在 `desktop/tests/test_shell_app.py` **新增**（檔頂加 `import os`，並在 import 前設定 offscreen 平台）:

```python
import os

os.environ.setdefault("QT_QPA_PLATFORM", "offscreen")

import pytest
from PySide6.QtWidgets import QApplication

from shell import app as app_module


@pytest.fixture(scope="module")
def qapp():
    app = QApplication.instance() or QApplication([])
    yield app


class _StubManager:
    port = 8765

    def is_running(self):
        return False


@pytest.fixture
def settings_dialog(qapp, monkeypatch):
    # 隔離 __init__ 對外部狀態的依賴
    monkeypatch.setattr(app_module.autostart, "is_installed", lambda: False)
    monkeypatch.setattr(app_module, "get_oikid_credentials", lambda: None)
    return app_module.SettingsDialog(_StubManager())


def test_save_oikid_credentials_writes_to_keychain(settings_dialog, monkeypatch):
    saved = {}
    monkeypatch.setattr(
        app_module, "set_oikid_credentials",
        lambda u, p: saved.update(username=u, password=p),
    )
    settings_dialog.oikid_user_edit.setText("alice")
    settings_dialog.oikid_pw_edit.setText("secret")

    settings_dialog._save_oikid_credentials()

    assert saved == {"username": "alice", "password": "secret"}


def test_clear_oikid_credentials_calls_clear(settings_dialog, monkeypatch):
    called = {"n": 0}
    monkeypatch.setattr(
        app_module, "clear_oikid_credentials", lambda: called.__setitem__("n", called["n"] + 1)
    )
    settings_dialog._clear_oikid_credentials()
    assert called["n"] == 1
```

註:若 `SettingsDialog.__init__` 還相依其他外部狀態（例如連按鈕到 manager 的方法），在 `_StubManager` 補上對應的 no-op 方法或在 fixture 內 monkeypatch；以實際 `__init__` 為準。

- [ ] **Step 2: 跑測試確認失敗**

Run: `cd desktop && uv run pytest tests/test_shell_app.py -k oikid -v`
Expected: FAIL — `AttributeError`（`SettingsDialog` 尚無 `oikid_user_edit` / `_save_oikid_credentials`）。

- [ ] **Step 3: 寫實作**

在 `desktop/shell/app.py`:

(a) `QtWidgets` import 加入 `QLineEdit`（與既有 `QCheckBox`、`QDialog`… 同列）。

(b) 檔案 import 區新增:
```python
from server.oikid_secrets import (
    clear_oikid_credentials,
    get_oikid_credentials,
    set_oikid_credentials,
)
```

(c) 在 `SettingsDialog.__init__` 的 `QFormLayout`（變數名 `layout`）內、按鈕列之後，加入 OIKID 區塊:
```python
        creds = get_oikid_credentials()
        self.oikid_user_edit = QLineEdit(creds[0] if creds else "")
        self.oikid_pw_edit = QLineEdit()
        self.oikid_pw_edit.setEchoMode(QLineEdit.EchoMode.Password)
        if creds:
            self.oikid_pw_edit.setPlaceholderText("（已設定，留空則不變更）")
        layout.addRow("OIKID 帳號：", self.oikid_user_edit)
        layout.addRow("OIKID 密碼：", self.oikid_pw_edit)

        self.oikid_status_label = QLabel("")
        layout.addRow("", self.oikid_status_label)

        self.oikid_save_button = QPushButton("儲存 OIKID 帳密")
        self.oikid_save_button.clicked.connect(self._save_oikid_credentials)
        self.oikid_clear_button = QPushButton("清除 OIKID 帳密")
        self.oikid_clear_button.clicked.connect(self._clear_oikid_credentials)
        layout.addRow(self.oikid_save_button, self.oikid_clear_button)
```

(d) 在 `SettingsDialog` 內新增兩個方法:
```python
    def _save_oikid_credentials(self, _checked: bool = False) -> None:
        username = self.oikid_user_edit.text().strip()
        password = self.oikid_pw_edit.text()
        if not username or not password:
            self.oikid_status_label.setText("帳號與密碼皆不可空白")
            return
        set_oikid_credentials(username, password)
        self.oikid_pw_edit.clear()
        self.oikid_pw_edit.setPlaceholderText("（已設定，留空則不變更）")
        self.oikid_status_label.setText("OIKID 帳密已儲存")

    def _clear_oikid_credentials(self, _checked: bool = False) -> None:
        clear_oikid_credentials()
        self.oikid_user_edit.clear()
        self.oikid_pw_edit.clear()
        self.oikid_pw_edit.setPlaceholderText("")
        self.oikid_status_label.setText("OIKID 帳密已清除")
```

- [ ] **Step 4: 跑測試確認通過**

Run: `cd desktop && uv run pytest tests/test_shell_app.py -k oikid -v`
Expected: PASS（2 passed）。若因 `__init__` 其他相依而失敗，依 Step 1 的註記補 monkeypatch/stub 後再跑。

- [ ] **Step 5: 跑整包 desktop 測試確認無回歸**

Run: `cd desktop && uv run pytest -q`
Expected: 全部 PASS。

- [ ] **Step 6: Commit**

```bash
git add desktop/shell/app.py desktop/tests/test_shell_app.py
git commit -m "feat(desktop): add OIKID credentials fields to settings dialog"
```

---

### Task 5: 前端改走 compute-mode helper

**Files:**
- Modify: `src/constants/api.ts`（新增 `OIKID_BOOKING_RECORDS_PATH`）
- Modify: `src/hooks/useBookingRecords.ts`（import + 呼叫改走 `fetchWithComputeBase`）

**Interfaces:**
- Consumes:`fetchWithComputeBase(path: string, init: RequestInit, fetcher?) => Promise<Response>`（`src/services/localBackend.ts`）；`apiFetch(url, ApiFetchOptions)`（`src/utils/apiUtil.ts`）；新常數 `OIKID_BOOKING_RECORDS_PATH`。
- Produces:無對外介面變更;oikid 改走 compute-mode 路由。

- [ ] **Step 1: 更新 `src/constants/api.ts`**

在既有 `OIKID_BOOKING_RECORDS_API_URL` 之後新增:
```ts
export const OIKID_BOOKING_RECORDS_PATH = "/api/oikid/booking-records";
```
（保留 `OIKID_BOOKING_RECORDS_API_URL`，除非 Step 4 後 grep 確認無其他引用。）

- [ ] **Step 2: 更新 `src/hooks/useBookingRecords.ts` import**

把
```ts
import { apiFetch } from "../utils/apiUtil";
import { OIKID_BOOKING_RECORDS_API_URL } from "../constants/api";
```
改為
```ts
import { apiFetch } from "../utils/apiUtil";
import { fetchWithComputeBase } from "../services/localBackend";
import { OIKID_BOOKING_RECORDS_PATH } from "../constants/api";
```

- [ ] **Step 3: 改呼叫點走 compute-mode**

把 `fetchBookingRecords` 內這段:
```ts
        const response = await apiFetch(OIKID_BOOKING_RECORDS_API_URL, {
          method: "GET",
          includeAuthToken: true,
          signal: controller.signal,
        });
```
改為:
```ts
        // 雲端帶 Firebase token；本機 sidecar 會忽略它。
        const authedFetcher = (url: string, init?: RequestInit) =>
          apiFetch(url, { ...init, includeAuthToken: true });
        const response = await fetchWithComputeBase(
          OIKID_BOOKING_RECORDS_PATH,
          { method: "GET", signal: controller.signal },
          authedFetcher,
        );
```
其餘（retry 邏輯、`response.ok` 檢查、JSON 解析、abort 處理）**不動**。

- [ ] **Step 4: 確認 `OIKID_BOOKING_RECORDS_API_URL` 是否還有人用**

Run: `grep -rn "OIKID_BOOKING_RECORDS_API_URL" src/`
Expected: 僅 `src/constants/api.ts`。若無其他引用，從 `api.ts` 移除該常數（避免 unused export）;若有其他引用則保留。

- [ ] **Step 5: 型別檢查 + 建置**

Run: `npm run build`
Expected: 成功（TypeScript 0 errors）。特別確認 `authedFetcher` 與 `fetchWithComputeBase` 的型別相容（`init` 僅含純 `RequestInit`、`includeAuthToken` 在 wrapper 內加,不觸發 excess-property error）。

- [ ] **Step 6: Lint**

Run: `npm run lint`
Expected: 0 errors（注意無 unused import / 變數）。

- [ ] **Step 7: 手動驗證(local + cloud)**

1. desktop shell 設定頁輸入 OIKID 帳密（存 keychain）。
2. `cd desktop && uv run python main.py --serve` 啟動 sidecar。
3. `npm run dev`，設定切 **本機/auto** → 開啟有用到 `useBookingRecords` 的頁面 → 應成功顯示預約記錄，請求打向 `127.0.0.1:8765`。
4. 設定切 **雲端** → 應打雲端（Firebase token）成功。
5. （local 模式）keychain 未設帳密時 → 應顯示「OIKID 帳密未設定…」400 訊息、不退雲端。

- [ ] **Step 8: Commit**

```bash
git add src/constants/api.ts src/hooks/useBookingRecords.ts
git commit -m "feat(web): route OIKID booking-records through compute-mode helper"
```

---

## 完成後驗證(整體)

- desktop:`cd desktop && uv run pytest -q` 全綠。
- web:`npm run build` 與 `npm run lint` 皆 0 error。
- 手動:local（已設帳密）/ auto / cloud 三模式取得預約記錄成功;local 未設帳密顯示明確錯誤。
