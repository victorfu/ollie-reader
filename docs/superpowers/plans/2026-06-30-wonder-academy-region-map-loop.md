# Wonder Academy Region Map Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Use Wonder Academy's `region_map_loop` music on map and exploration screens instead of reusing the hub loop everywhere outside battle.

**Architecture:** Add a small pure loop selector in `wonderAcademyAudio.ts` that maps gameplay screen names to loop IDs. `WonderAcademyCollector.tsx` calls that selector and stops every non-selected loop using `wonderAcademyLoopIds`, so all required loops are managed consistently.

**Tech Stack:** React 19, TypeScript strict, Vitest, existing Wonder Academy audio manager.

---

## File Structure

- **Modify** `src/components/LittleGames/wonder-academy/wonderAcademyAudio.ts`
  - Export `selectWonderAcademyLoop()` and the input shape used by the collector.
- **Modify** `src/components/LittleGames/wonder-academy/wonderAcademyAudio.test.ts`
  - Add pure tests for hub/title screens, map/explore screens, and battle/warden screens.
- **Modify** `src/components/LittleGames/wonder-academy/WonderAcademyCollector.tsx`
  - Replace inline loop selection with `selectWonderAcademyLoop()`.
  - Stop all loop IDs except the selected loop, including `region_map_loop`.

## Task 1: Audio Loop Selector

- [x] **Step 1: Write failing tests**

Add tests that expect:
- `title`, `hub`, `dex`, `shop`, `builder`, and `skills` use `hub_loop`;
- `regions`, `nodeMap`, and `scene` use `region_map_loop`;
- normal battle uses `mood_trial_loop`;
- warden battle uses `warden_trial_loop`.

- [x] **Step 2: Verify tests fail**

Run: `npm run test -- src/components/LittleGames/wonder-academy/wonderAcademyAudio.test.ts`
Expected: fail because `selectWonderAcademyLoop()` is not exported yet.

- [x] **Step 3: Implement selector**

Export `selectWonderAcademyLoop({ screen, isWarden })` from `wonderAcademyAudio.ts`.

- [x] **Step 4: Verify tests pass**

Run: `npm run test -- src/components/LittleGames/wonder-academy/wonderAcademyAudio.test.ts`
Expected: pass.

## Task 2: Collector Wiring

- [x] **Step 1: Import selector and loop ids**

Update `WonderAcademyCollector.tsx` imports to include `selectWonderAcademyLoop` and `wonderAcademyLoopIds`.

- [x] **Step 2: Replace inline loop decision**

Use `selectWonderAcademyLoop({ screen: state.screen, isWarden: state.isWarden })` in the audio effect.

- [x] **Step 3: Stop all inactive loops**

Iterate `wonderAcademyLoopIds` and stop every loop except the selected one.

- [x] **Step 4: Verify build**

Run: `npm run build`
Expected: pass.

## Task 3: Verification And Commit

- [x] **Step 1: Browser smoke on existing dev server**

Use `http://localhost:5173/games/wonder-academy` without starting a new server. Start a guest run, reach hub, open regions, and verify no runtime errors or framework overlay appear.

- [x] **Step 2: Full checks**

Run: `npm run lint`
Run: `npm run test`
Run: `npm run build`
Expected: lint has no errors; tests/build pass.

- [x] **Step 3: Commit**

```bash
git add docs/superpowers/plans/2026-06-30-wonder-academy-region-map-loop.md \
  src/components/LittleGames/wonder-academy/wonderAcademyAudio.ts \
  src/components/LittleGames/wonder-academy/wonderAcademyAudio.test.ts \
  src/components/LittleGames/wonder-academy/WonderAcademyCollector.tsx
git commit -m "feat(wonder-academy): route map music loop"
```
