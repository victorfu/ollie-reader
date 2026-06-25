# Wonder Academy — Progression & Evolution Logic Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the pure, fully-tested progression logic for the Wonder Academy creature-collector — XP/leveling, stage-based evolution, and bond growth — with no UI and no DOM.

**Architecture:** Three small, pure, side-effect-free TypeScript modules under `src/components/LittleGames/wonder-academy/logic/` (alongside the combat/catch modules from the previous plan). They operate on primitive values (level, xp, stage, bond) so they stay decoupled from the full `OwnedWonderling` shape; a later reducer plan wires them to owned creatures. Deterministic — no randomness.

**Tech Stack:** TypeScript (strict), Vitest 4.x (`npm test` → `vitest run`).

## Global Constraints

- **TypeScript strict**, functional style, **2-space indentation**.
- **Test runner:** Vitest. Tests **co-located** as `<name>.test.ts`. Import as: `import { describe, expect, it } from "vitest";`.
- **Run a single test file:** `npx vitest run <path>`. **Whole suite:** `npm test`.
- **Pure logic only** — no DOM, React, Firebase, audio, `Math.random()`. Functions take primitives and return new values; never mutate inputs.
- **Light, predictable, kid-friendly tuning** — gentle curves, no hidden randomness. The exact numbers below are MVP values, chosen to be simple and round.
- **Conventional Commits**; one focused commit per task.

## File Structure

| File | Responsibility |
|---|---|
| `src/components/LittleGames/wonder-academy/logic/progression.ts` | XP curve + `gainXp` leveling roll-over, `MAX_LEVEL`. |
| `src/components/LittleGames/wonder-academy/logic/evolution.ts` | Stage thresholds + `canEvolve` / `evolve`. |
| `src/components/LittleGames/wonder-academy/logic/bond.ts` | `gainBond` with favorite-snack multiplier + clamp. |

Each file has a co-located `*.test.ts`. The three tasks are independent of each other and of the combat/catch modules.

---

### Task 1: Leveling & XP curve

**Files:**
- Create: `src/components/LittleGames/wonder-academy/logic/progression.ts`
- Test: `src/components/LittleGames/wonder-academy/logic/progression.test.ts`

**Interfaces:**
- Produces:
  - `MAX_LEVEL: number` (= 50)
  - `xpToNext(level: number): number` — XP required to advance from `level` to `level + 1` (= `10 + level * 10`).
  - `type LevelUpResult = { level: number; xp: number; levelsGained: number }`
  - `gainXp(level: number, xp: number, amount: number): LevelUpResult` — `xp` is progress toward the next level; rolls over as many levels as the amount allows, capping at `MAX_LEVEL` (no XP stored past the cap).

- [ ] **Step 1: Write the failing test**

Create `src/components/LittleGames/wonder-academy/logic/progression.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { MAX_LEVEL, gainXp, xpToNext } from "./progression";

describe("xp curve", () => {
  it("increases the requirement each level", () => {
    expect(xpToNext(1)).toBe(20);
    expect(xpToNext(2)).toBe(30);
    expect(xpToNext(5)).toBe(60);
  });
});

describe("gainXp", () => {
  it("accumulates xp without leveling when below the threshold", () => {
    expect(gainXp(1, 0, 5)).toEqual({ level: 1, xp: 5, levelsGained: 0 });
  });

  it("levels up once and carries the remainder", () => {
    // level 1 needs 20 to reach 2; 25 -> level 2 with 5 left over
    expect(gainXp(1, 0, 25)).toEqual({ level: 2, xp: 5, levelsGained: 1 });
  });

  it("rolls over multiple levels in one gain", () => {
    // 60: -20 -> L2 (40 left), -30 -> L3 (10 left), need 40 for L4 -> stop
    expect(gainXp(1, 0, 60)).toEqual({ level: 3, xp: 10, levelsGained: 2 });
  });

  it("respects existing partial xp", () => {
    // level 2 with 25/30, gain 10 -> 35 -> level 3 with 5 left
    expect(gainXp(2, 25, 10)).toEqual({ level: 3, xp: 5, levelsGained: 1 });
  });

  it("caps at MAX_LEVEL with no stored overflow", () => {
    expect(gainXp(MAX_LEVEL, 0, 9999)).toEqual({
      level: MAX_LEVEL,
      xp: 0,
      levelsGained: 0,
    });
    const capped = gainXp(MAX_LEVEL - 1, 0, 999999);
    expect(capped.level).toBe(MAX_LEVEL);
    expect(capped.xp).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/LittleGames/wonder-academy/logic/progression.test.ts`
