# Wonder Academy — Exploration: Encounters & Loot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the pure, fully-tested exploration logic for the Wonder Academy creature-collector — weighted wild encounters (which creature appears in tall grass, at what level) and treasure-chest loot rolls — with no UI and no DOM.

**Architecture:** Three small, pure, side-effect-free TypeScript modules under `src/components/LittleGames/wonder-academy/logic/` (alongside the combat/catch/progression modules). A shared `weighted.ts` provides the weighted-pick + integer-roll primitives; `encounter.ts` and `loot.ts` build on it. All randomness flows through the injectable seeded `Rng` from the existing `rng.ts` — no `Math.random()`.

**Tech Stack:** TypeScript (strict), Vitest 4.x (`npm test` → `vitest run`).

## Global Constraints

- **TypeScript strict**, functional style, **2-space indentation**.
- **Test runner:** Vitest. Tests **co-located** as `<name>.test.ts`. Import as: `import { describe, expect, it } from "vitest";`.
- **Run a single test file:** `npx vitest run <path>`. **Whole suite:** `npm test`.
- **Pure logic only** — no DOM, React, Firebase, audio, `Math.random()`. All randomness through the injected `Rng` (`() => number` in `[0, 1)`). Functions take inputs and return new values; never mutate inputs.
- **Determinism in tests:** use a sequence stub `const seq = (values: number[]): Rng => { let i = 0; return () => values[i++]; };` to control the RNG exactly, and the real `createRng` only where a structural (in-range / in-pool) assertion suffices.
- **Conventional Commits**; one focused commit per task.

## File Structure

| File | Responsibility |
|---|---|
| `src/components/LittleGames/wonder-academy/logic/weighted.ts` | `pickWeighted` (weighted choice) + `rollInt` (inclusive integer roll). |
| `src/components/LittleGames/wonder-academy/logic/encounter.ts` | Encounter table types + `rollEncounter` (grass-step → wild creature or none). |
| `src/components/LittleGames/wonder-academy/logic/loot.ts` | Loot table types + `rollLoot` (treasure chest → accumulated items). |

Each file has a co-located `*.test.ts`. Task 1 is foundational; Tasks 2 and 3 both depend on Task 1's `weighted.ts`. All three depend only on the existing `rng.ts` (`Rng` type).

---

### Task 1: Weighted primitives

**Files:**
- Create: `src/components/LittleGames/wonder-academy/logic/weighted.ts`
- Test: `src/components/LittleGames/wonder-academy/logic/weighted.test.ts`

**Interfaces:**
- Consumes: `Rng` from `./rng`.
- Produces:
  - `pickWeighted<T extends { weight: number }>(entries: T[], rng: Rng): T` — picks one entry with probability proportional to its `weight`. Throws on an empty array.
  - `rollInt(min: number, max: number, rng: Rng): number` — uniform integer in `[min, max]` inclusive.

- [ ] **Step 1: Write the failing test**

Create `src/components/LittleGames/wonder-academy/logic/weighted.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { Rng } from "./rng";
import { pickWeighted, rollInt } from "./weighted";

const seq = (values: number[]): Rng => {
  let i = 0;
  return () => values[i++];
};

describe("pickWeighted", () => {
  const entries = [
    { id: "a", weight: 1 },
    { id: "b", weight: 3 },
  ];

  it("selects by weighted threshold", () => {
    // total = 4. r = rng()*4.
    expect(pickWeighted(entries, seq([0])).id).toBe("a"); // r=0 -> a
    expect(pickWeighted(entries, seq([0.5])).id).toBe("b"); // r=2 -> a(1) then b
    expect(pickWeighted(entries, seq([0.99])).id).toBe("b"); // r=3.96 -> b
  });

  it("returns the only entry when there is one", () => {
    expect(pickWeighted([{ id: "solo", weight: 5 }], seq([0.7])).id).toBe("solo");
  });

  it("throws on an empty pool", () => {
    expect(() => pickWeighted([], seq([0]))).toThrow();
  });
});

describe("rollInt", () => {
  it("returns min at rng 0 and max near rng 1, inclusive", () => {
    expect(rollInt(5, 8, seq([0]))).toBe(5);
    expect(rollInt(5, 8, seq([0.999]))).toBe(8);
    expect(rollInt(5, 8, seq([0.5]))).toBe(7); // 5 + floor(0.5*4) = 5 + 2
  });

  it("handles a single-value range", () => {
    expect(rollInt(3, 3, seq([0.99]))).toBe(3);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/LittleGames/wonder-academy/logic/weighted.test.ts`
Expected: FAIL — `Failed to resolve import "./weighted"`.

- [ ] **Step 3: Write minimal implementation**

