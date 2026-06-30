# Wonder Academy Progress Array Save Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Normalize malformed Wonder Academy progress arrays when loading saves.

**Architecture:** Keep cleanup inside `normalizeWonderAcademySave()`, matching the existing save migration boundary. String id arrays are trimmed, empty entries are removed, and duplicates are removed while preserving first-seen order. Dex reward milestones are converted to unique non-negative integers.

**Tech Stack:** React 19, TypeScript strict, Vitest, existing Wonder Academy persistence module.

---

## File Structure

- **Modify** `src/components/LittleGames/wonder-academy/wonderAcademyPersistence.test.ts`
  - Add a failing normalization test for duplicated and malformed progress arrays.
- **Modify** `src/components/LittleGames/wonder-academy/wonderAcademyPersistence.ts`
  - Replace `stringArray()` with a unique non-empty string id array helper.
  - Add a non-negative integer array helper for `dexRewardsClaimed`.

## Task 1: Progress Array Save Migration

- [x] **Step 1: Write the failing test**

Add to the `normalizeWonderAcademySave` describe block:

```ts
it("normalizes progress arrays to unique safe ids and milestones", () => {
  expect(
    normalizeWonderAcademySave({
      playerName: "Mina",
      team: [],
      wardensDefeated: ["sparkleaf-grove", " ", "sparkleaf-grove", 7],
      clearedNodes: [
        "sparkleaf-grove:meadow-path",
        "sparkleaf-grove:meadow-path",
        "",
      ],
      shinyDex: ["lumi", "lumi", "  momo  ", null],
      dexRewardsClaimed: [3, 3, -1, 5.9, Number.NaN, "8"],
    }),
  ).toMatchObject({
    wardensDefeated: ["sparkleaf-grove"],
    clearedNodes: ["sparkleaf-grove:meadow-path"],
    shinyDex: ["lumi", "momo"],
    dexRewardsClaimed: [3, 5],
  });
});
```

- [x] **Step 2: Verify test fails**

Run:

```bash
npm run test -- src/components/LittleGames/wonder-academy/wonderAcademyPersistence.test.ts
```

Expected: fail because duplicates, blank string ids, and negative/fractional reward values are currently preserved.

- [x] **Step 3: Implement normalization**

Replace `stringArray()` with:

```ts
function uniqueStringIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value.flatMap((item) => {
    if (typeof item !== "string") return [];
    const id = item.trim();
    if (!id || seen.has(id)) return [];
    seen.add(id);
    return [id];
  });
}
```

Add:

```ts
function uniqueNonNegativeIntegers(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<number>();
  return value.flatMap((item) => {
    if (typeof item !== "number" || !Number.isFinite(item)) return [];
    const milestone = Math.floor(item);
    if (milestone < 0 || milestone > Number.MAX_SAFE_INTEGER) return [];
    if (seen.has(milestone)) return [];
    seen.add(milestone);
    return [milestone];
  });
}
```

Then update `normalizeWonderAcademySave()`:

```ts
wardensDefeated: uniqueStringIds(parsed.wardensDefeated),
clearedNodes: uniqueStringIds(parsed.clearedNodes),
shinyDex: uniqueStringIds(parsed.shinyDex),
dexRewardsClaimed: uniqueNonNegativeIntegers(parsed.dexRewardsClaimed),
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
git add docs/superpowers/plans/2026-06-30-wonder-academy-progress-array-save-migration.md \
  src/components/LittleGames/wonder-academy/wonderAcademyPersistence.ts \
  src/components/LittleGames/wonder-academy/wonderAcademyPersistence.test.ts
git commit -m "fix(wonder-academy): migrate progress save arrays"
```
