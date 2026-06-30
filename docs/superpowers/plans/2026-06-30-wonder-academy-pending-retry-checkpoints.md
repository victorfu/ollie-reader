# Wonder Academy Pending Retry Checkpoints Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Wonder Academy retry pending cloud saves and preserve progress when the page is hidden or unloaded.

**Architecture:** Extend `wonderAcademyPersistence.ts` with two small, testable helpers: one writes a synchronous checkpoint to local cache and optional pending queue, and one flushes the pending queue to Firestore. `WonderAcademyCollector.tsx` keeps the latest persisted snapshot in a ref, checkpoints on `visibilitychange`/`pagehide`, and retries pending saves on `online`/return-to-visible.

**Tech Stack:** React 19, TypeScript strict, Vitest, localStorage, Firebase Firestore adapter.

---

## File Structure

- **Modify** `src/components/LittleGames/wonder-academy/wonderAcademyPersistence.ts`
  - Add `checkpointWonderAcademyProgress()` and `syncWonderAcademyPendingSave()`.
- **Modify** `src/components/LittleGames/wonder-academy/wonderAcademyPersistence.test.ts`
  - Add tests for checkpoint pending behavior and pending flush success/failure.
- **Modify** `src/components/LittleGames/wonder-academy/WonderAcademyCollector.tsx`
  - Store the latest persisted data in a ref, checkpoint on hide/unload, and flush pending saves when the browser comes back online or visible.

## Task 1: Persistence API

- [x] **Step 1: Write failing tests**

Add Vitest coverage for:
- checkpoint writes local cache and pending by default;
- checkpoint can skip pending for guest/local-only mode;
- syncing pending saves calls the cloud adapter and clears pending on success;
- failed pending sync leaves pending queued.

- [x] **Step 2: Verify tests fail**

Run: `npm run test -- src/components/LittleGames/wonder-academy/wonderAcademyPersistence.test.ts`
Expected: fail because the new helper exports do not exist.

- [x] **Step 3: Implement persistence helpers**

Implement `checkpointWonderAcademyProgress()` and `syncWonderAcademyPendingSave()` using existing storage helpers and `WonderAcademyCloudAdapter`.

- [x] **Step 4: Verify tests pass**

Run: `npm run test -- src/components/LittleGames/wonder-academy/wonderAcademyPersistence.test.ts`
Expected: pass.

## Task 2: React Lifecycle Wiring

- [x] **Step 1: Share persisted snapshot with checkpoint ref**

Build the persisted payload in the debounced save effect and store that same payload in `latestSaveDataRef` so lifecycle checkpoints reuse it without adding a broad `state` hook dependency.

- [x] **Step 2: Track latest payload**

Store every ready persisted snapshot in `latestSaveDataRef`.

- [x] **Step 3: Add lifecycle listeners**

Add one effect that:
- checkpoints on `visibilitychange` when hidden;
- checkpoints on `pagehide`;
- retries pending saves on `online`;
- retries pending saves when visibility returns to visible.

- [x] **Step 4: Verify build**

Run: `npm run build`
Expected: pass.

## Task 3: Verification And Commit

- [x] **Step 1: Browser smoke on existing dev server**

Use `http://localhost:5173/games/wonder-academy` without starting a new server. Verify page still renders and a guest flow can reach hub.

- [x] **Step 2: Full checks**

Run: `npm run lint`
Run: `npm run test`
Run: `npm run build`
Expected: lint has no errors; tests/build pass.

- [x] **Step 3: Commit**

```bash
git add docs/superpowers/plans/2026-06-30-wonder-academy-pending-retry-checkpoints.md \
  src/components/LittleGames/wonder-academy/wonderAcademyPersistence.ts \
  src/components/LittleGames/wonder-academy/wonderAcademyPersistence.test.ts \
  src/components/LittleGames/wonder-academy/WonderAcademyCollector.tsx
git commit -m "feat(wonder-academy): retry pending saves on resume"
```
