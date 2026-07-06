# Desktop 防重複行程實例 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 防止 desktop app 的 tray 殼與 sidecar 重複啟動:第二個 tray 實例喊醒舊實例後退出;SidecarManager 收養既有 sidecar 而不是再開一個。

**Architecture:** 兩層防護——tray 殼用 `QLockFile`(single-instance 鎖)+ `QLocalServer/QLocalSocket`(喚醒通道);sidecar 用「啟動前 HTTP 探測 + PID 檔」協調,`SidecarManager` 對既有 sidecar 走收養(adopt)路徑,以 `os.kill(pid, 0)` 做零網路存活檢查。

**Tech Stack:** Python 3 + PySide6(QtCore `QLockFile`、QtNetwork `QLocalServer/QLocalSocket`)、FastAPI/uvicorn sidecar、pytest(monkeypatch 風格,`QT_QPA_PLATFORM=offscreen`)。

**Spec:** `docs/superpowers/specs/2026-07-06-desktop-single-instance-design.md`

## Global Constraints

- 零新依賴:只用現有的 PySide6 / 標準庫。
- 目標平台 macOS arm64,POSIX 語意即可;不動現有 Windows 相容碼(`CREATE_NO_WINDOW`)。
- 收養後的存活檢查必須零網路(`os.kill(pid, 0)`),不可引入週期性 HTTP polling(先前已刻意移除)。
- `--serve` 偵測到既有 sidecar 時必須 **exit 0**(LaunchAgent `KeepAlive=False`,不可被誤判 crash)。
- 縮排:`desktop/server/*`、`desktop/shell/sidecar.py`、新檔、測試用 4 空格;`desktop/shell/app.py` 維持既有 2 空格。
- Docstring/註解風格:繁體中文,對齊現有檔案。
- 測試指令(從 repo root):`uv run --directory desktop pytest -v`
- Conventional Commits;每個 task 結尾 commit。

---

### Task 1: `server/instance.py` — PID 檔工具與 sidecar 存活探測

**Files:**
- Create: `desktop/server/instance.py`
- Test: `desktop/tests/test_instance.py`

**Interfaces:**
- Consumes: 無(僅標準庫)。
- Produces(後續 task 依賴的精確簽名):
  - `pid_file_path(port: int) -> str`
  - `write_pid_file(port: int) -> None`(寫入目前行程 PID;OSError 往外拋,由呼叫端決定是否致命)
  - `read_pid(port: int) -> Optional[int]`(檔案不存在/內容壞 → None)
  - `remove_pid_file(port: int) -> None`(不存在 → 靜默)
  - `pid_alive(pid: int) -> bool`
  - `sidecar_alive(port: int, timeout: float = 1.0) -> bool`(200 且 JSON body 帶 `version` 欄位才算)

- [ ] **Step 1: 寫失敗測試**

建立 `desktop/tests/test_instance.py`:

```python
import os
import subprocess
import sys

from server import instance


class _Resp:
    status = 200

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False

    def read(self):
        return b'{"version": "0.2.0", "engine": "local-sidecar"}'


def test_pid_file_roundtrip(tmp_path, monkeypatch):
    monkeypatch.setattr("server.instance.tempfile.gettempdir", lambda: str(tmp_path))

    instance.write_pid_file(8765)
    assert instance.read_pid(8765) == os.getpid()

    instance.remove_pid_file(8765)
    assert instance.read_pid(8765) is None


def test_read_pid_missing_file_returns_none(tmp_path, monkeypatch):
    monkeypatch.setattr("server.instance.tempfile.gettempdir", lambda: str(tmp_path))
    assert instance.read_pid(8765) is None


def test_read_pid_garbage_returns_none(tmp_path, monkeypatch):
    monkeypatch.setattr("server.instance.tempfile.gettempdir", lambda: str(tmp_path))
    with open(instance.pid_file_path(8765), "w", encoding="utf-8") as f:
        f.write("not-a-pid")
    assert instance.read_pid(8765) is None


def test_remove_pid_file_missing_is_silent(tmp_path, monkeypatch):
    monkeypatch.setattr("server.instance.tempfile.gettempdir", lambda: str(tmp_path))
    instance.remove_pid_file(8765)  # 不應丟例外


def test_pid_alive_self_is_true():
    assert instance.pid_alive(os.getpid()) is True


def test_pid_alive_dead_process_is_false():
    proc = subprocess.Popen([sys.executable, "-c", "pass"])
    proc.wait(timeout=10)
    assert instance.pid_alive(proc.pid) is False


def test_sidecar_alive_true_on_200_with_version(monkeypatch):
    monkeypatch.setattr(
        "server.instance.urllib.request.urlopen", lambda url, timeout=1.0: _Resp()
    )
    assert instance.sidecar_alive(8765) is True


def test_sidecar_alive_false_without_version_field(monkeypatch):
    class _Foreign(_Resp):
        def read(self):
            return b'{"hello": "world"}'

    monkeypatch.setattr(
        "server.instance.urllib.request.urlopen", lambda url, timeout=1.0: _Foreign()
    )
    assert instance.sidecar_alive(8765) is False


def test_sidecar_alive_false_on_non_json_body(monkeypatch):
    class _Html(_Resp):
        def read(self):
            return b"<html>not ours</html>"

    monkeypatch.setattr(
        "server.instance.urllib.request.urlopen", lambda url, timeout=1.0: _Html()
    )
    assert instance.sidecar_alive(8765) is False


def test_sidecar_alive_false_on_connection_error(monkeypatch):
    def boom(url, timeout=1.0):
        raise OSError("refused")

    monkeypatch.setattr("server.instance.urllib.request.urlopen", boom)
    assert instance.sidecar_alive(8765) is False
```

