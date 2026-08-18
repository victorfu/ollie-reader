# 生詞本停靠模式 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 讓 PDF 閱讀器的生詞本可以停靠在 PDF 預覽右側而不遮擋內容，並保留現有浮動模式作為可切換的選項。

**Architecture:** 把 `WordPanel.tsx`（551 行）拆成「內容」（`WordPanelContent`）與兩種外殼（浮動 `WordPanel`、停靠 `WordPanelDock`）。`PdfReader` 依「使用者偏好 × 是否桌機寬度」三選一渲染。停靠欄是 `PdfViewer` 盒子的 flex 兄弟並用 `items-stretch` 等高，因此 PDF 在自己的捲動容器內捲動時右欄完全不動 — 不需要 `position: sticky`。

**Tech Stack:** React 19、TypeScript strict、Tailwind CSS v4 + DaisyUI、framer-motion、Vitest + jsdom。

**Spec:** `docs/superpowers/specs/2026-08-18-vocabulary-panel-dock-design.md`

## Global Constraints

- TypeScript strict；型別定義放 `src/types/`。
- 只用 functional components，2 空格縮排，Tailwind utility（不寫 inline style，動態數值除外）。
- 檔名慣例：Components `PascalCase.tsx`、Hooks `useName.ts`、Utils `camelCase.ts`。
- Logging 一律用 `src/utils/logger.ts` 的 `logger`。
- 測試用 Vitest + jsdom。**本專案沒有安裝 @testing-library** — 測試一律用 `react-dom/client` 的 `createRoot` + React 的 `act`，並在 `beforeEach` 設 `IS_REACT_ACT_ENVIRONMENT = true`（照 `src/components/PdfReader.test.tsx` 的寫法）。
- 停靠欄寬度範圍：**最小 280px、最大 560px**，預設 **360px**。
- localStorage keys：模式 `"ollie-reader-vocabulary-panel-mode"`、寬度 `"ollie-reader-vocabulary-dock-width"`。
- 模式預設值：**`"docked"`**。
- 桌機斷點沿用既有 `useIsDesktop()`（`(min-width: 1024px)`，即 Tailwind `lg`）。
- 所有 localStorage 存取都要包 try/catch，失敗時回退預設值。
- Commit 用 Conventional Commits（`feat:`/`fix:`/`refactor:`/`test:`/`chore:`），72 字以內、祈使句。

---

### Task 1: 偏好儲存工具

把 localStorage 的讀寫與範圍夾制抽成純函式模組，讓它可以被完整單元測試，Context 與元件只負責呼叫。

**Files:**
- Create: `src/utils/vocabularyPanelPreferences.ts`
- Create: `src/utils/vocabularyPanelPreferences.test.ts`

**Interfaces:**
- Consumes: 無（本任務是最底層）
- Produces:
  - `type VocabularyPanelMode = "floating" | "docked"`（實際定義在 `src/types/pdf.ts`，見 Step 3）
  - `VOCABULARY_PANEL_MODE_KEY: string`
  - `VOCABULARY_DOCK_WIDTH_KEY: string`
  - `DOCK_WIDTH_MIN: 280`、`DOCK_WIDTH_MAX: 560`、`DOCK_WIDTH_DEFAULT: 360`
  - `clampDockWidth(value: number): number`
  - `readVocabularyPanelMode(): VocabularyPanelMode`
  - `writeVocabularyPanelMode(mode: VocabularyPanelMode): void`
  - `readVocabularyDockWidth(): number`
  - `writeVocabularyDockWidth(width: number): void`

- [ ] **Step 1: 寫失敗的測試**

Create `src/utils/vocabularyPanelPreferences.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DOCK_WIDTH_DEFAULT,
  DOCK_WIDTH_MAX,
  DOCK_WIDTH_MIN,
  VOCABULARY_DOCK_WIDTH_KEY,
  VOCABULARY_PANEL_MODE_KEY,
  clampDockWidth,
  readVocabularyDockWidth,
  readVocabularyPanelMode,
  writeVocabularyDockWidth,
  writeVocabularyPanelMode,
} from "./vocabularyPanelPreferences";

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("clampDockWidth", () => {
  it("keeps an in-range width untouched", () => {
    expect(clampDockWidth(400)).toBe(400);
  });

  it("clamps to the allowed range", () => {
    expect(clampDockWidth(10)).toBe(DOCK_WIDTH_MIN);
    expect(clampDockWidth(9999)).toBe(DOCK_WIDTH_MAX);
  });

  it("falls back to the default for non-finite values", () => {
    expect(clampDockWidth(Number.NaN)).toBe(DOCK_WIDTH_DEFAULT);
    expect(clampDockWidth(Number.POSITIVE_INFINITY)).toBe(DOCK_WIDTH_DEFAULT);
  });
});

describe("readVocabularyPanelMode", () => {
  it("defaults to docked when nothing is stored", () => {
    expect(readVocabularyPanelMode()).toBe("docked");
  });

  it("reads back a stored mode", () => {
    localStorage.setItem(VOCABULARY_PANEL_MODE_KEY, "floating");
    expect(readVocabularyPanelMode()).toBe("floating");
  });

  it("falls back to docked for an unrecognised value", () => {
    localStorage.setItem(VOCABULARY_PANEL_MODE_KEY, "sideways");
    expect(readVocabularyPanelMode()).toBe("docked");
  });

  it("falls back to docked when localStorage throws", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("denied");
    });
    expect(readVocabularyPanelMode()).toBe("docked");
  });
});

describe("writeVocabularyPanelMode", () => {
  it("persists the mode", () => {
    writeVocabularyPanelMode("floating");
    expect(localStorage.getItem(VOCABULARY_PANEL_MODE_KEY)).toBe("floating");
  });

  it("swallows storage failures", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });
    expect(() => writeVocabularyPanelMode("docked")).not.toThrow();
  });
});

describe("dock width persistence", () => {
  it("defaults when nothing is stored", () => {
    expect(readVocabularyDockWidth()).toBe(DOCK_WIDTH_DEFAULT);
  });

  it("clamps a stored width that is out of range", () => {
    localStorage.setItem(VOCABULARY_DOCK_WIDTH_KEY, "9999");
    expect(readVocabularyDockWidth()).toBe(DOCK_WIDTH_MAX);
  });

  it("defaults when the stored width is not a number", () => {
    localStorage.setItem(VOCABULARY_DOCK_WIDTH_KEY, "wide");
    expect(readVocabularyDockWidth()).toBe(DOCK_WIDTH_DEFAULT);
  });

  it("round-trips a clamped width", () => {
    writeVocabularyDockWidth(1000);
    expect(readVocabularyDockWidth()).toBe(DOCK_WIDTH_MAX);
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npx vitest run src/utils/vocabularyPanelPreferences.test.ts`
Expected: FAIL — `Failed to resolve import "./vocabularyPanelPreferences"`

