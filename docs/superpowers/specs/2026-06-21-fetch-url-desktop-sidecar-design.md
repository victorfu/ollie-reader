# fetch-url 端點移植到 desktop sidecar 設計

> 狀態：草案,待 review
> 日期：2026-06-21
> 程式碼位置:**`ollie-reader` repo** —— desktop sidecar(`desktop/server/`)+ web 前端(`src/`)
> 範圍:把雲端後端的 `GET /api/fetch-url` 移植到本機 sidecar,並讓 web app 透過既有的 compute-mode helper(`fetchWithComputeBase`)路由它,使「從 URL 載入 PDF」流程在 local/auto 模式下也能留在本機。

---

## 1. 背景與目標

桌面版提供本機 sidecar(FastAPI `http://127.0.0.1:8765`,`desktop/server/app.py`),目前實作 4 支與雲端同合約的端點:`/api/version`、`/api/pdf/extract`、`/api/tts`(Piper)、`/api/ktts`(Kokoro)。前三支運算端點(pdf/tts/ktts)已透過 `src/services/localBackend.ts` 的 `fetchWithComputeBase()` 做 auto/local/cloud 路由。

雲端後端(`purism-ev-bot`)還有一支 web app 實際在用、但**尚未移植到 desktop** 的運算端點:

- **`GET /api/fetch-url`**(`purism-ev-bot/routes/utility.py` + `services/utility_service.py`):server-side 抓取任意 URL 的內容並回傳 binary + metadata,用途是**繞過瀏覽器 CORS** 載入遠端 PDF。

web app 目前在 `src/contexts/PdfContext.tsx`(約 201–208 行)用**直接 `fetch()` 打雲端**呼叫它,接著把下載到的 PDF 餵給已是 hybrid 的 `/api/pdf/extract`。痛點:在 local 模式下,「URL → 抽取」這條流程是**一半雲端(fetch-url)+ 一半本機(extract)**,不一致;且開了桌面 App 時仍需連雲端才能用 URL 載入。

**目標**:把 fetch-url 以**與雲端相同的合約**移植到 sidecar,並讓前端改走 `fetchWithComputeBase`,使整條 URL→抽取流程在 local/auto 模式下一致地留在本機;雲端模式行為不變。

**不在範圍**(交叉比對 `purism-ev-bot` 全部端點後刻意排除):

- `/storage/*`(Supabase)、`/api/oikid/booking-records` —— 需把外部憑證帶到使用者機器、且資料本質在雲端,**永遠走雲端**。
- `/api/translate` —— web app 實際用 Gemini 直翻(`translateWithAI`/`aiService`),**沒有接後端這支**。api.ts 既有註解「translate 永遠走雲端」是過時敘述,本設計順手修正。
- LINE / Slack / 1NCE webhook 等 —— 伺服器端整合,與 desktop app 無關。

---

## 2. 鎖定的決策

| 主題 | 決策 | 理由 |
|---|---|---|
| 對齊程度 | **完整對齊雲端合約**(query params + response headers + 錯誤碼) | sidecar 哲學是「與雲端同合約」,做 drop-in;backend 函式可直接搬,成本低 |
| 程式碼來源 | 把 backend `services/utility_service.py` 的 **async/httpx 版**(`FetchResult`、`FetchError`、`fetch_url_content_async`)原樣移植,丟掉 `requests` 同步版 | async 版自包含,只依賴 httpx + stdlib;sidecar 全 async |
| HTTP client | desktop 路由呼叫 `fetch_url_content_async(..., client=None)`,函式自建/自關臨時 `httpx.AsyncClient` | sidecar 單機低流量,不需像雲端共用 pooled client;且 `client=None` 時 `follow_redirects`/`max_redirects` 才真正生效(見 §5) |
| 依賴 | `httpx` 從 `dev` 群組移到 runtime `dependencies`(已在 `uv.lock`) | runtime 目前無 HTTP client;httpx 為 FastAPI 生態標準選擇 |
| 前端路由 | 改走 `fetchWithComputeBase(path, { signal })`,path 為 `/api/fetch-url?...`(query string 併入),預設 fetcher 為 `fetch`(免 auth) | 與 pdf/tts 相同模式 |
| 前端錯誤處理 | **保留現有 status-code switch 不動**(400/404/408/429/500) | desktop 路由回傳相同錯誤碼,既有 UX 訊息續用 |
| 安全 | 不額外加防護,僅記註記 | sidecar 綁 `127.0.0.1` + CORS 限定 origins;屬「代使用者在自己機器抓取」 |

---

## 3. 元件與邊界

### 3.1 `desktop/server/fetch_url.py`(新增)

純模組,無 FastAPI 相依,可獨立測試。移植自 backend `services/utility_service.py`(僅 async 版):

```python
@dataclass
class FetchResult:
    content: bytes
    content_type: str
    final_url: str
    redirect_count: int
    filename: str
    file_extension: str
    content_disposition: Optional[str] = None

class FetchError(Exception):
    def __init__(self, message: str, status_code: int = 500): ...

async def fetch_url_content_async(
    url: str,
    follow_redirects: bool = True,
    max_redirects: int = 10,
    timeout: int = 30,
    client: Optional[httpx.AsyncClient] = None,
) -> FetchResult: ...
```

行為(與雲端一致):

- 驗證 url 必須以 `http://` / `https://` 開頭,否則 `FetchError(400)`。
- `client=None` → 以 `timeout`、`follow_redirects`、`max_redirects` 建立臨時 `httpx.AsyncClient`,結束後 `aclose()`。
- 狀態碼映射:`404 → FetchError(404)`、`429 → FetchError(429)`、其餘 `>=400 → FetchError(該碼)`。
- 從 final URL path / Content-Type 推測 filename 與副檔名(`mimetypes.guess_extension`),處理 `.php` 結尾。
- 例外映射:`httpx.TimeoutException → 408`、`TooManyRedirects → 500`、`ConnectError/RequestError → 500`。

