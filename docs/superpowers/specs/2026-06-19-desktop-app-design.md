# Desktop App 設計：本機 sidecar + PySide6 殼（v1）

> 狀態：草案，待 review
> 日期：2026-06-19
> 程式碼位置：**`ollie-reader` repo**（不是 purism-ev-bot）
> 範圍（v1）：把 **pdf 提取 + TTS（Piper + Kokoro）** 做成 macOS 桌面服務，供 web app（ollie-reader）使用。
> **OIKID / booking、GCS 不在 v1，維持走原本的 Cloud Run backend（purism-ev-bot）。**

---

## 1. 背景與目標

`ollie-reader`（瀏覽器 React/Vite）的線上功能打 `purism-ev-bot`（Cloud Run 上的 FastAPI）。痛點：

- **TTS 成本與品質**：Kokoro 需要 torch，太重，prod 不跑 → `/api/ktts` 在雲端回 503，只能用 Piper。
- **雲端運算成本**：PDF 提取、TTS 合成都在 Cloud Run 上跑。

**目標**：把重運算（PDF、TTS，含 Kokoro）搬到使用者的 Mac 上：

1. **省成本** — 本機跑 TTS/PDF，不耗 Cloud Run；Kokoro 帶完整 torch，本機不再 503。
2. **加速 web app** — 重運算外包到使用者機器。

**形態**：背景本機服務 + 設定視窗 + 系統匣（menubar）icon。**不是**對外發佈的產品。macOS 優先。

---

## 2. 鎖定的決策

| 主題 | 決策 | 理由 |
|---|---|---|
| 程式碼位置 | 放 **`ollie-reader/desktop/`**（monorepo：TS + Python） | 使用者指定；桌面 app 是 reader 的本機伴隨服務 |
| sidecar 來源 | **自包含**：在 ollie-reader 內自行實作 pdf/tts/ktts，**複製** purism-ev-bot 的 engine wrapper | 與 purism-ev-bot 解耦（OIKID 還在那）；表面積小、引擎穩定 |
| 運算來源 | desktop 當**本機服務**，web app 連得到用本機、連不到 fallback 雲端 | 同時滿足省成本 + 加速 |
| 傳輸 | **v1 用 REST**（與雲端同協定）；WebSocket 留 v2 | web app 幾乎不用改、單一 fallback 路徑、PDF 上傳/audio 回傳最自然（見 §10） |
| TTS 引擎 | **v1 就含 Piper + Kokoro**，直接內建 torch+Kokoro（~2-3GB） | 使用者指定；自用體積可接受 |
| OIKID / booking | **v1 不含**，維持走 Cloud Run（purism-ev-bot） | 使用者指定；它是網路 I/O 非重運算 |
| 殼技術 | **PySide6**（LGPL）：系統匣 icon + 設定視窗 | 全 Python；排除 Tauri（需 Rust）；用 PySide6 不用 PyQt(GPL) |
| UI 邊界 | React reader **留瀏覽器**；**不碰 QtWebEngine** | 嵌 web UI 該用 Tauri/Electron，Qt 內嵌 Chromium 又肥又痛 |
| 探測 port | 固定 `8765`（被佔則換候選並由殼告知） | 簡單、好探測 |

---

## 3. 範圍

**v1 納入**：本機 `/api/version`(健康檢查)、`/api/pdf/extract`、`/api/tts`（Piper）、`/api/ktts`（Kokoro）。

**v1 排除**：OIKID / booking-records、`/api/fetch-url`、GCS、translate、LINE/Slack/1NCE —— 全部維持走 Cloud Run（purism-ev-bot）+ Firebase，不動。

---

## 4. 架構總覽

