"""管理本機 API sidecar 子行程：啟動、停止、健康檢查。"""

import os
import subprocess
import sys
import tempfile
import urllib.error
import urllib.request
from typing import IO, Optional


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

    def _serve_cmd(self) -> list:
        if getattr(sys, "frozen", False):
            # 打包後：執行檔自己帶 --serve
            return [sys.executable, "--serve", "--port", str(self.port)]
        return [sys.executable, self.main_path, "--serve", "--port", str(self.port)]

    def start(self) -> None:
        if self.is_running():
            return
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

    def is_running(self) -> bool:
        return self._proc is not None and self._proc.poll() is None

    def health_check(self, timeout: float = 1.0) -> bool:
        url = f"http://127.0.0.1:{self.port}/api/version"
        try:
            with urllib.request.urlopen(url, timeout=timeout) as resp:
                return resp.status == 200
        except (urllib.error.URLError, OSError):
            return False
