# Lookup Panel Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the reader's floating "查詢結果" lookup panel easier to read — larger definition text, a taller default window, and a top search row for typing a word to look it up directly.

**Architecture:** All UI changes live in `LookupPanel.tsx` (text sizes, panel size options, a new optional `onLookupWord` prop + search row). The two call sites (`PdfReader.tsx`, `ShowSubtitlesPage.tsx`) each pass a thin handler that calls the existing `startLookup` and surfaces the existing toast feedback. No changes to the queue hook or lookup service.

**Tech Stack:** React 19 + TypeScript (strict), Tailwind CSS v4 + DaisyUI, Framer Motion, lucide-react (`^0.575.0`, already a dependency).

**Testing note:** This project has **no test framework** (build = `tsc -b && vite build`, lint = `eslint .`). Introducing a test harness for three small UI tweaks would violate YAGNI and the "follow existing patterns" rule. Each task is verified by `npm run build` (type-check), `npm run lint`, and a manual browser check — the project's existing verification path.

---

## File Structure

| File | Responsibility | Change |
|------|----------------|--------|
| `src/components/PdfReader/LookupPanel.tsx` | Floating lookup panel UI | Enlarge body text; taller default/max size; add optional `onLookupWord` prop + top search row |
| `src/components/PdfReader.tsx` | PDF reader page | Pass `onLookupWord` handler (with PDF source context + toasts) |
| `src/components/ShowSubtitles/ShowSubtitlesPage.tsx` | Subtitles page | Pass `onLookupWord` handler (with toasts) |

---

### Task 1: Enlarge body text and make the panel taller

**Files:**
- Modify: `src/components/PdfReader/LookupPanel.tsx`

Visual-only change. Bump reading content up one Tailwind size step (chrome text — status, badges, header title — stays the same), and grow the panel's default and max height.

- [ ] **Step 1: Enlarge the word title**

In `LookupItemCard`, the word title span (around line 87):

```tsx
// Before
<span className={`font-semibold text-base ${isTranslation ? "line-clamp-2" : "truncate"}`}>
// After
<span className={`font-semibold text-lg ${isTranslation ? "line-clamp-2" : "truncate"}`}>
```

- [ ] **Step 2: Enlarge the phonetic line**

Around line 134:

```tsx
// Before
<p className="text-xs text-base-content/40 italic">
// After
<p className="text-sm text-base-content/40 italic">
```

- [ ] **Step 3: Enlarge the definition body (part-of-speech inherits)**

Around line 139:

```tsx
// Before
<div key={i} className="text-sm leading-relaxed">
// After
<div key={i} className="text-base leading-relaxed">
```

The part-of-speech `<span>` and definition `<span>` inside this div have no explicit size, so they inherit `text-base`. Leave them unchanged.

- [ ] **Step 4: Enlarge the Chinese gloss**

Around line 149:

```tsx
// Before
<p className="text-base-content/50 text-xs mt-0.5 pl-1">
// After
<p className="text-base-content/50 text-sm mt-0.5 pl-1">
```

- [ ] **Step 5: Enlarge the translation / plain-text fallback**

Around line 159:

```tsx
// Before
<p className="mt-2 text-sm leading-relaxed whitespace-pre-line text-base-content/70">
// After
<p className="mt-2 text-base leading-relaxed whitespace-pre-line text-base-content/70">
```

- [ ] **Step 6: Grow the panel's default and max height**

In the `LookupPanel` component, the `useFloatingPanel` options object (around lines 187-190):

```tsx
// Before
    const { panelStyle, dragHandleProps, resizeHandleProps, isDragging, isResizing } =
      useFloatingPanel({
      defaultSize: { width: 320, height: 384 },
      minSize: { width: 240, height: 200 },
      maxSize: { width: 600, height: 600 },
      });
// After
    const { panelStyle, dragHandleProps, resizeHandleProps, isDragging, isResizing } =
      useFloatingPanel({
      defaultSize: { width: 320, height: 520 },
      minSize: { width: 240, height: 200 },
      maxSize: { width: 600, height: 760 },
      });
```

Do **not** edit `useFloatingPanel.ts` — only the options the panel requests change.

- [ ] **Step 7: Type-check and lint**

Run: `npm run build && npm run lint`
Expected: build completes with no TypeScript errors; lint reports no new errors.

- [ ] **Step 8: Manual check**

Run: `npm run dev`, open the PDF reader, select a word to trigger a lookup.
Expected: definition text is visibly larger than before, and the panel starts noticeably taller (~520px). The panel still drags and resizes.

- [ ] **Step 9: Commit**

```bash
git add src/components/PdfReader/LookupPanel.tsx
git commit -m "feat(lookup): Enlarge panel body text and increase height"
```