- [ ] **Step 2: 執行測試確認失敗**

Run: `uv run --directory desktop pytest tests/test_instance.py -v`
Expected: FAIL / ERROR — `ModuleNotFoundError: No module named 'server.instance'`(collection error)

- [ ] **Step 3: 實作 `desktop/server/instance.py`**

```python
"""sidecar 行程協調：PID 檔 + 存活探測（shell 與 --serve 兩邊共用）。"""

import json
import os
import tempfile
import urllib.error
import urllib.request
from typing import Optional


def pid_file_path(port: int) -> str:
    return os.path.join(tempfile.gettempdir(), f"ollie-reader-sidecar-{port}.pid")


def write_pid_file(port: int) -> None:
    """寫入目前行程的 PID。OSError 往外拋，由呼叫端決定是否致命。"""
    with open(pid_file_path(port), "w", encoding="utf-8") as f:
        f.write(str(os.getpid()))


def read_pid(port: int) -> Optional[int]:
    """讀 PID 檔；檔案不存在或內容不是整數 → None。"""
    try:
        with open(pid_file_path(port), encoding="utf-8") as f:
            return int(f.read().strip())
    except (OSError, ValueError):
        return None


def remove_pid_file(port: int) -> None:
    try:
        os.unlink(pid_file_path(port))
    except OSError:
        pass


def pid_alive(pid: int) -> bool:
    """行程是否存活。PermissionError 代表行程存在但不是我們的 → 視為存活。"""
    try:
        os.kill(pid, 0)
    except ProcessLookupError:
        return False
    except PermissionError:
        return True
    except OSError:
        return False
    return True


def sidecar_alive(port: int, timeout: float = 1.0) -> bool:
    """port 上是否有活的「自家」sidecar：/api/version 回 200 且 body 帶 version 欄位。

    驗證 body 是為了避免把占用同一個 port 的外部程式誤認成 sidecar。
    """
    url = f"http://127.0.0.1:{port}/api/version"
    try:
        with urllib.request.urlopen(url, timeout=timeout) as resp:
            if resp.status != 200:
                return False
            data = json.loads(resp.read().decode("utf-8"))
    except (urllib.error.URLError, OSError, ValueError):
        return False
    return isinstance(data, dict) and bool(data.get("version"))
```

- [ ] **Step 4: 執行測試確認通過**

Run: `uv run --directory desktop pytest tests/test_instance.py -v`
Expected: 10 passed

- [ ] **Step 5: Commit**

```bash
git add desktop/server/instance.py desktop/tests/test_instance.py
git commit -m "feat(desktop): add sidecar PID file + liveness probe helpers"
```

---

### Task 2: `SidecarManager` 收養既有 sidecar

**Files:**
- Modify: `desktop/shell/sidecar.py`(整檔改寫,見 Step 3)
- Test: `desktop/tests/test_sidecar.py`(更新既有測試 + 新增收養測試)

**Interfaces:**
- Consumes(Task 1):`server.instance.read_pid(port)`、`server.instance.pid_alive(pid)`、`server.instance.sidecar_alive(port, timeout)`。
- Produces:`SidecarManager` 公開 API 不變(`start/stop/is_running/health_check`);新增模組常數 `_ADOPTED_STOP_TIMEOUT = 5.0`(測試會 monkeypatch)。

**行為變更:**
- `start()`:port 上已有活的自家 sidecar → 收養(記 `_adopted_pid`,不 spawn)。
- `is_running()`:收養的 → `pid_alive`;收養但無 PID(舊版 sidecar 過渡期)→ `health_check`。
- `stop()`:收養的 → SIGTERM → 最多等 5 秒 → SIGKILL;無 PID → 只清除收養狀態。
- `health_check()`:委派給 `instance.sidecar_alive`(從此驗證 body 的 version 欄位)。

- [ ] **Step 1: 更新既有測試 + 寫新的失敗測試**

`desktop/tests/test_sidecar.py` 整檔改為:

