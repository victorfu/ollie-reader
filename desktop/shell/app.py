"""PySide6 殼：系統匣 icon + 設定視窗（一般 / 語音測試），監督本機 sidecar。"""

import os
import signal
import sys
import tempfile
from pathlib import Path

import httpx
from PySide6.QtCore import QObject, QRunnable, Qt, QThreadPool, QTimer, QUrl, Signal
from PySide6.QtGui import QAction, QDesktopServices, QIcon
from PySide6.QtMultimedia import QAudioOutput, QMediaPlayer
from PySide6.QtWidgets import (
  QApplication,
  QCheckBox,
  QComboBox,
  QDialog,
  QDoubleSpinBox,
  QFormLayout,
  QLabel,
  QLineEdit,
  QMenu,
  QPushButton,
  QSystemTrayIcon,
  QTabWidget,
  QVBoxLayout,
  QWidget,
)

from server.config import DEFAULT_PORT, HOST, VERSION
from server.oikid_secrets import (
  clear_oikid_credentials,
  get_oikid_credentials,
  set_oikid_credentials,
)
from server.tts_secrets import (
  DEFAULT_AZURE_REGION,
  clear_azure_credentials,
  get_azure_credentials,
  set_azure_credentials,
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


# (id, 顯示名稱, sidecar 端點)。離線/雲端要標清楚 —— edge/azure 住在「本機
# sidecar」裡但其實是網路引擎，不標的話 compute-mode「本機」的語意會被誤解。
TTS_ENGINES = [
  ("edge", "Edge TTS（雲端・免金鑰）", "/api/etts"),
  ("azure", "Azure AI Speech（雲端・需金鑰）", "/api/azure-tts"),
  ("piper", "Piper（離線）", "/api/tts"),
  ("kokoro", "Kokoro（離線）", "/api/ktts"),
]

SAMPLE_TEXT = "she got stung by a bee"


class _TaskSignals(QObject):
  done = Signal(object, object)  # (result, error)


class _Task(QRunnable):
  """把阻塞的 HTTP 呼叫丟到執行緒池，避免試聽時凍住視窗。"""

  def __init__(self, fn):
    super().__init__()
    self.fn = fn
    self.signals = _TaskSignals()

  def run(self) -> None:
    try:
      self.signals.done.emit(self.fn(), None)
    except Exception as e:  # noqa: BLE001 - 一律回報到 UI，不讓執行緒吞掉
      self.signals.done.emit(None, e)


class VoiceLabTab(QWidget):
  """試聽各 TTS 引擎的聲音。走 sidecar HTTP，測到的就是網頁端會用的同一條路。"""

  def __init__(self, manager: SidecarManager):
    super().__init__()
    self.manager = manager
    self.pool = QThreadPool.globalInstance()
    self._audio_path: Path | None = None

    self._player = QMediaPlayer(self)
    self._audio_out = QAudioOutput(self)
    self._player.setAudioOutput(self._audio_out)

    layout = QFormLayout(self)

    self.engine_combo = QComboBox()
    for engine_id, label, _path in TTS_ENGINES:
      self.engine_combo.addItem(label, engine_id)
    self.engine_combo.currentIndexChanged.connect(self._on_engine_changed)
    layout.addRow("引擎：", self.engine_combo)

    self.voice_combo = QComboBox()
    self.voice_combo.setMinimumWidth(320)
    layout.addRow("聲音：", self.voice_combo)

    self.en_only_cb = QCheckBox("只列英文聲音")
    self.en_only_cb.setChecked(True)
    self.en_only_cb.toggled.connect(lambda _checked: self._reload_voices())
    self.reload_button = QPushButton("重新載入聲音清單")
    self.reload_button.clicked.connect(lambda _checked=False: self._reload_voices())
    layout.addRow(self.en_only_cb, self.reload_button)

    self.text_edit = QLineEdit(SAMPLE_TEXT)
    self.text_edit.setMinimumWidth(320)
    self.text_edit.returnPressed.connect(self._audition)
    layout.addRow("試聽文字：", self.text_edit)

    self.speed_spin = QDoubleSpinBox()
    self.speed_spin.setRange(0.5, 2.0)
    self.speed_spin.setSingleStep(0.05)
    self.speed_spin.setValue(1.0)
    layout.addRow("語速：", self.speed_spin)

    self.play_button = QPushButton("▶ 試聽")
    self.play_button.clicked.connect(self._audition)
    layout.addRow("", self.play_button)

    self.status_label = QLabel("選好引擎與聲音後按「試聽」。")
    self.status_label.setWordWrap(True)
    layout.addRow("", self.status_label)

    # ── Azure 金鑰（存 OS keychain，不落檔、不進 bundle）
    creds = get_azure_credentials()
    self.azure_key_edit = QLineEdit()
    self.azure_key_edit.setEchoMode(QLineEdit.EchoMode.Password)
    self.azure_key_edit.setMinimumWidth(320)
    if creds:
      self.azure_key_edit.setPlaceholderText("（已設定，留空則不變更）")
    self.azure_region_edit = QLineEdit(creds[1] if creds else DEFAULT_AZURE_REGION)
    layout.addRow(QLabel("<b>Azure 金鑰</b>（僅 Azure 引擎需要）"))
    layout.addRow("Key：", self.azure_key_edit)
    layout.addRow("Region：", self.azure_region_edit)

    self.azure_save_button = QPushButton("儲存 Azure 金鑰")
    self.azure_save_button.clicked.connect(self._save_azure_credentials)
    self.azure_clear_button = QPushButton("清除 Azure 金鑰")
    self.azure_clear_button.clicked.connect(self._clear_azure_credentials)
    layout.addRow(self.azure_save_button, self.azure_clear_button)

    self._reload_voices()

  # ── helpers

  def _engine_id(self) -> str:
    return self.engine_combo.currentData()

  def _endpoint(self, engine_id: str) -> str:
    for candidate, _label, path in TTS_ENGINES:
      if candidate == engine_id:
        return path
    return "/api/tts"

  def _base_url(self) -> str:
    return f"http://{HOST}:{self.manager.port}"

  def _set_busy(self, busy: bool) -> None:
    self.play_button.setEnabled(not busy)
    self.reload_button.setEnabled(not busy)

  @staticmethod
  def _describe(error: Exception) -> str:
    if isinstance(error, httpx.HTTPStatusError):
      try:
        detail = error.response.json().get("detail") or error.response.text
      except Exception:  # noqa: BLE001 - 非 JSON 回應就用原始內容
        detail = error.response.text
      return f"HTTP {error.response.status_code}：{detail}"
    if isinstance(error, httpx.ConnectError):
      return "連不上本機服務。請先在「一般」頁按「啟動本機服務」。"
    return f"{type(error).__name__}: {error}"

  # ── 聲音清單

  def _on_engine_changed(self, _index: int) -> None:
    self._reload_voices()

  def _reload_voices(self) -> None:
    engine_id = self._engine_id()
    locale = "en" if self.en_only_cb.isChecked() else ""
    url = f"{self._base_url()}/api/tts/voices"

    def fetch():
      resp = httpx.get(
        url, params={"engine": engine_id, "locale": locale}, timeout=30.0
      )
      resp.raise_for_status()
      return resp.json().get("voices", [])

    self._set_busy(True)
    self.status_label.setText("載入聲音清單…")
    task = _Task(fetch)
    task.signals.done.connect(self._on_voices_loaded)
    self.pool.start(task)

  def _on_voices_loaded(self, voices, error) -> None:
    self._set_busy(False)
    self.voice_combo.clear()
    if error is not None:
      self.voice_combo.addItem("（預設）", "")
      self.status_label.setText(f"聲音清單載入失敗 — {self._describe(error)}")
      return
    if not voices:
      self.voice_combo.addItem("（預設）", "")
      self.status_label.setText("此引擎沒有可選聲音，將使用預設。")
      return
    for voice in voices:
      self.voice_combo.addItem(voice.get("label") or voice["id"], voice["id"])
    self.status_label.setText(f"載入 {len(voices)} 個聲音。")

  # ── 試聽

  def _audition(self) -> None:
    text = self.text_edit.text().strip()
    if not text:
      self.status_label.setText("請先輸入試聽文字。")
      return

    engine_id = self._engine_id()
    url = f"{self._base_url()}{self._endpoint(engine_id)}"
    payload = {
      "text": text,
      "speed": self.speed_spin.value(),
      "voice": self.voice_combo.currentData() or None,
    }

    def synthesize():
      resp = httpx.post(url, json=payload, timeout=120.0)
      resp.raise_for_status()
      return resp.content, resp.headers.get("content-type", "audio/wav")

    self._set_busy(True)
    self.status_label.setText(f"合成中（{engine_id}）…")
    task = _Task(synthesize)
    task.signals.done.connect(self._on_audio_ready)
    self.pool.start(task)

  def _on_audio_ready(self, result, error) -> None:
    self._set_busy(False)
    if error is not None:
      self.status_label.setText(f"試聽失敗 — {self._describe(error)}")
      return

    audio, content_type = result
    suffix = ".mp3" if "mpeg" in content_type or "mp3" in content_type else ".wav"

    # QMediaPlayer 需要檔案在播放期間存在；換新音檔時才清掉上一個
    self._player.stop()
    self._player.setSource(QUrl())
    if self._audio_path is not None:
      self._audio_path.unlink(missing_ok=True)
    with tempfile.NamedTemporaryFile(
      delete=False, suffix=suffix, prefix="ollie-tts-"
    ) as fh:
      fh.write(audio)
      self._audio_path = Path(fh.name)

    self._player.setSource(QUrl.fromLocalFile(str(self._audio_path)))
    self._player.play()
    self.status_label.setText(
      f"播放中：{len(audio) / 1024:.1f} KB {suffix.lstrip('.').upper()}"
    )

  # ── Azure 金鑰

  def _save_azure_credentials(self, _checked: bool = False) -> None:
    key = self.azure_key_edit.text().strip()
    region = self.azure_region_edit.text().strip() or DEFAULT_AZURE_REGION
    if not key:
      existing = get_azure_credentials()
      if not existing:
        self.status_label.setText("請輸入 Azure key。")
        return
      key = existing[0]  # 只改 region，沿用既有 key
    set_azure_credentials(key, region)
    self.azure_key_edit.clear()
    self.azure_key_edit.setPlaceholderText("（已設定，留空則不變更）")
    self.status_label.setText(f"Azure 金鑰已儲存（region={region}）。")

  def _clear_azure_credentials(self, _checked: bool = False) -> None:
    clear_azure_credentials()
    self.azure_key_edit.clear()
    self.azure_key_edit.setPlaceholderText("")
    self.status_label.setText("Azure 金鑰已清除。")

  def cleanup(self) -> None:
    self._player.stop()
    self._player.setSource(QUrl())
    if self._audio_path is not None:
      self._audio_path.unlink(missing_ok=True)
      self._audio_path = None


class SettingsDialog(QDialog):
  def __init__(self, manager: SidecarManager):
    super().__init__()
    self.manager = manager
    self.setWindowTitle("ollie-reader desktop 設定")
    # 預設視窗寬一點，讓 OIKID 帳號（email）等欄位能完整顯示不被截斷。
    self.setMinimumWidth(560)

    self.tabs = QTabWidget(self)
    self.tabs.addTab(self._build_general_tab(), "一般")
    self.voice_lab = VoiceLabTab(manager)
    self.tabs.addTab(self.voice_lab, "語音測試")

    root = QVBoxLayout(self)
    root.addWidget(self.tabs)

    self._timer = QTimer(self)
    self._timer.timeout.connect(self._refresh)
    self._timer.start(2000)
    self._refresh()

  def closeEvent(self, event) -> None:  # noqa: N802 - Qt 命名
    self.voice_lab.cleanup()
    super().closeEvent(event)

  def _build_general_tab(self) -> QWidget:
    page = QWidget()
    layout = QFormLayout(page)

    self.status_label = QLabel("—")
    layout.addRow("狀態：", self.status_label)
    layout.addRow("Port：", QLabel(str(self.manager.port)))

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

    return page

  def _refresh(self) -> None:
    # 本機存活檢查零網路（自家子行程 poll()/收養後 os.kill）；僅「收養但無 PID」的舊版過渡情境會退回 HTTP 探測。
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
    # 本機存活檢查零網路（自家子行程 poll()/收養後 os.kill）；僅「收養但無 PID」的舊版過渡情境會退回 HTTP 探測。
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
