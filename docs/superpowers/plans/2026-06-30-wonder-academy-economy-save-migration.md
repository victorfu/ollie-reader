# Wonder Academy Economy Save Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Repair malformed Wonder Academy economy values when loading saves.

**Architecture:** Keep economy cleanup inside `normalizeWonderAcademySave()`. Stardust and snack quantities become non-negative integers, preventing negative currency, fractional counts, or invalid finite numbers from reaching the shop and battle snack UI.

**Tech Stack:** React 19, TypeScript strict, Vitest, existing Wonder Academy persistence module.

---

## File Structure

- **Modify** `src/components/LittleGames/wonder-academy/wonderAcademyPersistence.test.ts`
  - Add a failing normalization test for negative/fractional stardust and snack values.
- **Modify** `src/components/LittleGames/wonder-academy/wonderAcademyPersistence.ts`
  - Replace the general `numberRecord()` helper with a non-negative integer record helper.
  - Normalize `stardust` with `clampedInteger()`.

## Task 1: Economy Save Migration

- [x] **Step 1: Write failing test**

Add to `normalizeWonderAcademySave` tests:

```ts
it("normalizes economy values to non-negative integers", () => {
  expect(
    normalizeWonderAcademySave({
      playerName: "Mina",
      team: [],
      stardust: -12.8,
      snacks: {
        "starberry-cookie": -2,
        "moon-milk-puff": 3.8,
        "warm-cocoa-gem": Number.NaN,
      },
    }),
  ).toMatchObject({
    stardust: 0,
    snacks: {
      "starberry-cookie": 0,
      "moon-milk-puff": 3,
    },
  });
});
```

- [x] **Step 2: Verify test fails**

Run:

```bash
npm run test -- src/components/LittleGames/wonder-academy/wonderAcademyPersistence.test.ts
```

Expected: fail because negative stardust and snack values are currently preserved, and fractional snack values are not floored.

- [x] **Step 3: Implement normalization**

Replace `numberRecord()` with:

```ts
function nonNegativeIntegerRecord(value: unknown): Record<string, number> {
  const record = asRecord(value);
  if (!record) return {};
  return Object.fromEntries(
    Object.entries(record)
      .filter((entry): entry is [string, number] => (
        typeof entry[1] === "number" && Number.isFinite(entry[1])
      ))
      .map(([key, amount]) => [key, clampedInteger(amount, 0, 0, Number.MAX_SAFE_INTEGER)]),
  );
}
```

Then update `normalizeWonderAcademySave()`:

```ts
stardust: clampedInteger(parsed.stardust, 0, 0, Number.MAX_SAFE_INTEGER),
snacks: nonNegativeIntegerRecord(parsed.snacks),
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
git add docs/superpowers/plans/2026-06-30-wonder-academy-economy-save-migration.md \
  src/components/LittleGames/wonder-academy/wonderAcademyPersistence.ts \
  src/components/LittleGames/wonder-academy/wonderAcademyPersistence.test.ts
git commit -m "fix(wonder-academy): migrate economy save values"
```
