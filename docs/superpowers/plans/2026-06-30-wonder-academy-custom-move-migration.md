# Wonder Academy Custom Move Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Repair legacy custom-creature move metadata when loading Wonder Academy saves so custom creatures always have playable, known battle moves.

**Architecture:** Reuse the same deterministic element-to-move helper used by `makeCustomCreature()`. `normalizeWonderAcademySave()` repairs custom creature `moveIds` during load: valid saved moves are preserved, while missing, empty, or unknown moves are replaced by element-derived defaults.

**Tech Stack:** React 19, TypeScript strict, Vitest, existing Wonder Academy persistence, move data, and creature registry modules.

---

## File Structure

- **Modify** `src/components/LittleGames/wonder-academy/wonderAcademyCreatures.ts`
  - Export `movesForElements(elements)` so save normalization can share builder defaults.
- **Modify** `src/components/LittleGames/wonder-academy/wonderAcademyPersistence.ts`
  - Validate each custom creature's `moveIds` using `getMoveById()`.
  - Backfill missing, empty, or invalid `moveIds` from normalized creature elements.
- **Modify** `src/components/LittleGames/wonder-academy/wonderAcademyPersistence.test.ts`
  - Add save migration tests for missing and invalid custom creature moves.

## Task 1: Custom Move Migration

- [x] **Step 1: Write failing tests**

Extend `normalizeWonderAcademySave` tests with two cases:

```ts
it("backfills missing custom creature moves from elements", () => {
  const normalized = normalizeWonderAcademySave({
    playerName: "Mina",
    team: [],
    customCreatures: [
      {
        speciesId: "custom-no-moves",
        name: "No Moves",
        category: "自訂夥伴",
        personality: "Legacy custom creature without moves",
        elements: ["leaf"],
        rarity: "rare",
        favoriteSnack: "clover-macaron",
        growthStages: ["No Moves"],
        fieldSkillId: "secret-sense",
        portrait: "no-moves.png",
        wild: true,
      },
    ],
  });

  expect(normalized?.customCreatures[0].moveIds).toEqual([
    "leaf-wink",
    "clover-patch",
    "mossy-tackle",
    "spore-puff",
  ]);
});

it("repairs invalid custom creature moves from elements", () => {
  const normalized = normalizeWonderAcademySave({
    playerName: "Mina",
    team: [],
    customCreatures: [
      {
        speciesId: "custom-invalid-moves",
        name: "Invalid Moves",
        category: "自訂夥伴",
        personality: "Legacy custom creature with invalid moves",
        elements: ["tide"],
        rarity: "rare",
        favoriteSnack: "moon-milk-puff",
        growthStages: ["Invalid Moves"],
        moveIds: ["missing-move"],
        fieldSkillId: "soft-float",
        portrait: "invalid-moves.png",
        wild: true,
      },
    ],
  });

  expect(normalized?.customCreatures[0].moveIds).toEqual([
    "bubble-pat",
    "cozy-shield",
    "moon-drizzle",
  ]);
});
```

- [x] **Step 2: Verify tests fail**

Run:

```bash
npm run test -- src/components/LittleGames/wonder-academy/wonderAcademyPersistence.test.ts
```

Expected: fail because custom creatures currently preserve missing or unknown `moveIds`.

- [x] **Step 3: Implement migration**

In `wonderAcademyCreatures.ts`, change:

```ts
function movesForElements(elements: WonderAcademyElement[]): string[] {
```

to:

```ts
export function movesForElements(elements: WonderAcademyElement[]): string[] {
```

In `wonderAcademyPersistence.ts`, import `getMoveById` and `movesForElements`, then normalize custom creature elements and moves:

```ts
const elements = Array.isArray(record.elements)
  ? (record.elements as WonderAcademyElement[])
  : [];
const normalizedElements = elements.length > 0 ? elements : ["light"];
const moveIds = Array.isArray(record.moveIds)
  ? record.moveIds.filter((moveId): moveId is string => (
      typeof moveId === "string" && !!getMoveById(moveId)
    ))
  : [];

return [{
  ...(record as unknown as CreatureSpecies),
  elements: normalizedElements,
  moveIds: moveIds.length > 0 ? moveIds : movesForElements(normalizedElements),
  fieldSkillId,
}];
```

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
git add docs/superpowers/plans/2026-06-30-wonder-academy-custom-move-migration.md \
  src/components/LittleGames/wonder-academy/wonderAcademyCreatures.ts \
  src/components/LittleGames/wonder-academy/wonderAcademyPersistence.ts \
  src/components/LittleGames/wonder-academy/wonderAcademyPersistence.test.ts
git commit -m "fix(wonder-academy): migrate custom creature moves"
```