```python
import signal
import subprocess

import server  # noqa: F401  確保 server 套件可 import
from shell.sidecar import SidecarManager


class _FakeProc:
    def __init__(self):
        self._alive = True

    def poll(self):
        return None if self._alive else 0

    def terminate(self):
        self._alive = False

    def wait(self, timeout=None):
        return 0

    def kill(self):
        self._alive = False


class _SlowProc(_FakeProc):
    def __init__(self):
        super().__init__()
        self.killed = False
        self.wait_calls = 0

    def terminate(self):
        pass

    def wait(self, timeout=None):
        self.wait_calls += 1
        if self.wait_calls == 1:
            raise subprocess.TimeoutExpired(cmd=["sidecar"], timeout=timeout)
        return 0

    def kill(self):
        self.killed = True
        self._alive = False


def _no_existing_sidecar(monkeypatch):
    """start() 現在會先 health_check；spawn 路徑的測試要先讓它回 False。"""
    monkeypatch.setattr(
        SidecarManager, "health_check", lambda self, timeout=1.0: False
    )


def _forbid_spawn(monkeypatch):
    def boom(*a, **k):
        raise AssertionError("subprocess.Popen 不應被呼叫")

    monkeypatch.setattr("shell.sidecar.subprocess.Popen", boom)


def test_start_spawns_process(monkeypatch):
    _no_existing_sidecar(monkeypatch)
    spawned = {}

    def fake_popen(cmd, *a, **k):
        spawned["cmd"] = cmd
        return _FakeProc()

    monkeypatch.setattr("shell.sidecar.subprocess.Popen", fake_popen)
    mgr = SidecarManager(port=8765, main_path="/x/main.py")
    mgr.start()
    assert mgr.is_running() is True
    assert "--serve" in spawned["cmd"]
    assert "8765" in spawned["cmd"]


def test_start_uses_frozen_executable(monkeypatch):
    _no_existing_sidecar(monkeypatch)
    spawned = {}

    def fake_popen(cmd, *a, **k):
        spawned["cmd"] = cmd
        return _FakeProc()

    monkeypatch.setattr("shell.sidecar.subprocess.Popen", fake_popen)
    monkeypatch.setattr("shell.sidecar.sys.frozen", True, raising=False)
    monkeypatch.setattr("shell.sidecar.sys.executable", "/Applications/Ollie.app/ollie")

    mgr = SidecarManager(port=8766, main_path="/x/main.py")
    mgr.start()

    assert spawned["cmd"] == [
        "/Applications/Ollie.app/ollie",
        "--serve",
        "--port",
        "8766",
    ]


def test_stop_terminates(monkeypatch):
    _no_existing_sidecar(monkeypatch)
    monkeypatch.setattr("shell.sidecar.subprocess.Popen", lambda *a, **k: _FakeProc())
    mgr = SidecarManager(port=8765, main_path="/x/main.py")
    mgr.start()
    mgr.stop()
    assert mgr.is_running() is False


def test_stop_kills_and_waits_when_terminate_times_out(monkeypatch):
    _no_existing_sidecar(monkeypatch)
    proc = _SlowProc()
    monkeypatch.setattr("shell.sidecar.subprocess.Popen", lambda *a, **k: proc)

    mgr = SidecarManager(port=8765, main_path="/x/main.py")
    mgr.start()
    mgr.stop()

    assert proc.killed is True
    assert proc.wait_calls == 2
    assert mgr.is_running() is False


def test_health_check_true_on_200_with_version(monkeypatch):
    class _Resp:
        status = 200

        def __enter__(self):
            return self

        def __exit__(self, *a):
            return False

        def read(self):
            return b'{"version": "0.2.0", "engine": "local-sidecar"}'

    monkeypatch.setattr(
        "server.instance.urllib.request.urlopen", lambda url, timeout=1.0: _Resp()
    )
    mgr = SidecarManager(port=8765, main_path="/x/main.py")
    assert mgr.health_check() is True


def test_health_check_false_on_error(monkeypatch):
    def boom(url, timeout=1.0):
        raise OSError("refused")

    monkeypatch.setattr("server.instance.urllib.request.urlopen", boom)
    mgr = SidecarManager(port=8765, main_path="/x/main.py")
    assert mgr.health_check() is False


# ---- 收養（adopt）既有 sidecar ----


def _adoptable(monkeypatch, pid=4242, alive=None):
    """port 上有活的自家 sidecar；alive 為可變 dict 讓測試翻轉存活狀態。"""
    if alive is None:
        alive = {"v": True}
    monkeypatch.setattr(
        SidecarManager, "health_check", lambda self, timeout=1.0: True
    )
    monkeypatch.setattr("shell.sidecar.instance.read_pid", lambda port: pid)
    monkeypatch.setattr(
        "shell.sidecar.instance.pid_alive", lambda p: alive["v"]
    )
    return alive


def test_start_adopts_existing_sidecar(monkeypatch):
    _forbid_spawn(monkeypatch)
    _adoptable(monkeypatch)

    mgr = SidecarManager(port=8765, main_path="/x/main.py")
    mgr.start()

    assert mgr.is_running() is True


def test_adopted_is_running_false_when_pid_dead(monkeypatch):
    _forbid_spawn(monkeypatch)
    alive = _adoptable(monkeypatch)

    mgr = SidecarManager(port=8765, main_path="/x/main.py")
    mgr.start()
    alive["v"] = False

    assert mgr.is_running() is False


def test_adopted_stop_sends_sigterm(monkeypatch):
    _forbid_spawn(monkeypatch)
    alive = _adoptable(monkeypatch)
    kills = []

    def fake_kill(pid, sig):
        kills.append((pid, sig))
        alive["v"] = False

    monkeypatch.setattr("shell.sidecar.os.kill", fake_kill)

    mgr = SidecarManager(port=8765, main_path="/x/main.py")
    mgr.start()
    mgr.stop()

    assert kills == [(4242, signal.SIGTERM)]
    assert mgr.is_running() is False


def test_adopted_stop_escalates_to_sigkill(monkeypatch):
    _forbid_spawn(monkeypatch)
    _adoptable(monkeypatch)  # pid_alive 恆為 True → SIGTERM 等不到 → SIGKILL
    monkeypatch.setattr("shell.sidecar._ADOPTED_STOP_TIMEOUT", 0.05)
    monkeypatch.setattr("shell.sidecar.time.sleep", lambda s: None)
    kills = []
    monkeypatch.setattr(
        "shell.sidecar.os.kill", lambda pid, sig: kills.append((pid, sig))
    )

    mgr = SidecarManager(port=8765, main_path="/x/main.py")
    mgr.start()
    mgr.stop()

    assert kills[0] == (4242, signal.SIGTERM)
    assert kills[-1] == (4242, signal.SIGKILL)


def test_adopted_without_pid_file(monkeypatch):
    """舊版 sidecar 還在跑（沒有 PID 檔）：可收養、is_running 退回 HTTP、stop 只清狀態。"""
    _forbid_spawn(monkeypatch)
    monkeypatch.setattr(
        SidecarManager, "health_check", lambda self, timeout=1.0: True
    )
    monkeypatch.setattr("shell.sidecar.instance.read_pid", lambda port: None)
    monkeypatch.setattr(
        "shell.sidecar.os.kill",
        lambda pid, sig: (_ for _ in ()).throw(AssertionError("不應呼叫 os.kill")),
    )

    mgr = SidecarManager(port=8765, main_path="/x/main.py")
    mgr.start()
    assert mgr.is_running() is True  # 退回 health_check

    mgr.stop()  # 不應丟例外
    assert mgr.is_running() is False


def test_start_respawns_after_adopted_died(monkeypatch):
    """收養的 sidecar 死掉後再按啟動 → 正常 spawn 新的。"""
    health = {"v": True}
    alive = {"v": True}
    monkeypatch.setattr(
        SidecarManager, "health_check", lambda self, timeout=1.0: health["v"]
    )
    monkeypatch.setattr("shell.sidecar.instance.read_pid", lambda port: 4242)
    monkeypatch.setattr("shell.sidecar.instance.pid_alive", lambda p: alive["v"])
    spawned = {}

    def fake_popen(cmd, *a, **k):
        spawned["cmd"] = cmd
        return _FakeProc()

    monkeypatch.setattr("shell.sidecar.subprocess.Popen", fake_popen)

    mgr = SidecarManager(port=8765, main_path="/x/main.py")
    mgr.start()  # 收養
    assert "cmd" not in spawned

    alive["v"] = False
    health["v"] = False  # 收養的 sidecar 死了
    mgr.start()  # 應改走 spawn

    assert "cmd" in spawned
    assert mgr.is_running() is True
```

