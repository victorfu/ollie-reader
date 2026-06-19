"""管理本機 API sidecar 子行程：啟動、停止、健康檢查。"""

import os
import subprocess
import sys
import urllib.error
import urllib.request
from typing import Optional


def _default_main_path() -> str:
    # dev：desktop/main.py；打包後（frozen）不使用此值（見 start()）
    return os.path.join(os.path.dirname(os.path.dirname(__file__)), "main.py")


class SidecarManager:
    def __init__(self, port: int, main_path: Optional[str] = None):
        self.port = port
        self.main_path = main_path or _default_main_path()
        self._proc: Optional[subprocess.Popen] = None

    def _serve_cmd(self) -> list:
        if getattr(sys, "frozen", False):
            # 打包後：執行檔自己帶 --serve
            return [sys.executable, "--serve", "--port", str(self.port)]
        return [sys.executable, self.main_path, "--serve", "--port", str(self.port)]

    def start(self) -> None:
        if self.is_running():
            return
        self._proc = subprocess.Popen(self._serve_cmd())

    def stop(self) -> None:
        if self._proc is not None:
            self._proc.terminate()
            try:
                self._proc.wait(timeout=5)
            except subprocess.TimeoutExpired:
                self._proc.kill()
            self._proc = None

    def is_running(self) -> bool:
        return self._proc is not None and self._proc.poll() is None

    def health_check(self, timeout: float = 1.0) -> bool:
        url = f"http://127.0.0.1:{self.port}/api/version"
        try:
            with urllib.request.urlopen(url, timeout=timeout) as resp:
                return resp.status == 200
        except (urllib.error.URLError, OSError):
            return False
