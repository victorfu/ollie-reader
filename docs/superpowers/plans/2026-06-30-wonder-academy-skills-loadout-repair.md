# Wonder Academy Skills Loadout Repair Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep the Wonder Academy skills panel from displaying or preserving malformed equipped moves from legacy saves.

**Architecture:** Tighten the existing `moveLoadout` helper so `equippedMovesFor()` returns a repaired current loadout using the same species/unlock rules as battle loadout repair. Reuse that helper in `SkillsScreen` instead of reading `owned.equippedMoveIds` directly.

**Tech Stack:** React 19, TypeScript strict, Vitest, existing Wonder Academy skills UI and move loadout helper.

---

## File Structure

- **Modify** `src/components/LittleGames/wonder-academy/logic/moveLoadout.test.ts`
  - Add regression tests for repaired displayed/current loadouts.
- **Modify** `src/components/LittleGames/wonder-academy/logic/moveLoadout.ts`
  - Repair equipped moves against species pool and unlock rules.
- **Modify** `src/components/LittleGames/wonder-academy/WonderAcademyCollector.tsx`
  - Use `equippedMovesFor()` in `SkillsScreen`.

## Task 1: Helper Repair

- [x] **Step 1: Write failing tests**

Add focused tests showing:

- `equippedMovesFor()` falls back to defaults when saved moves are known but from another species.
- `equippedMovesFor()` falls back to defaults when saved moves are locked high-tier moves.
- `equipMoveForCreature()` drops invalid saved moves when adding a valid unlocked move.

- [x] **Step 2: Verify tests fail**

Run:

```bash
npm run test -- src/components/LittleGames/wonder-academy/logic/moveLoadout.test.ts
```

Expected: fail because `equippedMovesFor()` currently filters unknown ids only.

- [x] **Step 3: Implement helper repair**

Update `equippedMovesFor()` so existing equipped moves must:

- exist in the move registry.
- belong to the species learnable pool.
- be either part of the default loadout or meet the owned creature's level unlock.
- fall back to default equipped moves when no valid saved moves remain.

- [x] **Step 4: Verify focused tests pass**

Run:

```bash
npm run test -- src/components/LittleGames/wonder-academy/logic/moveLoadout.test.ts
```

Expected: pass.

## Task 2: Skills UI And Verification

- [x] **Step 1: Use helper in skills UI**

Replace the skills screen's direct `owned.equippedMoveIds ?? defaultEquipped(sp)` calculation with `equippedMovesFor(owned, sp)`.

- [x] **Step 2: Run full checks and malformed-save smoke**

Run:

```bash
npm run lint
npm run test
npm run build
```

Then use the existing localhost `5173` server to load a malformed guest save and verify the skills panel does not show the invalid equipped move.

- [x] **Step 3: Commit**

```bash
git add docs/superpowers/plans/2026-06-30-wonder-academy-skills-loadout-repair.md \
  src/components/LittleGames/wonder-academy/logic/moveLoadout.ts \
  src/components/LittleGames/wonder-academy/logic/moveLoadout.test.ts \
  src/components/LittleGames/wonder-academy/WonderAcademyCollector.tsx
git commit -m "fix(wonder-academy): repair skills loadout display"
```
