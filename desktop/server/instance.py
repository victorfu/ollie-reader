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
    """移除 PID 檔；檔案不存在 → 靜默。"""
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
