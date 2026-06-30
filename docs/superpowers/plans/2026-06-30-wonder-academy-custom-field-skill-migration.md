# Wonder Academy Custom Field Skill Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Backfill missing custom-creature field skills when loading older Wonder Academy saves.

**Architecture:** Reuse the same deterministic element-to-field-skill helper used by `makeCustomCreature()`. `normalizeWonderAcademySave()` repairs legacy custom creature metadata during load, while preserving already-valid field skill ids.

**Tech Stack:** React 19, TypeScript strict, Vitest, existing Wonder Academy persistence and creature registry modules.

---

## File Structure

- **Modify** `src/components/LittleGames/wonder-academy/wonderAcademyCreatures.ts`
  - Export `fieldSkillForElements(elements)`.
- **Modify** `src/components/LittleGames/wonder-academy/wonderAcademyPersistence.ts`
  - Normalize `customCreatures` through a small helper that fills missing `fieldSkillId`.
- **Modify** `src/components/LittleGames/wonder-academy/wonderAcademyPersistence.test.ts`
  - Add save migration tests for missing and existing custom creature field skills.

## Task 1: Persistence Migration Test

- [x] **Step 1: Write failing tests**

Extend `normalizeWonderAcademySave` tests with cases that expect:

- a legacy custom leaf creature without `fieldSkillId` receives `secret-sense`;
- a legacy custom creature without elements receives `light-trail`;
- an existing custom `fieldSkillId` is preserved.

- [x] **Step 2: Verify tests fail**

Run:

```bash
npm run test -- src/components/LittleGames/wonder-academy/wonderAcademyPersistence.test.ts
```

Expected: fail because custom creatures are currently cast through without migration.

- [x] **Step 3: Implement migration**

Export `fieldSkillForElements()` from `wonderAcademyCreatures.ts`. In `wonderAcademyPersistence.ts`, map `parsed.customCreatures` through `normalizeCustomCreature()`:

- copy all existing custom creature fields;
- preserve non-empty string `fieldSkillId`;
- otherwise compute `fieldSkillForElements(elements)`.

- [x] **Step 4: Verify focused tests pass**

Run:

```bash
npm run test -- src/components/LittleGames/wonder-academy/wonderAcademyPersistence.test.ts
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
git add docs/superpowers/plans/2026-06-30-wonder-academy-custom-field-skill-migration.md \
  src/components/LittleGames/wonder-academy/wonderAcademyCreatures.ts \
  src/components/LittleGames/wonder-academy/wonderAcademyPersistence.ts \
  src/components/LittleGames/wonder-academy/wonderAcademyPersistence.test.ts
git commit -m "fix(wonder-academy): migrate custom field skills"
```
