# Wonder Academy Daily Reward Save Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Normalize saved daily reward dates when loading Wonder Academy saves.

**Architecture:** Keep cleanup inside `normalizeWonderAcademySave()`. `lastDailyReward` becomes a trimmed non-empty string or `null`, preventing whitespace-corrupted dates from allowing duplicate daily rewards.

**Tech Stack:** React 19, TypeScript strict, Vitest, existing Wonder Academy persistence module.

---

## File Structure

- **Modify** `src/components/LittleGames/wonder-academy/wonderAcademyPersistence.test.ts`
  - Add a failing normalization test for saved daily reward dates.
- **Modify** `src/components/LittleGames/wonder-academy/wonderAcademyPersistence.ts`
  - Add `optionalTrimmedString()`.
  - Use it for `lastDailyReward`.

## Task 1: Daily Reward Save Migration

- [x] **Step 1: Write the failing test**

Add to the `normalizeWonderAcademySave` describe block:

```ts
it("normalizes saved daily reward dates", () => {
  expect(
    normalizeWonderAcademySave({
      playerName: "Mina",
      team: [],
      lastDailyReward: " 2026-6-30 ",
    })?.lastDailyReward,
  ).toBe("2026-6-30");

  expect(
    normalizeWonderAcademySave({
      playerName: "Mina",
      team: [],
      lastDailyReward: " ",
    })?.lastDailyReward,
  ).toBeNull();
});
```

- [x] **Step 2: Verify test fails**

Run:

```bash
npm run test -- src/components/LittleGames/wonder-academy/wonderAcademyPersistence.test.ts
```

Expected: fail because whitespace is currently preserved.

- [x] **Step 3: Implement normalization**

Add:

```ts
function optionalTrimmedString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}
```

Then update `normalizeWonderAcademySave()`:

```ts
lastDailyReward: optionalTrimmedString(parsed.lastDailyReward),
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
git add docs/superpowers/plans/2026-06-30-wonder-academy-daily-reward-save-migration.md \
  src/components/LittleGames/wonder-academy/wonderAcademyPersistence.ts \
  src/components/LittleGames/wonder-academy/wonderAcademyPersistence.test.ts
git commit -m "fix(wonder-academy): migrate daily reward save date"
```