Expected: FAIL — `Failed to resolve import "./progression"`.

- [ ] **Step 3: Write minimal implementation**

Create `src/components/LittleGames/wonder-academy/logic/progression.ts`:

```ts
export const MAX_LEVEL = 50;

// XP required to advance FROM `level` to `level + 1`.
export function xpToNext(level: number): number {
  return 10 + level * 10;
}

export type LevelUpResult = {
  level: number;
  xp: number;
  levelsGained: number;
};

// Adds `amount` XP to a creature at (level, xp toward next). Rolls over as
// many levels as the amount allows; at MAX_LEVEL no further XP is stored.
export function gainXp(
  level: number,
  xp: number,
  amount: number,
): LevelUpResult {
  let currentLevel = level;
  let currentXp = xp + amount;
  let levelsGained = 0;

  while (currentLevel < MAX_LEVEL && currentXp >= xpToNext(currentLevel)) {
    currentXp -= xpToNext(currentLevel);
    currentLevel += 1;
    levelsGained += 1;
  }

  if (currentLevel >= MAX_LEVEL) {
    currentLevel = MAX_LEVEL;
    currentXp = 0;
  }

  return { level: currentLevel, xp: currentXp, levelsGained };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/LittleGames/wonder-academy/logic/progression.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/LittleGames/wonder-academy/logic/progression.ts \
        src/components/LittleGames/wonder-academy/logic/progression.test.ts
git commit -m "feat(wonder-academy): add xp and leveling logic"
```

---

### Task 2: Evolution

**Files:**
- Create: `src/components/LittleGames/wonder-academy/logic/evolution.ts`
- Test: `src/components/LittleGames/wonder-academy/logic/evolution.test.ts`

**Interfaces:**
- Produces:
  - `EVOLUTION_LEVELS: number[]` (= `[12, 24, 36]`) — the level required for the transition out of stage `index` (stage 0→1 at 12, 1→2 at 24, 2→3 at 36).
  - `canEvolve(currentStage: number, level: number, totalStages: number): boolean` — true only when the creature is not at its final stage and its level meets the threshold for the current stage.
  - `evolve(currentStage: number, totalStages: number): number` — returns the next stage index, never exceeding `totalStages - 1`.

Note: `totalStages` comes from a species' `growthStages.length` (4 for the existing starters). `currentStage` maps to the existing `OwnedWonderling.currentGrowthStage` (0-based).

- [ ] **Step 1: Write the failing test**

Create `src/components/LittleGames/wonder-academy/logic/evolution.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { EVOLUTION_LEVELS, canEvolve, evolve } from "./evolution";

describe("canEvolve", () => {
  it("requires the level threshold for the current stage", () => {
    expect(canEvolve(0, 11, 4)).toBe(false);
    expect(canEvolve(0, 12, 4)).toBe(true);
    expect(canEvolve(1, 23, 4)).toBe(false);
    expect(canEvolve(1, 24, 4)).toBe(true);
    expect(canEvolve(2, 36, 4)).toBe(true);
  });

  it("never evolves past the final stage", () => {
    expect(canEvolve(3, 99, 4)).toBe(false); // already final (stages 0..3)
  });

  it("returns false when no threshold exists for the stage", () => {
    // a 2-stage species: only stage 0 can evolve, using EVOLUTION_LEVELS[0]
    expect(canEvolve(1, 99, 2)).toBe(false);
  });
});

describe("evolve", () => {
  it("advances one stage", () => {
    expect(evolve(0, 4)).toBe(1);
    expect(evolve(2, 4)).toBe(3);
  });

  it("clamps at the final stage", () => {
    expect(evolve(3, 4)).toBe(3);
  });
});

describe("EVOLUTION_LEVELS", () => {
  it("defines three ascending thresholds for a four-stage line", () => {
    expect(EVOLUTION_LEVELS).toEqual([12, 24, 36]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/LittleGames/wonder-academy/logic/evolution.test.ts`
Expected: FAIL — `Failed to resolve import "./evolution"`.

- [ ] **Step 3: Write minimal implementation**

Create `src/components/LittleGames/wonder-academy/logic/evolution.ts`:

