# Lookup Panel Improvements — Design

<status>Approved</status>
<date>2026-06-02</date>

## Problem

The reader's floating "查詢結果" (Lookup Results) panel has three usability gaps:

1. **Body text is small.** Definition text renders at `text-sm` (14px), which is hard to read comfortably.
2. **The panel is short.** It defaults to 384px tall, so only a couple of cards fit before scrolling.
3. **No direct lookup.** Words can only be looked up by selecting text in the reader. There's no way to type a word and look it up directly.

## Scope

- `src/components/PdfReader/LookupPanel.tsx` — text sizes, taller panel options, new top search row
- `src/components/PdfReader.tsx` — wire up typed lookups
- `src/components/ShowSubtitles/ShowSubtitlesPage.tsx` — wire up typed lookups

No changes to `useLookupQueue.ts`; its existing `startLookup(word, context?)` already does everything the new input needs.

## 1. Enlarge body text by one level

In `LookupItemCard`, bump the *reading content* up one Tailwind size step. Chrome text (status messages, badges, the "查詢結果" header title) stays unchanged.

| Element | Current | New |
|---------|---------|-----|
| Word title | `text-base` | `text-lg` |
| Phonetic | `text-xs` | `text-sm` |
| Part-of-speech + definition body | `text-sm` | `text-base` |
| Chinese gloss under a definition | `text-xs` | `text-sm` |
| Translation result / plain-text definition fallback | `text-sm` | `text-base` |

Loading text ("查詢中…"), the error message, and badges keep their current sizes.

## 2. Taller panel

In `LookupPanel.tsx`, the panel already passes explicit size options to `useFloatingPanel`. Update those option values:

- Default height: `384` → `520`
- Max height: `600` → `760`
- Width (default 320, max 600) and min size (240×200) unchanged.

`useFloatingPanel.ts` itself is not modified — only the options the panel requests. The panel stays drag-resizable; only the starting and ceiling heights grow. The hook's default-position helper already derives `y` from the current height, so a taller default simply starts higher on screen.

## 3. Top search row (type-to-look-up)

### UI
A fixed search row sits directly **below the header** and **above** the scrollable card list (`shrink-0`, so it stays put while cards scroll). It contains:

- A `Search` icon (lucide-react, per project convention) inside a text input styled per the design system (`rounded-[6px] border border-border-hairline bg-background/50`, focus ring).
- Placeholder: `輸入單字查詢…`
- Submit via **Enter** key (a dedicated button is optional; Enter is the primary path).

### Behavior
- On submit: trim the input. If empty, do nothing.
- If non-empty, call the new `onLookupWord(word)` prop, then clear the input and **keep focus** for rapid successive lookups.
- The new card is prepended to the top of the list by the existing queue logic, so it appears immediately under the search row.
- The search row only renders when `onLookupWord` is provided (both call sites provide it).

### Wiring
- `LookupPanel` gains an optional prop: `onLookupWord?: (word: string) => void`.
- Each call site wraps `startLookup` in a handler that surfaces the existing toast feedback:
  - `startLookup` returns `"duplicate" | "max_reached" | undefined`.
  - `"duplicate"` → toast `「{word}」正在查詢中` (info)
  - `"max_reached"` → toast `同時查詢數量已達上限` (error)
  - This mirrors the existing `handleLookupWord` logic.
- Context passed to `startLookup` for typed words:
  - PdfReader: `{ sourcePdfName: selectedFile?.name }`
  - ShowSubtitlesPage: `{}` (no per-word source context)
- The typed word is passed trimmed, as-is (single-word input is expected; no token splitting).

## Non-goals (YAGNI)

- No adjustable font-size control — a fixed one-level bump was chosen.
- No persisted panel height / per-user size memory beyond the existing in-session resize.
- No search history or autocomplete in the input.
- No changes to the lookup/translation service or the queue hook.

## Testing / verification

- Manual: in the PDF reader, open the panel, confirm definition text is visibly larger and the panel starts taller.
- Manual: type a word in the search row, press Enter → a new lookup card appears; input clears and keeps focus.
- Manual: type a word already loading → info toast; exceed concurrent limit → error toast.
- Manual: repeat the typed-lookup check on the Show Subtitles page.
- `npm run build` (type-check) and `npm run lint` pass.