### 3.2 `desktop/server/app.py`(在 `create_app()` 內新增路由)

鏡像 backend `routes/utility.py`:

```python
@app.get("/api/fetch-url", tags=["utility"])
async def fetch_url(
    url: str = Query(...),
    follow_redirects: bool = Query(True),
    max_redirects: int = Query(10, ge=1, le=30),
    timeout: int = Query(30, ge=1, le=120),
):
    try:
        result = await fetch_url_content_async(
            url=url,
            follow_redirects=follow_redirects,
            max_redirects=max_redirects,
            timeout=timeout,
        )  # client=None → 自建/自關
    except FetchError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message) from e
    except Exception as e:
        logger.exception("URL 抓取未預期錯誤")
        raise HTTPException(status_code=500, detail="伺服器錯誤,請稍後再試") from e

    headers = {
        "Content-Type": result.content_type,
        "Content-Length": str(len(result.content)),
        "X-Final-URL": result.final_url,
        "X-Redirect-Count": str(result.redirect_count),
        "X-File-Extension": result.file_extension,
        "Content-Disposition": result.content_disposition,
    }
    return Response(content=result.content, headers=headers, media_type=result.content_type)
```

註:前端目前只讀 `Content-Type` + body(CORS-safelisted,本就可讀),不讀 `X-*` headers,故**不需** `expose_headers`。X-* 仍回傳以維持合約完整性。

### 3.3 `desktop/pyproject.toml`(改依賴)

把 `httpx` 從 `[dependency-groups].dev` 移到 `[project].dependencies`(已在 `uv.lock`),跑 `uv sync`。

### 3.4 `src/constants/api.ts`(前端常數)

```ts
export const FETCH_URL_PATH = "/api/fetch-url";  // 新增:hybrid path
```

並修正過時註解:fetch-url 改為「可走本機」;translate 不再列為「走雲端的後端端點」(前端根本沒接)。`FETCH_URL_API`(完整雲端 URL)若無其他引用點可移除;以 grep 結果為準。

### 3.5 `src/contexts/PdfContext.tsx`(前端呼叫點)

把約 201–208 行的直接 `fetch(new URL(FETCH_URL_API)...)` 改為:

```ts
const params = new URLSearchParams({ url, follow_redirects: "true" });
const response = await fetchWithComputeBase(
  `${FETCH_URL_PATH}?${params.toString()}`,
  { signal: controller.signal },
);
```

**保留** 後續的 status-code switch、Content-Type 檢查、blob→File 轉換與既有 `fetchWithComputeBase(PDF_EXTRACT_PATH, ...)` 抽取步驟,皆不動。

---

## 4. 資料流(local/auto 模式)

```
使用者貼 URL
  → fetchWithComputeBase("/api/fetch-url?url=...", { signal })
      auto: 探測 127.0.0.1:8765/api/version(一次/session)
        可達 → 打本機 sidecar fetch-url
        不可達 → 打雲端 fetch-url
      local: 一律本機
      cloud: 一律雲端
  → 取得 PDF blob(Content-Type 須含 application/pdf)
  → 轉成 File
  → fetchWithComputeBase("/api/pdf/extract", FormData)  ← 已是 hybrid
  → 顯示抽取結果
```

整條流程在 local/auto(本機可達)模式下**全程本機**;雲端模式全程雲端,與現行一致。

---

## 5. 錯誤處理與韌性

- **sidecar 連不上**(本機 process 沒開):`fetchWithComputeBase` 在 `auto` 模式下偵測到 `TypeError`(連線層失敗)會**自動退回雲端**;`local` 模式則照既有邏輯回連線錯誤訊息。此為 helper 既有行為,fetch-url 直接受惠。
- **目標 URL 抓取失敗**(404/超時等):sidecar 回**正常 HTTP 錯誤碼**(非 TypeError),`fetchWithComputeBase` **不會**誤觸雲端重試 —— 正確,因為換成雲端去抓同一個壞 URL 也會失敗。前端既有 switch 顯示對應訊息。
- **行為差異(刻意)**:雲端路由傳入共用 client,使 `follow_redirects`/`max_redirects` 參數實際被忽略;desktop 傳 `client=None`,這兩參數**真正生效**。屬更正確的行為,且前端目前只送 `follow_redirects=true`,不影響現有流程。

---

## 6. 測試

- **desktop**(`desktop/tests/`,pytest + httpx TestClient):
  - 400:`url` 非 `http(s)` scheme(不需網路)。
  - 成功路徑:monkeypatch / 攔截出站 httpx 請求(不打真實網路),驗證回傳 body 與 `Content-Type`、`X-Final-URL` 等 header。
  - 錯誤映射:模擬上游 404 → 路由回 404;模擬 timeout → 408。
- **web app**:無 test runner(僅 leaf-util node:test)。前端改動以 `npm run build` + `npm run lint` + 手動驗證(貼一個 PDF URL,確認 local/cloud 模式都能載入)為準。

---

## 7. 實作順序(預告,細節留給 plan)

1. desktop:`fetch_url.py` 移植 + 單元測試。
2. desktop:`app.py` 加路由 + `pyproject.toml` 加 httpx + `uv sync` + 路由測試。
3. frontend:`api.ts` 加 `FETCH_URL_PATH`、修註解;`PdfContext.tsx` 改走 `fetchWithComputeBase`。
4. 驗證:desktop pytest 綠燈;web `npm run build` + `npm run lint` + 手動 URL 載入驗證(local + cloud)。