```ts
// Level required to evolve OUT OF stage `index` (0-based).
// A four-stage line has three transitions.
export const EVOLUTION_LEVELS = [12, 24, 36];

export function canEvolve(
  currentStage: number,
  level: number,
  totalStages: number,
): boolean {
  if (currentStage >= totalStages - 1) return false;
  const threshold = EVOLUTION_LEVELS[currentStage];
  if (threshold === undefined) return false;
  return level >= threshold;
}

export function evolve(currentStage: number, totalStages: number): number {
  return Math.min(currentStage + 1, totalStages - 1);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/LittleGames/wonder-academy/logic/evolution.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/LittleGames/wonder-academy/logic/evolution.ts \
        src/components/LittleGames/wonder-academy/logic/evolution.test.ts
git commit -m "feat(wonder-academy): add stage evolution logic"
```

---

### Task 3: Bond

**Files:**
- Create: `src/components/LittleGames/wonder-academy/logic/bond.ts`
- Test: `src/components/LittleGames/wonder-academy/logic/bond.test.ts`

**Interfaces:**
- Produces:
  - `MAX_BOND: number` (= 100)
  - `FAVORITE_SNACK_BOND_MULTIPLIER: number` (= 2)
  - `gainBond(currentBond: number, amount: number, isFavorite: boolean): number` — adds `amount` (doubled when `isFavorite`), clamped to `[0, MAX_BOND]`.

- [ ] **Step 1: Write the failing test**

Create `src/components/LittleGames/wonder-academy/logic/bond.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { MAX_BOND, gainBond } from "./bond";

describe("gainBond", () => {
  it("adds the plain amount for a non-favorite snack", () => {
    expect(gainBond(0, 10, false)).toBe(10);
  });

  it("doubles the gain for the favorite snack", () => {
    expect(gainBond(0, 10, true)).toBe(20);
  });

  it("clamps at MAX_BOND", () => {
    expect(gainBond(95, 10, false)).toBe(MAX_BOND);
    expect(gainBond(95, 10, true)).toBe(MAX_BOND);
  });

  it("never goes below zero for a negative amount", () => {
    expect(gainBond(5, -10, false)).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/LittleGames/wonder-academy/logic/bond.test.ts`
Expected: FAIL — `Failed to resolve import "./bond"`.

- [ ] **Step 3: Write minimal implementation**

Create `src/components/LittleGames/wonder-academy/logic/bond.ts`:

```ts
export const MAX_BOND = 100;
export const FAVORITE_SNACK_BOND_MULTIPLIER = 2;

export function gainBond(
  currentBond: number,
  amount: number,
  isFavorite: boolean,
): number {
  const gain = isFavorite ? amount * FAVORITE_SNACK_BOND_MULTIPLIER : amount;
  const next = currentBond + gain;
  return Math.min(MAX_BOND, Math.max(0, next));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/LittleGames/wonder-academy/logic/bond.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Run the full suite and commit**

Run: `npm test`
Expected: PASS — the progression/evolution/bond specs plus all earlier suites.

```bash
git add src/components/LittleGames/wonder-academy/logic/bond.ts \
        src/components/LittleGames/wonder-academy/logic/bond.test.ts
git commit -m "feat(wonder-academy): add bond growth logic"
```

---

## Self-Review

**1. Spec coverage (this plan's slice — §7 養成):**
- 升級:XP from battles/catching, level roll-over, cap → Task 1. ✓
- 進化:level-threshold stage advance through the 4 `growthStages` → Task 2. ✓
- 感情(bond):rises from favorite snacks, clamped → Task 3. ✓
- **Out of scope (later plans):** materials cost for evolution, stat growth per level (belongs with the species→combatant mapping in the battle-integration plan), skill-slot unlocks, and wiring all of this into the reducer / `OwnedWonderling`.

**2. Placeholder scan:** No TBD/TODO; every code step shows complete code; every run step gives an exact command and expected result. ✓

**3. Type consistency:** `LevelUpResult` defined once and returned by `gainXp`. `MAX_LEVEL`, `EVOLUTION_LEVELS`, `MAX_BOND`, `FAVORITE_SNACK_BOND_MULTIPLIER` each defined once and referenced by name in their tests. `canEvolve`/`evolve` share the `(currentStage, …, totalStages)` parameter convention. No cross-module references (the three modules are independent). ✓