```
                   ┌──────────────────────────────┐
                   │     Web app (ollie-reader)    │
                   │      瀏覽器 React / Vite       │
                   └───────────────┬───────────────┘
              pdf/tts/ktts          │           booking/oikid/translate…
            ┌──────────────────────┤            └─────────────┐
            │ 探測 127.0.0.1:8765   │                          │ 一律走雲端
       通 ✓ │           ✗ 不通 fallback                        │
            ▼                       ▼                          ▼
 ┌───────────────────────────┐  ┌──────────────────────────────────────────┐
 │ 本機 sidecar (127.0.0.1)   │  │            Cloud Run（purism-ev-bot）       │
 │ ollie-reader/desktop       │  │            FastAPI 完整版                   │
 │ 自包含 FastAPI (REST)      │  │  • /api/pdf/extract   • /api/tts (Piper)    │
 │ • /api/version             │  │  • /api/ktts → 503（無 torch）              │
 │ • /api/pdf/extract         │  │  • /api/oikid/booking-records (Firebase)    │
 │ • /api/tts   (Piper)       │  │  • /api/fetch-url、translate、gcs …         │
 │ • /api/ktts  (Kokoro+torch)│  └──────────────────────────────────────────┘
 └─────────────▲─────────────┘
               │ spawn / 監控 / 健康檢查
 ┌─────────────┴─────────────┐
 │  PySide6 殼（純 Python）   │
 │  • 系統匣 icon：啟停/狀態  │
 │  • 設定視窗（QDialog）     │
 │  • 開機自啟（LaunchAgent） │
 └───────────────────────────┘
```

**核心洞察**：web app 對 pdf/tts/ktts 採「localhost 優先、雲端 fallback」;其餘(OIKID/translate/gcs)永遠走雲端。本機 sidecar 因為跑在使用者機器上，Kokoro 可帶完整 torch，不再 503、不花雲端錢。

---

## 5. 元件設計

### 5.1 本機 sidecar — `ollie-reader/desktop/server/`

自包含的小型 FastAPI(REST)，只做三件事 + 健康檢查。

```python
# desktop/server/app.py（草圖）
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="ollie-reader local sidecar")
app.add_middleware(
    CORSMiddleware,
    allow_origins=LOCAL_CORS_ORIGINS,   # web prod origin + http://localhost:5173 + 127.0.0.1:5173
    allow_methods=["*"], allow_headers=["*"],
)
# /api/version, /api/pdf/extract, /api/tts, /api/ktts
```

- **合約必須與雲端一致**：`/api/tts`、`/api/ktts` 收 `SpeechRequest {text, speed, voice?}`;`/api/pdf/extract` 收 multipart file、回 `ExtractResponse {pages:[{page_number, text}]}`。如此 web app 不論打本機或雲端都同一套程式碼。
- **engine wrapper 從 purism-ev-bot 複製精簡**：`tts_piper.py`（Piper）、`tts_kokoro.py`（Kokoro，guarded import：缺 torch 回 503）、`pdf_extract.py`（PyMuPDF）。
- **CORS 嚴格鎖** web app origin（prod + localhost dev），不開放任意網站。
- 只綁 `127.0.0.1`，不綁 `0.0.0.0`。
- 啟動：dev `uvicorn server.app:app --port 8765`；打包後由殼以 `--serve` 子命令啟動（見 5.3）。

### 5.2 PySide6 殼 — `ollie-reader/desktop/shell/`

- `QApplication` + `QSystemTrayIcon`，選單：**狀態**(running/stopped + port)、**啟動/停止**、**開啟設定…**、**開啟 web app**、**結束**。
- **設定視窗(`QDialog`)**：port、開機自啟開關、sidecar 啟停與狀態、Kokoro 狀態(已載入/載入失敗)、log 檢視。（v1 無 OIKID，故設定視窗**不含**帳密欄位。）
- **Sidecar 生命週期**：以 `subprocess` 啟 `self --serve`(同一可執行檔、不同子命令，避免兩個 binary);定時打 `/api/version` 健康檢查;崩潰自動重啟;匣 icon 顏色表狀態;結束時 terminate 子行程。
- **開機自啟**：寫 LaunchAgent plist 到 `~/Library/LaunchAgents`，由開關安裝/移除。**預設關**，使用者於設定視窗開啟。
- **單一實例**：避免重複啟動(檔案鎖或 port 偵測)。