- [ ] **Step 2: 執行測試確認新測試失敗**

Run: `uv run --directory desktop pytest tests/test_sidecar.py -v`
Expected: 收養與 health_check 相關測試 FAIL/ERROR(收養測試因 `shell.sidecar` 尚無 `instance` 屬性而 monkeypatch AttributeError;health_check 測試因尚未委派 `server.instance` 而失敗);spawn/stop 四個測試 PASS。

- [ ] **Step 3: 改寫 `desktop/shell/sidecar.py`**

整檔內容:

```python
"""管理本機 API sidecar 子行程：啟動、停止、健康檢查。

啟動前先探測 port：已有活的自家 sidecar（例如開機自啟的 LaunchAgent 開的）
→「收養」它（記下 PID、不重複 spawn），存活檢查與停止都對該 PID 操作。
"""

import os
import signal
import subprocess
import sys
import tempfile
import time
from typing import IO, Optional

from server import instance

# 收養的 sidecar：SIGTERM 後等它自己退出的秒數，逾時升級 SIGKILL。
_ADOPTED_STOP_TIMEOUT = 5.0


def _default_main_path() -> str:
    # dev：desktop/main.py；打包後（frozen）不使用此值（見 start()）
    return os.path.join(os.path.dirname(os.path.dirname(__file__)), "main.py")


def _sidecar_log_path() -> str:
    return os.path.join(tempfile.gettempdir(), "ollie-reader-sidecar.log")


class SidecarManager:
    def __init__(self, port: int, main_path: Optional[str] = None):
        self.port = port
        self.main_path = main_path or _default_main_path()
        self._proc: Optional[subprocess.Popen] = None
        self._log: Optional[IO[bytes]] = None
        self._adopted = False
        self._adopted_pid: Optional[int] = None

    def _serve_cmd(self) -> list:
        if getattr(sys, "frozen", False):
            # 打包後：執行檔自己帶 --serve
            return [sys.executable, "--serve", "--port", str(self.port)]
        return [sys.executable, self.main_path, "--serve", "--port", str(self.port)]

    def start(self) -> None:
        if self.is_running():
            return
        if self.health_check(timeout=0.5):
            # port 上已有活的自家 sidecar → 收養，不重複 spawn。
            # PID 檔可能缺（舊版 sidecar）或殘留（crash 沒清），存活驗證後才採用。
            pid = instance.read_pid(self.port)
            self._adopted = True
            self._adopted_pid = (
                pid if pid is not None and instance.pid_alive(pid) else None
            )
            return
        self._adopted = False
        self._adopted_pid = None
        # Windows：殼若以 pythonw.exe（無 console，例如雙擊或開機自啟）執行，
        # sys.executable 會是 pythonw，子行程繼承到無效的 stdout/stderr，uvicorn
        # 一寫 log 就 crash（poll()=1）。把子行程輸出導到 log 檔給它有效 handle，
        # 並以 CREATE_NO_WINDOW 避免彈出 console 視窗。
        self._log = open(_sidecar_log_path(), "wb")
        self._proc = subprocess.Popen(
            self._serve_cmd(),
            stdout=self._log,
            stderr=subprocess.STDOUT,
            creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
        )

    def stop(self) -> None:
        if self._adopted:
            self._stop_adopted()
            return
        if self._proc is not None:
            self._proc.terminate()
            try:
                self._proc.wait(timeout=5)
            except subprocess.TimeoutExpired:
                self._proc.kill()
                self._proc.wait(timeout=5)
            self._proc = None
        if self._log is not None:
            self._log.close()
            self._log = None

    def _stop_adopted(self) -> None:
        """停止收養來的 sidecar：SIGTERM → 等待 → SIGKILL。無 PID 只能放棄追蹤。"""
        pid = self._adopted_pid
        self._adopted = False
        self._adopted_pid = None
        if pid is None:
            return
        try:
            os.kill(pid, signal.SIGTERM)
        except OSError:
            return
        deadline = time.monotonic() + _ADOPTED_STOP_TIMEOUT
        while time.monotonic() < deadline:
            if not instance.pid_alive(pid):
                return
            time.sleep(0.1)
        try:
            os.kill(pid, signal.SIGKILL)
        except OSError:
            pass

    def is_running(self) -> bool:
        if self._adopted:
            if self._adopted_pid is not None:
                # 零網路存活檢查（維持先前移除週期性 HTTP polling 的決策）。
                return instance.pid_alive(self._adopted_pid)
            # 收養但拿不到 PID（舊版 sidecar 過渡期）→ 只能用 HTTP 探測。
            return self.health_check(timeout=0.3)
        return self._proc is not None and self._proc.poll() is None

    def health_check(self, timeout: float = 1.0) -> bool:
        return instance.sidecar_alive(self.port, timeout=timeout)
```

