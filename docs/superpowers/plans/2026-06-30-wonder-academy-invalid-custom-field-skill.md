# Wonder Academy Invalid Custom Field Skill Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Repair invalid custom-creature field skill ids during save normalization.

**Architecture:** Tighten the previous custom field-skill migration so it preserves only known `FIELD_SKILLS` ids. Missing or unknown ids are recalculated from creature elements using `fieldSkillForElements()`.

**Tech Stack:** React 19, TypeScript strict, Vitest, existing Wonder Academy persistence and creature registry modules.

---

## File Structure

- **Modify** `src/components/LittleGames/wonder-academy/wonderAcademyPersistence.test.ts`
  - Add a failing test for a custom creature with an unknown `fieldSkillId`.
- **Modify** `src/components/LittleGames/wonder-academy/wonderAcademyPersistence.ts`
  - Import `FIELD_SKILLS`.
  - Preserve saved `fieldSkillId` only if it exists in `FIELD_SKILLS`.

## Task 1: Invalid Field Skill Migration

- [x] **Step 1: Write failing test**

Extend `normalizeWonderAcademySave` tests with a custom creature whose saved `fieldSkillId` is `"missing-skill"` and whose elements are `["tide"]`. Expected normalized `fieldSkillId`: `"soft-float"`.

- [x] **Step 2: Verify test fails**

Run:

```bash
npm run test -- src/components/LittleGames/wonder-academy/wonderAcademyPersistence.test.ts
```

Expected: fail because normalization currently preserves any non-empty field skill string.

- [x] **Step 3: Implement validation**

In `normalizeCustomCreatures()`, preserve `record.fieldSkillId` only when `FIELD_SKILLS[record.fieldSkillId]` exists. Otherwise compute `fieldSkillForElements(elements)`.

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
git add docs/superpowers/plans/2026-06-30-wonder-academy-invalid-custom-field-skill.md \
  src/components/LittleGames/wonder-academy/wonderAcademyPersistence.ts \
  src/components/LittleGames/wonder-academy/wonderAcademyPersistence.test.ts
git commit -m "fix(wonder-academy): repair invalid custom field skills"
```
