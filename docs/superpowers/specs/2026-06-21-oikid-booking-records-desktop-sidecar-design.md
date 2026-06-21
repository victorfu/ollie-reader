# OIKID booking-records 移植到 desktop sidecar 設計

> 狀態：草案,待 review
> 日期：2026-06-21
> 程式碼位置:**`ollie-reader` repo** —— desktop sidecar(`desktop/server/`)、desktop shell(`desktop/shell/`)、web 前端(`src/`)。**cloud(`purism-ev-bot`)不調整。**
> 範圍:把 `GET /api/oikid/booking-records` 以 hybrid 模式移植到本機 sidecar:桌面開著走本機(用本機 keychain 的 OIKID 帳密、免 Firebase auth),沒開走雲端(現狀)。

---

## 1. 背景與目標

雲端 `GET /api/oikid/booking-records`(`purism-ev-bot/routes/oikid.py` + `services/oikid_service.py`)做兩件事:

1. **Firebase auth**(`Depends(verify_firebase_token)`)—— 僅用來驗證「呼叫雲端後端的人是合法使用者」,**與 OIKID 無關**。
2. **OIKID 登入 + 抓資料**:`initialize_session()` 用 `OIKID_USERNAME`/`OIKID_PASSWORD`(server env)對 `oikid.com` 做 session 登入(GET 建 cookie → POST 帳密 → 取 `PHPSESSID`/`AWSALB` → 組 Cookie header),`search_booking_records()` POST `BookingRecord&b=Search` 抓 JSON、映射欄位,回傳 `{Token, Data:[{id, Level, ClassVersion, CoursesName, ClassTime, TeacherName, OpenName}, ...]}`。

此 service **自包含**:只依賴 `requests` + OIKID 帳密,無 Firebase / Supabase / 其他雲端相依 → 可移植。

**目標**:在本機 sidecar 提供同合約的 `GET /api/oikid/booking-records`,使「課程預約記錄」在 local/auto 模式走本機;**cloud 端不動**。

**設計原則(沿用既有)**:與 pdf/tts/fetch-url 相同的 compute-mode hybrid;sidecar 與雲端**回傳同合約**。

---

## 2. 鎖定的決策

| 主題 | 決策 | 理由 |
|---|---|---|
| 路由模式 | **hybrid**(compute-mode):本機開著走本機,否則走雲端 | 「server side 不調整」→ 加本機能力、保留雲端;沿用既有模式 |
| desktop 路由 auth | **不要 Firebase auth**(移除 `Depends(verify_firebase_token)`) | sidecar 綁 `127.0.0.1` + CORS 限定,只服務本機單一使用者;Firebase 本來只是擋外部亂打雲端 |
| OIKID 帳密來源 | **OS keychain**(`keyring`),由 desktop shell 設定頁輸入 | 不落碼、不進 git/Firestore;最符合原生桌面 App |
| keychain 儲存格式 | 單一 JSON blob:`keyring.set_password("ollie-reader-oikid", "credentials", json)` | 原子、簡單;username 也算敏感,一起進 keychain |
| HTTP client | **httpx**(已是 desktop runtime 依賴),不新增 `requests` | 與 fetch_url 一致;httpx.Client 同樣有 cookie 處理 |
| 同步/執行 | service 保持同步,路由用 `run_in_threadpool` 呼叫 | 比照 desktop pdf/tts;OIKID 是阻塞式網路 IO |
| 合約 | 與雲端**完全一致**:`{Token, Data:[...]}`,欄位映射相同 | drop-in;前端不需分辨來源 |
| missing creds(桌面開著但未設帳密) | 本機回 **400 明確錯誤**(「OIKID 帳密未設定,請到桌面 App 設定」),**不**自動退雲端 | HTTP 錯誤 ≠ 連線錯誤,`fetchWithComputeBase` 不會誤退;不靜默壞掉、指引使用者 |
| 前端 fetcher | 走 `fetchWithComputeBase(path, init, apiFetch)` | 雲端路徑仍帶 Firebase token;本機 sidecar 忽略它 |

---

## 3. 元件與邊界

### 3.1 `desktop/pyproject.toml`(改依賴)
在 `[project].dependencies` 加 `"keyring"`,`uv sync`。macOS 原生走 Keychain。

### 3.2 `desktop/server/oikid_secrets.py`(新增,keychain 封裝)
純模組,無 FastAPI 相依,可獨立測試。

```python
SERVICE = "ollie-reader-oikid"
KEY = "credentials"

def get_oikid_credentials() -> Optional[tuple[str, str]]:
    """回 (username, password);未設定回 None。"""

def set_oikid_credentials(username: str, password: str) -> None:
    """以 JSON blob 寫入 keychain。"""

def clear_oikid_credentials() -> None:
    """刪除 keychain 內的帳密(設定頁「清除」用)。"""
```
內部用 `keyring.get_password/set_password/delete_password` + `json`。讀到壞 JSON 視為未設定(回 None)。

### 3.3 `desktop/server/oikid.py`(新增,移植 service)
移植自 cloud `services/oikid_service.py`,差異:
- 帳密來源:`get_oikid_credentials()`;`None` → `raise OikidError("OIKID 帳密未設定,請到桌面 App 設定", status_code=400)`。
- HTTP:`httpx.Client`(同步)取代 `requests.Session`;登入流程與 Cookie header 組法**逐步對齊**雲端(GET `login.php` → POST `Student/Login&b=Process` → 取 `PHPSESSID`/`AWSALB`/`AWSALBCORS` → 組 `location=zh-tw; PHPSESSID=...; AWSALB=...; AWSALBCORS=...`)。
- `search_booking_records()` 欄位映射與回傳 `{Token, Data:[...]}` **與雲端逐欄一致**。
- `OikidError(message, status_code)`;網路錯 → 502、登入失敗(無 PHPSESSID)→ 502、帳密缺 → 400。