(移除不再使用的 `urllib.error` / `urllib.request` import。)

- [ ] **Step 4: 執行測試確認通過**

Run: `uv run --directory desktop pytest tests/test_sidecar.py -v`
Expected: 13 passed

- [ ] **Step 5: Commit**

```bash
git add desktop/shell/sidecar.py desktop/tests/test_sidecar.py
git commit -m "feat(desktop): SidecarManager adopts an already-running sidecar"
```

---

### Task 3: `main.py --serve` 去重防護 + PID 檔生命週期

**Files:**
- Modify: `desktop/main.py:16-26`(`--serve` 分支)
- Test: `desktop/tests/test_main_serve.py`(新增)

**Interfaces:**
- Consumes(Task 1):`server.instance.sidecar_alive(port)`、`write_pid_file(port)`、`remove_pid_file(port)`。
- Produces: 無(行程進入點)。

- [ ] **Step 1: 寫失敗測試**

建立 `desktop/tests/test_main_serve.py`:

```python
import sys

import pytest
import uvicorn

import main
from server import instance


def test_serve_exits_cleanly_when_sidecar_already_running(monkeypatch):
    monkeypatch.setattr(sys, "argv", ["ollie-reader", "--serve", "--port", "8123"])
    monkeypatch.setattr(instance, "sidecar_alive", lambda port, timeout=1.0: True)

    def boom(*a, **k):
        raise AssertionError("uvicorn.run 不應被呼叫")

    monkeypatch.setattr(uvicorn, "run", boom)

    main.main()  # 正常 return（exit 0），不啟動 uvicorn


def test_serve_writes_then_removes_pid_file(monkeypatch):
    monkeypatch.setattr(sys, "argv", ["ollie-reader", "--serve", "--port", "8123"])
    monkeypatch.setattr(instance, "sidecar_alive", lambda port, timeout=1.0: False)
    events = []
    monkeypatch.setattr(
        instance, "write_pid_file", lambda port: events.append(("write", port))
    )
    monkeypatch.setattr(
        instance, "remove_pid_file", lambda port: events.append(("remove", port))
    )
    monkeypatch.setattr(uvicorn, "run", lambda *a, **k: events.append(("run",)))

    main.main()

    assert events == [("write", 8123), ("run",), ("remove", 8123)]


def test_serve_removes_pid_file_when_uvicorn_raises(monkeypatch):
    monkeypatch.setattr(sys, "argv", ["ollie-reader", "--serve", "--port", "8123"])
    monkeypatch.setattr(instance, "sidecar_alive", lambda port, timeout=1.0: False)
    events = []
    monkeypatch.setattr(instance, "write_pid_file", lambda port: None)
    monkeypatch.setattr(
        instance, "remove_pid_file", lambda port: events.append(("remove", port))
    )

    def boom(*a, **k):
        raise RuntimeError("bind failed")

    monkeypatch.setattr(uvicorn, "run", boom)

    with pytest.raises(RuntimeError):
        main.main()
    assert events == [("remove", 8123)]


def test_serve_continues_when_pid_file_write_fails(monkeypatch):
    monkeypatch.setattr(sys, "argv", ["ollie-reader", "--serve", "--port", "8123"])
    monkeypatch.setattr(instance, "sidecar_alive", lambda port, timeout=1.0: False)
    events = []

    def bad_write(port):
        raise OSError("disk full")

    monkeypatch.setattr(instance, "write_pid_file", bad_write)
    monkeypatch.setattr(instance, "remove_pid_file", lambda port: None)
    monkeypatch.setattr(uvicorn, "run", lambda *a, **k: events.append(("run",)))

    main.main()  # PID 檔寫失敗不致命

    assert events == [("run",)]
```

