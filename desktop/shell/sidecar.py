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
