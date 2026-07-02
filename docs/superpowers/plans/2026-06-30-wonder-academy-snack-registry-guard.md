# Wonder Academy Snack Registry Guard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep Wonder Academy snack ids centralized and prevent daily reward actions from writing unknown snack keys into progress.

**Architecture:** Extract the local snack name/pool constants from `WonderAcademyCollector.tsx` into a pure `logic/snacks.ts` registry. Use `isKnownSnack()` for economy guards, including `claimDaily`.

**Tech Stack:** React 19, TypeScript strict, Vitest, existing Wonder Academy reducer and snack flows.

---

## File Structure

- **Add** `src/components/LittleGames/wonder-academy/logic/snacks.ts`
  - Export `SNACK_NAMES`, `SNACK_POOL`, and `isKnownSnack()`.
- **Add** `src/components/LittleGames/wonder-academy/logic/snacks.test.ts`
  - Cover canonical snack ids and unknown-id rejection.
- **Modify** `src/components/LittleGames/wonder-academy/WonderAcademyCollector.tsx`
  - Import snack registry constants.
  - Guard `claimDaily` and `buySnack` with `isKnownSnack()`.

## Task 1: Snack Registry

- [x] **Step 1: Write failing tests**

Add tests showing:

- the canonical starter snack ids are present.
- `isKnownSnack()` accepts a known id and rejects an unknown id.

- [x] **Step 2: Verify tests fail**

Run:

```bash
npm run test -- src/components/LittleGames/wonder-academy/logic/snacks.test.ts
```

Expected: fail because `logic/snacks.ts` does not exist yet.

- [x] **Step 3: Extract registry and guard reducer**

Create the snack registry module and update the collector to import it. In `claimDaily`, return `state` when `action.snackId` is unknown.

- [x] **Step 4: Verify focused tests pass**

Run:

```bash
npm run test -- src/components/LittleGames/wonder-academy/logic/snacks.test.ts
```

Expected: pass.

## Task 2: Full Verification And Commit

- [x] **Step 1: Run full checks**

Run:

```bash
npm run lint
npm run test
npm run build
```

Expected: lint has no errors; tests and build pass. Existing non-blocking warnings can remain documented.

- [x] **Step 2: Commit**

```bash
git add docs/superpowers/plans/2026-06-30-wonder-academy-snack-registry-guard.md \
  src/components/LittleGames/wonder-academy/WonderAcademyCollector.tsx \
  src/components/LittleGames/wonder-academy/logic/snacks.ts \
  src/components/LittleGames/wonder-academy/logic/snacks.test.ts
git commit -m "fix(wonder-academy): guard snack reward ids"
```