- [ ] **Step 2: 執行測試確認失敗**

Run: `uv run --directory desktop pytest tests/test_main_serve.py -v`
Expected: 4 failed — 現行 `main()` 直接呼叫 `uvicorn.run`,`test_serve_exits_cleanly_when_sidecar_already_running` 收到 `AssertionError: uvicorn.run 不應被呼叫`,其餘因沒寫 PID 檔而 assert 失敗。

- [ ] **Step 3: 修改 `desktop/main.py` 的 `--serve` 分支**

把:

```python
    if args.serve:
        import uvicorn

        from server.config import DEFAULT_PORT, HOST

        uvicorn.run(
            "server.app:app",
            host=HOST,
            port=args.port or DEFAULT_PORT,
            log_level="info",
        )
```

改為:

```python
    if args.serve:
        import uvicorn

        from server import instance
        from server.config import DEFAULT_PORT, HOST

        port = args.port or DEFAULT_PORT
        if instance.sidecar_alive(port):
            # 已有活的 sidecar（開機自啟或另一個殼開的）→ 正常退出（exit 0），
            # 不搶 port。LaunchAgent KeepAlive=False，不會被誤判 crash。
            print(f"ollie-reader sidecar 已在 port {port} 執行，不重複啟動。")
            return

        try:
            instance.write_pid_file(port)
        except OSError as exc:
            print(f"無法寫入 sidecar PID 檔（{exc}），照常啟動。")
        try:
            uvicorn.run(
                "server.app:app",
                host=HOST,
                port=port,
                log_level="info",
            )
        finally:
            # uvicorn 對 SIGTERM/SIGINT 都會優雅收尾後 return，finally 足以清檔。
            instance.remove_pid_file(port)
```

同時更新檔頭 docstring:

```python
"""ollie-reader desktop 進入點。

無旗標 → 啟動 PySide6 殼。
--serve  → 啟動本機 API sidecar（uvicorn）；若 port 上已有活的 sidecar 則直接退出。
"""
```

- [ ] **Step 4: 執行測試確認通過**

Run: `uv run --directory desktop pytest tests/test_main_serve.py -v`
Expected: 4 passed

- [ ] **Step 5: Commit**

```bash
git add desktop/main.py desktop/tests/test_main_serve.py
git commit -m "feat(desktop): --serve exits cleanly when a sidecar already runs"
```

---

### Task 4: `shell/single_instance.py` — tray 殼 single-instance 鎖與喚醒通道

**Files:**
- Create: `desktop/shell/single_instance.py`
- Test: `desktop/tests/test_single_instance.py`

**Interfaces:**
- Consumes: PySide6(`QtCore.QLockFile`、`QtNetwork.QLocalServer/QLocalSocket`)。
- Produces(Task 5 依賴):
  - `SingleInstance(on_activate: Optional[Callable[[], None]] = None, server_name: str = SERVER_NAME, lock_path: Optional[str] = None)`
  - `.acquire() -> bool`(取鎖 + 開始監聽;False 表示已有實例)
  - `.notify_existing(timeout_ms: int = 500) -> bool`(通知既有實例;連不上回 False)
  - `.release() -> None`(關 server、釋放鎖;可安全重複呼叫)
  - `.on_activate` 屬性(可於 acquire 後再指定)

- [ ] **Step 1: 寫失敗測試**

建立 `desktop/tests/test_single_instance.py`:

```python
import os
import time

os.environ.setdefault("QT_QPA_PLATFORM", "offscreen")

import pytest
from PySide6.QtWidgets import QApplication

from shell.single_instance import SingleInstance


@pytest.fixture(scope="module")
def qapp():
    app = QApplication.instance() or QApplication([])
    yield app


def test_first_instance_acquires_lock(qapp, tmp_path):
    guard = SingleInstance(
        server_name="ollie-test-first", lock_path=str(tmp_path / "shell.lock")
    )
    try:
        assert guard.acquire() is True
    finally:
        guard.release()


def test_second_instance_fails_and_wakes_first(qapp, tmp_path):
    activated = []
    first = SingleInstance(
        on_activate=lambda: activated.append(1),
        server_name="ollie-test-wake",
        lock_path=str(tmp_path / "shell.lock"),
    )
    second = SingleInstance(
        server_name="ollie-test-wake", lock_path=str(tmp_path / "shell.lock")
    )
    try:
        assert first.acquire() is True
        assert second.acquire() is False
        assert second.notify_existing() is True

        deadline = time.monotonic() + 2.0
        while not activated and time.monotonic() < deadline:
            qapp.processEvents()
        assert activated == [1]
    finally:
        second.release()
        first.release()


def test_notify_without_listener_returns_false(qapp, tmp_path):
    guard = SingleInstance(
        server_name="ollie-test-nobody", lock_path=str(tmp_path / "shell.lock")
    )
    assert guard.notify_existing(timeout_ms=100) is False


def test_release_allows_reacquire(qapp, tmp_path):
    first = SingleInstance(
        server_name="ollie-test-re", lock_path=str(tmp_path / "shell.lock")
    )
    assert first.acquire() is True
    first.release()

    second = SingleInstance(
        server_name="ollie-test-re", lock_path=str(tmp_path / "shell.lock")
    )
    try:
        assert second.acquire() is True
    finally:
        second.release()
```

