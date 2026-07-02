# Wonder Academy Daily Save Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Normalize malformed Wonder Academy daily task progress when loading saves.

**Architecture:** Keep daily cleanup inside `normalizeWonderAcademySave()`. A saved daily object is accepted only when it has a string `date`; its counts are normalized per known `DailyTaskId`, and its claimed list is filtered to unique known task ids.

**Tech Stack:** React 19, TypeScript strict, Vitest, existing Wonder Academy persistence and daily task modules.

---

## File Structure

- **Modify** `src/components/LittleGames/wonder-academy/wonderAcademyPersistence.test.ts`
  - Add a failing normalization test for malformed daily progress.
- **Modify** `src/components/LittleGames/wonder-academy/wonderAcademyPersistence.ts`
  - Import runtime daily task ids.
  - Add `normalizeDailyProgress()`.

## Task 1: Daily Save Migration

- [x] **Step 1: Write the failing test**

Add to the `normalizeWonderAcademySave` describe block:

```ts
it("normalizes malformed daily progress", () => {
  expect(
    normalizeWonderAcademySave({
      playerName: "Mina",
      team: [],
      daily: {
        date: "2026-6-30",
        counts: {
          catch: 1.8,
          win: -2,
          chest: "many",
          extra: 99,
        },
        claimed: ["catch", "catch", "bogus", 7, "win"],
      },
    }),
  ).toMatchObject({
    daily: {
      date: "2026-6-30",
      counts: { catch: 1, win: 0, chest: 0 },
      claimed: ["catch", "win"],
    },
  });
});
```

- [x] **Step 2: Verify test fails**

Run:

```bash
npm run test -- src/components/LittleGames/wonder-academy/wonderAcademyPersistence.test.ts
```

Expected: fail because malformed daily progress is currently cast through without count or claimed cleanup.

- [x] **Step 3: Implement normalization**

Update the daily task import:

```ts
import {
  DAILY_TASKS,
  type DailyProgress,
  type DailyTaskId,
} from "./logic/dailyTasks";
```

Add:

```ts
const DAILY_TASK_IDS = DAILY_TASKS.map((task) => task.id);
const DAILY_TASK_ID_SET = new Set<string>(DAILY_TASK_IDS);

function isDailyTaskId(value: unknown): value is DailyTaskId {
  return typeof value === "string" && DAILY_TASK_ID_SET.has(value);
}

function normalizeDailyProgress(value: unknown): DailyProgress | null {
  const record = asRecord(value);
  if (!record || typeof record.date !== "string") return null;
  const countsRecord = asRecord(record.counts);
  const counts = Object.fromEntries(
    DAILY_TASK_IDS.map((id) => [
      id,
      clampedInteger(countsRecord?.[id], 0, 0, Number.MAX_SAFE_INTEGER),
    ]),
  ) as Record<DailyTaskId, number>;
  return {
    date: record.date,
    counts,
    claimed: uniqueDailyTaskIds(record.claimed),
  };
}
```

To support the claimed list, add:

```ts
function uniqueDailyTaskIds(value: unknown): DailyTaskId[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<DailyTaskId>();
  return value.flatMap((item) => {
    if (!isDailyTaskId(item) || seen.has(item)) return [];
    seen.add(item);
    return [item];
  });
}
```

Then update `normalizeWonderAcademySave()`:

```ts
daily: normalizeDailyProgress(parsed.daily),
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
git add docs/superpowers/plans/2026-06-30-wonder-academy-daily-save-migration.md \
  src/components/LittleGames/wonder-academy/wonderAcademyPersistence.ts \
  src/components/LittleGames/wonder-academy/wonderAcademyPersistence.test.ts
git commit -m "fix(wonder-academy): migrate daily save progress"
```
