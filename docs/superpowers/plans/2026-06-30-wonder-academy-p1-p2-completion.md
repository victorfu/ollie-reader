# Wonder Academy P1/P2 Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the canonical Wonder Academy Phase 2 and Phase 3 surface as playable vertical slices after the P0 core-loop gate.

**Architecture:** Keep existing reducer/gameplay patterns, but put new long-term systems into small pure logic modules first. Data expansion stays in `wonderAcademyCreatures.ts` and `wonderAcademyRegions.ts`; economy/trials/objectives stay in `logic/`; `WonderAcademyCollector.tsx` only wires actions, panels, and save payloads. Verification combines focused Vitest coverage with the existing already-running `localhost:5173` Playwright smoke.

**Tech Stack:** React 19, TypeScript strict, Vitest, Playwright smoke runner, Vite dev server already running on port 5173.

---

## Existing Phase Coverage Audit

- Phase 2 already present: skill unlock/equip/loadout, field skill node gating, shiny tracking, Wonderdex rewards, builder, sleep status, second region, cloud/local/pending sync coverage.
- Phase 2 gaps to finish: more canonical region/warden content, richer rarity/drop data, builder/custom content save guardrails through the new save fields.
- Phase 3 already present: daily reward, daily tasks, catch/evolution animations, mobile/touch/keyboard smoke from P0.
- Phase 3 gaps to finish: materials/charms, postgame trials, explicit current-objective rhythm, volume controls beyond mute, reduced-motion smoke gate, expanded long-term content slice.

## File Structure

- **Modify** `src/data/wonderAcademyMoves.ts`
  - Add moves for Tideglass/Clocktower/Sugarcloud/Aurora/Postgame creatures.
- **Modify** `src/data/wonderAcademyMoves.test.ts`
  - Validate new move ids and sleep-capable moves stay intentional.
- **Modify** `src/components/LittleGames/wonder-academy/wonderAcademyCreatures.ts`
  - Add canonical Phase 3 species/wardens and pure registry helpers.
- **Modify** `src/components/LittleGames/wonder-academy/wonderAcademyCreatures.test.ts`
  - Lock 4-stage coverage, rarity spread, and Warden/mythling registry invariants.
- **Modify** `src/components/LittleGames/wonder-academy/wonderAcademyRegions.ts`
  - Add canonical Chapter 2+ regions and a final/postgame unlock path.
- **Modify** `src/components/LittleGames/wonder-academy/wonderAcademyRegions.test.ts`
  - Verify shipped regions, unlock order, Warden species, loot tiers, and field-skill side gates.
- **Create** `src/components/LittleGames/wonder-academy/logic/charms.ts`
  - Define materials, charms, charm effects, crafting/activation helpers, and loot conversion.
- **Create** `src/components/LittleGames/wonder-academy/logic/charms.test.ts`
  - TDD coverage for crafting, activation limits, effect aggregation, and save-safe normalization.
- **Create** `src/components/LittleGames/wonder-academy/logic/postgameTrials.ts`
  - Define trials unlocked after all Wardens, reward calculation, and trial-win recording.
- **Create** `src/components/LittleGames/wonder-academy/logic/postgameTrials.test.ts`
  - TDD coverage for unlock gating, trial lookup, and reward application.
- **Create** `src/components/LittleGames/wonder-academy/logic/objectives.ts`
  - Compute the next short-term objective from state-like progress data.
- **Create** `src/components/LittleGames/wonder-academy/logic/objectives.test.ts`
  - TDD coverage for starter, exploration, Warden, region, charm, dex, and postgame objective states.
- **Modify** `src/components/LittleGames/wonder-academy/wonderAcademyPersistence.ts`
  - Add `materials`, `charms`, `activeCharms`, `trialWins`, and normalize them from old saves.
- **Modify** `src/components/LittleGames/wonder-academy/wonderAcademyPersistence.test.ts`
  - Verify new fields default, clamp, dedupe, and survive guest/cloud/pending flows.
- **Modify** `src/components/LittleGames/wonder-academy/WonderAcademyCollector.tsx`
  - Wire charms workshop, trial screen, objective card, audio volume controls, charm effects in loot/encounter/xp/shiny, and postgame trial battle resolution.