Create `src/components/LittleGames/wonder-academy/logic/weighted.ts`:

```ts
import type { Rng } from "./rng";

export function pickWeighted<T extends { weight: number }>(
  entries: T[],
  rng: Rng,
): T {
  if (entries.length === 0) {
    throw new Error("pickWeighted: entries must not be empty");
  }
  const total = entries.reduce((sum, entry) => sum + entry.weight, 0);
  let threshold = rng() * total;
  for (const entry of entries) {
    threshold -= entry.weight;
    if (threshold < 0) return entry;
  }
  return entries[entries.length - 1];
}

export function rollInt(min: number, max: number, rng: Rng): number {
  return min + Math.floor(rng() * (max - min + 1));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/LittleGames/wonder-academy/logic/weighted.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/LittleGames/wonder-academy/logic/weighted.ts \
        src/components/LittleGames/wonder-academy/logic/weighted.test.ts
git commit -m "feat(wonder-academy): add weighted pick and int roll helpers"
```

---

### Task 2: Wild encounters

**Files:**
- Create: `src/components/LittleGames/wonder-academy/logic/encounter.ts`
- Test: `src/components/LittleGames/wonder-academy/logic/encounter.test.ts`

**Interfaces:**
- Consumes: `Rng` from `./rng`; `pickWeighted`, `rollInt` from `./weighted` (Task 1).
- Produces:
  - `type EncounterEntry = { speciesId: string; weight: number }`
  - `type EncounterTable = { encounterChance: number; entries: EncounterEntry[]; minLevel: number; maxLevel: number }`
  - `type WildEncounter = { speciesId: string; level: number }`
  - `rollEncounter(table: EncounterTable, rng: Rng): WildEncounter | null` — first consumes one `rng()` for the encounter-chance gate; if `rng() < encounterChance`, it picks a species (one `rng()`) and rolls a level (one `rng()`) and returns the `WildEncounter`; otherwise returns `null`.

- [ ] **Step 1: Write the failing test**

Create `src/components/LittleGames/wonder-academy/logic/encounter.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { Rng } from "./rng";
import { createRng } from "./rng";
import type { EncounterTable } from "./encounter";
import { rollEncounter } from "./encounter";

const seq = (values: number[]): Rng => {
  let i = 0;
  return () => values[i++];
};

const table: EncounterTable = {
  encounterChance: 0.5,
  entries: [
    { speciesId: "mossmew", weight: 1 },
    { speciesId: "sparkleaf-fawn", weight: 1 },
  ],
  minLevel: 3,
  maxLevel: 6,
};

describe("rollEncounter", () => {
  it("returns null when the chance gate is not met", () => {
    // first rng() = 0.9 >= 0.5 -> no encounter
    expect(rollEncounter(table, seq([0.9]))).toBeNull();
  });

  it("produces a wild encounter when the gate is met", () => {
    // gate 0.1 < 0.5 ; pick rng 0 -> first species ; level rng 0 -> minLevel
    expect(rollEncounter(table, seq([0.1, 0, 0]))).toEqual({
      speciesId: "mossmew",
      level: 3,
    });
  });

  it("rolls the level within [minLevel, maxLevel]", () => {
    // gate met, pick second species, level rng 0.999 -> maxLevel
    expect(rollEncounter(table, seq([0.0, 0.99, 0.999]))).toEqual({
      speciesId: "sparkleaf-fawn",
      level: 6,
    });
  });

  it("never encounters when encounterChance is 0", () => {
    const zero: EncounterTable = { ...table, encounterChance: 0 };
    const rng = createRng(1);
    for (let i = 0; i < 20; i += 1) {
      expect(rollEncounter(zero, rng)).toBeNull();
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/LittleGames/wonder-academy/logic/encounter.test.ts`
Expected: FAIL — `Failed to resolve import "./encounter"`.

- [ ] **Step 3: Write minimal implementation**

Create `src/components/LittleGames/wonder-academy/logic/encounter.ts`:

```ts
import type { Rng } from "./rng";
import { pickWeighted, rollInt } from "./weighted";

export type EncounterEntry = {
  speciesId: string;
  weight: number;
};

export type EncounterTable = {
  encounterChance: number;
  entries: EncounterEntry[];
  minLevel: number;
  maxLevel: number;
};

export type WildEncounter = {
  speciesId: string;
  level: number;
};

export function rollEncounter(
  table: EncounterTable,
  rng: Rng,
): WildEncounter | null {
  if (rng() >= table.encounterChance) return null;
  const entry = pickWeighted(table.entries, rng);
  const level = rollInt(table.minLevel, table.maxLevel, rng);
  return { speciesId: entry.speciesId, level };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/LittleGames/wonder-academy/logic/encounter.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/LittleGames/wonder-academy/logic/encounter.ts \
        src/components/LittleGames/wonder-academy/logic/encounter.test.ts
git commit -m "feat(wonder-academy): add wild encounter rolls"
```

