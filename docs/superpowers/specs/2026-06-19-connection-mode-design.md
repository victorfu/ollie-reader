# 連線模式設計：web app 本機/自動/雲端 運算後端選擇

> 狀態：草案,待 review
> 日期：2026-06-19
> 程式碼位置:**`ollie-reader` repo**(web 前端 `src/`)
> 範圍:讓使用者用設定控制重運算(PDF 提取、TTS)走**本機 sidecar**、**自動**、或**只用雲端**;並把目前「每 10 秒探測一次」的行為改成「探一次 + 失敗才重探」。

---

## 1. 背景與目標

桌面版提供本機 sidecar(FastAPI `http://127.0.0.1:8765`),負責 PDF 提取與 TTS(Piper/Kokoro)。web app 目前的選擇邏輯在 `src/services/localBackend.ts`:

- `getComputeBase()` 在每次 PDF/TTS 請求前探測 `127.0.0.1:8765/api/version`(timeout 400ms),結果**快取 10 秒**(`PROBE_TTL_MS`),連得到用本機、否則雲端(`API_BASE_URL`)。
- `src/hooks/useWarmServer.ts` 在 App 掛載時打一次**雲端** `/api/version` 暖機(非迴圈)。

痛點:

1. **沒有使用者控制權** — 走本機或雲端完全自動,使用者無法強制。
2. **不必要的探測** — 密集使用時,因 10 秒 TTL,大約每 10 秒就對 `127.0.0.1:8765` 探測一次。雲端使用者根本不需要這個探測。

**目標**:加入使用者可選的連線模式(本機 / 自動 / 雲端),並把探測收斂到最低 —— 只有「自動」需要偵測,且改成「探一次 + 失敗才重探」。

**只影響可走本機的端點**:PDF 提取(`/api/pdf/extract`)、TTS(`/api/tts`、`/api/ktts`)。其餘(OIKID、translate、GCS、Gemini)永遠走雲端,不在本設計範圍。

---

## 2. 鎖定的決策

| 主題 | 決策 | 理由 |
|---|---|---|
| 模式 | 單一設定 `computeMode`:`"local" \| "auto" \| "cloud"`,預設 `"auto"` | 維持現行行為為預設;三模式涵蓋使用者需求 |
| 儲存範圍 | **per-device,只存 localStorage**(比照 `textParsingMode`),**不進 Firestore** | 本機 sidecar 只存在於裝了桌面版的那台電腦;同步「本機」到手機/沒裝的電腦會壞掉 |
| 架構(mode 放哪) | **方案 A**:`localBackend.ts` 擁有 mode,直接讀 localStorage;`SettingsContext` 只是薄 UI 層 | source of truth 單一;`getComputeBase()` 自包含,呼叫點零改動傳參 |
| auto 偵測策略 | **探一次 + 失敗才重探**:本 session 探測過就沿用;只在本機請求失敗或手動「重新偵測」時重探。**移除 10 秒 TTL** | 直接解決不必要探測;auto 仍保有韌性(見 §4.2) |
| local 失敗 | **直接報錯,不退雲端** | 尊重明確選擇;`local` 就是真的只用本機 |
| cloud 模式 | 永遠回 `API_BASE_URL`,**完全不探測本機** | 雲端使用者零本機 ping |
| UI | Settings 頁加三選一 + 「目前使用:本機/雲端」狀態 + 「重新偵測」按鈕 | 讓使用者看得到現況、開了桌面 App 後可手動重探 |

---

## 3. 元件與邊界

### 3.1 `src/services/localBackend.ts`(核心,改寫)

唯一真相來源,純模組(非 React),直接讀/寫 localStorage。

```ts
export type ComputeMode = "auto" | "local" | "cloud";
const COMPUTE_MODE_KEY = "ollie-reader-compute-mode";

// 讀目前模式(預設 auto)
export function getComputeMode(): ComputeMode;

// 寫模式 + 重置已解析狀態(切模式後下次重新決定)
export function setComputeMode(mode: ComputeMode): void;

// 回 pdf/tts/ktts 應使用的 base
//   cloud → API_BASE_URL(不探測)
//   local → LOCAL_BASE_URL(不探測)
//   auto  → 本 session 探測過用快取,否則探一次
export async function getComputeBase(): Promise<string>;

// 強制探測一次本機並更新狀態(手動按鈕 / auto 模式本機請求失敗時)。
//   auto  → 重探,resolvedBase = 本機(通)否則雲端
//   local → 探測只為更新 localReachable;resolvedBase 維持 LOCAL_BASE_URL
//   cloud → no-op(按鈕在此模式隱藏)
export async function refreshComputeBase(): Promise<string>;

// 同步取狀態給 UI,不觸發網路
export function getComputeStatusSync(): {
  mode: ComputeMode;
  resolvedBase: string;          // 目前會用的 base
  usingLocal: boolean;           // resolvedBase === LOCAL_BASE_URL
  localReachable: boolean | null; // 最近一次探測/請求結果;null = 尚未探測
};
```