- [ ] **Step 2: 執行測試確認失敗**

Run: `uv run --directory desktop pytest tests/test_single_instance.py -v`
Expected: collection error — `ModuleNotFoundError: No module named 'shell.single_instance'`

- [ ] **Step 3: 實作 `desktop/shell/single_instance.py`**

```python
"""tray 殼 single-instance：QLockFile 防重複 + QLocalServer 喚醒既有實例。

第一個實例 acquire() 取得鎖並監聽 local socket；之後的實例 acquire() 失敗，
notify_existing() 送出 activate 訊息（既有實例會打開設定視窗）後退出。
QLockFile 內建 stale-lock 偵測：持鎖行程 crash 後，下一個實例會自動清掉舊鎖。
"""

import os
import tempfile
from typing import Callable, Optional

from PySide6.QtCore import QLockFile
from PySide6.QtNetwork import QLocalServer, QLocalSocket

SERVER_NAME = "ollie-reader-desktop"
ACTIVATE_MESSAGE = b"activate"


def _lock_file_path() -> str:
    return os.path.join(tempfile.gettempdir(), "ollie-reader-shell.lock")


class SingleInstance:
    def __init__(
        self,
        on_activate: Optional[Callable[[], None]] = None,
        server_name: str = SERVER_NAME,
        lock_path: Optional[str] = None,
    ):
        self.on_activate = on_activate
        self._server_name = server_name
        self._lock = QLockFile(lock_path or _lock_file_path())
        # 0 = 永不以「檔案年齡」判定 stale（tray 是長駐行程）；
        # QLockFile 仍會以持鎖 PID 是否存活來偵測 crash 留下的殘鎖。
        self._lock.setStaleLockTime(0)
        self._server: Optional[QLocalServer] = None

    def acquire(self) -> bool:
        """取鎖並開始監聽喚醒訊息。回 False 表示已有實例在跑。"""
        if not self._lock.tryLock(0):
            return False
        # 前一個實例 crash 可能留下 stale socket 檔，先清掉才能 listen。
        QLocalServer.removeServer(self._server_name)
        self._server = QLocalServer()
        self._server.newConnection.connect(self._handle_connection)
        self._server.listen(self._server_name)
        return True

    def notify_existing(self, timeout_ms: int = 500) -> bool:
        """通知既有實例（打開設定視窗）。連不上就放棄，不影響呼叫端退出。"""
        socket = QLocalSocket()
        socket.connectToServer(self._server_name)
        if not socket.waitForConnected(timeout_ms):
            return False
        socket.write(ACTIVATE_MESSAGE)
        socket.flush()
        socket.waitForBytesWritten(timeout_ms)
        socket.disconnectFromServer()
        return True

    def release(self) -> None:
        if self._server is not None:
            self._server.close()
            self._server = None
        if self._lock.isLocked():
            self._lock.unlock()

    def _handle_connection(self) -> None:
        if self._server is None:
            return
        socket = self._server.nextPendingConnection()
        if socket is None:
            return
        socket.readyRead.connect(lambda: self._handle_ready_read(socket))

    def _handle_ready_read(self, socket: QLocalSocket) -> None:
        data = bytes(socket.readAll().data())
        socket.disconnectFromServer()
        if data.startswith(ACTIVATE_MESSAGE) and self.on_activate is not None:
            self.on_activate()
```

- [ ] **Step 4: 執行測試確認通過**

Run: `uv run --directory desktop pytest tests/test_single_instance.py -v`
Expected: 4 passed

- [ ] **Step 5: Commit**

```bash
git add desktop/shell/single_instance.py desktop/tests/test_single_instance.py
git commit -m "feat(desktop): add single-instance lock with wake-existing channel"
```

---

### Task 5: 接進 `run_shell()` — 第二個實例喊醒舊實例後退出

**Files:**
- Modify: `desktop/shell/app.py:235-250`(`run_shell()`)與 import 區
- Test: `desktop/tests/test_shell_app.py`(新增兩個測試)

**Interfaces:**
- Consumes(Task 4):`shell.single_instance.SingleInstance`(`acquire/notify_existing/release/on_activate`)。
- Produces: 無(UI 進入點)。

**注意:`shell/app.py` 用 2 空格縮排。**

- [ ] **Step 1: 寫失敗測試**

在 `desktop/tests/test_shell_app.py` 檔尾加上:

