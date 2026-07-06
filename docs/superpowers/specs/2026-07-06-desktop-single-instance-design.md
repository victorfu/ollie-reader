# Desktop 防重複行程實例(Single Instance)設計

**日期**:2026-07-06
**範圍**:`desktop/`(PySide6 tray 殼 + FastAPI sidecar)

## 問題

desktop app 有兩層行程,重複啟動的問題在兩層都會發生:

1. **Tray 殼(GUI)**:重複啟動 app 會出現兩個 tray icon,各自嘗試 spawn sidecar。
2. **Sidecar(`--serve`)**:開機自啟的 LaunchAgent 已在跑 sidecar 時,使用者再打開
   tray app,`SidecarManager.start()` 會再 spawn 一個 `--serve`;第二個 uvicorn 綁
   不到 port 8765 秒死,tray 顯示「已停止」——明明有一個好的 sidecar 在跑,只是
   不是它生的,而且 tray 完全無法管理它。

## 決策

- **兩層都做**防重複。
- 第二個 tray 實例的行為:**喊醒舊實例(打開設定視窗)後退出**。
- 實作方案:**Qt 原生 shell 鎖 + PID 檔協調 sidecar**(零新依賴)。
  - 否決「純 flock 靜默退出」:做不到喊醒舊實例的 UX。
  - 否決「HTTP shutdown endpoint」:擴大 HTTP 攻擊面(任何本機行程、瀏覽器頁面
    都可能觸發 shutdown),且週期性 HTTP polling 與既有的零網路 liveness 決策衝突。

## 架構總覽

新增兩個模組,修改三個檔案:

| 檔案 | 動作 | 職責 |
|------|------|------|
| `desktop/shell/single_instance.py` | 新增 | tray 殼 single-instance 鎖與喚醒通道 |
| `desktop/server/instance.py` | 新增 | sidecar PID 檔工具(serve 端寫、shell 端讀) |
| `desktop/main.py` | 修改 | `--serve` 前置檢查 + PID 檔生命週期 |
| `desktop/shell/sidecar.py` | 修改 | 收養(adopt)既有 sidecar |
| `desktop/shell/app.py` | 修改 | `run_shell()` 掛上 single-instance |

`server/instance.py` 放在 server 側是因為 `--serve` 模式不 import `shell/`,而
shell 已有 import `server.config` 的先例,兩邊共用無循環依賴。

## 1. Tray 殼 single-instance(`shell/single_instance.py`)

- `QLockFile` 於 `<tempdir>/ollie-reader-shell.lock`(與現有 sidecar log 同目錄
  慣例)。`QLockFile` 內建 stale-lock 偵測:持鎖行程 crash 後,下一個實例自動清
  掉舊鎖,不會永久鎖死。
- **取鎖成功**:先 `QLocalServer.removeServer(name)` 清 stale socket,再監聽
  local socket 名稱 `"ollie-reader-desktop"`;收到連線且訊息為 `activate` → 呼叫
  activate callback(接 `TrayApp._open_settings`)。
- **取鎖失敗**:以 `QLocalSocket` 連線送 `activate`(timeout 500ms,連不上就放
  棄,不影響退出)→ `sys.exit(0)`。
- 整合位置:`run_shell()` 中,建立 `QApplication` 之後、`TrayApp` 之前。

## 2. Sidecar 去重(`main.py --serve` 路徑)

- 啟動 uvicorn 前探測 `GET http://127.0.0.1:<port>/api/version`(短 timeout):
  回 200 **且 body 帶版本欄位**(確認是自家服務,不是別的程式占用 port)→ log
  「sidecar 已在執行」→ **exit 0**。LaunchAgent `KeepAlive=False`,正常退出不會
  被誤判 crash 或重啟。
- 通過檢查後寫 PID 檔 `<tempdir>/ollie-reader-sidecar-<port>.pid`,結束時清除
  (try/finally;uvicorn 優雅關閉後會重放訊號、預設 handler 終止行程,故以
  `install_signal_cleanup` 在 signal 路徑清檔,try/finally 涵蓋正常 return 與例外)。
  寫入失敗不致命,log 後照常服務。
- port 綁定本身仍是最後防線:極端 race 下第二個 uvicorn 綁不到 port 自行退出。

## 3. SidecarManager 收養機制(`shell/sidecar.py`)

`start()` 順序:

1. 自己的子行程還活著 → return(現狀)。
2. `health_check()` 發現 port 上已有活的自家 sidecar(例如 autostart 啟動的)→
   **收養**:讀 PID 檔記下 `_adopted_pid`,不 spawn。`health_check()` 需從「只看
   status 200」擴充為「200 且 JSON body 帶 `version` 欄位」,serve 前置檢查
   (§2)與收養共用同一驗證邏輯。
3. 否則照現狀 spawn。

- `is_running()`:自己生的 → `poll()`(現狀);收養的 → `os.kill(pid, 0)` 檢查
  存活(**零網路**,維持先前移除週期性 HTTP polling 的決策);收養但無有效 PID
  (僅「舊版 sidecar 還在跑」的過渡期會發生)→ 退回 `health_check()`。
- `stop()`:自己生的 → terminate/kill(現狀);收養的 → `os.kill(pid, SIGTERM)`,
  最多等 5 秒,仍活著就 SIGKILL;無 PID 的收養實例無法停止 → 清除收養狀態並記 log。

此機制順帶修掉現有 bug:autostart 的 sidecar 在跑時打開 tray,不再出現
「spawn 失敗 → 顯示已停止」的假狀態。

## 4. 錯誤處理與邊界

- **Stale PID 檔**(sidecar crash 沒清):收養前必先 health_check;PID 只做後續
  存活檢查。`os.kill(pid, 0)` 拋 `ProcessLookupError` → 已停止;`PermissionError`
  → 存活。
- **port 被外部程式占用**:version 回應驗證不過 → 不收養、照常 spawn(spawn 的
  uvicorn 綁不到 port 會死,狀態顯示已停止——與現狀相同,不惡化)。
- **平台**:app 只發佈 macOS arm64,POSIX 語意即可;現有 Windows 相容碼
  (`CREATE_NO_WINDOW`)不動。

## 5. 測試計畫(pytest,沿用現有 monkeypatch 風格)

- `server/instance.py`:PID 檔寫/讀/清 roundtrip、壞內容容錯、`pid_alive` 各分支。
- `shell/sidecar.py`:health_check OK → 不 spawn 且收養;收養後 `is_running` 走
  `os.kill`;收養後 `stop` 送 SIGTERM(逾時 → SIGKILL);health_check 失敗 → 照常
  spawn;現有測試不變。
- `main.py` serve guard:已有活 sidecar → 不呼叫 `uvicorn.run` 直接退出。
- `single_instance.py`:兩個 `QLockFile` 搶同一檔 → 第二個失敗;notify/activate
  以 QLocalServer 實測;若現有測試無 Qt event loop 基礎,把邏輯拆薄、以可注入的
  方式測。