- [ ] **Step 3: 新增型別**

Modify `src/types/pdf.ts` — 在 `export type ComputeMode = "auto" | "local" | "cloud";` 之後加一行：

```ts
/** 生詞本面板呈現方式：浮動視窗，或停靠在閱讀區右側。 */
export type VocabularyPanelMode = "floating" | "docked";
```

- [ ] **Step 4: 實作工具模組**

Create `src/utils/vocabularyPanelPreferences.ts`:

```ts
import type { VocabularyPanelMode } from "../types/pdf";

export const VOCABULARY_PANEL_MODE_KEY = "ollie-reader-vocabulary-panel-mode";
export const VOCABULARY_DOCK_WIDTH_KEY = "ollie-reader-vocabulary-dock-width";

export const DOCK_WIDTH_MIN = 280;
export const DOCK_WIDTH_MAX = 560;
export const DOCK_WIDTH_DEFAULT = 360;

const DEFAULT_MODE: VocabularyPanelMode = "docked";

/** Keep a dock width inside the allowed range; non-finite input falls back. */
export function clampDockWidth(value: number): number {
  if (!Number.isFinite(value)) return DOCK_WIDTH_DEFAULT;
  return Math.min(Math.max(value, DOCK_WIDTH_MIN), DOCK_WIDTH_MAX);
}

export function readVocabularyPanelMode(): VocabularyPanelMode {
  try {
    const stored = localStorage.getItem(VOCABULARY_PANEL_MODE_KEY);
    if (stored === "floating" || stored === "docked") return stored;
  } catch {
    // localStorage not available
  }
  return DEFAULT_MODE;
}

export function writeVocabularyPanelMode(mode: VocabularyPanelMode): void {
  try {
    localStorage.setItem(VOCABULARY_PANEL_MODE_KEY, mode);
  } catch {
    // localStorage not available
  }
}

export function readVocabularyDockWidth(): number {
  try {
    const stored = localStorage.getItem(VOCABULARY_DOCK_WIDTH_KEY);
    if (stored !== null) {
      const parsed = Number.parseFloat(stored);
      if (Number.isFinite(parsed)) return clampDockWidth(parsed);
    }
  } catch {
    // localStorage not available
  }
  return DOCK_WIDTH_DEFAULT;
}

export function writeVocabularyDockWidth(width: number): void {
  try {
    localStorage.setItem(VOCABULARY_DOCK_WIDTH_KEY, String(clampDockWidth(width)));
  } catch {
    // localStorage not available
  }
}
```

- [ ] **Step 5: 跑測試確認通過**

Run: `npx vitest run src/utils/vocabularyPanelPreferences.test.ts`
Expected: PASS（15 tests）

- [ ] **Step 6: Commit**

```bash
git add src/types/pdf.ts src/utils/vocabularyPanelPreferences.ts src/utils/vocabularyPanelPreferences.test.ts
git commit -m "feat(vocab): add vocabulary panel mode and dock width preferences"
```

---

### Task 2: SettingsContext 提供面板模式

把模式接上全域設定，讓 `PdfReader` 與面板標題列共用同一份狀態。寬度不進 Context — 它只有 `WordPanelDock` 需要。

**Files:**
- Modify: `src/contexts/SettingsContextType.ts`
- Modify: `src/contexts/SettingsContext.tsx`
- Create: `src/contexts/SettingsContext.test.tsx`

**Interfaces:**
- Consumes: Task 1 的 `readVocabularyPanelMode`、`writeVocabularyPanelMode`、`VocabularyPanelMode`
- Produces: `useSettings()` 回傳值新增
  - `vocabularyPanelMode: VocabularyPanelMode`
  - `updateVocabularyPanelMode: (mode: VocabularyPanelMode) => void`

- [ ] **Step 1: 寫失敗的測試**

Create `src/contexts/SettingsContext.test.tsx`:

```tsx
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../hooks/useAuth", () => ({ useAuth: () => ({ user: null }) }));
vi.mock("../services/settingsService", () => ({
  getUserSettings: vi.fn().mockResolvedValue(null),
  saveUserSettings: vi.fn().mockResolvedValue(undefined),
  normalizeTtsEngine: () => "piper",
}));
vi.mock("../services/localBackend", () => ({
  getComputeMode: () => "auto",
  setComputeMode: vi.fn(),
}));

import { SettingsProvider } from "./SettingsContext";
import { useSettings } from "../hooks/useSettings";
import { VOCABULARY_PANEL_MODE_KEY } from "../utils/vocabularyPanelPreferences";

function Probe() {
  const { vocabularyPanelMode, updateVocabularyPanelMode } = useSettings();
  return (
    <button
      data-testid="probe"
      onClick={() =>
        updateVocabularyPanelMode(
          vocabularyPanelMode === "docked" ? "floating" : "docked",
        )
      }
    >
      {vocabularyPanelMode}
    </button>
  );
}

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
    .IS_REACT_ACT_ENVIRONMENT = true;
  localStorage.clear();
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

describe("SettingsContext vocabulary panel mode", () => {
  it("defaults to docked", () => {
    act(() => root.render(<SettingsProvider><Probe /></SettingsProvider>));
    expect(host.querySelector('[data-testid="probe"]')?.textContent).toBe("docked");
  });

  it("reads the stored preference on mount", () => {
    localStorage.setItem(VOCABULARY_PANEL_MODE_KEY, "floating");
    act(() => root.render(<SettingsProvider><Probe /></SettingsProvider>));
    expect(host.querySelector('[data-testid="probe"]')?.textContent).toBe("floating");
  });

  it("updates state and persists on change", () => {
    act(() => root.render(<SettingsProvider><Probe /></SettingsProvider>));
    const probe = host.querySelector<HTMLElement>('[data-testid="probe"]');

    act(() => probe?.click());

    expect(probe?.textContent).toBe("floating");
    expect(localStorage.getItem(VOCABULARY_PANEL_MODE_KEY)).toBe("floating");
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npx vitest run src/contexts/SettingsContext.test.tsx`
Expected: FAIL — TypeScript/runtime 錯誤，`vocabularyPanelMode` 不存在於 `useSettings()` 回傳值（`undefined` 導致 textContent 為空字串）

