# Wonder Academy P0 Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the P0 Wonder Academy work: full core-loop smoke coverage, mobile/keyboard/touch QA gates, persistence edge tests, balance characterization, and a small maintainability split.

**Architecture:** Keep user-facing behavior stable while strengthening automated protection around the canonical MVP loop. Browser validation stays in the existing Playwright smoke script and runs only against an already-running dev server. Pure persistence and tuning logic stays covered by Vitest before any behavior or refactor changes.

**Tech Stack:** React 19, TypeScript strict, Vitest, Playwright, Vite dev server already running on port 5173.

---

## File Structure

- **Modify** `scripts/wonder-academy-smoke-helpers.mjs`
  - Extend the smoke checklist and seed-save builders.
- **Modify** `scripts/smoke-wonder-academy.mjs`
  - Add battle/catch/chest/Warden/reload/mobile/keyboard checks.
- **Modify** `src/components/LittleGames/wonder-academy/wonderAcademySmokeScript.test.ts`
  - Lock the smoke checklist and helper behavior.
- **Modify** `src/types/wonder-academy-smoke-helpers.d.ts`
  - Keep helper declarations in sync.
- **Modify** `src/components/LittleGames/wonder-academy/wonderAcademyPersistence.test.ts`
  - Add focused pending/cloud/local precedence cases.
- **Modify** `src/components/LittleGames/wonder-academy/logic/catchLogic.test.ts`
  - Characterize child-friendly catch rates.
- **Modify** `src/components/LittleGames/wonder-academy/logic/progression.test.ts`
  - Characterize XP pacing for short sessions.
- **Create** `src/components/LittleGames/wonder-academy/wonderAcademyPresentation.tsx`
  - Move small presentational components out of the large collector file.
- **Create** `src/components/LittleGames/wonder-academy/wonderAcademyPresentationStyles.ts`
  - Move shared non-component presentation style helpers out of React Refresh component modules.
- **Modify** `src/components/LittleGames/wonder-academy/WonderAcademyCollector.tsx`
  - Import extracted presentation helpers, leaving reducer/game behavior unchanged.

## Task 1: Expanded Core Loop Smoke

- [x] **Step 1: Write failing helper tests**

Update `wonderAcademySmokeScript.test.ts` so `WONDER_ACADEMY_SMOKE_CHECKS` includes:

- `battle opens from grass`
- `catch flow reaches result`
- `chest loot message appears`
- `Warden battle opens`
- `reload preserves guest hub`
- `mobile touch flow opens hub surfaces`
- `keyboard flow reaches starter selection`

Expected red result: focused test fails because helper checklist is missing the new items.

- [x] **Step 2: Implement helper additions**

Update `scripts/wonder-academy-smoke-helpers.mjs` with the new checklist entries and any focused save builders needed for deterministic Warden or reload states.

- [x] **Step 3: Extend Playwright smoke runner**

Update `scripts/smoke-wonder-academy.mjs` to:

- use seeded saves for deterministic battle/catch/chest/Warden states;
- trigger a grass encounter and verify the battle DOM;
- attack/catch until a result screen appears;
- open a chest and verify the loot message;
- open a Warden battle from a seeded cleared-node state;
- reload a guest save and verify hub state returns;
- run a mobile/touch viewport smoke for hub surfaces and 44px primary touch targets;
- run a keyboard smoke that uses Tab/Enter to start guest flow and reach starter selection.

- [x] **Step 4: Verify focused and rendered smoke**

Run:

```bash
npm run test -- src/components/LittleGames/wonder-academy/wonderAcademySmokeScript.test.ts
npm run smoke:wonder-academy
```

Expected: focused tests pass; smoke JSON includes all expanded P0 checks.

## Task 2: Persistence Edge Coverage

- [x] **Step 1: Write failing persistence tests**

Add tests for:

- failed signed-in cloud save writes a pending save and local cache;
- pending sync saves to cloud and clears pending;
- newer cloud wins over stale pending and clears stale pending;
- guest save uses local-only storage and reports saved.

Expected red result: any missing assertion should fail before implementation; if behavior already exists, keep these as characterization tests.

- [x] **Step 2: Implement persistence fixes only if tests reveal a gap**

If a test fails because behavior is missing, patch `wonderAcademyPersistence.ts` at the source of the precedence or pending-queue issue.

- [x] **Step 3: Verify persistence tests**

Run:

```bash
npm run test -- src/components/LittleGames/wonder-academy/wonderAcademyPersistence.test.ts
```

Expected: persistence tests pass.

## Task 3: Balance Characterization

- [x] **Step 1: Add balance tests**

Add focused tests that characterize:

- common sleepy favorite-snack catch chance is high but not guaranteed;
- healthy uncommon non-favorite catch chance is meaningfully lower;
- one normal Sparkleaf encounter win gives visible progress without multi-level jumps.

- [x] **Step 2: Tune only if values violate the characterization**

Patch `catchLogic.ts` or `progression.ts` only if tests prove current values are outside the intended range.

- [x] **Step 3: Verify balance tests**

Run:

```bash
npm run test -- src/components/LittleGames/wonder-academy/logic/catchLogic.test.ts src/components/LittleGames/wonder-academy/logic/progression.test.ts
```

Expected: tests pass.

## Task 4: Collector Presentation Split

- [x] **Step 1: Extract presentational helpers**

Create `wonderAcademyPresentation.tsx` with `SaveStatusChip`, `TypeBadge`, `HpBar`, and related shared style exports used by the collector.

- [x] **Step 2: Wire imports**

Update `WonderAcademyCollector.tsx` to import the extracted helpers and remove the duplicated local declarations.

- [x] **Step 3: Verify no behavior changed**

Run:

```bash
npm run build
npm run smoke:wonder-academy
```

Expected: build and smoke pass.

## Task 5: Full Verification And Commit

- [x] **Step 1: Run full checks**

Run:

```bash
npm run lint
npm run test
npm run build
npm run smoke:wonder-academy
```

Expected: lint has no errors; tests/build/smoke pass. Existing warnings can remain documented.

- [x] **Step 2: Commit**

```bash
git add docs/superpowers/plans/2026-06-30-wonder-academy-p0-completion.md \
  scripts/smoke-wonder-academy.mjs scripts/wonder-academy-smoke-helpers.mjs \
  src/types/wonder-academy-smoke-helpers.d.ts \
  src/components/LittleGames/wonder-academy/wonderAcademySmokeScript.test.ts \
  src/components/LittleGames/wonder-academy/wonderAcademyPersistence.test.ts \
  src/components/LittleGames/wonder-academy/logic/catchLogic.test.ts \
  src/components/LittleGames/wonder-academy/logic/progression.test.ts \
  src/components/LittleGames/wonder-academy/wonderAcademyPresentation.tsx \
  src/components/LittleGames/wonder-academy/wonderAcademyPresentationStyles.ts \
  src/components/LittleGames/wonder-academy/WonderAcademyCollector.tsx
git commit -m "test(wonder-academy): complete p0 coverage"
```