---

### Task 2: Add the top search row (type-to-look-up)

**Files:**
- Modify: `src/components/PdfReader/LookupPanel.tsx`

Add an optional `onLookupWord` prop and a fixed search row below the header. The row only renders when the prop is provided, so this task is safe to ship before the call sites are wired (Tasks 3-4) — the input simply won't appear yet.

- [ ] **Step 1: Import the Search icon and `useRef`**

Update the React import (line 1) and add the lucide import. Line 1:

```tsx
// Before
import { memo, useState } from "react";
// After
import { memo, useRef, useState } from "react";
```

Add directly below the existing imports (after the `useSettings` import, around line 5):

```tsx
import { Search } from "lucide-react";
```

- [ ] **Step 2: Add the prop to `LookupPanelProps`**

In the `LookupPanelProps` interface (around lines 37-43):

```tsx
// Before
interface LookupPanelProps {
  lookups: LookupItem[];
  onDismiss: (id: string) => void;
  onDismissAll: () => void;
  onSpeak?: (word: string) => void;
  showSignal?: number;
}
// After
interface LookupPanelProps {
  lookups: LookupItem[];
  onDismiss: (id: string) => void;
  onDismissAll: () => void;
  onSpeak?: (word: string) => void;
  onLookupWord?: (word: string) => void;
  showSignal?: number;
}
```

- [ ] **Step 3: Destructure the new prop and add input state**

Update the `LookupPanel` component signature (around line 180):

```tsx
// Before
  ({ lookups, onDismiss, onDismissAll, onSpeak, showSignal }: LookupPanelProps) => {
    const [collapsedToken, setCollapsedToken] = useState<number | "nosignal" | null>(
      null,
    );
// After
  ({ lookups, onDismiss, onDismissAll, onSpeak, onLookupWord, showSignal }: LookupPanelProps) => {
    const [collapsedToken, setCollapsedToken] = useState<number | "nosignal" | null>(
      null,
    );
    const [searchInput, setSearchInput] = useState("");
    const searchInputRef = useRef<HTMLInputElement>(null);
```

- [ ] **Step 4: Add a submit handler**

Add this handler inside the `LookupPanel` component body, just before the `if (lookups.length === 0) return null;` line (around line 195):

```tsx
    const handleSearchSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      const word = searchInput.trim();
      if (!word || !onLookupWord) return;
      onLookupWord(word);
      setSearchInput("");
      searchInputRef.current?.focus();
    };
```

- [ ] **Step 5: Render the search row between the header and the items**

Insert this block immediately after the closing `</div>` of the header (the draggable header block ends around line 284, right before the `{/* Items */}` comment):

```tsx
          {/* Search row — type a word to look it up directly */}
          {onLookupWord && (
            <div className="px-3 py-2 border-b border-black/5 dark:border-white/10 shrink-0">
              <form onSubmit={handleSearchSubmit} className="relative flex items-center">
                <Search
                  className="w-4 h-4 text-base-content/40 absolute left-2.5 pointer-events-none"
                  strokeWidth={1.5}
                />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="輸入單字查詢…"
                  aria-label="輸入單字查詢"
                  className="w-full rounded-[6px] border border-black/5 dark:border-white/10 bg-base-200/50 py-1.5 pl-8 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent placeholder:text-base-content/40"
                />
              </form>
            </div>
          )}
```

The row sits between the `shrink-0` header and the `flex-1 ... overflow-y-auto` items container, so it stays fixed while cards scroll. The header is the only drag handle, so typing here never starts a drag.

- [ ] **Step 6: Type-check and lint**

Run: `npm run build && npm run lint`
Expected: build completes with no TypeScript errors; lint reports no new errors. (The search row is not visible yet because no caller passes `onLookupWord`.)

- [ ] **Step 7: Commit**

```bash
git add src/components/PdfReader/LookupPanel.tsx
git commit -m "feat(lookup): Add optional top search row to lookup panel"
```

---

### Task 3: Wire up typed lookups in the PDF reader

**Files:**
- Modify: `src/components/PdfReader.tsx`

`startLookup`, `addToast`, and `selectedFile` are already in scope (used by the existing `handleLookupWord` around line 166).

- [ ] **Step 1: Add a typed-word handler**

Add this handler next to the existing `handleLookupWord` (immediately after it, around line 183):

```tsx
  // Lookup a word typed directly into the panel's search row
  const handleLookupTypedWord = (word: string) => {
    const trimmed = word.trim();
    if (!trimmed) return;

    const result = startLookup(trimmed, {
      sourcePdfName: selectedFile?.name,
    });

    if (result === "duplicate") {
      addToast(`「${trimmed}」正在查詢中`, "info");
    } else if (result === "max_reached") {
      addToast("同時查詢數量已達上限", "error");
    }
  };
```

