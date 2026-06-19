# Connection Mode (local/auto/cloud) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the web app's user choose whether PDF extraction + TTS use the local desktop sidecar, auto-detect, or cloud only — and stop probing `127.0.0.1:8765` unnecessarily.

**Architecture:** A per-device `computeMode` (`"auto" | "local" | "cloud"`) stored in `localStorage`. `src/services/localBackend.ts` is the single source of truth: it reads the mode and resolves the compute base. `cloud`/`local` never probe; `auto` probes once per session and re-probes only on a failed local request or a manual "重新偵測". `SettingsContext` is a thin UI wrapper; the Settings page adds a mode selector + status + re-detect button. PDF/TTS call sites switch from `getComputeBase()` to a `fetchWithComputeBase()` helper that auto-falls-back to cloud (auto mode) or surfaces a clear error (local mode).

**Tech Stack:** React 19 + TypeScript (strict), Vite, DaisyUI/Tailwind. No test framework (see Global Constraints).

## Global Constraints

- **TypeScript strict**; 2-space indentation; functional components only.
- **Logging:** use `logger` from `src/utils/logger.ts` (already imported in `localBackend.ts`).
- **Per-device only:** `computeMode` lives in `localStorage` (key `ollie-reader-compute-mode`); **never** added to `UserSettings` / Firestore (mirror `textParsingMode`).
- **Scope:** only PDF extract (`/api/pdf/extract`) and TTS (`/api/tts`, `/api/ktts`) may use the local sidecar. `/api/fetch-url`, OIKID, GCS, translate, Gemini stay cloud-only — do not touch.
- **No automated tests** (user decision): the web app has no runner able to exercise the Vite module graph. Verify every task with `npm run build` (tsc) **and** `npm run lint`, plus the manual checks noted per task. Both commands must exit 0.
- **Conventional Commits**; commit after each task. End commit messages with the `Co-Authored-By` trailer used in this repo.
- **Defaults:** `computeMode` defaults to `"auto"` (preserves current behavior).

---

### Task 1: `ComputeMode` type + rewrite `localBackend` service

**Files:**
- Modify: `src/types/pdf.ts` (add `ComputeMode` after the other mode types, ~line 22)
- Modify (full rewrite): `src/services/localBackend.ts`

**Interfaces:**
- Consumes: `API_BASE_URL`, `LOCAL_BASE_URL`, `VERSION_PATH` from `src/constants/api.ts`; `logger` from `src/utils/logger.ts`.
- Produces (later tasks rely on these exact names/types):
  - `type ComputeMode = "auto" | "local" | "cloud"` (in `src/types/pdf.ts`)
  - `getComputeMode(): ComputeMode`
  - `setComputeMode(mode: ComputeMode): void`
  - `getComputeBase(): Promise<string>`
  - `refreshComputeBase(): Promise<string>`
  - `type ComputeStatus = { mode: ComputeMode; resolvedBase: string; usingLocal: boolean; localReachable: boolean | null }`
  - `getComputeStatusSync(): ComputeStatus`
  - `isLocalConnectionError(err: unknown): boolean`
  - `localUnavailableMessage(): string`
  - `fetchWithComputeBase(path: string, init: RequestInit, fetcher?: (url: string, init?: RequestInit) => Promise<Response>): Promise<Response>`
- Removed: `getResolvedBaseSync()` (was exported, has **no** callers — verified).

- [ ] **Step 1: Add the `ComputeMode` type**

In `src/types/pdf.ts`, after the `TextParsingMode` line (currently line 22), add:

```ts
// 運算後端連線模式（per-device，存 localStorage，不同步 Firestore）
export type ComputeMode = "auto" | "local" | "cloud";
```

- [ ] **Step 2: Rewrite `src/services/localBackend.ts`**

Replace the entire file with:

```ts
import { API_BASE_URL, LOCAL_BASE_URL, VERSION_PATH } from "../constants/api";
import { logger } from "../utils/logger";
import type { ComputeMode } from "../types/pdf";

// per-device 連線模式設定（不同步 Firestore）
const COMPUTE_MODE_KEY = "ollie-reader-compute-mode";
const PROBE_TIMEOUT_MS = 400;

type Fetcher = (url: string, init?: RequestInit) => Promise<Response>;

// session 內的解析狀態
let resolvedBase = API_BASE_URL; // 預設雲端
let hasProbed = false; // auto 模式本 session 是否已探測過
let localReachable: boolean | null = null; // 最近一次探測/請求結果；null = 尚未探測
let inflight: Promise<string> | null = null;

/** 讀目前連線模式（預設 auto）。 */
export function getComputeMode(): ComputeMode {
  try {
    const stored = localStorage.getItem(COMPUTE_MODE_KEY);
    if (stored === "auto" || stored === "local" || stored === "cloud") {
      return stored;
    }
  } catch {
    // localStorage not available
  }
  return "auto";
}

/** 寫連線模式並重置 session 解析狀態。 */
export function setComputeMode(mode: ComputeMode): void {
  try {
    localStorage.setItem(COMPUTE_MODE_KEY, mode);
  } catch {
    // localStorage not available
  }
  hasProbed = false;
  inflight = null;
  localReachable = null;
  resolvedBase = mode === "local" ? LOCAL_BASE_URL : API_BASE_URL;
}

async function probeLocal(): Promise<boolean> {
  try {
    const resp = await fetch(`${LOCAL_BASE_URL}${VERSION_PATH}`, {
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    });
    return resp.ok;
  } catch {
    return false;
  }
}

/**
 * 回傳 pdf/tts/ktts 應使用的 base：
 *   cloud → API_BASE_URL（不探測）
 *   local → LOCAL_BASE_URL（不探測）
 *   auto  → 本 session 探測過用快取，否則探一次（探到本機用本機，否則雲端）
 */
export async function getComputeBase(): Promise<string> {
  const mode = getComputeMode();
  if (mode === "cloud") {
    resolvedBase = API_BASE_URL;
    return resolvedBase;
  }
  if (mode === "local") {
    resolvedBase = LOCAL_BASE_URL;
    return resolvedBase;
  }
  // auto
  if (hasProbed) return resolvedBase;
  if (inflight) return inflight;
  inflight = (async () => {
    const ok = await probeLocal();
    localReachable = ok;
    resolvedBase = ok ? LOCAL_BASE_URL : API_BASE_URL;
    hasProbed = true;
    inflight = null;
    logger.debug("compute base resolved:", resolvedBase);
    return resolvedBase;
  })();
  return inflight;
}

/**
 * 強制探測一次本機並更新狀態。
 *   auto  → 重探，resolvedBase = 本機（通）否則雲端
 *   local → 探測只為更新 localReachable；resolvedBase 維持 LOCAL_BASE_URL
 *   cloud → 不探測，resolvedBase = 雲端
 */
export async function refreshComputeBase(): Promise<string> {
  const mode = getComputeMode();
  if (mode === "cloud") {
    resolvedBase = API_BASE_URL;
    localReachable = null;
    return resolvedBase;
  }
  const ok = await probeLocal();
  localReachable = ok;
  if (mode === "local") {
    resolvedBase = LOCAL_BASE_URL;
  } else {
    hasProbed = true;
    resolvedBase = ok ? LOCAL_BASE_URL : API_BASE_URL;
  }
  logger.debug("compute base refreshed:", resolvedBase, "local:", ok);
  return resolvedBase;
}

export type ComputeStatus = {
  mode: ComputeMode;
  resolvedBase: string;
  usingLocal: boolean;
  localReachable: boolean | null;
};

/** 同步取得目前狀態（不觸發網路），UI 顯示用。 */
export function getComputeStatusSync(): ComputeStatus {
  const mode = getComputeMode();
  const base =
    mode === "cloud"
      ? API_BASE_URL
      : mode === "local"
        ? LOCAL_BASE_URL
        : resolvedBase;
  return {
    mode,
    resolvedBase: base,
    usingLocal: base === LOCAL_BASE_URL,
    localReachable,
  };
}

/** 連線層級失敗（網路/連不上），非 HTTP 狀態碼錯誤。fetch 失敗會丟 TypeError。 */
export function isLocalConnectionError(err: unknown): boolean {
  return err instanceof TypeError;
}

/** local 模式 sidecar 連不上時的使用者訊息。 */
export function localUnavailableMessage(): string {
  return "本機 sidecar 未連線，請先啟動桌面 App，或在設定改用雲端。";
}

/**
 * 用解析後的 base 發送請求；auto 模式下若送往本機的請求發生連線層級失敗，
 * 自動 refresh（改用雲端）並重試一次。fetcher 預設用全域 fetch，TTS 傳 apiFetch。
 */
export async function fetchWithComputeBase(
  path: string,
  init: RequestInit,
  fetcher: Fetcher = fetch,
): Promise<Response> {
  const base = await getComputeBase();
  try {
    return await fetcher(`${base}${path}`, init);
  } catch (err) {
    if (
      getComputeMode() === "auto" &&
      base === LOCAL_BASE_URL &&
      isLocalConnectionError(err)
    ) {
      const cloudBase = await refreshComputeBase();
      return fetcher(`${cloudBase}${path}`, init);
    }
    throw err;
  }
}
```