- [ ] **Step 3: 擴充 context 型別**

Modify `src/contexts/SettingsContextType.ts`:

第 2 行的 import 改為（加入 `VocabularyPanelMode`）：

```ts
import type {
  TTSMode,
  TTSEngine,
  ReadingMode,
  ComputeMode,
  VocabularyPanelMode,
} from "../types/pdf";
```

在 `showChineseTranslation: boolean;` 之後加一行：

```ts
  vocabularyPanelMode: VocabularyPanelMode;
```

在 `updateShowChineseTranslation: (show: boolean) => void;` 之後加一行：

```ts
  updateVocabularyPanelMode: (mode: VocabularyPanelMode) => void;
```

- [ ] **Step 4: Provider 實作**

Modify `src/contexts/SettingsContext.tsx`:

4a. 匯入型別 — 把既有的 `import type { TTSMode, TTSEngine, ReadingMode, ComputeMode } from "../types/pdf";` 改為：

```ts
import type {
  TTSMode,
  TTSEngine,
  ReadingMode,
  ComputeMode,
  VocabularyPanelMode,
} from "../types/pdf";
import {
  readVocabularyPanelMode,
  writeVocabularyPanelMode,
} from "../utils/vocabularyPanelPreferences";
```

4b. 在 `const [computeMode, setComputeModeState] = useState<ComputeMode>(getComputeMode);` 之後加：

```ts
  const [vocabularyPanelMode, setVocabularyPanelMode] =
    useState<VocabularyPanelMode>(readVocabularyPanelMode);
```

4c. 在 `updateComputeMode` 的 `useCallback` 之後加：

```ts
  const updateVocabularyPanelMode = useCallback((mode: VocabularyPanelMode) => {
    writeVocabularyPanelMode(mode);
    setVocabularyPanelMode(mode);
  }, []);
```

4d. 在 `useMemo` 的 value 物件與依賴陣列**兩處**都加入 `vocabularyPanelMode,` 與 `updateVocabularyPanelMode,`（value 物件放在 `computeMode,` 之後與 `updateComputeMode,` 之後；依賴陣列同樣位置）。

- [ ] **Step 5: 跑測試確認通過**

Run: `npx vitest run src/contexts/SettingsContext.test.tsx`
Expected: PASS（3 tests）

- [ ] **Step 6: 全套測試 + 型別檢查**

Run: `npm run test && npm run build`
Expected: 全部通過（`npm run build` 含 `tsc`）

- [ ] **Step 7: Commit**

```bash
git add src/contexts/SettingsContextType.ts src/contexts/SettingsContext.tsx src/contexts/SettingsContext.test.tsx
git commit -m "feat(vocab): expose vocabulary panel mode from settings context"
```

---

### Task 3: 抽出 WordPanelContent

純重構 + 新增兩個標題列控制項。行為不變（浮動模式外觀與操作完全一致），但內容從外殼獨立出來，供 Task 4 的停靠外殼重用。

**Files:**
- Create: `src/components/PdfReader/WordPanelContent.tsx`
- Create: `src/components/PdfReader/WordPanelContent.test.tsx`
- Modify: `src/components/PdfReader/WordPanel.tsx`（大幅縮減為浮動外殼）
- Modify: `src/hooks/useFloatingPanel.ts`（`export` 既有的 `FloatingPanelResult` interface）

**Interfaces:**
- Consumes: Task 1 的 `VocabularyPanelMode`
- Produces:
  - `WordPanelContent` — props 如下
  - `WordPanel` — props 移除 `isOpen`，新增 `onToggleMode`
  - `FloatingPanelResult` 成為 `useFloatingPanel.ts` 的具名匯出

```ts
// WordPanelContent.tsx
export interface WordPanelContentProps {
  mode: VocabularyPanelMode;
  lookups: LookupItem[];
  onDismiss: (id: string) => void;
  onDismissAll: () => void;
  onSpeak?: (text: string) => void;
  onLookupWord: (word: string) => void;
  onClose: () => void;
  onToggleMode: () => void;
  dragHandleProps?: FloatingPanelResult["dragHandleProps"] & {
    style: React.CSSProperties;
  };
  disableItemLayoutAnimation: boolean;
}

// WordPanel.tsx (floating shell)
export interface WordPanelProps {
  lookups: LookupItem[];
  onDismiss: (id: string) => void;
  onDismissAll: () => void;
  onSpeak?: (text: string) => void;
  onLookupWord: (word: string) => void;
  onClose: () => void;
  onToggleMode: () => void;
}
```

- [ ] **Step 1: 寫失敗的測試**

Create `src/components/PdfReader/WordPanelContent.test.tsx`:

