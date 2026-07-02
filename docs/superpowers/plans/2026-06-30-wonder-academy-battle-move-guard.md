# Wonder Academy Battle Move Guard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent battle actions from using moves that are not currently equipped by the active Wonderling.

**Architecture:** Keep the guard inside the pure battle engine. `playerAttack()` should return the same session when the requested move id is not in `session.active.moveIds` or is not a known move. UI already only renders equipped moves, but the engine must also defend its contract.

**Tech Stack:** React 19, TypeScript strict, Vitest, existing Wonder Academy battle session logic.

---

## File Structure

- **Modify** `src/components/LittleGames/wonder-academy/logic/battleSession.test.ts`
  - Add regression tests for unavailable and unknown player moves.
- **Modify** `src/components/LittleGames/wonder-academy/logic/battleSession.ts`
  - Guard `playerAttack()` before `performMove()`.

## Task 1: Battle Move Guard

- [x] **Step 1: Write failing tests**

Add tests showing:

- requesting a known move not in the active combatant's `moveIds` returns the same session.
- requesting an unknown move id returns the same session instead of throwing.

- [x] **Step 2: Verify tests fail**

Run:

```bash
npm run test -- src/components/LittleGames/wonder-academy/logic/battleSession.test.ts
```

Expected: fail because `playerAttack()` currently accepts known non-equipped moves and throws on unknown ids.

- [x] **Step 3: Implement guard**

In `playerAttack()`, after the outcome check and before `performMove()`:

```ts
if (!session.active.moveIds.includes(moveId) || !getMoveById(moveId)) return session;
```

- [x] **Step 4: Verify focused tests pass**

Run:

```bash
npm run test -- src/components/LittleGames/wonder-academy/logic/battleSession.test.ts
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
git add docs/superpowers/plans/2026-06-30-wonder-academy-battle-move-guard.md \
  src/components/LittleGames/wonder-academy/logic/battleSession.ts \
  src/components/LittleGames/wonder-academy/logic/battleSession.test.ts
git commit -m "fix(wonder-academy): guard unavailable battle moves"
```