- [ ] **Step 3: Type-check + lint**

Run: `npm run build && npm run lint`
Expected: both exit 0. (Build will still pass even though `getComputeBase` callers in `PdfContext`/`SpeechContext` are unchanged — the signature is unchanged; new exports are additive. `getResolvedBaseSync` removal is safe — no callers.)

- [ ] **Step 4: Commit**

```bash
git add src/types/pdf.ts src/services/localBackend.ts
git commit -m "feat(web): mode-aware compute base resolution

Add ComputeMode (auto/local/cloud) and rewrite localBackend: cloud/local
never probe; auto probes once per session + on refresh. Add
getComputeStatusSync + fetchWithComputeBase (auto cloud-fallback).

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Wire `computeMode` into `SettingsContext`

**Files:**
- Modify: `src/contexts/SettingsContextType.ts`
- Modify: `src/contexts/SettingsContext.tsx`

**Interfaces:**
- Consumes: `getComputeMode`, `setComputeMode` from `src/services/localBackend.ts`; `ComputeMode` from `src/types/pdf.ts`.
- Produces: `SettingsContextValue.computeMode: ComputeMode` and `SettingsContextValue.updateComputeMode: (mode: ComputeMode) => void`.

- [ ] **Step 1: Extend the context type**

In `src/contexts/SettingsContextType.ts`:

Change the import line to include `ComputeMode`:

```ts
import type { TTSMode, TTSEngine, ReadingMode, TextParsingMode, ComputeMode } from "../types/pdf";
```

Add these two members to `SettingsContextValue` (after `showChineseTranslation` and its updater — placement only needs to be inside the type):

```ts
  computeMode: ComputeMode;
  updateComputeMode: (mode: ComputeMode) => void;
```

- [ ] **Step 2: Provide it in `SettingsContext.tsx`**

In `src/contexts/SettingsContext.tsx`:

Add to the type import (line 6):

```ts
import type { TTSMode, TTSEngine, ReadingMode, TextParsingMode, ComputeMode } from "../types/pdf";
```

Add a new import below line 5 (`import type { UserSettings } ...`):

```ts
import { getComputeMode, setComputeMode } from "../services/localBackend";
```

Add state init alongside the other `useState` calls (e.g. after the `showChineseTranslation` state, ~line 47):

```ts
  const [computeMode, setComputeModeState] = useState<ComputeMode>(getComputeMode);
```

Add the updater near `updateShowChineseTranslation` (~line 178). It writes localStorage via the service and updates local state — no Firestore:

```ts
  const updateComputeMode = useCallback((mode: ComputeMode) => {
    setComputeMode(mode);
    setComputeModeState(mode);
  }, []);
```

Add `computeMode` and `updateComputeMode` to BOTH the `value` object and its dependency array in the `useMemo` (lines 180-213):

```ts
      textParsingMode,
      showChineseTranslation,
      computeMode,
      loading,
      error,
      updateTtsMode,
      updateTtsEngine,
      updateSpeechRate,
      updateReadingMode,
      updateTextParsingMode,
      updateShowChineseTranslation,
      updateComputeMode,
```

(Apply the same two additions — `computeMode` in the state group and `updateComputeMode` in the callback group — to the dependency array.)

- [ ] **Step 3: Type-check + lint**

Run: `npm run build && npm run lint`
Expected: both exit 0.

- [ ] **Step 4: Commit**

```bash
git add src/contexts/SettingsContextType.ts src/contexts/SettingsContext.tsx
git commit -m "feat(web): expose computeMode via SettingsContext

