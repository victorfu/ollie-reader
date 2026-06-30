# Wonder Academy Creature Field Skills Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ensure every built-in and custom Wonder Academy creature has a valid exploration field skill.

**Architecture:** Add focused Vitest coverage for creature registry invariants, then make `fieldSkillId` required on `CreatureSpecies`. Built-in wild creatures get explicit field skills, and custom creatures derive a field skill from their selected elements with a deterministic fallback.

**Tech Stack:** React 19, TypeScript strict, Vitest, existing Wonder Academy creature registry and field-skill logic.

---

## File Structure

- **Create** `src/components/LittleGames/wonder-academy/wonderAcademyCreatures.test.ts`
  - Validate built-in field skill ids, starter ids, evolution-stage bounds, move references, and custom creature defaults.
- **Modify** `src/components/LittleGames/wonder-academy/wonderAcademyCreatures.ts`
  - Require `fieldSkillId` on `CreatureSpecies`.
  - Add field skills for `mossmew` and `sparkleaf-fawn`.
  - Add deterministic custom-creature field skill selection.

## Task 1: Creature Registry Field Skill Guardrails

- [x] **Step 1: Write failing tests**

Create `wonderAcademyCreatures.test.ts` with tests that expect:

- every built-in species has a valid `FIELD_SKILLS` entry;
- starters keep their spec-defined field skills;
- every species has at least one move, all move ids exist, and total stages fit `EVOLUTION_LEVELS`;
- `makeCustomCreature()` assigns a valid field skill for selected elements and defaults to `light-trail`.

- [x] **Step 2: Verify tests fail**

Run:

```bash
npm run test -- src/components/LittleGames/wonder-academy/wonderAcademyCreatures.test.ts
```

Expected: fail because wild/custom creatures do not all expose valid `fieldSkillId`.

- [x] **Step 3: Implement field skill data**

Update `CreatureSpecies` so `fieldSkillId` is required. Add explicit field skills to wild species, then derive custom creature field skills from the first selected element:

- `light` / `spark` -> `light-trail`
- `dream` / `tide` -> `soft-float`
- `star` / `leaf` -> `secret-sense`
- `ember` / `crystal` -> `crystal-push`

- [x] **Step 4: Verify tests pass**

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

- [x] **Step 2: Browser smoke on existing dev server**

Use `http://localhost:5173/games/wonder-academy` without starting a new server. Start a guest run, select a starter, confirm the Team view still displays field skill chips and the route has no new page errors.

- [x] **Step 3: Commit**

```bash
git add docs/superpowers/plans/2026-06-30-wonder-academy-creature-field-skills.md \
  src/components/LittleGames/wonder-academy/wonderAcademyCreatures.ts \
  src/components/LittleGames/wonder-academy/wonderAcademyCreatures.test.ts
git commit -m "feat(wonder-academy): require creature field skills"
```
