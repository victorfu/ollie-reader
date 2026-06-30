# Wonder Academy Starter Selection Guard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ensure Wonder Academy new-game starter selection remains limited to the four canonical starters.

**Architecture:** Add a starter-only lookup helper in the creature registry and use it in the reducer for both `pickStarter` and `confirmStarter`. UI still renders `STARTER_SPECIES`, but reducer actions also defend the same rule.

**Tech Stack:** React 19, TypeScript strict, Vitest, existing Wonder Academy creature registry.

---

## File Structure

- **Modify** `src/components/LittleGames/wonder-academy/wonderAcademyCreatures.test.ts`
  - Add tests for starter-only lookup.
- **Modify** `src/components/LittleGames/wonder-academy/wonderAcademyCreatures.ts`
  - Export `starterById()`.
- **Modify** `src/components/LittleGames/wonder-academy/WonderAcademyCollector.tsx`
  - Use `starterById()` in starter selection reducer cases.

## Task 1: Starter Registry Contract

- [x] **Step 1: Write failing tests**

Add tests showing:

- `starterById("lumi")` returns Lumi.
- `starterById("mossmew")` returns `undefined`.

- [x] **Step 2: Verify tests fail**

Run:

```bash
npm run test -- src/components/LittleGames/wonder-academy/wonderAcademyCreatures.test.ts
```

Expected: fail because `starterById()` does not exist yet.

- [x] **Step 3: Implement helper and wire reducer**

Add:

```ts
export function starterById(id: string): CreatureSpecies | undefined {
  return STARTER_SPECIES.find((c) => c.speciesId === id);
}
```

Use `starterById()` in `pickStarter` and `confirmStarter`.

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
git add docs/superpowers/plans/2026-06-30-wonder-academy-starter-selection-guard.md \
  src/components/LittleGames/wonder-academy/WonderAcademyCollector.tsx \
  src/components/LittleGames/wonder-academy/wonderAcademyCreatures.ts \
  src/components/LittleGames/wonder-academy/wonderAcademyCreatures.test.ts
git commit -m "fix(wonder-academy): guard starter selection"
```