Per-device localStorage setting (not synced to Firestore), mirroring
textParsingMode.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Settings page — mode selector + status + re-detect

**Files:**
- Modify: `src/components/Settings/Settings.tsx`

**Interfaces:**
- Consumes: `computeMode`, `updateComputeMode` from `useSettings()`; `getComputeStatusSync`, `refreshComputeBase`, `type ComputeStatus` from `src/services/localBackend.ts`; `ComputeMode` from `src/types/pdf.ts`.

- [ ] **Step 1: Imports + destructure**

Add `ComputeMode` to the types import (line 8):

```ts
import type { TTSMode, TTSEngine, ReadingMode, TextParsingMode, ComputeMode } from "../../types/pdf";
```

Add a service import below the existing imports (after line 7, the `ConfirmModal` import):

```ts
import { getComputeStatusSync, refreshComputeBase, type ComputeStatus } from "../../services/localBackend";
```

Add `computeMode` and `updateComputeMode` to the `useSettings()` destructure (lines 19-32):

```ts
    updateTextParsingMode,
    computeMode,
    updateComputeMode,
```

- [ ] **Step 2: Local state + handlers**

Add state after the existing `useState` declarations (~line 37):

```ts
  const [computeStatus, setComputeStatus] = useState<ComputeStatus>(getComputeStatusSync);
  const [redetecting, setRedetecting] = useState(false);
```

Add handlers after `handleTextParsingModeChange` (~line 112):

```ts
  const handleComputeModeChange = async (mode: ComputeMode) => {
    updateComputeMode(mode);
    if (mode !== "cloud") {
      setRedetecting(true);
      await refreshComputeBase();
      setRedetecting(false);
    }
    setComputeStatus(getComputeStatusSync());
  };

  const handleRedetect = async () => {
    setRedetecting(true);
    await refreshComputeBase();
    setRedetecting(false);
    setComputeStatus(getComputeStatusSync());
  };
```

- [ ] **Step 3: Render the section**

Insert this block right after the PDF Text Parsing `</div>` (the section ending at line 415) and before the `{saving && ...}` block (line 417). It reuses the existing radio-card pattern:

```tsx
            {/* Divider */}
            <div className="divider"></div>

            {/* 運算後端 / 連線模式 */}
            <div>
              <h3 className="text-lg font-semibold mb-3">運算後端</h3>
              <p className="text-sm text-muted-foreground mb-4">
                選擇 PDF 解析與 AI 語音要走本機桌面 App、自動，或只用雲端
              </p>

              <div className="space-y-3">
                {(
                  [
                    { id: "auto", name: "自動", desc: "偵測到本機桌面 App 就用本機，否則用雲端（推薦）" },
                    { id: "local", name: "只用本機", desc: "強制使用本機桌面 App；未啟動時會顯示錯誤，不退雲端" },
                    { id: "cloud", name: "只用雲端", desc: "永遠使用雲端服務，不偵測本機" },
                  ] as { id: ComputeMode; name: string; desc: string }[]
                ).map((opt) => (
                  <label
                    key={opt.id}
                    className="flex items-start gap-3 p-4 border border-border-hairline rounded-lg cursor-pointer hover:bg-base-200/60 transition-colors"
                  >
                    <input
                      type="radio"
                      name="computeMode"
                      className="radio radio-primary mt-1"
                      checked={computeMode === opt.id}
                      onChange={() => handleComputeModeChange(opt.id)}
                      disabled={redetecting}
                    />
                    <div className="flex-1">
                      <div className="font-medium">{opt.name}</div>
                      <div className="text-sm text-muted-foreground">{opt.desc}</div>
                    </div>
                  </label>
                ))}
              </div>

              {computeMode !== "cloud" && (
                <div className="mt-3 flex items-center gap-3 border-l-2 border-border-hairline pl-4">
                  <span className="text-sm text-base-content/70">
                    目前使用：
                    {computeStatus.usingLocal ? "本機 sidecar" : "雲端"}
                    {computeMode === "local" && computeStatus.localReachable === false
                      ? "（本機未連線）"
                      : ""}
                  </span>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={handleRedetect}
                    disabled={redetecting}
                  >
                    {redetecting ? "偵測中…" : "重新偵測"}
                  </button>
                </div>
              )}
            </div>
```