```tsx
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  updateShowChineseTranslation: vi.fn(),
}));

vi.mock("../../hooks/useSettings", () => ({
  useSettings: () => ({
    showChineseTranslation: false,
    updateShowChineseTranslation: mocks.updateShowChineseTranslation,
  }),
}));
vi.mock("../../hooks/useVocabularySearch", () => ({
  useVocabularySearch: () => ({
    query: "",
    setQuery: vi.fn(),
    results: null,
    isSearching: false,
    clearSearch: vi.fn(),
  }),
}));

import { WordPanelContent } from "./WordPanelContent";
import type { LookupItem } from "../../hooks/useLookupQueue";

const completedLookup = {
  id: "1",
  type: "word",
  word: "tense",
  status: "done",
} as unknown as LookupItem;

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
    .IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks();
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

function renderContent(overrides: Partial<Record<string, unknown>> = {}) {
  const props = {
    mode: "docked" as const,
    lookups: [completedLookup],
    onDismiss: vi.fn(),
    onDismissAll: vi.fn(),
    onLookupWord: vi.fn(),
    onClose: vi.fn(),
    onToggleMode: vi.fn(),
    disableItemLayoutAnimation: false,
    ...overrides,
  };
  act(() => root.render(<WordPanelContent {...(props as never)} />));
  return props;
}

describe("WordPanelContent header controls", () => {
  it("fires onDismissAll from the clear button", () => {
    const props = renderContent();
    const clear = Array.from(host.querySelectorAll("button")).find(
      (b) => b.textContent?.trim() === "清除",
    );

    act(() => clear?.click());

    expect(props.onDismissAll).toHaveBeenCalledTimes(1);
  });

  it("fires onClose from the minimise button", () => {
    const props = renderContent();
    const close = host.querySelector<HTMLElement>('[data-testid="panel-close"]');

    act(() => close?.click());

    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it("fires onToggleMode from the dock toggle", () => {
    const props = renderContent();
    const toggle = host.querySelector<HTMLElement>('[data-testid="panel-mode-toggle"]');

    act(() => toggle?.click());

    expect(props.onToggleMode).toHaveBeenCalledTimes(1);
  });

  it("toggles the Chinese translation checkbox", () => {
    renderContent();
    const checkbox = host.querySelector<HTMLInputElement>('input[type="checkbox"]');

    act(() => checkbox?.click());

    expect(mocks.updateShowChineseTranslation).toHaveBeenCalledWith(true);
  });

  it("does not make the docked header a drag handle", () => {
    renderContent({ mode: "docked" });
    const header = host.querySelector<HTMLElement>('[data-testid="panel-header"]');

    expect(header?.style.cursor).toBe("");
  });

  it("makes the floating header a drag handle", () => {
    renderContent({
      mode: "floating",
      dragHandleProps: {
        onPointerDown: vi.fn(),
        style: { cursor: "grab", userSelect: "none", touchAction: "none" },
      },
    });
    const header = host.querySelector<HTMLElement>('[data-testid="panel-header"]');

    expect(header?.style.cursor).toBe("grab");
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npx vitest run src/components/PdfReader/WordPanelContent.test.tsx`
Expected: FAIL — `Failed to resolve import "./WordPanelContent"`

- [ ] **Step 3: 匯出 FloatingPanelResult**

Modify `src/hooks/useFloatingPanel.ts` — 把

```ts
interface FloatingPanelResult {
```

改成

```ts
export interface FloatingPanelResult {
```

- [ ] **Step 4: 建立 WordPanelContent**

Create `src/components/PdfReader/WordPanelContent.tsx`。

從 `src/components/PdfReader/WordPanel.tsx` **搬移**（剪下，不是複製）以下區塊到新檔案：

1. 全部的 inline SVG icon 元件：`BookMarkedIcon`、`SearchIcon`、`SpeakerIcon`、`MinusIcon`、`XIcon`、`ChevronDownIcon`、`ReturnIcon`
2. `WordDetail` 元件（含 `WordDetail.displayName`）
3. `SavedWordItem` 元件（含 `SavedWordItem.displayName`）
4. `WordPanel` 內部的所有 state/hook/衍生值計算與 JSX，但**不含** `motion.div` 外殼與右下角 resize handle

新檔案的頂部 imports：

```tsx
import { memo, useState, useRef, useEffect } from "react";
import type React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useVocabularySearch } from "../../hooks/useVocabularySearch";
import { useSettings } from "../../hooks/useSettings";
import type { FloatingPanelResult } from "../../hooks/useFloatingPanel";
import type { LookupItem } from "../../hooks/useLookupQueue";
import type { VocabularyWord } from "../../types/vocabulary";
import type { VocabularyPanelMode } from "../../types/pdf";
import { LookupResultCard } from "./LookupResultCard";
```

新增兩個 icon（停靠/浮動切換用），放在其他 icon 之後：

```tsx
const DockRightIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <rect x="3" y="4" width="18" height="16" rx="2" strokeWidth={1.5} />
    <path strokeLinecap="round" strokeWidth={1.5} d="M15 4v16" />
  </svg>
);

const FloatWindowIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <rect x="3" y="4" width="18" height="16" rx="2" strokeWidth={1.5} />
    <rect x="11" y="11" width="8" height="6" rx="1.5" strokeWidth={1.5} fill="currentColor" fillOpacity="0.15" />
  </svg>
);
```

元件本體：

```tsx
export interface WordPanelContentProps {
  mode: VocabularyPanelMode;
  lookups: LookupItem[];
  onDismiss: (id: string) => void;
  onDismissAll: () => void;
  onSpeak?: (text: string) => void;
  onLookupWord: (word: string) => void;
  onClose: () => void;
  onToggleMode: () => void;
  /** Only supplied by the floating shell; the docked header must not drag. */
  dragHandleProps?: FloatingPanelResult["dragHandleProps"];
  disableItemLayoutAnimation: boolean;
}

export const WordPanelContent = memo(
  ({
    mode,
    lookups,
    onDismiss,
    onDismissAll,
    onSpeak,
    onLookupWord,
    onClose,
    onToggleMode,
    dragHandleProps,
    disableItemLayoutAnimation,
  }: WordPanelContentProps) => {
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const { showChineseTranslation, updateShowChineseTranslation } = useSettings();
    const { query, setQuery, results, isSearching, clearSearch } =
      useVocabularySearch();

    const isDocked = mode === "docked";

    // Focus the search input on mount; reset search state on unmount.
    useEffect(() => {
      const timer = setTimeout(() => inputRef.current?.focus(), 100);
      return () => {
        clearTimeout(timer);
        setExpandedId(null);
        clearSearch();
      };
    }, [clearSearch]);

    const handleToggleExpand = (wordId: string) => {
      setExpandedId((prev) => (prev === wordId ? null : wordId));
    };

    const handleLookupSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      const word = query.trim();
      if (!word) return;
      onLookupWord(word);
    };

    // …（把 WordPanel 原本從 `const trimmedQuery = query.trim();` 到
    //     `showNoSavedHint` 的整段衍生值計算原封不動搬過來）

    return (
      <>
        {/* Header */}
        <div
          data-testid="panel-header"
          {...(dragHandleProps ?? {})}
          className="flex items-center justify-between px-4 py-3 border-b border-border-hairline shrink-0"
        >
          {/* …（原本的標題、badge、中 toggle、清除 按鈕原封不動搬過來）… */}

          {/* 新增：停靠 ⇄ 浮動 切換 */}
          <button
            type="button"
            data-testid="panel-mode-toggle"
            onClick={onToggleMode}
            className="btn btn-ghost btn-xs btn-circle hover:bg-black/5 dark:hover:bg-white/10"
            aria-label={isDocked ? "改為浮動視窗" : "停靠到側邊"}
            title={isDocked ? "改為浮動視窗" : "停靠到側邊"}
          >
            {isDocked ? <FloatWindowIcon /> : <DockRightIcon />}
          </button>

          <button
            type="button"
            data-testid="panel-close"
            onClick={onClose}
            className="btn btn-ghost btn-xs btn-circle hover:bg-black/5 dark:hover:bg-white/10"
            aria-label={isDocked ? "關閉側欄" : "收合面板"}
          >
            <MinusIcon />
          </button>
        </div>

        {/* …（搜尋框 + 合併清單原封不動搬過來）… */}
      </>
    );
  },
);

WordPanelContent.displayName = "WordPanelContent";
```

