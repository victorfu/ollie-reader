# Wonder Academy Catch Snack Consumption Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make battle capture consume an actual snack, matching the "give a snack to befriend" gameplay and battle UI copy.

**Architecture:** Add a small pure helper for choosing and consuming the catch snack. The reducer uses that helper before calling `playerCatch()`: favorite snack is preferred and grants the favorite bonus; otherwise the first available known snack is consumed without the favorite bonus; if no known snack is available, capture is a no-op. The battle UI disables the capture button when no snack is available.

**Tech Stack:** React 19, TypeScript strict, Vitest, existing Wonder Academy battle/session logic.

---

## File Structure

- **Create** `src/components/LittleGames/wonder-academy/logic/catchSnacks.ts`
  - Pure snack selection and inventory update helper.
- **Create** `src/components/LittleGames/wonder-academy/logic/catchSnacks.test.ts`
  - Focused tests for favorite, fallback, and empty inventory behavior.
- **Modify** `src/components/LittleGames/wonder-academy/WonderAcademyCollector.tsx`
  - Use the helper in the `battleCatch` reducer branch.
  - Disable the battle capture button when no known snack is available.

## Task 1: Catch Snack Helper

- [x] **Step 1: Write failing tests**

Create `src/components/LittleGames/wonder-academy/logic/catchSnacks.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { chooseCatchSnack } from "./catchSnacks";

const snackOrder = ["starberry-cookie", "moon-milk-puff", "clover-macaron"];

describe("chooseCatchSnack", () => {
  it("prefers and consumes the favorite snack", () => {
    expect(
      chooseCatchSnack(
        { "starberry-cookie": 2, "clover-macaron": 1 },
        "clover-macaron",
        snackOrder,
      ),
    ).toEqual({
      snackId: "clover-macaron",
      snacks: { "starberry-cookie": 2, "clover-macaron": 0 },
      isFavorite: true,
      treatTier: 2,
    });
  });

  it("consumes the first available known snack when the favorite is missing", () => {
    expect(
      chooseCatchSnack(
        { "starberry-cookie": 0, "moon-milk-puff": 3, "clover-macaron": 1 },
        "starberry-cookie",
        snackOrder,
      ),
    ).toEqual({
      snackId: "moon-milk-puff",
      snacks: { "starberry-cookie": 0, "moon-milk-puff": 2, "clover-macaron": 1 },
      isFavorite: false,
      treatTier: 2,
    });
  });

  it("returns null when no known snack is available", () => {
    expect(
      chooseCatchSnack({ "unknown-snack": 4, "starberry-cookie": 0 }, "starberry-cookie", snackOrder),
    ).toBeNull();
  });
});
```

- [x] **Step 2: Verify tests fail**

Run:

```bash
npm run test -- src/components/LittleGames/wonder-academy/logic/catchSnacks.test.ts
```

Expected: fail because `catchSnacks.ts` does not exist yet.

- [x] **Step 3: Implement helper**

Create `src/components/LittleGames/wonder-academy/logic/catchSnacks.ts`:

```ts
export type CatchSnackChoice = {
  snackId: string;
  snacks: Record<string, number>;
  isFavorite: boolean;
  treatTier: number;
};

export function chooseCatchSnack(
  snacks: Record<string, number>,
  favoriteSnack: string | undefined,
  snackOrder: readonly string[],
): CatchSnackChoice | null {
  const favoriteCount = favoriteSnack ? snacks[favoriteSnack] ?? 0 : 0;
  const snackId = favoriteSnack && favoriteCount > 0
    ? favoriteSnack
    : snackOrder.find((id) => (snacks[id] ?? 0) > 0);
  if (!snackId) return null;
  return {
    snackId,
    snacks: { ...snacks, [snackId]: (snacks[snackId] ?? 0) - 1 },
    isFavorite: snackId === favoriteSnack,
    treatTier: 2,
  };
}
```

- [x] **Step 4: Verify helper tests pass**

Run:

```bash
npm run test -- src/components/LittleGames/wonder-academy/logic/catchSnacks.test.ts
```

Expected: pass.

## Task 2: Wire Battle Catch Flow

- [x] **Step 1: Update reducer and UI**

In `src/components/LittleGames/wonder-academy/WonderAcademyCollector.tsx`, import:

```ts
import { chooseCatchSnack } from "./logic/catchSnacks";
```

Update the `battleCatch` branch:

```ts
case "battleCatch": {
  if (!state.battle) return state;
  const fav = speciesById(state.battle.wild.speciesId)?.favoriteSnack;
  const choice = chooseCatchSnack(state.snacks, fav, SNACK_POOL);
  if (!choice) return state;
  return afterBattle(
    { ...state, snacks: choice.snacks },
    playerCatch(state.battle, choice.treatTier, choice.isFavorite, random),
    action.today,
  );
}
```

In the battle render block, add:

```ts
const hasCatchSnack = SNACK_POOL.some((id) => (state.snacks?.[id] ?? 0) > 0);
```

Then disable the catch button when no snack is available:

```tsx
<button
  disabled={!hasCatchSnack}
  onClick={() => {
    if (hasCatchSnack) dispatch({ type: "battleCatch", today });
  }}
  style={{
    ...actBtn,
    opacity: hasCatchSnack ? 1 : 0.55,
    cursor: hasCatchSnack ? "pointer" : "not-allowed",
    background: "linear-gradient(180deg,#ffd66b,#f7b13a)",
    color: "#5b3d00",
    border: "none",
    boxShadow: hasCatchSnack ? "0 6px 16px rgba(247,177,58,.4)" : "none",
    lineHeight: 1.25,
  }}
>
```

When favorite snack is missing, show whether a normal snack is available:

```tsx
{favSnack && (
  <small style={{ display: "block", fontSize: 9.5, fontWeight: 700, opacity: 0.85, marginTop: 2 }}>
    {hasFav
      ? `最愛 ${SNACK_NAMES[favSnack] ?? favSnack} ×${favCount} · 加成!`
      : hasCatchSnack
        ? `最愛 ${SNACK_NAMES[favSnack] ?? favSnack}(沒有) · 改用一般點心`
        : "沒有可用點心"}
  </small>
)}
```

- [x] **Step 2: Verify focused tests pass**

Run:

```bash
npm run test -- src/components/LittleGames/wonder-academy/logic/catchSnacks.test.ts
```

Expected: pass.

## Task 3: Full Verification And Commit

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
git add docs/superpowers/plans/2026-06-30-wonder-academy-catch-snack-consumption.md \
  src/components/LittleGames/wonder-academy/WonderAcademyCollector.tsx \
  src/components/LittleGames/wonder-academy/logic/catchSnacks.ts \
  src/components/LittleGames/wonder-academy/logic/catchSnacks.test.ts
git commit -m "fix(wonder-academy): consume snacks on catch attempts"
```
