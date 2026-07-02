# Wonder Academy Dex Save Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Normalize malformed Wonderdex records when loading Wonder Academy saves.

**Architecture:** Keep dex cleanup inside `normalizeWonderAcademySave()`. The loader keeps only non-empty species ids and known dex statuses, trimming ids so malformed keys do not leak into completion logic.

**Tech Stack:** React 19, TypeScript strict, Vitest, existing Wonder Academy persistence and Wonderdex modules.

---

## File Structure

- **Modify** `src/components/LittleGames/wonder-academy/wonderAcademyPersistence.test.ts`
  - Add a failing normalization test for invalid Wonderdex entries.
- **Modify** `src/components/LittleGames/wonder-academy/wonderAcademyPersistence.ts`
  - Import `DexStatus`.
  - Add `normalizeWonderdex()`.

## Task 1: Wonderdex Save Migration

- [x] **Step 1: Write the failing test**

Add to the `normalizeWonderAcademySave` describe block:

```ts
it("normalizes malformed Wonderdex records", () => {
  expect(
    normalizeWonderAcademySave({
      playerName: "Mina",
      team: [],
      dex: {
        lumi: "caught",
        "  momo  ": "evolved",
        pico: "mystery",
        nibi: 3,
        "": "seen",
        sparkleaf: "unseen",
      },
    }),
  ).toMatchObject({
    dex: {
      lumi: "caught",
      momo: "evolved",
      sparkleaf: "unseen",
    },
  });
});
```

- [x] **Step 2: Verify test fails**

Run:

```bash
npm run test -- src/components/LittleGames/wonder-academy/wonderAcademyPersistence.test.ts
```

Expected: fail because invalid statuses and empty/untrimmed species ids are currently preserved.

- [x] **Step 3: Implement normalization**

Update the Wonderdex import:

```ts
import type { DexStatus, Wonderdex } from "./logic/wonderdex";
```

Add:

```ts
const DEX_STATUSES = new Set<string>(["unseen", "seen", "caught", "evolved"]);

function isDexStatus(value: unknown): value is DexStatus {
  return typeof value === "string" && DEX_STATUSES.has(value);
}

function normalizeWonderdex(value: unknown): Wonderdex {
  const record = asRecord(value);
  if (!record) return {};
  const dex: Wonderdex = {};
  for (const [rawSpeciesId, status] of Object.entries(record)) {
    const speciesId = rawSpeciesId.trim();
    if (!speciesId || !isDexStatus(status) || dex[speciesId]) continue;
    dex[speciesId] = status;
  }
  return dex;
}
```

Then update `normalizeWonderAcademySave()`:

```ts
dex: normalizeWonderdex(parsed.dex),
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
git add docs/superpowers/plans/2026-06-30-wonder-academy-dex-save-migration.md \
  src/components/LittleGames/wonder-academy/wonderAcademyPersistence.ts \
  src/components/LittleGames/wonder-academy/wonderAcademyPersistence.test.ts
git commit -m "fix(wonder-academy): migrate dex save records"
```