**重要細節：**
- 標題列的 `style` 由 `dragHandleProps` 帶入。停靠模式不傳 `dragHandleProps`，所以標題列沒有 `cursor: grab`、也沒有 `onPointerDown` — 這正是測試 5/6 驗證的行為。
- 浮動模式的「拖曳中變 grabbing 游標」交給 Task 3 Step 5 的 `WordPanel` 組合好再傳進來。
- 標題列右側的按鈕群（`中` toggle、`清除`、模式切換、`—`）仍包在原本的 `<div className="flex items-center gap-1 shrink-0">` 內。

- [ ] **Step 5: 改寫 WordPanel 為浮動外殼**

Modify `src/components/PdfReader/WordPanel.tsx` — 搬走上述內容後，整個檔案剩下：

```tsx
import { memo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useFloatingPanel } from "../../hooks/useFloatingPanel";
import type { LookupItem } from "../../hooks/useLookupQueue";
import { WordPanelContent } from "./WordPanelContent";

interface WordPanelProps {
  lookups: LookupItem[];
  onDismiss: (id: string) => void;
  onDismissAll: () => void;
  onSpeak?: (text: string) => void;
  onLookupWord: (word: string) => void;
  onClose: () => void;
  onToggleMode: () => void;
}

/** Floating shell: draggable, resizable window that overlays the reader. */
export const WordPanel = memo((props: WordPanelProps) => {
  const {
    panelStyle,
    dragHandleProps,
    resizeHandleProps,
    isDragging,
    isResizing,
  } = useFloatingPanel({
    defaultPosition: {
      x: window.innerWidth - 360 - 24,
      y: window.innerHeight - 480 - 24,
    },
    defaultSize: { width: 360, height: 480 },
    minSize: { width: 260, height: 240 },
    maxSize: { width: 560, height: 760 },
  });

  return (
    <AnimatePresence mode="wait">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.2 }}
        style={{ ...panelStyle, overflow: "hidden" }}
        className="bg-base-100/90 backdrop-blur-xl rounded-2xl border border-border-hairline shadow-floating flex flex-col"
      >
        <WordPanelContent
          {...props}
          mode="floating"
          dragHandleProps={{
            ...dragHandleProps,
            style: {
              ...dragHandleProps.style,
              cursor: isDragging ? "grabbing" : "grab",
            },
          }}
          disableItemLayoutAnimation={isDragging || isResizing}
        />

        {/* Resize handle */}
        <div
          {...resizeHandleProps}
          className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize"
        >
          <svg
            className="w-3 h-3 text-base-content/20 absolute bottom-0.5 right-0.5"
            viewBox="0 0 6 6"
          >
            <circle cx="4.5" cy="1.5" r="0.75" fill="currentColor" />
            <circle cx="1.5" cy="4.5" r="0.75" fill="currentColor" />
            <circle cx="4.5" cy="4.5" r="0.75" fill="currentColor" />
          </svg>
        </div>
      </motion.div>
    </AnimatePresence>
  );
});

WordPanel.displayName = "WordPanel";
```

- [ ] **Step 6: 跑測試確認通過**

Run: `npx vitest run src/components/PdfReader/WordPanelContent.test.tsx`
Expected: PASS（6 tests）

注意：此時 `npm run build` 會因 `PdfReader.tsx` 仍傳 `isOpen` 給 `WordPanel` 而失敗 — 那是 Task 5 的工作，屬預期。

- [ ] **Step 7: Commit**

```bash
git add src/hooks/useFloatingPanel.ts src/components/PdfReader/WordPanel.tsx src/components/PdfReader/WordPanelContent.tsx src/components/PdfReader/WordPanelContent.test.tsx
git commit -m "refactor(vocab): split word panel content from its floating shell"
```

---

### Task 4: WordPanelDock 停靠外殼

**Files:**
- Create: `src/components/PdfReader/WordPanelDock.tsx`
- Create: `src/components/PdfReader/WordPanelDock.test.tsx`

**Interfaces:**
- Consumes: Task 1 的寬度工具、Task 3 的 `WordPanelContent`
- Produces: `WordPanelDock`，props 與 `WordPanelProps` 相同（`lookups`、`onDismiss`、`onDismissAll`、`onSpeak?`、`onLookupWord`、`onClose`、`onToggleMode`）

- [ ] **Step 1: 寫失敗的測試**

Create `src/components/PdfReader/WordPanelDock.test.tsx`:

