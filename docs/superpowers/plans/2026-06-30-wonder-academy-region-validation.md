# Wonder Academy Region Validation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add pure validation guardrails for Wonder Academy region maps and node graphs.

**Architecture:** Keep validation in `wonderAcademyRegions.ts` so region/map invariants can be tested without loading React or asset-heavy creature modules. Tests exercise the existing canonical regions and one deliberately malformed region.

**Tech Stack:** React 19, TypeScript strict, Vitest, existing Wonder Academy region data.

---

## File Structure

- **Modify** `src/components/LittleGames/wonder-academy/wonderAcademyRegions.test.ts`
  - Import and test `regionValidationErrors()`.
- **Modify** `src/components/LittleGames/wonder-academy/wonderAcademyRegions.ts`
  - Export `VALID_REGION_TILES`.
  - Export `regionValidationErrors(region)`.

## Task 1: Region Validation Helper

- [x] **Step 1: Write failing tests**

Extend `wonderAcademyRegions.test.ts` with tests that expect:

- every region in `REGIONS` returns no validation errors;
- a malformed region reports a non-rectangular map, unknown tile, missing start, missing exit, duplicate node id, out-of-range node position, unknown prerequisite, and invalid level range.

- [x] **Step 2: Verify tests fail**

Run:

```bash
npm run test -- src/components/LittleGames/wonder-academy/wonderAcademyRegions.test.ts
```

Expected: fail because `regionValidationErrors()` is not exported.

- [x] **Step 3: Implement helper**

Add `VALID_REGION_TILES` and `regionValidationErrors(region: Region): string[]`.

Validation rules:

- map must have at least one row;
- every row must match the first row width;
- tile symbols must be one of `T`, `P`, `G`, `C`, `N`, `X`, `S`, `W`, `F`, `O`;
- map must contain exactly one `S`;
- map must contain at least one `X`;
- `minLevel <= maxLevel`;
- `wardenLevel >= maxLevel`;
- node ids must be unique;
- node `x` and `y` must be between `0` and `1`;
- each requirement must reference another node in the same region;
- a node cannot require itself;
- region must contain exactly one warden node.

- [x] **Step 4: Verify tests pass**

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
git add docs/superpowers/plans/2026-06-30-wonder-academy-region-validation.md \
  src/components/LittleGames/wonder-academy/wonderAcademyRegions.ts \
  src/components/LittleGames/wonder-academy/wonderAcademyRegions.test.ts
git commit -m "feat(wonder-academy): validate region data"
```
