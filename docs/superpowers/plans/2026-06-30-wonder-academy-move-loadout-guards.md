# Wonder Academy Move Loadout Guard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent Wonder Academy move loadout actions from equipping moves that the creature cannot learn or has not unlocked by level.

**Architecture:** Add a small pure loadout helper under `logic/` and reuse it from the main reducer. The skill screen can keep its existing UI filtering, while reducer behavior becomes safe for malformed events and migrated saves.

**Tech Stack:** React 19, TypeScript strict, Vitest, existing Wonder Academy creature and move registry.

---

## File Structure

- **Add** `src/components/LittleGames/wonder-academy/logic/moveLoadout.ts`
  - Export loadout helpers for current moves, equip, and unequip.
- **Add** `src/components/LittleGames/wonder-academy/logic/moveLoadout.test.ts`
  - Cover invalid species moves, level locks, max slots, and last-move protection.
- **Modify** `src/components/LittleGames/wonder-academy/WonderAcademyCollector.tsx`
  - Use the helper for `equipMove` and `unequipMove`.

## Task 1: Pure Loadout Rules

- [x] **Step 1: Write failing tests**

Add focused tests for:

- rejecting moves outside the species learnable pool.
- rejecting moves above the owned creature's current level.
- equipping an unlocked learnable move when there is room.
- preserving max four equipped moves.
- preventing removal of the last equipped move.

- [x] **Step 2: Verify tests fail**

Run:

```bash
npm run test -- src/components/LittleGames/wonder-academy/logic/moveLoadout.test.ts
```

Expected: fail because the helper does not exist yet.

- [x] **Step 3: Implement helper**

Create `moveLoadout.ts` with pure functions that:

- derive current equipped moves with species defaults.
- require known move ids.
- require membership in `learnablePool(species)`.
- require `owned.level >= moveUnlockLevel(poolIndex)`.
- cap equipped moves at four.
- keep at least one equipped move.

- [x] **Step 4: Verify focused tests pass**

Run:

```bash
npm run test -- src/components/LittleGames/wonder-academy/logic/moveLoadout.test.ts
```

Expected: pass.

## Task 2: Wire Reducer And Verify

- [x] **Step 1: Use helper in reducer**

Replace inline `equipMove` and `unequipMove` logic in `WonderAcademyCollector.tsx` with the helper functions.

- [x] **Step 2: Run full checks**

Run:

```bash
npm run lint
npm run test
npm run build
```

Expected: lint has no errors; tests and build pass. Existing non-blocking warnings can remain documented.

- [x] **Step 3: Commit**

```bash
git add docs/superpowers/plans/2026-06-30-wonder-academy-move-loadout-guards.md \
  src/components/LittleGames/wonder-academy/logic/moveLoadout.ts \
  src/components/LittleGames/wonder-academy/logic/moveLoadout.test.ts \
  src/components/LittleGames/wonder-academy/WonderAcademyCollector.tsx
git commit -m "fix(wonder-academy): guard move loadout changes"
```