**狀態**(模組層):`resolvedBase`、`hasProbed`(取代 `lastProbeAt`/TTL)、`localReachable`、`inflight`(同時多次呼叫共用一次探測,沿用現有 dedupe)。

### 3.2 `src/contexts/SettingsContext.tsx` + `SettingsContextType.ts`

- 新增 `computeMode: ComputeMode` 與 `updateComputeMode(mode): void`。
- 初值由 `localBackend.getComputeMode()` 取得;`updateComputeMode` 呼叫 `localBackend.setComputeMode()` 並更新 context state。
- **不動** `types/settings.ts` 的 `UserSettings` 與 Firestore schema(per-device,比照 `textParsingMode` / `showChineseTranslation`)。

### 3.3 `src/components/Settings/Settings.tsx`

- 新增「運算後端」區塊:三選一(本機 / 自動 / 雲端)。
- 狀態行:「目前使用:本機 / 雲端」,讀 `getComputeStatusSync()`;local 連線失敗時顯示「本機未連線」。
- 「重新偵測」按鈕:呼叫 `refreshComputeBase()`,完成後更新顯示。按鈕只在 `local`/`auto` 模式顯示(cloud 模式不需要)。

### 3.4 呼叫點(PdfContext / SpeechContext)

- 仍呼叫 `await getComputeBase()` 取 base —— 介面不變。
- 新增 auto 模式韌性與 local 報錯,見 §4。

---

## 4. 行為與錯誤處理

### 4.1 模式決策(`getComputeBase()`)

- `cloud` → `API_BASE_URL`,不探測。
- `local` → `LOCAL_BASE_URL`,不探測。
- `auto` → 若 `hasProbed` 為真回 `resolvedBase`;否則探測 `LOCAL_BASE_URL/api/version`(400ms timeout),設 `resolvedBase`/`localReachable`/`hasProbed`,回結果。

### 4.2 auto 模式「失敗才重探」韌性

PdfContext / SpeechContext 在 auto 模式下,若送往**本機**的請求發生**連線層級失敗**(fetch reject / network error,非 HTTP 4xx/5xx;503 仍照現有 Kokoro→Piper 降級處理):

1. 呼叫 `refreshComputeBase()`(會重探,sidecar 已關時解析成雲端)。
2. **以新 base 重試該請求一次**。

→ 桌面 App 中途關掉時,下一個動作能自動接回雲端,全程零輪詢。重試只做一次,避免無限迴圈。

### 4.3 local 模式失敗

- 送往本機的請求連線失敗 → **不退雲端**。
- 拋出明確錯誤,UI 顯示可理解訊息(例:「本機 sidecar 未連線,請先啟動桌面 App」)。PDF 區走現有 `error` 狀態;TTS 走現有錯誤路徑。
- `localReachable` 設為 `false`,狀態行反映。

### 4.4 不變動

- `useWarmServerOnRouteChange`(雲端暖機,掛載打一次)維持原樣。
- `constants/api.ts` 既有 `LOCAL_BASE_URL`、`*_PATH`、`API_BASE_URL` 常數沿用。

---

## 5. 資料流

```
Settings UI ──updateComputeMode──> SettingsContext ──setComputeMode──> localBackend (localStorage)
                                                                            │
PdfContext / SpeechContext ──getComputeBase()──────────────────────────────┤
                                                                            │
   cloud → API_BASE_URL                                                     │
   local → LOCAL_BASE_URL (失敗→報錯)                                        │
   auto  → 探一次→cache;本機請求失敗→refreshComputeBase()→重試一次(→雲端)    │
```

---

## 6. 測試

- `localBackend` 單元測試(mock fetch / localStorage):
  - `cloud` 回 `API_BASE_URL` 且**不呼叫 fetch**。
  - `local` 回 `LOCAL_BASE_URL` 且**不呼叫 fetch**。
  - `auto` 第一次探測、第二次用快取(只 fetch 一次);`refreshComputeBase()` 會再探一次。
  - `setComputeMode` 切換後重置已解析狀態。
  - `getComputeStatusSync()` 回正確 `usingLocal` / `localReachable`。
- 確認 PdfContext / SpeechContext 在三模式下 base 解析正確;auto 本機連線失敗會 refresh + 重試;local 失敗會報錯不退雲端。

---

## 7. 不做(YAGNI)

- 不做背景輪詢/即時連線燈(只在 Settings 提供手動「重新偵測」)。
- 不把 `computeMode` 同步進 Firestore。
- 不改 OIKID / GCS / translate / Gemini 的雲端路徑。
- 不做桌面 App → web 的主動通知(本次採 web 端手動重探)。
