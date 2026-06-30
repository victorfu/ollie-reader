# Wonder Academy Save Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Wonder Academy persistence match the canonical spec's direction: Firestore is authoritative, localStorage is a cache plus pending queue, and the UI exposes save/sync status.

**Architecture:** Extract Wonder Academy save normalization, local cache, pending queue, and cloud conflict rules into a testable `wonderAcademyPersistence.ts` module. `WonderAcademyCollector.tsx` will consume the module, display a compact save status in the shell, load the freshest available state, and retry pending saves before normal cloud saves.

**Tech Stack:** React 19, TypeScript strict, Vitest, Firebase Firestore dynamic imports, localStorage.

---

## File Structure

- **Create** `src/components/LittleGames/wonder-academy/wonderAcademyPersistence.ts`
  - Owns persisted data types, schema version, cloud doc ids, local cache keys, pending queue keys, normalization, local read/write, pending queue read/write, cloud read/write, load precedence, and save orchestration.
- **Create** `src/components/LittleGames/wonder-academy/wonderAcademyPersistence.test.ts`
  - Covers malformed saves, legacy local saves, cloud-vs-local precedence, pending queue behavior, and save failure behavior.
- **Modify** `src/components/LittleGames/wonder-academy/WonderAcademyCollector.tsx`
  - Imports persistence helpers/types, removes inline persistence functions, tracks `saveStatus`, loads via `loadWonderAcademySave`, saves via `saveWonderAcademyProgress`, and renders save status in the top bar.

## Task 1: Extract Persistence Module With Tests

- [x] **Step 1: Write failing tests**

Create `src/components/LittleGames/wonder-academy/wonderAcademyPersistence.test.ts` with tests for normalization, local cache fallback, cloud precedence, pending saves, and failures.

- [x] **Step 2: Verify tests fail**

Run: `npm run test -- src/components/LittleGames/wonder-academy/wonderAcademyPersistence.test.ts`
Expected: fail because `./wonderAcademyPersistence` does not exist.

- [x] **Step 3: Implement persistence module**

Create `src/components/LittleGames/wonder-academy/wonderAcademyPersistence.ts` with exported `WonderAcademyProgressData`, `normalizeWonderAcademySave`, `loadWonderAcademySave`, `saveWonderAcademyProgress`, and helpers used by tests.

- [x] **Step 4: Verify tests pass**

Run: `npm run test -- src/components/LittleGames/wonder-academy/wonderAcademyPersistence.test.ts`
Expected: pass.

## Task 2: Wire Collector To New Persistence

- [x] **Step 1: Modify imports and types**

Update `WonderAcademyCollector.tsx` to import `WonderAcademyProgressData`, `loadWonderAcademySave`, `saveWonderAcademyProgress`, and `type WonderAcademySaveStatus`.

- [x] **Step 2: Remove inline persistence**

Delete inline `Persisted`, `StoredGame`, `storageKey`, `normalizeStored`, `loadPersisted`, `loadCloudGame`, and `saveCloudGame` code from the component.

- [x] **Step 3: Add save status UI**

Track load/save state with `useState<WonderAcademySaveStatus>("idle")`, set `loading`, `saved`, `pending`, and `failed` based on persistence results, and render a compact status chip in the frame top bar.

- [x] **Step 4: Verify targeted test and typecheck**

Run: `npm run test -- src/components/LittleGames/wonder-academy/wonderAcademyPersistence.test.ts`
Run: `npm run build`
Expected: both pass.

## Task 3: Browser Smoke On Existing Dev Server

- [x] **Step 1: Open the existing dev server**

Use the already-running app at `http://localhost:5173/games/wonder-academy`.

- [x] **Step 2: Verify visible status and basic flow**

Confirm the page renders, no framework overlay is present, no relevant console errors appear, and the save status chip appears in the top bar after load. Browser check saw an unrelated Firebase App Check debug-token 403 in this local environment, with no page errors.

- [x] **Step 3: Interact**

Start or continue the game far enough to reach a visible state change, then confirm the UI remains responsive and no runtime errors are emitted.

## Task 4: Final Verification And Commit

- [x] **Step 1: Run automated checks**

Run: `npm test -- --run`
Run: `npm run build`
Expected: both pass.

- [x] **Step 2: Commit**

```bash
git add docs/superpowers/plans/2026-06-30-wonder-academy-save-sync.md \
  src/components/LittleGames/wonder-academy/wonderAcademyPersistence.ts \
  src/components/LittleGames/wonder-academy/wonderAcademyPersistence.test.ts \
  src/components/LittleGames/wonder-academy/WonderAcademyCollector.tsx
git commit -m "feat(wonder-academy): add authoritative save sync"
```
