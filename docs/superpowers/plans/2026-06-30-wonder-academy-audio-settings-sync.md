# Wonder Academy Audio Settings Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist Wonder Academy audio settings with the player save so mute state follows local/cloud progress.

**Architecture:** Add normalized `audioSettings` to `WonderAcademyProgressData`, using the existing `normalizeAudioSettings()` helper. `WonderAcademyCollector.tsx` stores audio settings in React state, applies loaded settings to the audio manager, and includes the current settings in debounced saves and lifecycle checkpoints.

**Tech Stack:** React 19, TypeScript strict, Vitest, localStorage/Firestore save adapter, existing Wonder Academy audio manager.

---

## File Structure

- **Modify** `src/components/LittleGames/wonder-academy/wonderAcademyPersistence.ts`
  - Add `audioSettings` to `WonderAcademyProgressData`.
  - Normalize missing or malformed audio settings to `defaultWonderAcademyAudioSettings`.
- **Modify** `src/components/LittleGames/wonder-academy/wonderAcademyPersistence.test.ts`
  - Add tests for saved mute settings and malformed settings fallback.
- **Modify** `src/components/LittleGames/wonder-academy/WonderAcademyCollector.tsx`
  - Load saved audio settings into UI state.
  - Persist current audio settings in every save/checkpoint payload.
  - Keep the mute button bound to the full audio settings object.

## Task 1: Persistence Shape

- [x] **Step 1: Write failing tests**

Add tests that expect:
- `normalizeWonderAcademySave()` preserves valid `audioSettings`.
- `normalizeWonderAcademySave()` defaults invalid or missing `audioSettings`.

- [x] **Step 2: Verify tests fail**

Run: `npm run test -- src/components/LittleGames/wonder-academy/wonderAcademyPersistence.test.ts`
Expected: fail because `WonderAcademyProgressData` does not yet include normalized audio settings.

- [x] **Step 3: Implement persistence support**

Import `normalizeAudioSettings` and `defaultWonderAcademyAudioSettings`, add `audioSettings` to the progress type, and normalize the field inside `normalizeWonderAcademySave()`.

- [x] **Step 4: Verify tests pass**

Run: `npm run test -- src/components/LittleGames/wonder-academy/wonderAcademyPersistence.test.ts`
Expected: pass.

## Task 2: Collector Wiring

- [x] **Step 1: Track full audio settings**

Replace the standalone `muted` state with `audioSettings`, initialized from `defaultWonderAcademyAudioSettings`.

- [x] **Step 2: Apply loaded settings**

When `loadWonderAcademySave()` returns data, apply `result.data.audioSettings` to state; on empty/new/error load, keep defaults.

- [x] **Step 3: Persist current settings**

Add `audioSettings` to the debounced persisted payload and hook dependency list so mute changes save immediately through the existing save flow.

- [x] **Step 4: Verify build**

Run: `npm run build`
Expected: pass.

## Task 3: Verification And Commit

- [x] **Step 1: Browser smoke on existing dev server**

Use `http://localhost:5173/games/wonder-academy` without starting a new server. Toggle mute and verify the icon/title updates without runtime errors.

- [x] **Step 2: Full checks**

Run: `npm run lint`
Run: `npm run test`
Run: `npm run build`
Expected: lint has no errors; tests/build pass.

- [x] **Step 3: Commit**

```bash
git add docs/superpowers/plans/2026-06-30-wonder-academy-audio-settings-sync.md \
  src/components/LittleGames/wonder-academy/wonderAcademyPersistence.ts \
  src/components/LittleGames/wonder-academy/wonderAcademyPersistence.test.ts \
  src/components/LittleGames/wonder-academy/WonderAcademyCollector.tsx
git commit -m "feat(wonder-academy): sync audio settings"
```