```tsx
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./WordPanelContent", () => ({
  WordPanelContent: ({ mode }: { mode: string }) => (
    <div data-testid="content" data-mode={mode} />
  ),
}));

import { WordPanelDock } from "./WordPanelDock";
import {
  DOCK_WIDTH_DEFAULT,
  DOCK_WIDTH_MAX,
  DOCK_WIDTH_MIN,
  VOCABULARY_DOCK_WIDTH_KEY,
} from "../../utils/vocabularyPanelPreferences";

function pointerEvent(type: string, clientX: number): Event {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, clientX });
  Object.defineProperty(event, "pointerId", { value: 1 });
  return event;
}

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
    .IS_REACT_ACT_ENVIRONMENT = true;
  localStorage.clear();
  Object.defineProperty(HTMLElement.prototype, "setPointerCapture", {
    configurable: true,
    value() {},
  });
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

function renderDock() {
  act(() =>
    root.render(
      <WordPanelDock
        lookups={[]}
        onDismiss={vi.fn()}
        onDismissAll={vi.fn()}
        onLookupWord={vi.fn()}
        onClose={vi.fn()}
        onToggleMode={vi.fn()}
      />,
    ),
  );
}

describe("WordPanelDock", () => {
  it("renders the shared content in docked mode", () => {
    renderDock();
    expect(
      host.querySelector('[data-testid="content"]')?.getAttribute("data-mode"),
    ).toBe("docked");
  });

  it("starts at the stored width", () => {
    localStorage.setItem(VOCABULARY_DOCK_WIDTH_KEY, "420");
    renderDock();
    const aside = host.querySelector<HTMLElement>('[data-testid="vocab-dock"]');
    expect(aside?.style.width).toBe("420px");
  });

  it("defaults its width when nothing is stored", () => {
    renderDock();
    const aside = host.querySelector<HTMLElement>('[data-testid="vocab-dock"]');
    expect(aside?.style.width).toBe(`${DOCK_WIDTH_DEFAULT}px`);
  });

  it("widens when the left edge is dragged left and persists the result", () => {
    renderDock();
    const aside = host.querySelector<HTMLElement>('[data-testid="vocab-dock"]');
    const grip = host.querySelector<HTMLElement>('[data-testid="vocab-dock-resize"]');

    act(() => {
      grip?.dispatchEvent(pointerEvent("pointerdown", 800));
      window.dispatchEvent(pointerEvent("pointermove", 760));
    });
    expect(aside?.style.width).toBe(`${DOCK_WIDTH_DEFAULT + 40}px`);

    act(() => {
      window.dispatchEvent(pointerEvent("pointerup", 760));
    });
    expect(localStorage.getItem(VOCABULARY_DOCK_WIDTH_KEY)).toBe(
      String(DOCK_WIDTH_DEFAULT + 40),
    );
  });

  it("clamps the dragged width to the allowed range", () => {
    renderDock();
    const aside = host.querySelector<HTMLElement>('[data-testid="vocab-dock"]');
    const grip = host.querySelector<HTMLElement>('[data-testid="vocab-dock-resize"]');

    act(() => {
      grip?.dispatchEvent(pointerEvent("pointerdown", 800));
      window.dispatchEvent(pointerEvent("pointermove", 100));
    });
    expect(aside?.style.width).toBe(`${DOCK_WIDTH_MAX}px`);

    act(() => {
      window.dispatchEvent(pointerEvent("pointermove", 1600));
    });
    expect(aside?.style.width).toBe(`${DOCK_WIDTH_MIN}px`);
  });

  it("stops resizing after pointerup", () => {
    renderDock();
    const aside = host.querySelector<HTMLElement>('[data-testid="vocab-dock"]');
    const grip = host.querySelector<HTMLElement>('[data-testid="vocab-dock-resize"]');

    act(() => {
      grip?.dispatchEvent(pointerEvent("pointerdown", 800));
      window.dispatchEvent(pointerEvent("pointermove", 780));
      window.dispatchEvent(pointerEvent("pointerup", 780));
      window.dispatchEvent(pointerEvent("pointermove", 400));
    });

    expect(aside?.style.width).toBe(`${DOCK_WIDTH_DEFAULT + 20}px`);
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npx vitest run src/components/PdfReader/WordPanelDock.test.tsx`
Expected: FAIL — `Failed to resolve import "./WordPanelDock"`

- [ ] **Step 3: 實作停靠外殼**

Create `src/components/PdfReader/WordPanelDock.tsx`:

```tsx
import { memo, useCallback, useEffect, useRef, useState } from "react";
import type React from "react";
import type { LookupItem } from "../../hooks/useLookupQueue";
import {
  clampDockWidth,
  readVocabularyDockWidth,
  writeVocabularyDockWidth,
} from "../../utils/vocabularyPanelPreferences";
import { WordPanelContent } from "./WordPanelContent";

interface WordPanelDockProps {
  lookups: LookupItem[];
  onDismiss: (id: string) => void;
  onDismissAll: () => void;
  onSpeak?: (text: string) => void;
  onLookupWord: (word: string) => void;
  onClose: () => void;
  onToggleMode: () => void;
}

/**
 * Docked shell: a right-hand rail that is a flex sibling of the PDF viewer box,
 * so it stays put while the PDF scrolls inside its own container.
 */
export const WordPanelDock = memo((props: WordPanelDockProps) => {
  const [width, setWidth] = useState<number>(readVocabularyDockWidth);
  const [isResizing, setIsResizing] = useState(false);
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => () => cleanupRef.current?.(), []);

  const handleResizePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      const pointerId = e.pointerId;
      const grip = e.currentTarget as HTMLElement;
      grip.setPointerCapture(pointerId);

      const startX = e.clientX;
      const startWidth = width;
      let latestWidth = startWidth;
      setIsResizing(true);

      const handleMove = (ev: PointerEvent) => {
        // Dragging left (smaller clientX) widens the right-hand rail.
        latestWidth = clampDockWidth(startWidth + (startX - ev.clientX));
        setWidth(latestWidth);
      };

      const cleanup = () => {
        window.removeEventListener("pointermove", handleMove);
        window.removeEventListener("pointerup", handleEnd);
        window.removeEventListener("pointercancel", handleEnd);
        grip.removeEventListener("lostpointercapture", handleEnd);
        cleanupRef.current = null;
        setIsResizing(false);
      };

      const handleEnd = () => {
        writeVocabularyDockWidth(latestWidth);
        cleanup();
      };

      cleanupRef.current = cleanup;
      window.addEventListener("pointermove", handleMove);
      window.addEventListener("pointerup", handleEnd);
      window.addEventListener("pointercancel", handleEnd);
      grip.addEventListener("lostpointercapture", handleEnd);
    },
    [width],
  );

  return (
    <aside
      data-testid="vocab-dock"
      style={{ width }}
      className="relative hidden shrink-0 flex-col overflow-hidden rounded-xl border border-border-hairline bg-base-100 shadow-elevated lg:flex"
    >
      {/* Left-edge resize grip */}
      <div
        data-testid="vocab-dock-resize"
        onPointerDown={handleResizePointerDown}
        style={{ touchAction: "none" }}
        className={`absolute inset-y-0 left-0 z-10 w-1.5 cursor-ew-resize transition-colors ${
          isResizing ? "bg-accent/40" : "hover:bg-accent/20"
        }`}
        aria-label="調整生詞本寬度"
        role="separator"
      />

      <WordPanelContent
        {...props}
        mode="docked"
        disableItemLayoutAnimation={isResizing}
      />
    </aside>
  );
});

WordPanelDock.displayName = "WordPanelDock";
```

- [ ] **Step 4: 跑測試確認通過**

Run: `npx vitest run src/components/PdfReader/WordPanelDock.test.tsx`
Expected: PASS（6 tests）

- [ ] **Step 5: Commit**

