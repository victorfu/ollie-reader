# Wonder Academy Equipped Move Repair Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent legacy or malformed equipped move loadouts from leaving Wonder Academy battle combatants with unknown moves.

**Architecture:** Keep the repair at the battle boundary. `toCombatant()` filters an owned creature's saved `equippedMoveIds` to known move ids and falls back to the species default loadout when no valid equipped move remains.

**Tech Stack:** React 19, TypeScript strict, Vitest, existing Wonder Academy creature registry and battle logic.

---

## File Structure

- **Modify** `src/components/LittleGames/wonder-academy/wonderAcademyCreatures.test.ts`
  - Add failing tests that show `toCombatant()` preserves valid equipped moves and repairs unknown equipped moves.
- **Modify** `src/components/LittleGames/wonder-academy/wonderAcademyCreatures.ts`
  - Add a small known-move filter near `defaultEquipped()`.
  - Update `toCombatant()` to use filtered equipped moves or species defaults.

## Task 1: Equipped Move Repair

- [x] **Step 1: Write failing tests**

Import `toCombatant` in `wonderAcademyCreatures.test.ts` and add:

```ts
it("keeps valid equipped moves when building a battle combatant", () => {
  expect(toCombatant({
    ownedId: "owned-lumi",
    speciesId: "lumi",
    nickname: "Lumi",
    level: 5,
    xp: 0,
    bond: 0,
    stage: 0,
    equippedMoveIds: ["zip-spark", "tiny-flash"],
  }).moveIds).toEqual(["zip-spark", "tiny-flash"]);
});

it("repairs unknown equipped moves before battle", () => {
  expect(toCombatant({
    ownedId: "owned-lumi",
    speciesId: "lumi",
    nickname: "Lumi",
    level: 5,
    xp: 0,
    bond: 0,
    stage: 0,
    equippedMoveIds: ["missing-move"],
  }).moveIds).toEqual(["tiny-flash", "zip-spark", "wink-feint", "starstep-dash"]);
});
```

- [x] **Step 2: Verify tests fail**

Run:

```bash
npm run test -- src/components/LittleGames/wonder-academy/wonderAcademyCreatures.test.ts
```

Expected: fail because `toCombatant()` currently passes unknown equipped move ids through.

- [x] **Step 3: Implement repair**

Add a local helper:

```ts
function knownMoveIds(ids: string[]): string[] {
  return ids.filter((id) => !!WONDER_ACADEMY_MOVES[id]).slice(0, 4);
}
```

Update `toCombatant()`:

```ts
const equippedMoveIds = owned.equippedMoveIds
  ? knownMoveIds(owned.equippedMoveIds)
  : [];
const defaultMoveIds = species ? knownMoveIds(defaultEquipped(species)) : ["tiny-flash"];
const moveIds =
  equippedMoveIds.length > 0
    ? equippedMoveIds
    : defaultMoveIds.length > 0 ? defaultMoveIds : ["tiny-flash"];
```

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
git add docs/superpowers/plans/2026-06-30-wonder-academy-equipped-move-repair.md \
  src/components/LittleGames/wonder-academy/wonderAcademyCreatures.ts \
  src/components/LittleGames/wonder-academy/wonderAcademyCreatures.test.ts
git commit -m "fix(wonder-academy): repair invalid equipped moves"
```
