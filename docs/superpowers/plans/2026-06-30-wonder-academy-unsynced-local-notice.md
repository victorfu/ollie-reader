# Wonder Academy Unsynced Local Notice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Warn signed-in players when this device has Wonder Academy progress that is newer than or not yet synced to Firestore.

**Architecture:** Extend the save loader result with a boolean `hasUnsyncedLocalProgress`, derived from pending saves or a local cache selected over cloud. `WonderAcademyCollector.tsx` tracks that flag, maps it to the pending save status, and renders a compact warning panel in the hub until a cloud save succeeds.

**Tech Stack:** React 19, TypeScript strict, Vitest, Firebase Firestore adapter, localStorage cache.

---

## File Structure

- **Modify** `src/components/LittleGames/wonder-academy/wonderAcademyPersistence.ts`
  - Add `hasUnsyncedLocalProgress` to `WonderAcademyLoadResult`.
  - Mark local/pending selections as unsynced when they should be pushed to cloud.
- **Modify** `src/components/LittleGames/wonder-academy/wonderAcademyPersistence.test.ts`
  - Add tests for local-newer-than-cloud and cloud-newer-than-local load outcomes.
- **Modify** `src/components/LittleGames/wonder-academy/WonderAcademyCollector.tsx`
  - Track unsynced local progress and render an explanatory hub notice for signed-in users.

## Task 1: Persistence Load Flag

- [x] **Step 1: Write failing tests**

Add tests that expect:
- newer cloud over local returns `hasUnsyncedLocalProgress: false`;
- newer local over older cloud returns `hasUnsyncedLocalProgress: true` and pending status.

- [x] **Step 2: Verify tests fail**

Run: `npm run test -- src/components/LittleGames/wonder-academy/wonderAcademyPersistence.test.ts`
Expected: fail because the loader does not yet expose the new flag.

- [x] **Step 3: Implement loader flag**

Update `WonderAcademyLoadResult` and `loadWonderAcademySave()` so selected pending/local records report unsynced progress where appropriate.

- [x] **Step 4: Verify tests pass**

Run: `npm run test -- src/components/LittleGames/wonder-academy/wonderAcademyPersistence.test.ts`
Expected: pass.

## Task 2: UI Notice

- [x] **Step 1: Track unsynced state**

Add `hasUnsyncedLocalProgress` state in `WonderAcademyCollector.tsx`, set it from load/save/sync outcomes, and ignore it for guest mode.

- [x] **Step 2: Render hub notice**

Render a compact signed-in-only warning near the hub top: "此裝置有尚未同步的 Wonder Academy 進度" with short explanatory copy.

- [x] **Step 3: Verify build**

Run: `npm run build`
Expected: pass.

## Task 3: Verification And Commit

- [x] **Step 1: Browser smoke on existing dev server**

Use `http://localhost:5173/games/wonder-academy` without starting a new server. Verify guest flow still reaches hub and no new runtime errors appear.

- [x] **Step 2: Full checks**

Run: `npm run lint`
Run: `npm run test`
Run: `npm run build`
Expected: lint has no errors; tests/build pass.

- [x] **Step 3: Commit**

```bash
git add docs/superpowers/plans/2026-06-30-wonder-academy-unsynced-local-notice.md \
  src/components/LittleGames/wonder-academy/wonderAcademyPersistence.ts \
  src/components/LittleGames/wonder-academy/wonderAcademyPersistence.test.ts \
  src/components/LittleGames/wonder-academy/WonderAcademyCollector.tsx
git commit -m "feat(wonder-academy): show unsynced local progress"
```
