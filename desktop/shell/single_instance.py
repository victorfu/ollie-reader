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
        if not self._server.listen(self._server_name):
            # 喚醒通道開不起來只影響「第二個實例喊醒舊實例」的 UX，鎖本身仍有效。
            print(f"single-instance 喚醒通道監聽失敗：{self._server.errorString()}")
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
