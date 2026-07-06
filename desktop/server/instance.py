"""sidecar 行程協調：PID 檔 + 存活探測（shell 與 --serve 兩邊共用）。"""

import json
import os
import signal
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
    """移除 PID 檔，但僅在檔案內容是「自己」時才動手。

    擁有權防護：兩個 --serve 行程幾乎同時啟動時（例如 LaunchAgent 開機自啟
    又疊到手動/shell 啟動），都會通過 sidecar_alive 檢查後各自寫入 PID 檔，
    第二次寫入會覆蓋第一次；bind port 失敗的那個之後清理時，若不檢查擁有權，
    就會刪掉 bind 成功、真正在跑的那個行程的 PID 檔。因此：檔案不存在 →
    靜默；內容無法解析或 PID 不是自己 → 保留原檔不動；只有內容等於
    os.getpid() 才真的刪除。並行啟動時，輸掉 bind 的那方不可刪掉贏家的
    PID 檔。
    """
    if read_pid(port) != os.getpid():
        return
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


def install_signal_cleanup(port: int) -> None:
    """安裝 SIGTERM/SIGINT handler：先清 PID 檔，再還原預設行為並重送訊號。

    uvicorn 優雅關閉後會「還原原本的 handler 並重放訊號」，預設 handler 直接終止
    行程，try/finally 不會執行 —— 所以 PID 檔要在這裡清，清完再以預設行為結束，
    保留「因 signal 結束」的行程語意。
    """

    def _cleanup(signum, frame):
        remove_pid_file(port)
        signal.signal(signum, signal.SIG_DFL)
        os.kill(os.getpid(), signum)

    for sig in (signal.SIGTERM, signal.SIGINT):
        signal.signal(sig, _cleanup)