介面:
```python
class OikidError(Exception): ...   # .message, .status_code
def search_booking_records() -> dict   # 自管 keychain 讀取 + 登入;回 {Token, Data:[...]}
```

### 3.4 `desktop/server/app.py`(新路由)
```python
@app.get("/api/oikid/booking-records", tags=["oikid"])
async def oikid_booking_records():
    try:
        return await run_in_threadpool(search_booking_records)
    except OikidError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message) from e
    except Exception as e:
        logger.exception("OIKID 未預期錯誤")
        raise HTTPException(status_code=500, detail="OIKID 處理失敗") from e
```
**無 Firebase auth。**

### 3.5 `src/constants/api.ts`(前端常數)
```ts
export const OIKID_BOOKING_RECORDS_PATH = "/api/oikid/booking-records";
```
(保留既有 `OIKID_BOOKING_RECORDS_API_URL`,因下方呼叫點改走 path;若改後無其他引用可移除,以 grep 為準。)

### 3.6 `src/hooks/useBookingRecords.ts`(前端呼叫點)
把現有對 `OIKID_BOOKING_RECORDS_API_URL` 的 `apiFetch` 呼叫改為:
```ts
const res = await fetchWithComputeBase(
  OIKID_BOOKING_RECORDS_PATH,
  { signal },
  apiFetch,            // 雲端帶 Firebase token;本機忽略
);
```
回應解析、錯誤處理沿用既有;另針對本機 400(帳密未設)顯示 `detail` 訊息。

### 3.7 `desktop/shell/app.py`(SettingsDialog 擴充)
在既有 `SettingsDialog`(QFormLayout)加:
- `QLineEdit` OIKID 帳號(預填:已設定則帶入 username)。
- `QLineEdit` OIKID 密碼(`setEchoMode(QLineEdit.EchoMode.Password)`,不預填明碼;以 placeholder 表示「已設定」)。
- 「儲存 OIKID 帳密」鈕 → `set_oikid_credentials(user, pw)`;「清除」鈕 → `clear_oikid_credentials()`。
- 儲存後給狀態提示(成功/失敗)。

---

## 4. 資料流(hybrid)

```
useBookingRecords
  → fetchWithComputeBase("/api/oikid/booking-records", { signal }, apiFetch)
      auto: 探測 127.0.0.1:8765/api/version
        可達 → 本機 sidecar oikid（讀 keychain 帳密 → 登入 oikid.com → 抓記錄）
          帳密未設 → 400「請到桌面 App 設定」（前端顯示，不退雲端）
        不可達 → 雲端 oikid（Firebase token + server 帳密）
      local: 一律本機；cloud: 一律雲端
  → {Token, Data:[...]} → 顯示課程預約
```

---

## 5. 錯誤處理與韌性

- **本機帳密未設**:400 + 明確訊息;前端顯示,**不**自動退雲端(見 §2)。
- **OIKID 登入/網路失敗**:502(與雲端一致);前端顯示。
- **sidecar 連不上**(auto):`fetchWithComputeBase` 偵測 TypeError → 自動退雲端(既有行為,直接受惠)。
- **安全**:OIKID 帳密只存 OS keychain;不寫檔、不進 git、不傳雲端;sidecar 綁 loopback。

---

## 6. 測試

- **desktop**(pytest + `httpx.MockTransport`,不打真實網路、不碰真實 keychain):
  - `oikid_secrets`:set→get round-trip(monkeypatch `keyring` 後端為記憶體 dict);壞 JSON → None;clear。
  - `oikid.py`:成功(MockTransport 模擬 login 回 `PHPSESSID` cookie + search 回 JSON)→ 正確映射 `{Token, Data}`;帳密缺 → `OikidError(400)`;無 PHPSESSID → 502;網路錯 → 502。
  - `app.py` 路由:monkeypatch `app_module.search_booking_records`→ 200 合約;`OikidError(400/502)` → 對應狀態碼。
- **web app**:無 test runner → `npm run build` + `npm run lint` + 手動(local 設好帳密跑一次、cloud 跑一次)。
- **shell**:既有 `test_shell_app.py` 模式;SettingsDialog 的 OIKID 儲存/清除以 monkeypatch `set/clear_oikid_credentials` 驗證接線(不彈真窗則用既有測試手法)。

---

## 7. 實作順序(預告,細節留給 plan)

1. desktop:`oikid_secrets.py`(keychain 封裝)+ 測試;`pyproject.toml` 加 `keyring` + `uv sync`。
2. desktop:`oikid.py`(httpx 移植 + 讀 keychain)+ 測試。
3. desktop:`app.py` 加 `/api/oikid/booking-records`(免 Firebase)+ 路由測試。
4. desktop shell:`SettingsDialog` 加 OIKID 帳密欄位 + 儲存/清除接線 + 測試。
5. frontend:`api.ts` 加 path;`useBookingRecords.ts` 改走 `fetchWithComputeBase`(fetcher=apiFetch);build + lint + 手動驗證。
