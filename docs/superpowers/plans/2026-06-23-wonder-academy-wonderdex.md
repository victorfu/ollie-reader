# Wonder Academy — Wonderdex (Collection) Logic Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the pure, fully-tested Wonderdex (collection) logic — per-species status (unseen → seen → caught → evolved, never regressing) and completion totals — with no UI and no DOM.

**Architecture:** One small, pure, side-effect-free TypeScript module under `src/components/LittleGames/wonder-academy/logic/` (alongside the combat/catch/progression/exploration modules). Status is rank-ordered so it can only advance; `recordDex` returns the same object reference when nothing changes (cheap no-op for reducers). Completion is a pure fold over a species-id list.

**Tech Stack:** TypeScript (strict), Vitest 4.x (`npm test` → `vitest run`).

## Global Constraints

- **TypeScript strict**, functional style, **2-space indentation**.
- **Test runner:** Vitest. Tests **co-located** as `<name>.test.ts`. Import as: `import { describe, expect, it } from "vitest";`.
- **Run a single test file:** `npx vitest run <path>`. **Whole suite:** `npm test`.
- **Pure logic only** — no DOM, React, Firebase, audio, `Math.random()`. `recordDex` must not mutate its input.
- **Status never regresses** — recording a lower status than the current one is a no-op that returns the same `Wonderdex` reference.
- **Conventional Commits**; one focused commit.

## File Structure

| File | Responsibility |
|---|---|
| `src/components/LittleGames/wonder-academy/logic/wonderdex.ts` | `DexStatus`/`Wonderdex`/`DexCompletion` types, `recordDex` (monotonic status advance), `dexCompletion` (totals). |

A co-located `wonderdex.test.ts` covers it. No dependencies on other modules.

---

### Task 1: Wonderdex status & completion

**Files:**
- Create: `src/components/LittleGames/wonder-academy/logic/wonderdex.ts`
- Test: `src/components/LittleGames/wonder-academy/logic/wonderdex.test.ts`

**Interfaces:**
- Produces:
  - `type DexStatus = "unseen" | "seen" | "caught" | "evolved"`
  - `type Wonderdex = Record<string, DexStatus>` — speciesId → status
  - `type DexCompletion = { seen: number; caught: number; total: number; caughtRatio: number }`
  - `recordDex(dex: Wonderdex, speciesId: string, status: DexStatus): Wonderdex` — advances the species to `status` only if it ranks higher than its current status (default `unseen`); otherwise returns `dex` unchanged (same reference). Never mutates the input.
  - `dexCompletion(dex: Wonderdex, allSpeciesIds: string[]): DexCompletion` — counts how many species are at least `seen` and at least `caught`, the total, and `caught / total` (0 when total is 0).

- [ ] **Step 1: Write the failing test**

Create `src/components/LittleGames/wonder-academy/logic/wonderdex.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { Wonderdex } from "./wonderdex";
import { dexCompletion, recordDex } from "./wonderdex";

describe("recordDex", () => {
  it("upgrades an unseen species to the new status", () => {
    expect(recordDex({}, "lumi", "seen")).toEqual({ lumi: "seen" });
  });

  it("advances through the ranks", () => {
    let dex: Wonderdex = {};
    dex = recordDex(dex, "lumi", "seen");
    dex = recordDex(dex, "lumi", "caught");
    dex = recordDex(dex, "lumi", "evolved");
    expect(dex.lumi).toBe("evolved");
  });

  it("never downgrades and returns the same reference when unchanged", () => {
    const dex: Wonderdex = { lumi: "caught" };
    const next = recordDex(dex, "lumi", "seen");
    expect(next).toBe(dex);
    expect(next.lumi).toBe("caught");
  });

  it("does not mutate the input", () => {
    const dex: Wonderdex = { lumi: "seen" };
    recordDex(dex, "lumi", "caught");
    expect(dex.lumi).toBe("seen");
  });
});

describe("dexCompletion", () => {
  const all = ["lumi", "momo", "pico", "nibi"];

  it("counts seen and caught across all species", () => {
    const dex: Wonderdex = { lumi: "evolved", momo: "caught", pico: "seen" };
    expect(dexCompletion(dex, all)).toEqual({
      seen: 3,
      caught: 2,
      total: 4,
      caughtRatio: 0.5,
    });
  });

  it("treats missing species as unseen", () => {
    expect(dexCompletion({}, all)).toEqual({
      seen: 0,
      caught: 0,
      total: 4,
      caughtRatio: 0,
    });
  });

  it("avoids division by zero for an empty species list", () => {
    expect(dexCompletion({}, []).caughtRatio).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/LittleGames/wonder-academy/logic/wonderdex.test.ts`
Expected: FAIL — `Failed to resolve import "./wonderdex"`.

- [ ] **Step 3: Write minimal implementation**

Create `src/components/LittleGames/wonder-academy/logic/wonderdex.ts`:

```ts
export type DexStatus = "unseen" | "seen" | "caught" | "evolved";

const RANK: Record<DexStatus, number> = {
  unseen: 0,
  seen: 1,
  caught: 2,
  evolved: 3,
};

export type Wonderdex = Record<string, DexStatus>;

export type DexCompletion = {
  seen: number;
  caught: number;
  total: number;
  caughtRatio: number;
};

// Advances a species' status; never downgrades. Returns the same object
// reference when the status would not advance (cheap no-op for reducers).
export function recordDex(
  dex: Wonderdex,
  speciesId: string,
  status: DexStatus,
): Wonderdex {
  const current = dex[speciesId] ?? "unseen";
  if (RANK[status] <= RANK[current]) return dex;
  return { ...dex, [speciesId]: status };
}

export function dexCompletion(
  dex: Wonderdex,
  allSpeciesIds: string[],
): DexCompletion {
  let seen = 0;
  let caught = 0;
  for (const id of allSpeciesIds) {
    const rank = RANK[dex[id] ?? "unseen"];
    if (rank >= RANK.seen) seen += 1;
    if (rank >= RANK.caught) caught += 1;
  }
  const total = allSpeciesIds.length;
  return { seen, caught, total, caughtRatio: total === 0 ? 0 : caught / total };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/LittleGames/wonder-academy/logic/wonderdex.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Run the full suite and commit**

Run: `npm test`
Expected: PASS — the wonderdex spec plus all earlier suites.

```bash
git add src/components/LittleGames/wonder-academy/logic/wonderdex.ts \
        src/components/LittleGames/wonder-academy/logic/wonderdex.test.ts
git commit -m "feat(wonder-academy): add wonderdex collection logic"
```

---

## Self-Review

**1. Spec coverage (§7 收集 / Wonderdex):**
- 狀態 未見/已收服/已進化(+ 已見)→ `DexStatus` + `recordDex`. ✓
- 不回退(收服後再「看到」不降級)→ rank guard. ✓
- 分區/總體完成度 → `dexCompletion` (callable with a region's id list or the full list). ✓
- **Out of scope (later plans):** region-completion *rewards*, the stage/variant dex representation decision (extended enum vs parallel map — still open in spec §10), and wiring `recordDex` into the reducer on encounter/catch/evolve.

**2. Placeholder scan:** No TBD/TODO; complete code in every step; exact commands with expected results. ✓

**3. Type consistency:** `DexStatus`/`Wonderdex`/`DexCompletion` defined once and referenced by name in the test. `recordDex` and `dexCompletion` signatures match between the test imports and the implementation. The no-downgrade no-op returns the input reference, which the `toBe` assertion pins. ✓