```bash
git add src/components/PdfReader/WordPanelDock.tsx src/components/PdfReader/WordPanelDock.test.tsx
git commit -m "feat(vocab): add docked vocabulary panel shell with resizable width"
```

---

### Task 5: PdfReader 版型與模式切換

**Files:**
- Modify: `src/components/PdfReader.tsx`
- Modify: `src/components/PdfReader.test.tsx`

**Interfaces:**
- Consumes: Task 2 的 `vocabularyPanelMode`/`updateVocabularyPanelMode`、Task 3 的 `WordPanel`、Task 4 的 `WordPanelDock`、既有 `useIsDesktop`
- Produces: 無（終端消費者）

- [ ] **Step 1: 寫失敗的測試**

Modify `src/components/PdfReader.test.tsx`。

1a. 在既有的 `mocks` 物件（`vi.hoisted`）加入兩個欄位：

```ts
const mocks = vi.hoisted(() => ({
  usePdfState: vi.fn(),
  clearSelection: vi.fn(),
  fetchBookingRecords: vi.fn(),
  useIsDesktop: vi.fn(),
  vocabularyPanelMode: { current: "docked" as "docked" | "floating" },
  updateVocabularyPanelMode: vi.fn(),
}));
```

1b. 在既有 mocks 之後新增：

```ts
vi.mock("../hooks/useMediaQuery", () => ({
  useIsDesktop: mocks.useIsDesktop,
  useMediaQuery: vi.fn(),
}));
vi.mock("../hooks/useSettings", () => ({
  useSettings: () => ({
    vocabularyPanelMode: mocks.vocabularyPanelMode.current,
    updateVocabularyPanelMode: mocks.updateVocabularyPanelMode,
  }),
}));
```

1c. 把既有的 `vi.mock("./PdfReader/WordPanel", …)` 換成兩個具辨識度的替身：

```ts
vi.mock("./PdfReader/WordPanel", () => ({
  WordPanel: ({ onToggleMode }: { onToggleMode: () => void }) => (
    <div data-testid="word-panel-floating" onClick={onToggleMode} />
  ),
}));
vi.mock("./PdfReader/WordPanelDock", () => ({
  WordPanelDock: ({ onToggleMode }: { onToggleMode: () => void }) => (
    <div data-testid="word-panel-dock" onClick={onToggleMode} />
  ),
}));
```

1d. 在 `beforeEach` 的 `vi.clearAllMocks();` 之後加：

```ts
  mocks.useIsDesktop.mockReturnValue(true);
  mocks.vocabularyPanelMode.current = "docked";
```

1e. 在檔案尾端新增一個 describe：

```tsx
describe("PdfReader vocabulary panel placement", () => {
  function openPanel() {
    act(() => root.render(<PdfReader />));
    const fab = host.querySelector<HTMLElement>('[aria-label="開啟生詞本"]');
    act(() => fab?.click());
  }

  it("docks the panel beside the PDF on desktop", () => {
    openPanel();

    expect(host.querySelector('[data-testid="word-panel-dock"]')).not.toBeNull();
    expect(host.querySelector('[data-testid="word-panel-floating"]')).toBeNull();
  });

  it("falls back to the floating panel below the lg breakpoint", () => {
    mocks.useIsDesktop.mockReturnValue(false);
    openPanel();

    expect(host.querySelector('[data-testid="word-panel-dock"]')).toBeNull();
    expect(host.querySelector('[data-testid="word-panel-floating"]')).not.toBeNull();
  });

  it("floats when the stored preference is floating", () => {
    mocks.vocabularyPanelMode.current = "floating";
    openPanel();

    expect(host.querySelector('[data-testid="word-panel-floating"]')).not.toBeNull();
    expect(host.querySelector('[data-testid="word-panel-dock"]')).toBeNull();
  });

  it("renders no panel until it is opened", () => {
    act(() => root.render(<PdfReader />));

    expect(host.querySelector('[data-testid="word-panel-dock"]')).toBeNull();
    expect(host.querySelector('[data-testid="word-panel-floating"]')).toBeNull();
  });

  it("switches the stored mode from the panel toggle", () => {
    openPanel();
    const dock = host.querySelector<HTMLElement>('[data-testid="word-panel-dock"]');

    act(() => dock?.click());

    expect(mocks.updateVocabularyPanelMode).toHaveBeenCalledWith("floating");
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npx vitest run src/components/PdfReader.test.tsx`
Expected: FAIL — 找不到 `word-panel-dock`（`PdfReader` 目前只渲染 `WordPanel`）

- [ ] **Step 3: 接上 PdfReader**

Modify `src/components/PdfReader.tsx`:

3a. 新增 imports（放在既有的 `import { WordPanel } from "./PdfReader/WordPanel";` 附近）：

```ts
import { WordPanelDock } from "./PdfReader/WordPanelDock";
import { useIsDesktop } from "../hooks/useMediaQuery";
import { useSettings } from "../hooks/useSettings";
```

3b. 在 `const [wordPanelOpen, setWordPanelOpen] = useState(false);` 附近加：

```ts
  const isDesktop = useIsDesktop();
  const { vocabularyPanelMode, updateVocabularyPanelMode } = useSettings();
  const isDocked = vocabularyPanelMode === "docked" && isDesktop;

  const toggleVocabularyPanelMode = () =>
    updateVocabularyPanelMode(
      vocabularyPanelMode === "docked" ? "floating" : "docked",
    );
```

3c. 把 PDF 區塊（原本的 `{pdfUrl && (<div className="space-y-6"><div className="overflow-hidden rounded-xl …">`）改為：

```tsx
      {pdfUrl && (
        <div className="space-y-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-stretch">
            <div className="min-w-0 flex-1 overflow-hidden rounded-xl border border-border-hairline bg-base-100 shadow-elevated">
              <PdfViewer
                url={pdfUrl}
                pagesByNumber={pagesByNumber}
                onSpeak={speak}
                onTextSelection={handleTextSelection}
                isLoadingAudio={isLoadingAudio}
                isSpeaking={isSpeaking}
                initialScrollPosition={initialScrollPosition}
                onScrollPositionChange={saveScrollPosition}
              />
            </div>

            {isDocked && wordPanelOpen && (
              <WordPanelDock
                lookups={lookups}
                onDismiss={dismissLookup}
                onDismissAll={dismissAll}
                onSpeak={speak}
                onLookupWord={handleLookupTypedWord}
                onClose={() => setWordPanelOpen(false)}
                onToggleMode={toggleVocabularyPanelMode}
              />
            )}
          </div>
        </div>
      )}
```

