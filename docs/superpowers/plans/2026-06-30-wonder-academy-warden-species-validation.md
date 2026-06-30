# Wonder Academy Warden Species Validation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ensure Wonder Academy region data cannot reference a missing Warden creature species.

**Architecture:** Extend the existing pure `regionValidationErrors()` guardrail with a species registry lookup for `wardenSpeciesId`. Existing region/map validation stays in one place, and tests cover both shipped valid regions and a malformed missing-Warden region.

**Tech Stack:** React 19, TypeScript strict, Vitest, existing Wonder Academy region and creature registry modules.

---

## File Structure

- **Modify** `src/components/LittleGames/wonder-academy/wonderAcademyRegions.test.ts`
  - Extend the malformed region fixture with `wardenSpeciesId: "missing-warden"`.
  - Expect a validation error for the unknown Warden species id.
- **Modify** `src/components/LittleGames/wonder-academy/wonderAcademyRegions.ts`
  - Import `speciesById`.
  - Add a `wardenSpeciesId` existence check in `regionValidationErrors()`.

## Task 1: Warden Species Validation

- [x] **Step 1: Write failing test**

In `wonderAcademyRegions.test.ts`, update the malformed region:

```ts
wardenSpeciesId: "missing-warden",
```

Then add this expected validation error after the `wardenLevel` error:

```ts
"broken: unknown warden species 'missing-warden'",
```

- [x] **Step 2: Verify test fails**

Run:

```bash
npm run test -- src/components/LittleGames/wonder-academy/wonderAcademyRegions.test.ts
```

Expected: fail because `regionValidationErrors()` does not check `wardenSpeciesId` yet.

- [x] **Step 3: Implement validation**

In `wonderAcademyRegions.ts`, import:

```ts
import { speciesById } from "./wonderAcademyCreatures";
```

Then add:

```ts
if (!speciesById(region.wardenSpeciesId)) {
  errors.push(`${prefix} unknown warden species '${region.wardenSpeciesId}'`);
}
```

- [x] **Step 4: Verify focused tests pass**

Run:

```bash
npm run test -- src/components/LittleGames/wonder-academy/wonderAcademyRegions.test.ts
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
git add docs/superpowers/plans/2026-06-30-wonder-academy-warden-species-validation.md \
  src/components/LittleGames/wonder-academy/wonderAcademyRegions.ts \
  src/components/LittleGames/wonder-academy/wonderAcademyRegions.test.ts
git commit -m "feat(wonder-academy): validate warden species"
```