### 5.3 打包 — PyInstaller

- 一個可執行檔，雙模式：無旗標 → PySide6 殼;`--serve` → 跑 uvicorn(`server.app:app`)。殼以子行程啟 sidecar。
- **子行程模式(非 in-process)**：uvicorn 放子行程而非 Qt 事件迴圈同行程，換得隔離、可獨立重啟、崩潰不拖垮殼。
- **v1 直接內建 torch + Kokoro + 模型**(~2-3GB)。自用體積可接受;移除「按需下載」的最大打包風險。
- PyInstaller + PySide6 widgets 成熟;**唯一會痛的是 QtWebEngine — 不用它**。專案早期先打一次包驗證 plugin 沒漏。

### 5.4 Web app resolver — `ollie-reader/src/`

- 新增 `resolveApiBase()`：載入時對 `http://127.0.0.1:8765/api/version` 發短 timeout(~300ms)fetch。通 → pdf/tts/ktts 的 base 指向本機;不通 → 用 `VITE_API_BASE_URL`(雲端)。結果快取，失敗時重探。
- 走本機的端點：`/api/pdf/extract`、`/api/tts`、`/api/ktts`(+ `/api/version` 探測)。OIKID/translate/gcs **永遠走雲端**。
- 既有 `TTS_ENGINE_URL` map 只需換 base，其餘幾乎不動(合約已統一)。
- **Kokoro 未就緒**：若本機 `/api/ktts` 回 503，前端提示「請確認 desktop app 已啟動 / Kokoro 已載入」或退回 Piper(雲端 ktts 同為 503，不對 Kokoro 做雲端 fallback)。
- **混合內容 / 本機網路存取(關鍵假設，需實測 — 見 §9)**：Chrome/Edge 允許 https 頁面打 `http://127.0.0.1`(localhost secure-context 豁免);但 **Safari 較嚴**、且 Chrome 的 **PNA** 可能要求 preflight + 本機回 `Access-Control-Allow-Private-Network: true`。**P1 必須先用目標瀏覽器實測。**

---

## 6. 資料流(範例：TTS)

1. web app 載入 → resolver 探測本機 → 命中 → base = `http://127.0.0.1:8765`。
2. 使用者觸發朗讀 → POST `{text, speed, voice}` 到本機 `/api/ktts`。
3. sidecar 用 Kokoro(完整 torch)合成 → 回 WAV → 瀏覽器播放。**Cloud Run 沒被碰 → 省成本。**
4. desktop 沒開 → resolver 探測失敗 → 打 Cloud Run(Piper) → 功能不中斷，只是沒 Kokoro。
5. booking/翻譯等 → 一律直接打 Cloud Run，與 desktop 無關。

---

## 7. 建置順序

| 階段 | 內容 | 產出價值 |
|---|---|---|
| **P0** | `desktop/server/`：自包含 FastAPI(pdf/tts/ktts/version)+ 複製 engine wrapper + CORS;手動 `uvicorn` 驗證 Kokoro 本機可跑 | 本機能跑 Kokoro，驗證可行性 |
| **P1** | ollie-reader `resolveApiBase()`(localhost 優先/雲端 fallback)+ Kokoro-503 前端處理;**先用目標瀏覽器實測 localhost 連線** | **立刻拿到省成本 + Kokoro 可用**，還不用打包 |
| **P2** | PyInstaller 打包(`--serve` 子命令，內建 torch+Kokoro) | 可執行的本機服務 |
| **P3** | PySide6 殼：系統匣 icon + 設定視窗 + 健康檢查/重啟 + 開機自啟 | 真正成為「desktop app」 |

P0+P1 即可驗證整個價值假設，不必等打包。

---

## 8. 未來(v1 之外)

- **WebSocket 傳輸**：見 §10。若日後要串流首字延遲/進度/取消，再把傳輸升級成 WS。
- **OIKID 本地化**：若哪天要連 OIKID 也本機化，再把 booking + fetch-url 代理搬進 sidecar，OIKID 帳密存 macOS Keychain。**目前明確不做。**
- **按需下載 Kokoro**：只有要對外發佈、在意體積時才需要。