- [ ] **Step 4: Type-check + lint**

Run: `npm run build && npm run lint`
Expected: both exit 0.

- [ ] **Step 5: Manual check**

Run: `npm run dev`, open Settings (⚙️). Verify: the "運算後端" section renders three options; selecting one and reloading the page keeps the choice (localStorage `ollie-reader-compute-mode`); "重新偵測" toggles to "偵測中…" briefly. (Local detection accuracy is verified end-to-end in Task 6.)

- [ ] **Step 6: Commit**

```bash
git add src/components/Settings/Settings.tsx
git commit -m "feat(web): add connection-mode setting to Settings page

Three-way selector (local/auto/cloud) + current-backend status + manual
re-detect button.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Route PDF extraction through `fetchWithComputeBase`

**Files:**
- Modify: `src/contexts/PdfContext.tsx`

**Interfaces:**
- Consumes: `fetchWithComputeBase`, `getComputeMode`, `localUnavailableMessage` from `src/services/localBackend.ts` (replacing `getComputeBase`).

- [ ] **Step 1: Swap the import**

Change line 12 from:

```ts
import { getComputeBase } from "../services/localBackend";
```

to:

```ts
import { fetchWithComputeBase, getComputeMode, localUnavailableMessage } from "../services/localBackend";
```

- [ ] **Step 2: `uploadAndExtract` — use the helper**

Replace lines 108-114:

```ts
      const base = await getComputeBase();
      const res = await fetch(`${base}${PDF_EXTRACT_PATH}`, {
        method: "POST",
        body: form,
        headers: { Accept: "application/json" },
        signal: controller.signal,
      });
```

with:

```ts
      const res = await fetchWithComputeBase(PDF_EXTRACT_PATH, {
        method: "POST",
        body: form,
        headers: { Accept: "application/json" },
        signal: controller.signal,
      });
```

- [ ] **Step 3: `uploadAndExtract` — local error message**

Replace the catch body (lines 134-141):

```ts
    } catch (err: unknown) {
      if (isAbortError(err)) return;
      const message = err instanceof Error ? err.message : "發生未知錯誤";
      if (/Failed to fetch|CORS/i.test(message)) {
        setError("連線失敗或 CORS 問題，請稍後再試。");
      } else {
        setError(message);
      }
    } finally {
```

with:

```ts
    } catch (err: unknown) {
      if (isAbortError(err)) return;
      const message = err instanceof Error ? err.message : "發生未知錯誤";
      const isConn = /Failed to fetch|CORS|NetworkError/i.test(message);
      if (getComputeMode() === "local" && isConn) {
        setError(localUnavailableMessage());
      } else if (/Failed to fetch|CORS/i.test(message)) {
        setError("連線失敗或 CORS 問題，請稍後再試。");
      } else {
        setError(message);
      }
    } finally {
```

- [ ] **Step 4: `loadPdfFromUrl` — use the helper for the extract step**

Replace lines 255-261:

```ts
      const extractBase = await getComputeBase();
      const extractRes = await fetch(`${extractBase}${PDF_EXTRACT_PATH}`, {
        method: "POST",
        body: form,
        headers: { Accept: "application/json" },
        signal: controller.signal,
      });
```

with:

```ts
      const extractRes = await fetchWithComputeBase(PDF_EXTRACT_PATH, {
        method: "POST",
        body: form,
        headers: { Accept: "application/json" },
        signal: controller.signal,
      });
```

(The `/api/fetch-url` call above it stays on `FETCH_URL_API` / cloud — do not change it.)

- [ ] **Step 5: `loadPdfFromUrl` — local error message**

Replace the catch body (lines 276-283):

```ts
    } catch (err: unknown) {
      if (isAbortError(err)) return;
      const message =
        err instanceof Error ? err.message : "載入 PDF 時發生未知錯誤";
      setError(message);
      setSelectedFile(null);
      setPdfUrl(null);
      setResult(null);
    } finally {
```

with:

```ts
    } catch (err: unknown) {
      if (isAbortError(err)) return;
      const message =
        err instanceof Error ? err.message : "載入 PDF 時發生未知錯誤";
      const isConn = /Failed to fetch|CORS|NetworkError/i.test(message);
      setError(
        getComputeMode() === "local" && isConn ? localUnavailableMessage() : message,
      );
      setSelectedFile(null);
      setPdfUrl(null);
      setResult(null);
    } finally {
```

- [ ] **Step 6: Type-check + lint**

Run: `npm run build && npm run lint`
Expected: both exit 0.

- [ ] **Step 7: Commit**

```bash
git add src/contexts/PdfContext.tsx
git commit -m "feat(web): route PDF extraction through compute-mode helper

Use fetchWithComputeBase (auto cloud-fallback) and show a clear
local-unavailable message in local mode.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Route TTS through `fetchWithComputeBase`

**Files:**
- Modify: `src/contexts/SpeechContext.tsx`

**Interfaces:**
- Consumes: `fetchWithComputeBase` from `src/services/localBackend.ts` (replacing `getComputeBase`); passes `apiFetch` as the `fetcher`. Preserves the existing 503 Kokoro→Piper fallback.

- [ ] **Step 1: Swap the import**

Change line 13 from:

```ts
import { getComputeBase } from "../services/localBackend";
```

to:

```ts
import { fetchWithComputeBase } from "../services/localBackend";
```

- [ ] **Step 2: Use the helper in `fetchTTSBlob`**

Replace lines 44-50:

```ts
    const base = await getComputeBase();
    const response = await apiFetch(`${base}${TTS_ENGINE_PATH[engine]}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal,
      body: JSON.stringify({ text, speed: speechRate }),
    });