- **Modify** `scripts/wonder-academy-smoke-helpers.mjs`
  - Add seeded saves and checklist entries for charms, trials, audio controls, reduced motion.
- **Modify** `scripts/smoke-wonder-academy.mjs`
  - Exercise workshop crafting/activation, postgame trial start, volume sliders, reduced-motion starter flow, and expanded content surfaces.
- **Modify** `src/types/wonder-academy-smoke-helpers.d.ts`
  - Keep helper declarations in sync.
- **Modify** `src/components/LittleGames/wonder-academy/wonderAcademySmokeScript.test.ts`
  - Lock the expanded P1/P2 smoke checklist.

## Task 1: Canonical Content Expansion

- [x] **Step 1: Write failing registry/region tests**

Add tests that expect:

- at least six built-in wild/warden/postgame species;
- each shipped region references an existing Warden species;
- region ids include `sparkleaf`, `tideglass`, `clocktower`, and `sugarcloud`;
- regions unlock in order by previous Warden defeat;
- deeper regions have nondecreasing `lootTier`;
- every built-in species has `growthStages.length <= EVOLUTION_LEVELS.length + 1`.

Run:

```bash
npm run test -- src/components/LittleGames/wonder-academy/wonderAcademyCreatures.test.ts src/components/LittleGames/wonder-academy/wonderAcademyRegions.test.ts
```

Expected red result: tests fail because the additional canonical regions/species are not present yet.

- [x] **Step 2: Add moves/species/regions**

Add the minimum canonical vertical slice:

- Tideglass Coast Warden: `pearlwhisker-seal`
- Clocktower Dorms Warden: `clockbell-tanuki`
- Sugarcloud Market Warden: `marshmallow-maestro`
- Rare/mythling/postgame species: `comet-kitsune`, `pillowmoon-ram`, `silent-bellheart`

Each species gets original name/category/personality, elements, rarity, favorite snack, field skill, growth stages, move ids, and an existing original portrait fallback until dedicated art is added.

- [x] **Step 3: Verify content expansion**

Run:

```bash
npm run test -- src/data/wonderAcademyMoves.test.ts src/components/LittleGames/wonder-academy/wonderAcademyCreatures.test.ts src/components/LittleGames/wonder-academy/wonderAcademyRegions.test.ts
```

Expected: move, species, and region tests pass.

## Task 2: Materials And Charms Economy

- [x] **Step 1: Write failing charm logic tests**

Create `logic/charms.test.ts` covering:

- `normalizeMaterials()` removes unknown ids and clamps negative/float values;
- `normalizeCharms()` removes unknown ids and clamps quantities to nonnegative integers;
- `craftCharm()` spends Stardust/materials and increments the charm count;
- `toggleActiveCharm()` activates only owned charms and caps active charms at 2;
- `charmEffects()` aggregates encounter, loot, shiny, and XP bonuses.

Run:

```bash
npm run test -- src/components/LittleGames/wonder-academy/logic/charms.test.ts
```

Expected red result: module does not exist.

- [x] **Step 2: Implement `logic/charms.ts`**

Define material ids `glow-petal`, `tide-glass`, `clock-spring`, `sugar-crystal`, `bell-shard`; charm ids `lucky-lantern`, `treasure-ribbon`, `training-bell`, `quiet-sneakers`. Export definitions and the pure helpers used by tests and reducer.

- [x] **Step 3: Add save migration tests**

Extend persistence tests so old saves default to empty `materials`, `charms`, `activeCharms`, `trialWins`, while malformed values are normalized.

Run:

```bash
npm run test -- src/components/LittleGames/wonder-academy/wonderAcademyPersistence.test.ts
```

Expected red result: normalized save lacks the new fields.

- [x] **Step 4: Wire save schema and reducer/UI**

Extend progress data and `INITIAL` with materials/charm fields. Add a `workshop` screen from Hub with craft/activate/deactivate controls. Apply charm effects to encounter rate, rare weight, chest rolls, chest Stardust, shiny odds, and XP reward.

- [x] **Step 5: Verify economy**

Run:

```bash
npm run test -- src/components/LittleGames/wonder-academy/logic/charms.test.ts src/components/LittleGames/wonder-academy/wonderAcademyPersistence.test.ts
```

