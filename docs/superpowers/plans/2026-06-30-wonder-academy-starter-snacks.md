# Wonder Academy Starter Snacks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give each new Wonder Academy starter its favorite snack at game start.

**Architecture:** Add a pure `starterSnackBundle()` helper beside creature data so starter snack rules are testable and reusable. Wire `confirmStarter` to use the helper instead of a hard-coded snack bundle.

**Tech Stack:** React 19, TypeScript strict, Vitest, existing Wonder Academy creature registry and reducer shell.

---

## File Structure

- **Modify** `src/components/LittleGames/wonder-academy/wonderAcademyCreatures.test.ts`
  - Add snack-bundle assertions for all starters and concrete Momo/Lumi examples.
- **Modify** `src/components/LittleGames/wonder-academy/wonderAcademyCreatures.ts`
  - Export `starterSnackBundle(species)`.
- **Modify** `src/components/LittleGames/wonder-academy/WonderAcademyCollector.tsx`
  - Import `starterSnackBundle`.
  - Use it when confirming starter selection.

## Task 1: Starter Snack Helper

- [x] **Step 1: Write failing tests**

Extend `wonderAcademyCreatures.test.ts` with tests that expect:

- each starter receives at least 2 of its favorite snack;
- each starter starts with exactly 4 snacks total;
- Lumi keeps the existing `starberry-cookie` + `clover-macaron` bundle;
- Momo receives `moon-milk-puff` instead of being stuck with only Lumi/Pico snacks.

- [x] **Step 2: Verify tests fail**

Run:

```bash
npm run test -- src/components/LittleGames/wonder-academy/wonderAcademyCreatures.test.ts
```

Expected: fail because `starterSnackBundle()` is not exported.

- [x] **Step 3: Implement helper**

Add `starterSnackBundle(species: CreatureSpecies): Record<string, number>`.

Rules:

- favorite snack gets 2;
- fallback snack gets 2;
- fallback is `clover-macaron` when favorite is `starberry-cookie`, otherwise `starberry-cookie`.

- [x] **Step 4: Verify tests pass**

Run:

```bash
npm run test -- src/components/LittleGames/wonder-academy/wonderAcademyCreatures.test.ts
```

Expected: pass.

## Task 2: Reducer Wiring

- [x] **Step 1: Use helper in starter confirmation**

In `WonderAcademyCollector.tsx`, import `starterSnackBundle` and replace the hard-coded starter snacks in `confirmStarter`.

- [x] **Step 2: Verify focused behavior**

Run:

```bash
npm run test -- src/components/LittleGames/wonder-academy/wonderAcademyCreatures.test.ts
```

Expected: pass.

## Task 3: Full Verification And Commit

- [x] **Step 1: Run full checks**

Run:

```bash
npm run lint
npm run test
npm run build
```

Expected: lint has no errors; tests and build pass. Existing non-blocking warnings can remain documented.

- [x] **Step 2: Browser smoke on existing dev server**

Use `http://localhost:5173/games/wonder-academy` without starting a new server. Start a guest run with Momo and verify the Hub snack count reflects 4 starting snacks.

- [x] **Step 3: Commit**

```bash
git add docs/superpowers/plans/2026-06-30-wonder-academy-starter-snacks.md \
  src/components/LittleGames/wonder-academy/wonderAcademyCreatures.ts \
  src/components/LittleGames/wonder-academy/wonderAcademyCreatures.test.ts \
  src/components/LittleGames/wonder-academy/WonderAcademyCollector.tsx
git commit -m "feat(wonder-academy): seed starter favorite snacks"
```