```

with (note `apiFetch` passed as the `fetcher`; the 503 and `!response.ok` handling below it on lines 52-61 stays unchanged):

```ts
    const response = await fetchWithComputeBase(
      TTS_ENGINE_PATH[engine],
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal,
        body: JSON.stringify({ text, speed: speechRate }),
      },
      apiFetch,
    );
```

- [ ] **Step 3: Type-check + lint**

Run: `npm run build && npm run lint`
Expected: both exit 0. (Confirms `apiFetch` is assignable to the helper's `Fetcher` param — `ApiFetchOptions` extends `RequestInit` with an optional field, so a `RequestInit` argument is accepted.)

- [ ] **Step 4: Commit**

```bash
git add src/contexts/SpeechContext.tsx
git commit -m "feat(web): route TTS through compute-mode helper

Use fetchWithComputeBase with apiFetch as fetcher; keep the 503
Kokoro->Piper fallback.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: End-to-end manual verification

**Files:** none (verification only).

- [ ] **Step 1: Build + lint gate**

Run: `npm run build && npm run lint`
Expected: both exit 0.

- [ ] **Step 2: Cloud mode — zero local pings**

Run `npm run dev`. In Settings choose **只用雲端**. Open DevTools → Network, filter `8765`. Trigger a PDF upload and a TTS playback.
Expected: **no** requests to `127.0.0.1:8765`; PDF/TTS work via cloud.

- [ ] **Step 3: Auto mode — detect + fallback**

Start the desktop sidecar: `make desktop-serve` (or `uv run --directory desktop python main.py --serve`). In Settings choose **自動**, click **重新偵測**.
Expected: status shows "目前使用：本機 sidecar". A PDF upload / TTS hits `127.0.0.1:8765`.
Now stop the sidecar (Ctrl-C) and trigger another PDF upload.
Expected: request to `8765` fails once, then the app retries against cloud and succeeds (auto fallback).

- [ ] **Step 4: Local mode — hard error**

Ensure the sidecar is **stopped**. In Settings choose **只用本機**. Trigger a PDF upload.
Expected: PDF area shows "本機 sidecar 未連線，請先啟動桌面 App，或在設定改用雲端。"; **no** cloud fallback.

- [ ] **Step 5: Persistence**

Reload the page.
Expected: the last-selected mode is still active (localStorage `ollie-reader-compute-mode`).

- [ ] **Step 6 (optional): final commit if any tweaks were needed**

Only if Steps 2-5 surfaced fixes; otherwise nothing to commit.
