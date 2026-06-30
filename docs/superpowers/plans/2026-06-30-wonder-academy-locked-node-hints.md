# Wonder Academy Locked Node Hints Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show clear unlock requirements on locked Wonder Academy node-map locations.

**Architecture:** Add a pure `nodeUnlockHint()` helper beside `isNodeUnlocked()` in `wonderAcademyRegions.ts`. The helper derives missing prerequisite labels from region data, returns `null` for unlocked nodes, and gives `WonderAcademyCollector.tsx` a display string for locked node labels.

**Tech Stack:** React 19, TypeScript strict, Vitest, existing Wonder Academy region data.

---

## File Structure

- **Modify** `src/components/LittleGames/wonder-academy/wonderAcademyRegions.ts`
  - Export `nodeUnlockHint(node, region, clearedNodes)`.
- **Create** `src/components/LittleGames/wonder-academy/wonderAcademyRegions.test.ts`
  - Cover no-requirement nodes, locked single prerequisite nodes, unlocked nodes, and unknown prerequisite fallback.
- **Modify** `src/components/LittleGames/wonder-academy/WonderAcademyCollector.tsx`
  - Import `nodeUnlockHint`.
  - Render a small `🔒 先完成「...」` hint under locked node labels.

## Task 1: Region Unlock Hint Helper

- [x] **Step 1: Write failing tests**

Create `wonderAcademyRegions.test.ts` with tests that expect:
- entry nodes without requirements return `null`;
- locked nodes return the missing prerequisite label;
- nodes return `null` once prerequisites are cleared;
- unknown prerequisite ids fall back to the raw id.

- [x] **Step 2: Verify tests fail**

Run: `npm run test -- src/components/LittleGames/wonder-academy/wonderAcademyRegions.test.ts`
Expected: fail because `nodeUnlockHint()` is not exported.

- [x] **Step 3: Implement helper**

Add `nodeUnlockHint()` to `wonderAcademyRegions.ts` using existing `nodeKey()` and region node labels.

- [x] **Step 4: Verify tests pass**

Run: `npm run test -- src/components/LittleGames/wonder-academy/wonderAcademyRegions.test.ts`
Expected: pass.

## Task 2: Node Map UI Wiring

- [x] **Step 1: Import helper**

Import `nodeUnlockHint` in `WonderAcademyCollector.tsx`.

- [x] **Step 2: Render locked hints**

Inside node-map rendering, compute `const unlockHint = nodeUnlockHint(n, region, state.clearedNodes)` and render it below the node label when present.

- [x] **Step 3: Keep layout stable**

Use small, non-wrapping hint text with a translucent background so it is readable without shifting the node-map dimensions.

- [x] **Step 4: Verify build**

Run: `npm run build`
Expected: pass.

## Task 3: Verification And Commit

- [x] **Step 1: Browser smoke on existing dev server**

Use `http://localhost:5173/games/wonder-academy` without starting a new server. Start a guest run, reach the node map, and verify locked node hints are visible without framework overlay or relevant console errors.

- [x] **Step 2: Full checks**

Run: `npm run lint`
Run: `npm run test`
Run: `npm run build`
Expected: lint has no errors; tests/build pass.

- [x] **Step 3: Commit**

```bash
git add docs/superpowers/plans/2026-06-30-wonder-academy-locked-node-hints.md \
  src/components/LittleGames/wonder-academy/wonderAcademyRegions.ts \
  src/components/LittleGames/wonder-academy/wonderAcademyRegions.test.ts \
  src/components/LittleGames/wonder-academy/WonderAcademyCollector.tsx
git commit -m "feat(wonder-academy): show locked node hints"
```