- [ ] **Step 2: Pass the handler to `LookupPanel`**

In the `LookupPanel` JSX (around lines 380-386):

```tsx
// Before
      <LookupPanel
        lookups={lookups}
        showSignal={requestSignal}
        onDismiss={dismissLookup}
        onDismissAll={dismissAll}
        onSpeak={speak}
      />
// After
      <LookupPanel
        lookups={lookups}
        showSignal={requestSignal}
        onDismiss={dismissLookup}
        onDismissAll={dismissAll}
        onSpeak={speak}
        onLookupWord={handleLookupTypedWord}
      />
```

- [ ] **Step 3: Type-check and lint**

Run: `npm run build && npm run lint`
Expected: build completes with no TypeScript errors; lint reports no new errors.

- [ ] **Step 4: Manual check**

Run: `npm run dev`, open the PDF reader, open the lookup panel (look up any word first so the panel is visible), then type a word into the search row and press Enter.
Expected: a new lookup card appears at the top of the list; the input clears and keeps focus. Typing a word already loading shows the info toast; exceeding the concurrent limit shows the error toast.

- [ ] **Step 5: Commit**

```bash
git add src/components/PdfReader.tsx
git commit -m "feat(lookup): Wire typed-word lookups in PDF reader"
```

---

### Task 4: Wire up typed lookups in the Show Subtitles page

**Files:**
- Modify: `src/components/ShowSubtitles/ShowSubtitlesPage.tsx`

`startLookup` and `addToast` are already in scope (used by `handleLookupWord` around line 57). There is no per-word source context here.

- [ ] **Step 1: Add a typed-word handler**

Add this handler immediately after the existing `handleLookupWord` (around line 71):

```tsx
  // Lookup a word typed directly into the panel's search row
  const handleLookupTypedWord = (word: string) => {
    const trimmed = word.trim();
    if (!trimmed) return;

    const result = startLookup(trimmed);

    if (result === "duplicate") {
      addToast(`「${trimmed}」正在查詢中`, "info");
    } else if (result === "max_reached") {
      addToast("同時查詢數量已達上限", "error");
    }
  };
```

- [ ] **Step 2: Pass the handler to `LookupPanel`**

In the `LookupPanel` JSX (around lines 190-196):

```tsx
// Before
      <LookupPanel
        lookups={lookups}
        showSignal={requestSignal}
        onDismiss={dismissLookup}
        onDismissAll={dismissAll}
        onSpeak={speak}
      />
// After
      <LookupPanel
        lookups={lookups}
        showSignal={requestSignal}
        onDismiss={dismissLookup}
        onDismissAll={dismissAll}
        onSpeak={speak}
        onLookupWord={handleLookupTypedWord}
      />
```

- [ ] **Step 3: Type-check and lint**

Run: `npm run build && npm run lint`
Expected: build completes with no TypeScript errors; lint reports no new errors.

- [ ] **Step 4: Manual check**

Run: `npm run dev`, open the Show Subtitles page, trigger the lookup panel, type a word into the search row and press Enter.
Expected: a new lookup card appears; the input clears and keeps focus; duplicate / limit toasts behave as in the PDF reader.

- [ ] **Step 5: Commit**

```bash
git add src/components/ShowSubtitles/ShowSubtitlesPage.tsx
git commit -m "feat(lookup): Wire typed-word lookups in subtitles page"
```

---

## Self-Review

**Spec coverage:**
- Spec §1 (enlarge body text) → Task 1, Steps 1-5. ✓
- Spec §2 (taller panel) → Task 1, Step 6. ✓
- Spec §3 (top search row + wiring + toasts + context) → Task 2 (UI/prop), Task 3 (PdfReader wiring + `sourcePdfName` context + toasts), Task 4 (subtitles wiring + toasts). ✓
- Spec non-goals (no adjustable font control, no persisted height, no search history, no service changes) → respected; none of these appear in any task. ✓

**Placeholder scan:** No TBD/TODO/"handle edge cases"/vague steps — every code step shows exact before/after code. ✓

**Type consistency:** The new prop `onLookupWord?: (word: string) => void` (Task 2, Step 2) matches the handlers passed in Task 3, Step 2 and Task 4, Step 2 (`handleLookupTypedWord: (word: string) => void`). State/ref names (`searchInput`, `setSearchInput`, `searchInputRef`, `handleSearchSubmit`) are defined in Task 2 and used consistently within the same task. `startLookup`'s context arg matches its signature in `useLookupQueue.ts` (`{ sourcePdfName?, sourceContext?, sourcePage? }`). ✓