---

## 9. 風險與緩解

| 風險 | 緩解 |
|---|---|
| **瀏覽器擋 https→localhost**(Safari mixed-content / Chrome PNA) | **P1 先用目標瀏覽器實測**;備案：本機回 PNA header、發本機 TLS 憑證、引導用 Chrome、或讓 web app 也從 localhost 提供 |
| Qt 事件迴圈 vs uvicorn | 用**子行程**跑 sidecar(非 in-process)，隔離、可重啟 |
| torch/Kokoro 體積(~2-3GB) | 自用接受;只有日後發佈才需「按需下載」 |
| engine wrapper 與 purism-ev-bot 重複、走鐘 | 表面積小、引擎穩定;以「合約一致」測試把關(本機與雲端同一組 request/response 測試) |
| localhost 被任意網站探測 | CORS 嚴鎖 origin;必要時加本機 token(殼產生、塞給 web app) |
| 固定 port 衝突 | 預設 `8765`;偵測佔用換候選 port，web app 探測多個候選 |
| PyInstaller + PySide6 plugin 漏包 | 專案早期先打一次包驗證;避開 QtWebEngine |
| Python 進 ollie-reader 影響前端工具鏈 | `desktop/` 不納入 tsconfig/eslint(本就只掃 `src/`);Python 產物加進 `.gitignore` |
| macOS Gatekeeper 擋未簽章 app | 自用以 ad-hoc 簽章或系統設定放行;發佈才需 Apple 憑證 + notarization |

---

## 10. 附錄：REST vs WebSocket(已決定 v1 用 REST)

WS **不會**繞過 localhost 風險(`ws://127.0.0.1` 一樣算 mixed content、吃同一套豁免、PNA 也涵蓋 WS handshake);WS 唯一省到的是沒有 CORS preflight。

| 面向 | REST(v1 採用) | 全 WebSocket(v2 選項) |
|---|---|---|
| web app 改動 | 幾乎不用改，換 base URL | 要寫 WS client 層(重連、request-id 對應、binary 組裝) |
| liveness | REST `/version` 輪詢 | 連上=活著、自動重連 |
| audio/PDF payload | 原生 multipart 上傳 / blob 回傳 | base64-in-JSON(+33%)或 binary frame + 封包協定 |
| 串流/進度/取消 | 不行(整包回) | 可串流(Kokoro 邊合成邊送)、可進度、可取消 |
| 雲端 fallback | 本機 + 雲端**同一條 REST 路徑** | 本機 WS / 雲端 REST → 雙路徑，或得做雲端 WS 遷移 |

**結論**：v1 REST(簡單、單一 fallback 路徑);WS 的串流/進度屬 v2 polish，屆時再升級。

---

## 11. 程式碼落點

```
ollie-reader/
├── src/                          # React/Vite（既有）
│   └── services/localBackend.ts  # 新：resolveApiBase()（localhost 優先/雲端 fallback）
├── desktop/                      # 新：Python（不納入 TS 工具鏈）
│   ├── server/                   # 自包含 FastAPI sidecar
│   │   ├── app.py                # FastAPI + CORS + 路由
│   │   ├── tts_piper.py          # 複製自 purism-ev-bot tts_service
│   │   ├── tts_kokoro.py         # 複製自 kokoro_service（guarded import）
│   │   └── pdf_extract.py        # PyMuPDF
│   ├── shell/                    # PySide6
│   │   ├── app.py                # QApplication / 系統匣 / 設定視窗
│   │   └── sidecar.py            # 子行程啟停 + 健康檢查
│   ├── ollie-reader-desktop.spec # PyInstaller
│   ├── requirements.txt          # fastapi, uvicorn, pymupdf, piper-tts, kokoro, torch, PySide6, pyinstaller
│   └── README.md
```

---

## 12. 待決問題

- 固定 port `8765` 被佔時的候選清單 — P2/P3 再定具體值。
- 其餘皆已鎖定。