---

### Task 3: Treasure loot

**Files:**
- Create: `src/components/LittleGames/wonder-academy/logic/loot.ts`
- Test: `src/components/LittleGames/wonder-academy/logic/loot.test.ts`

**Interfaces:**
- Consumes: `Rng` from `./rng`; `pickWeighted` from `./weighted` (Task 1).
- Produces:
  - `type LootEntry = { itemId: string; quantity: number; weight: number }`
  - `type LootTable = { rolls: number; entries: LootEntry[] }`
  - `type LootResult = Record<string, number>` — itemId → total quantity
  - `rollLoot(table: LootTable, rng: Rng): LootResult` — performs `table.rolls` weighted picks (one `rng()` each), accumulating quantities per item id. Zero rolls → empty object.

- [ ] **Step 1: Write the failing test**

Create `src/components/LittleGames/wonder-academy/logic/loot.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { Rng } from "./rng";
import type { LootTable } from "./loot";
import { rollLoot } from "./loot";

const seq = (values: number[]): Rng => {
  let i = 0;
  return () => values[i++];
};

const table: LootTable = {
  rolls: 3,
  entries: [
    { itemId: "starberry-cookie", quantity: 1, weight: 1 },
    { itemId: "stardust", quantity: 5, weight: 1 },
  ],
};

describe("rollLoot", () => {
  it("returns an empty result for zero rolls", () => {
    expect(rollLoot({ ...table, rolls: 0 }, seq([]))).toEqual({});
  });

  it("accumulates quantity when the same item is rolled repeatedly", () => {
    // total weight 2; r<1 -> first entry. rng 0,0.1,0.4 all map to entry 0
    expect(rollLoot(table, seq([0, 0.1, 0.4]))).toEqual({
      "starberry-cookie": 3,
    });
  });

  it("accumulates separate items independently", () => {
    // rng 0 -> entry0 (cookie x1); rng 0.9 -> r=1.8 -> entry1 (stardust x5); rng 0 -> entry0 (cookie x1)
    expect(rollLoot(table, seq([0, 0.9, 0]))).toEqual({
      "starberry-cookie": 2,
      stardust: 5,
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/LittleGames/wonder-academy/logic/loot.test.ts`
Expected: FAIL — `Failed to resolve import "./loot"`.

- [ ] **Step 3: Write minimal implementation**

Create `src/components/LittleGames/wonder-academy/logic/loot.ts`:

```ts
import type { Rng } from "./rng";
import { pickWeighted } from "./weighted";

export type LootEntry = {
  itemId: string;
  quantity: number;
  weight: number;
};

export type LootTable = {
  rolls: number;
  entries: LootEntry[];
};

export type LootResult = Record<string, number>;

export function rollLoot(table: LootTable, rng: Rng): LootResult {
  const result: LootResult = {};
  for (let i = 0; i < table.rolls; i += 1) {
    const entry = pickWeighted(table.entries, rng);
    result[entry.itemId] = (result[entry.itemId] ?? 0) + entry.quantity;
  }
  return result;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/LittleGames/wonder-academy/logic/loot.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Run the full suite and commit**

Run: `npm test`
Expected: PASS — the exploration specs plus all earlier suites.

```bash
git add src/components/LittleGames/wonder-academy/logic/loot.ts \
        src/components/LittleGames/wonder-academy/logic/loot.test.ts
git commit -m "feat(wonder-academy): add treasure loot rolls"
```

---

## Self-Review

**1. Spec coverage (this plan's slice — §5 ① 探索 / §6 expedition rolls):**
- 草叢遭遇(哪隻野生寵物、什麼等級,seeded)→ Tasks 1+2. ✓
- 寶箱掉落表 → Tasks 1+3. ✓
- **Out of scope (later plans):** node-unlock / field-skill gating conditions, the explorable Kaplay scene itself, and wiring rolls into the reducer (which expedition/destination feeds which table).

**2. Placeholder scan:** No TBD/TODO; every code step shows complete code; every run step gives an exact command and expected result. ✓

**3. Type consistency:** `pickWeighted`/`rollInt` defined once in `weighted.ts` and imported by `encounter.ts` and `loot.ts`. `EncounterTable`/`WildEncounter`/`LootTable`/`LootResult` each defined once and referenced by name in their tests. The `seq` RNG stub matches the `Rng = () => number` type from `rng.ts`. The documented per-call RNG consumption order (gate → pick → level for encounters; one pick per roll for loot) matches the implementations and the seeded test vectors. ✓
