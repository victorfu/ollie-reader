"""PySide6 殼：系統匣 icon + 設定視窗，監督本機 sidecar。"""

import os
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
  QLineEdit,
  QMenu,
  QPushButton,
  QSystemTrayIcon,
)

from server.config import DEFAULT_PORT, VERSION
from server.oikid_secrets import (
  clear_oikid_credentials,
  get_oikid_credentials,
  set_oikid_credentials,
)
from shell import autostart
from shell.sidecar import SidecarManager
from shell.single_instance import SingleInstance

DEV_WEB_APP_URL = "http://localhost:5173"
PROD_WEB_APP_URL = "https://ollie-reader.web.app"


def _web_app_url() -> str:
  """托盤「開啟 Ollie Reader」要打開的網址。

  dev（從原始碼跑）→ Vite 開發伺服器；production（凍結後）→ 已部署的網站。
  可用環境變數 OLLIE_WEB_APP_URL 覆寫。
  """
  override = os.getenv("OLLIE_WEB_APP_URL")
  if override:
    return override
  if getattr(sys, "frozen", False):
    return PROD_WEB_APP_URL
  return DEV_WEB_APP_URL


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
    # 預設視窗寬一點，讓 OIKID 帳號（email）等欄位能完整顯示不被截斷。
    self.setMinimumWidth(480)

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

    creds = get_oikid_credentials()
    self.oikid_user_edit = QLineEdit(creds[0] if creds else "")
    self.oikid_user_edit.setMinimumWidth(280)
    self.oikid_pw_edit = QLineEdit()
    self.oikid_pw_edit.setEchoMode(QLineEdit.EchoMode.Password)
    self.oikid_pw_edit.setMinimumWidth(280)
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

  def _save_oikid_credentials(self, _checked: bool = False) -> None:
    username = self.oikid_user_edit.text().strip()
    password = self.oikid_pw_edit.text()
    if not username or not password:
      self.oikid_status_label.setText("請輸入 OIKID 帳號與密碼")
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

    self.version_action = QAction(f"Ollie Reader v{VERSION}", self.menu)
    self.version_action.setEnabled(False)
    self.menu.addAction(self.version_action)

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
    self.tray.setToolTip(f"ollie-reader desktop v{VERSION}")

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
    QDesktopServices.openUrl(QUrl(_web_app_url()))

  def _quit(self, _checked: bool = False) -> None:
    self.manager.stop()
    self.app.quit()


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
