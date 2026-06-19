"""PySide6 殼：系統匣 icon + 設定視窗，監督本機 sidecar。"""

import signal
import sys
from pathlib import Path

from PySide6.QtCore import QTimer, QUrl
from PySide6.QtGui import QAction, QDesktopServices, QIcon
from PySide6.QtWidgets import (
  QApplication,
  QCheckBox,
  QDialog,
  QFormLayout,
  QLabel,
  QMenu,
  QPushButton,
  QSystemTrayIcon,
)

from server.config import DEFAULT_PORT
from shell import autostart
from shell.sidecar import SidecarManager

WEB_APP_URL = "http://localhost:5173"


def _resource_path(*parts: str) -> Path:
  if getattr(sys, "frozen", False):
    return Path(getattr(sys, "_MEIPASS", Path(sys.executable).resolve().parent), *parts)
  return Path(__file__).resolve().parents[1].joinpath(*parts)


def _tray_icon() -> QIcon:
  return QIcon(str(_resource_path("assets", "tray-icon.png")))


def _autostart_args(manager: SidecarManager) -> list[str]:
  if getattr(sys, "frozen", False):
    return [sys.executable, "--serve", "--port", str(manager.port)]
  return [sys.executable, manager.main_path, "--serve", "--port", str(manager.port)]


class SettingsDialog(QDialog):
  def __init__(self, manager: SidecarManager):
    super().__init__()
    self.manager = manager
    self.setWindowTitle("ollie-reader desktop 設定")

    layout = QFormLayout(self)

    self.status_label = QLabel("—")
    layout.addRow("狀態：", self.status_label)
    layout.addRow("Port：", QLabel(str(manager.port)))

    self.autostart_cb = QCheckBox("開機時自動啟動")
    self.autostart_cb.setChecked(autostart.is_installed())
    self.autostart_cb.toggled.connect(self._toggle_autostart)
    layout.addRow(self.autostart_cb)

    self.start_button = QPushButton("啟動本機服務")
    self.start_button.clicked.connect(self._start_sidecar)
    self.stop_button = QPushButton("停止本機服務")
    self.stop_button.clicked.connect(self._stop_sidecar)
    layout.addRow(self.start_button, self.stop_button)

    self._timer = QTimer(self)
    self._timer.timeout.connect(self._refresh)
    self._timer.start(2000)
    self._refresh()

  def _refresh(self) -> None:
    # 本機子行程存活檢查（poll()），零網路；不再每 2 秒打 /api/version。
    ok = self.manager.is_running()
    self.status_label.setText("● 運行中" if ok else "○ 已停止")

  def _start_sidecar(self, _checked: bool = False) -> None:
    self.manager.start()
    self._refresh()

  def _stop_sidecar(self, _checked: bool = False) -> None:
    self.manager.stop()
    self._refresh()

  def _toggle_autostart(self, checked: bool) -> None:
    if checked:
      autostart.install(_autostart_args(self.manager))
    else:
      autostart.uninstall()


class TrayApp:
  def __init__(self, app: QApplication):
    self.app = app
    self.manager = SidecarManager(DEFAULT_PORT)
    self.dialog: SettingsDialog | None = None

    self.tray_icon = _tray_icon()
    self.tray = QSystemTrayIcon(self.tray_icon, self.app)
    self.menu = QMenu()

    self.status_action = QAction("狀態：啟動中…", self.menu)
    self.status_action.setEnabled(False)
    self.menu.addAction(self.status_action)
    self.menu.addSeparator()

    self.start_action = QAction("啟動本機服務", self.menu)
    self.start_action.triggered.connect(self._start_sidecar)
    self.menu.addAction(self.start_action)

    self.stop_action = QAction("停止本機服務", self.menu)
    self.stop_action.triggered.connect(self._stop_sidecar)
    self.menu.addAction(self.stop_action)

    self.settings_action = QAction("開啟設定…", self.menu)
    self.settings_action.triggered.connect(self._open_settings)
    self.menu.addAction(self.settings_action)

    self.web_action = QAction("開啟 Ollie Reader", self.menu)
    self.web_action.triggered.connect(self._open_web)
    self.menu.addAction(self.web_action)

    self.menu.addSeparator()
    self.quit_action = QAction("結束", self.menu)
    self.quit_action.triggered.connect(self._quit)
    self.menu.addAction(self.quit_action)

    self.tray.setContextMenu(self.menu)
    self.tray.setToolTip("ollie-reader desktop")

    self._timer = QTimer(self.app)
    self._timer.timeout.connect(self._refresh)
    self._timer.start(3000)

    self.app.aboutToQuit.connect(self.manager.stop)

  def start(self) -> None:
    self.manager.start()
    self.tray.show()
    self._refresh()

  def _refresh(self) -> None:
    # 本機子行程存活檢查（poll()），零網路；不再每 3 秒打 /api/version。
    ok = self.manager.is_running()
    self.status_action.setText("狀態：● 運行中" if ok else "狀態：○ 已停止")

  def _start_sidecar(self, _checked: bool = False) -> None:
    self.manager.start()
    self._refresh()

  def _stop_sidecar(self, _checked: bool = False) -> None:
    self.manager.stop()
    self._refresh()

  def _open_settings(self, _checked: bool = False) -> None:
    if self.dialog is None:
      self.dialog = SettingsDialog(self.manager)
    self.dialog.show()
    self.dialog.raise_()
    self.dialog.activateWindow()

  def _open_web(self, _checked: bool = False) -> None:
    QDesktopServices.openUrl(QUrl(WEB_APP_URL))

  def _quit(self, _checked: bool = False) -> None:
    self.manager.stop()
    self.app.quit()


def run_shell() -> None:
  app = QApplication(sys.argv)
  app.setWindowIcon(_tray_icon())
  app.setQuitOnLastWindowClosed(False)
  tray = TrayApp(app)
  tray.start()

  # Qt 的 C++ event loop 會吞掉 SIGINT，導致終端機按 Ctrl+C 關不掉。
  # 攔截 SIGINT → app.quit()（觸發 aboutToQuit → manager.stop()，收掉 sidecar）；
  # 再加一個短週期 timer 讓 Python 直譯器定期醒來，signal 才有機會被處理。
  signal.signal(signal.SIGINT, lambda *_: app.quit())
  sigint_timer = QTimer(app)
  sigint_timer.timeout.connect(lambda: None)
  sigint_timer.start(200)

  sys.exit(app.exec())
