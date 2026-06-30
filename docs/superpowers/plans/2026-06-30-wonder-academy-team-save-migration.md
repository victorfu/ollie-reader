# Wonder Academy Team Save Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Repair malformed owned team creature metadata when loading Wonder Academy saves.

**Architecture:** Add `normalizeTeam()` inside `wonderAcademyPersistence.ts`, mirroring the existing custom creature migration style. Team entries must keep stable `ownedId` and `speciesId` strings; numeric progression fields are clamped to safe gameplay ranges; equipped move ids are filtered to known moves.

**Tech Stack:** React 19, TypeScript strict, Vitest, existing Wonder Academy persistence, progression, bond, and move modules.

---

## File Structure

- **Modify** `src/components/LittleGames/wonder-academy/wonderAcademyPersistence.test.ts`
  - Add a failing normalization test for malformed team entries.
- **Modify** `src/components/LittleGames/wonder-academy/wonderAcademyPersistence.ts`
  - Import `MAX_LEVEL` and `MAX_BOND`.
  - Add numeric clamp helpers and `normalizeTeam(value)`.
  - Replace the raw `parsed.team as OwnedCreature[]` cast with `normalizeTeam(parsed.team)`.

## Task 1: Team Save Migration

- [x] **Step 1: Write failing test**

Add to `normalizeWonderAcademySave` tests:

```ts
it("normalizes malformed owned team creatures", () => {
  const normalized = normalizeWonderAcademySave({
    playerName: "Mina",
    team: [
      {
        ownedId: "owned-lumi",
        speciesId: "lumi",
        nickname: 42,
        level: "high",
        xp: -20,
        bond: 500,
        stage: -2,
        equippedMoveIds: ["zip-spark", "missing-move", 7],
        shiny: true,
      },
      { ownedId: "bad-species", speciesId: 42 },
      null,
    ],
  });

  expect(normalized?.team).toEqual([
    {
      ownedId: "owned-lumi",
      speciesId: "lumi",
      nickname: "",
      level: 1,
      xp: 0,
      bond: 100,
      stage: 0,
      equippedMoveIds: ["zip-spark"],
      shiny: true,
    },
  ]);
});
```

- [x] **Step 2: Verify test fails**

Run:

```bash
npm run test -- src/components/LittleGames/wonder-academy/wonderAcademyPersistence.test.ts
```

Expected: fail because `normalizeWonderAcademySave()` currently casts `team` through without repairing entries.

- [x] **Step 3: Implement migration**

In `wonderAcademyPersistence.ts`, import:

```ts
import { MAX_BOND } from "./logic/bond";
import { MAX_LEVEL } from "./logic/progression";
```

Add helpers:

```ts
function clampedInteger(value: unknown, fallback: number, min: number, max: number): number {
  const numberValue = typeof value === "number" && Number.isFinite(value)
    ? Math.floor(value)
    : fallback;
  return Math.min(max, Math.max(min, numberValue));
}

function knownMoveIds(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((moveId): moveId is string => (
        typeof moveId === "string" && !!getMoveById(moveId)
      ))
    : [];
}

function normalizeTeam(value: unknown): OwnedCreature[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const record = asRecord(item);
    if (!record || typeof record.ownedId !== "string" || typeof record.speciesId !== "string") return [];
    const equippedMoveIds = knownMoveIds(record.equippedMoveIds);
    return [{
      ownedId: record.ownedId,
      speciesId: record.speciesId,
      nickname: typeof record.nickname === "string" ? record.nickname : "",
      level: clampedInteger(record.level, 1, 1, MAX_LEVEL),
      xp: clampedInteger(record.xp, 0, 0, Number.MAX_SAFE_INTEGER),
      bond: clampedInteger(record.bond, 0, 0, MAX_BOND),
      stage: clampedInteger(record.stage, 0, 0, Number.MAX_SAFE_INTEGER),
      ...(equippedMoveIds.length > 0 ? { equippedMoveIds } : {}),
      ...(record.shiny === true ? { shiny: true } : {}),
    }];
  });
}
```

Then update `normalizeWonderAcademySave()`:

```ts
team: normalizeTeam(parsed.team),
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
git add docs/superpowers/plans/2026-06-30-wonder-academy-team-save-migration.md \
  src/components/LittleGames/wonder-academy/wonderAcademyPersistence.ts \
  src/components/LittleGames/wonder-academy/wonderAcademyPersistence.test.ts
git commit -m "fix(wonder-academy): migrate owned team saves"
```