Expected: charm logic and save migration tests pass.

## Task 3: Postgame Trials And Objective Rhythm

- [x] **Step 1: Write failing postgame/objective tests**

Create tests that expect:

- postgame trials remain locked until every shipped region Warden is defeated;
- a trial win records `trialWins[trialId] + 1`;
- trial rewards include Stardust, material bundles, and a higher payout on first win;
- objectives progress from starter -> first node -> Warden -> next region -> workshop/charm -> postgame trial.

Run:

```bash
npm run test -- src/components/LittleGames/wonder-academy/logic/postgameTrials.test.ts src/components/LittleGames/wonder-academy/logic/objectives.test.ts
```

Expected red result: modules do not exist.

- [x] **Step 2: Implement `postgameTrials.ts` and `objectives.ts`**

Keep both modules pure and independent of React. Use region/species ids only.

- [x] **Step 3: Wire reducer/UI**

Add a `trials` screen and `trialId` state. Show the current objective card on Hub and Region screen. Starting a trial creates a Warden-style battle against the configured trial species; winning records the trial and rewards the player without changing normal region completion.

- [x] **Step 4: Verify trials/objectives**

Run:

```bash
npm run test -- src/components/LittleGames/wonder-academy/logic/postgameTrials.test.ts src/components/LittleGames/wonder-academy/logic/objectives.test.ts
```

Expected: tests pass.

## Task 4: Audio Controls And P1/P2 Smoke QA

- [x] **Step 1: Write failing smoke helper tests**

Add checklist expectations:

- `workshop opens and charm toggles`
- `postgame trial opens`
- `audio controls adjust volume`
- `reduced motion starter flow renders`
- `expanded regions are listed`

Run:

```bash
npm run test -- src/components/LittleGames/wonder-academy/wonderAcademySmokeScript.test.ts
```

Expected red result: checklist is missing the new entries.

- [x] **Step 2: Implement UI smoke paths**

Extend `scripts/wonder-academy-smoke-helpers.mjs` with saves that include materials/charms and all Wardens defeated. Extend `scripts/smoke-wonder-academy.mjs` to open Workshop, craft/toggle a charm, start a postgame trial, move volume sliders, emulate reduced motion, and verify expanded region cards.

- [x] **Step 3: Verify rendered QA**

Run:

```bash
npm run test -- src/components/LittleGames/wonder-academy/wonderAcademySmokeScript.test.ts
npm run smoke:wonder-academy
```

Expected: helper tests and rendered smoke pass against `http://localhost:5173/games/wonder-academy`.

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
git add docs/superpowers/plans/2026-06-30-wonder-academy-p1-p2-completion.md \
  src/data/wonderAcademyMoves.ts src/data/wonderAcademyMoves.test.ts \
  src/components/LittleGames/wonder-academy/wonderAcademyCreatures.ts \
  src/components/LittleGames/wonder-academy/wonderAcademyCreatures.test.ts \
  src/components/LittleGames/wonder-academy/wonderAcademyRegions.ts \
  src/components/LittleGames/wonder-academy/wonderAcademyRegions.test.ts \
  src/components/LittleGames/wonder-academy/logic/charms.ts \
  src/components/LittleGames/wonder-academy/logic/charms.test.ts \
  src/components/LittleGames/wonder-academy/logic/postgameTrials.ts \
  src/components/LittleGames/wonder-academy/logic/postgameTrials.test.ts \
  src/components/LittleGames/wonder-academy/logic/objectives.ts \
  src/components/LittleGames/wonder-academy/logic/objectives.test.ts \
  src/components/LittleGames/wonder-academy/wonderAcademyPersistence.ts \
  src/components/LittleGames/wonder-academy/wonderAcademyPersistence.test.ts \
  src/components/LittleGames/wonder-academy/WonderAcademyCollector.tsx \
  scripts/smoke-wonder-academy.mjs scripts/wonder-academy-smoke-helpers.mjs \
  src/types/wonder-academy-smoke-helpers.d.ts \
  src/components/LittleGames/wonder-academy/wonderAcademySmokeScript.test.ts
git commit -m "feat(wonder-academy): complete p1 p2 systems"
```
