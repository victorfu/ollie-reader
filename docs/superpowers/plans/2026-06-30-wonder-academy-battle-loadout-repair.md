# Wonder Academy Battle Loadout Repair Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent malformed saved equipped moves from entering Wonder Academy battles when they are known move ids but invalid for the creature.

**Architecture:** Keep the repair at the battle combatant boundary. `toCombatant()` already filters unknown move ids; extend that repair to require species learnability and to reject high-tier moves that the owned creature has not unlocked. Preserve the existing first-four default loadout behavior so legacy starters do not lose their default moves.

**Tech Stack:** React 19, TypeScript strict, Vitest, existing Wonder Academy creature and move registry.

---

## File Structure

- **Modify** `src/components/LittleGames/wonder-academy/wonderAcademyCreatures.test.ts`
  - Add regression tests for known-but-invalid saved loadouts.
- **Modify** `src/components/LittleGames/wonder-academy/wonderAcademyCreatures.ts`
  - Tighten `toCombatant()` equipped move repair around species learnable pool and unlock rules.

## Task 1: Battle Boundary Repair

- [x] **Step 1: Write failing tests**

Add focused tests that show:

- a known move from another species is repaired before battle.
- a high-tier move above the owned creature's level is repaired before battle.
- default equipped moves are preserved for low-level creatures, matching existing starter behavior.

- [x] **Step 2: Verify tests fail**

Run:

```bash
npm run test -- src/components/LittleGames/wonder-academy/wonderAcademyCreatures.test.ts
```

Expected: fail because `toCombatant()` currently accepts any known equipped move id.

- [x] **Step 3: Implement repair**

Update `toCombatant()` support helpers so equipped moves must:

- exist in `WONDER_ACADEMY_MOVES`.
- belong to `learnablePool(species)`.
- be either part of `defaultEquipped(species)` or meet `owned.level >= moveUnlockLevel(poolIndex)`.
- fall back to default equipped moves if no equipped moves remain valid.

- [x] **Step 4: Verify focused tests pass**

Run:

```bash
npm run test -- src/components/LittleGames/wonder-academy/wonderAcademyCreatures.test.ts
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
git add docs/superpowers/plans/2026-06-30-wonder-academy-battle-loadout-repair.md \
  src/components/LittleGames/wonder-academy/wonderAcademyCreatures.ts \
  src/components/LittleGames/wonder-academy/wonderAcademyCreatures.test.ts
git commit -m "fix(wonder-academy): repair invalid battle loadouts"
```