3d. 把檔尾的 `<WordPanel isOpen={wordPanelOpen} … />` 改為只在浮動模式渲染：

```tsx
      {/* Floating shell — used when the user prefers it, or below the lg breakpoint */}
      {!isDocked && wordPanelOpen && (
        <WordPanel
          lookups={lookups}
          onDismiss={dismissLookup}
          onDismissAll={dismissAll}
          onSpeak={speak}
          onLookupWord={handleLookupTypedWord}
          onClose={() => setWordPanelOpen(false)}
          onToggleMode={toggleVocabularyPanelMode}
        />
      )}
```

- [ ] **Step 4: 跑測試確認通過**

Run: `npx vitest run src/components/PdfReader.test.tsx`
Expected: PASS（原本 2 tests + 新增 5 tests）

- [ ] **Step 5: 全套驗證**

Run: `npm run test && npm run build && npm run lint`
Expected: 測試全過、build 過（含 `tsc`）、lint 0 errors

- [ ] **Step 6: Commit**

```bash
git add src/components/PdfReader.tsx src/components/PdfReader.test.tsx
git commit -m "feat(reader): dock the vocabulary panel beside the PDF viewer"
```

---

### Task 6: 瀏覽器實測

單元測試無法涵蓋版型與捲動行為，spec §7 要求實機驗證。

**Files:**
- 視發現的問題修正前述檔案；本任務不預期新增檔案。

**Interfaces:**
- Consumes: Task 5 完成的整合結果
- Produces: 無

- [ ] **Step 1: 啟動開發伺服器並開啟閱讀器**

用 preview 工具啟動 `ollie-reader-dev`（**不要**用 Bash 跑 dev server），載入一份 PDF，開啟生詞本，查 2–3 個單字讓清單有內容。

- [ ] **Step 2: 逐項確認 spec §7 的瀏覽器清單**

1. 停靠模式下 PDF 完全不被遮擋（截圖存證）
2. 在 PDF 盒子內捲動數頁 → 右欄位置不變
3. 拖曳右欄左緣調寬 → PDF 欄同步縮窄，放開後重新整理仍記得寬度
4. `resize_window` 縮到 1000px 寬 → 自動變浮動面板；拉回 1280px → 自動變回停靠
5. 點標題列切換鈕 → 浮動 ⇄ 停靠雙向可用；重新整理後記得選擇
6. 停靠模式下 `清除`、`—`、`中` 三個控制項都可點（回歸檢查上次修好的指標擷取 bug）

- [ ] **Step 3: 檢查 console 與網路**

用 `read_console_messages`（`onlyErrors: true`）確認沒有新的錯誤。

- [ ] **Step 4: 修正發現的問題**

若有問題，先寫失敗的單元測試（若該行為可被單元測試涵蓋），再修，再回到 Step 2 重驗。

- [ ] **Step 5: 更新 spec 狀態並 commit**

把 spec 的 `status:` 從 `approved design, pending implementation plan` 改為 `implemented`。

```bash
git add docs/superpowers/specs/2026-08-18-vocabulary-panel-dock-design.md
git commit -m "docs: mark docked vocabulary panel spec as implemented"
```

---

## Self-Review

**1. Spec coverage**

| Spec 段落 | 對應 Task |
|-----------|-----------|
| §4 不需 sticky 的前提 | Task 5 Step 3c（flex 兄弟 + `items-stretch`） |
| §5.1 元件拆分 | Task 3（`WordPanelContent` + 瘦身 `WordPanel`）、Task 4（`WordPanelDock`） |
| §5.1 只掛載一個外殼 | Task 5 Step 3c/3d（互斥條件）＋ Task 5 測試 1–3 |
| §5.1 移除 `isOpen` | Task 3 Step 5（`WordPanelProps` 無 `isOpen`）、Task 5 Step 3d |
| §5.1 `export FloatingPanelResult` | Task 3 Step 3 |
| §5.2 版型與樣式 | Task 5 Step 3c、Task 4 Step 3（`rounded-xl border … shadow-elevated`，無 backdrop-blur） |
| §5.3 模式狀態與預設 docked | Task 1（讀寫）、Task 2（context） |
| §5.3 窄螢幕自動退回、偏好不變 | Task 5 Step 3b + 測試 2 |
| §5.4 寬度 280–560、持久化、指標拖曳 | Task 1 + Task 4 |
| §5.5 開關與 FAB 語意 | Task 5 Step 3c/3d（`wordPanelOpen` 兩模式共用）；FAB 與 Cmd+K 既有邏輯不動 |
| §6 錯誤處理（localStorage、無效值、matchMedia） | Task 1 測試（拋錯、無效值、非數字）；matchMedia 由既有 `useMediaQuery` 保證 |
| §7 單元測試 1–5 | Task 1、2、3、4、5 |
| §7 瀏覽器實測 | Task 6 |
| §8 動到的檔案 | 全部涵蓋 |

無缺口。

**2. Placeholder scan**

Task 3 Step 4 的元件本體含三處「原封不動搬過來」的省略註記。這是刻意的：那些是從既有檔案**剪下貼上**的既有程式碼（衍生值計算、搜尋框、合併清單），把 400 行原樣重印進計畫只會增加抄錯的機會，且註記明確指出來源檔案與起訖位置。其餘所有新程式碼皆完整列出。

**3. Type consistency**

- `VocabularyPanelMode` 定義於 `src/types/pdf.ts`（Task 1 Step 3），Task 1/2/3 一致引用。
- `WordPanelContentProps` 的欄位（Task 3）與 `WordPanelDock` 傳入的 props（Task 4 Step 3 的 `{...props} mode="docked" disableItemLayoutAnimation`）、`WordPanel` 傳入的 props（Task 3 Step 5）三處一致。
- `WordPanelProps` 與 `WordPanelDockProps` 欄位相同，Task 5 兩處呼叫端傳入的參數一致。
- 寬度常數 `DOCK_WIDTH_MIN/MAX/DEFAULT` 在 Task 1 定義，Task 4 的實作與測試一致引用。
- localStorage key 常數名稱 `VOCABULARY_PANEL_MODE_KEY`/`VOCABULARY_DOCK_WIDTH_KEY` 在 Task 1、2、4 一致。