```python
class _StubGuard:
    def __init__(self, acquired):
        self._acquired = acquired
        self.notified = False
        self.released = False
        self.on_activate = None

    def acquire(self):
        return self._acquired

    def notify_existing(self, timeout_ms=500):
        self.notified = True
        return True

    def release(self):
        self.released = True


def test_run_shell_second_instance_notifies_and_exits(qapp, monkeypatch):
    guard = _StubGuard(acquired=False)
    monkeypatch.setattr(app_module, "SingleInstance", lambda: guard)

    def boom(*a, **k):
        raise AssertionError("TrayApp 不應被建立")

    monkeypatch.setattr(app_module, "TrayApp", boom)

    app_module.run_shell()  # 應直接 return，不進入 event loop

    assert guard.notified is True


def test_run_shell_first_instance_wires_activate_to_settings(qapp, monkeypatch):
    guard = _StubGuard(acquired=True)
    monkeypatch.setattr(app_module, "SingleInstance", lambda: guard)

    created = {}

    class _StubTray:
        def __init__(self, app):
            created["tray"] = self
            self.opened = 0

        def _open_settings(self, _checked=False):
            self.opened += 1

        def start(self):
            pass

    monkeypatch.setattr(app_module, "TrayApp", _StubTray)
    monkeypatch.setattr(type(qapp), "exec", lambda self: 0)

    with pytest.raises(SystemExit):
        app_module.run_shell()

    assert guard.on_activate is not None
    guard.on_activate()
    assert created["tray"].opened == 1
```

- [ ] **Step 2: 執行測試確認失敗**

Run: `uv run --directory desktop pytest tests/test_shell_app.py -v`
Expected: 新兩個測試 FAIL — `AttributeError: module 'shell.app' has no attribute 'SingleInstance'`;既有測試 PASS。

- [ ] **Step 3: 修改 `desktop/shell/app.py`**

import 區加一行(放在 `from shell.sidecar import SidecarManager` 之後):

```python
from shell.single_instance import SingleInstance
```

`run_shell()` 改為(2 空格縮排;SIGINT 註解與處理維持原樣):

```python
def run_shell() -> None:
  # 測試會預先建立 QApplication；正常執行時這裡是第一次建立。
  app = QApplication.instance() or QApplication(sys.argv)
  app.setWindowIcon(_tray_icon())
  app.setQuitOnLastWindowClosed(False)

  # single-instance：搶不到鎖代表已有實例在跑 → 喊醒它（打開設定視窗）後退出。
  guard = SingleInstance()
  if not guard.acquire():
    guard.notify_existing()
    print("Ollie Reader desktop 已在執行，改為喚醒既有實例。")
    return

  tray = TrayApp(app)
  guard.on_activate = tray._open_settings
  app.aboutToQuit.connect(guard.release)
  tray.start()

  # Qt 的 C++ event loop 會吞掉 SIGINT，導致終端機按 Ctrl+C 關不掉。
  # 攔截 SIGINT → app.quit()（觸發 aboutToQuit → manager.stop()，收掉 sidecar）；
  # 再加一個短週期 timer 讓 Python 直譯器定期醒來，signal 才有機會被處理。
  signal.signal(signal.SIGINT, lambda *_: app.quit())
  sigint_timer = QTimer(app)
  sigint_timer.timeout.connect(lambda: None)
  sigint_timer.start(200)

  sys.exit(app.exec())
```

- [ ] **Step 4: 執行測試確認通過**

Run: `uv run --directory desktop pytest tests/test_shell_app.py -v`
Expected: 9 passed(既有 7 + 新 2)

- [ ] **Step 5: Commit**

```bash
git add desktop/shell/app.py desktop/tests/test_shell_app.py
git commit -m "feat(desktop): tray shell enforces single instance, wakes existing one"
```

---

### Task 6: 全套驗證 + README 補充

**Files:**
- Modify: `desktop/README.md`(行為說明)

- [ ] **Step 1: 跑整個 desktop 測試套件**

Run: `uv run --directory desktop pytest -v`
Expected: 全部 PASS(既有測試 + 本計畫新增的約 20 個)

- [ ] **Step 2: 手動煙霧測試(dev 模式)**

```bash
# 終端機 A:啟動殼(會 spawn sidecar)
make desktop-run
# 終端機 B:再啟動一次 → 應立即退出並印「已在執行,改為喚醒既有實例」,
#          且終端機 A 的實例跳出設定視窗;系統匣仍只有一個 icon。
make desktop-run
# 終端機 B:單獨再開 sidecar → 應印「已在 port 8765 執行,不重複啟動」後退出。
uv run --directory desktop python main.py --serve
# 收養驗證:先只開 sidecar,再開殼 → 殼的狀態應顯示「● 運行中」(收養),
# 從托盤按「停止本機服務」→ sidecar 行程應被終止。
```

- [ ] **Step 3: 在 `desktop/README.md` 加一小節**

在適當位置(行為/架構說明附近)加:

```markdown
## Single instance

- 重複啟動 app 時,第二個實例會喚醒既有實例(打開設定視窗)後直接退出
  (`QLockFile` + `QLocalServer`,鎖檔在暫存目錄 `ollie-reader-shell.lock`)。
- `--serve` 啟動時若 port 上已有活的 sidecar(`/api/version` 驗證),會直接
  exit 0 不搶 port;sidecar 會在暫存目錄寫 `ollie-reader-sidecar-<port>.pid`。
- 殼啟動時若發現已有 sidecar 在跑(例如開機自啟的),會「收養」它:狀態
  顯示運行中,「停止本機服務」會對該行程送 SIGTERM。
```

- [ ] **Step 4: Commit**

```bash
git add desktop/README.md
git commit -m "docs(desktop): document single-instance behavior"
```
