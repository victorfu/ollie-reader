# Wonder Academy Custom Element Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Repair invalid custom-creature element metadata when loading Wonder Academy saves.

**Architecture:** Add a runtime element allowlist next to the `WonderAcademyElement` type. `normalizeWonderAcademySave()` filters legacy custom creature `elements` through that allowlist, preserves valid elements in order, and falls back to `["light"]` when none remain.

**Tech Stack:** React 19, TypeScript strict, Vitest, existing Wonder Academy persistence and type modules.

---

## File Structure

- **Modify** `src/types/wonderAcademy.ts`
  - Add `WONDER_ACADEMY_ELEMENTS` as the runtime source of valid element ids.
  - Derive `WonderAcademyElement` from that constant.
- **Modify** `src/components/LittleGames/wonder-academy/wonderAcademyPersistence.ts`
  - Import `WONDER_ACADEMY_ELEMENTS`.
  - Normalize custom creature `elements` with a small type guard.
- **Modify** `src/components/LittleGames/wonder-academy/wonderAcademyPersistence.test.ts`
  - Add tests for mixed valid/invalid elements and all-invalid elements.

## Task 1: Custom Element Migration

- [x] **Step 1: Write failing tests**

Add to `normalizeWonderAcademySave` tests:

```ts
it("filters invalid custom creature elements before deriving metadata", () => {
  const normalized = normalizeWonderAcademySave({
    playerName: "Mina",
    team: [],
    customCreatures: [
      {
        speciesId: "custom-mixed-elements",
        name: "Mixed Elements",
        category: "自訂夥伴",
        personality: "Legacy custom creature with mixed metadata",
        elements: ["bogus", "leaf"],
        rarity: "rare",
        favoriteSnack: "clover-macaron",
        growthStages: ["Mixed Elements"],
        moveIds: ["missing-move"],
        fieldSkillId: "missing-skill",
        portrait: "mixed.png",
        wild: true,
      },
    ],
  });

  expect(normalized?.customCreatures[0]).toMatchObject({
    elements: ["leaf"],
    fieldSkillId: "secret-sense",
    moveIds: ["leaf-wink", "clover-patch", "mossy-tackle", "spore-puff"],
  });
});

it("defaults custom creature elements to light when none are valid", () => {
  const normalized = normalizeWonderAcademySave({
    playerName: "Mina",
    team: [],
    customCreatures: [
      {
        speciesId: "custom-bad-elements",
        name: "Bad Elements",
        category: "自訂夥伴",
        personality: "Legacy custom creature with bad elements",
        elements: ["bogus"],
        rarity: "rare",
        favoriteSnack: "starberry-cookie",
        growthStages: ["Bad Elements"],
        portrait: "bad-elements.png",
        wild: true,
      },
    ],
  });

  expect(normalized?.customCreatures[0]).toMatchObject({
    elements: ["light"],
    fieldSkillId: "light-trail",
    moveIds: ["tiny-flash", "starstep-dash", "aurora-parade"],
  });
});
```

- [x] **Step 2: Verify tests fail**

Run:

```bash
npm run test -- src/components/LittleGames/wonder-academy/wonderAcademyPersistence.test.ts
```

Expected: fail because invalid custom creature element ids are currently preserved.

- [x] **Step 3: Implement runtime allowlist**

In `src/types/wonderAcademy.ts`, replace the manual union with:

```ts
export const WONDER_ACADEMY_ELEMENTS = [
  "spark",
  "tide",
  "leaf",
  "light",
  "dream",
  "ember",
  "crystal",
  "star",
] as const;

export type WonderAcademyElement = typeof WONDER_ACADEMY_ELEMENTS[number];
```

- [x] **Step 4: Implement custom element normalization**

In `wonderAcademyPersistence.ts`, add:

```ts
const VALID_ELEMENTS = new Set<string>(WONDER_ACADEMY_ELEMENTS);

function isWonderAcademyElement(value: unknown): value is WonderAcademyElement {
  return typeof value === "string" && VALID_ELEMENTS.has(value);
}
```

Then replace the custom creature elements extraction with:

```ts
const elements = Array.isArray(record.elements)
  ? record.elements.filter(isWonderAcademyElement)
  : [];
```

- [x] **Step 5: Verify focused tests pass**

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
git add docs/superpowers/plans/2026-06-30-wonder-academy-custom-element-migration.md \
  src/types/wonderAcademy.ts \
  src/components/LittleGames/wonder-academy/wonderAcademyPersistence.ts \
  src/components/LittleGames/wonder-academy/wonderAcademyPersistence.test.ts
git commit -m "fix(wonder-academy): migrate custom creature elements"
```
