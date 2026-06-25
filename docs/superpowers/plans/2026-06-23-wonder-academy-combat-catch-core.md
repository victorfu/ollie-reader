# Wonder Academy — Combat & Catch Core Logic Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the pure, fully-tested combat & catch logic for the Wonder Academy creature-collector redesign (type chart, moves, damage/turn resolution, and weaken-then-befriend catch), with no UI and no DOM.

**Architecture:** Small, pure, side-effect-free TypeScript modules under `src/components/LittleGames/wonder-academy/logic/` plus a moves content file under `src/data/`. Every module is deterministic — damage has no RNG (predictable for a 10-year-old), and catch/encounter randomness flows through an injectable seeded RNG so tests are reproducible. These modules are consumed by later UI/canvas plans; this plan ships none of that UI.

**Tech Stack:** TypeScript (strict), Vitest 4.x (`npm test` → `vitest run`). Reuses existing `WonderAcademyElement` and `WonderAcademyRarity` types from `src/types/wonderAcademy.ts`.

## Global Constraints

- **TypeScript strict**, functional style, **2-space indentation**.
- **Test runner:** Vitest. Tests are **co-located** next to the module as `<name>.test.ts`. Import as: `import { describe, expect, it } from "vitest";`.
- **Run a single test file:** `npx vitest run <path>`. **Run the whole suite:** `npm test`.
- **Pure logic only** — no DOM, no React, no Firebase, no audio, no `Math.random()` inside library code. All randomness goes through an injected `Rng` (seeded). Damage is deterministic (no RNG at all).
- **Light strategy (MVP):** no PP, no status effects. Type effectiveness is **2× / 1× / 0.5×** only.
- **Reuse existing types:** `WonderAcademyElement = "spark"|"tide"|"leaf"|"light"|"dream"|"ember"|"crystal"|"star"` and `WonderAcademyRarity = "common"|"uncommon"|"rare"|"warden"|"mythling"` from `src/types/wonderAcademy.ts` — do not redefine them.
- **Display strings are Traditional Chinese.**
- **Conventional Commits**; one focused commit per task.

## File Structure

| File | Responsibility |
|---|---|
| `src/components/LittleGames/wonder-academy/logic/typeChart.ts` | The 8-element relationship + `getEffectiveness` / `getEffectivenessAgainst`. |
| `src/components/LittleGames/wonder-academy/logic/rng.ts` | Injectable seeded RNG (`createRng`). |
| `src/data/wonderAcademyMoves.ts` | `MoveDef` type, the moves record, `getMoveById`. |
| `src/components/LittleGames/wonder-academy/logic/battleLogic.ts` | `BattleCombatant`, damage, `performMove`, faint/sleepy helpers. |
| `src/components/LittleGames/wonder-academy/logic/catchLogic.ts` | Catch chance + seeded `attemptCatch`. |

Each file has a co-located `*.test.ts`. Tasks 1–3 are independent; Task 4 depends on Tasks 1 & 3; Task 5 depends on Task 2.

---

### Task 1: Type chart

**Files:**
- Create: `src/components/LittleGames/wonder-academy/logic/typeChart.ts`
- Test: `src/components/LittleGames/wonder-academy/logic/typeChart.test.ts`

**Interfaces:**
- Consumes: `WonderAcademyElement` from `../../../../types/wonderAcademy`.
- Produces:
  - `getEffectiveness(attacking: WonderAcademyElement, defending: WonderAcademyElement): number` → `2 | 1 | 0.5`
  - `getEffectivenessAgainst(attacking: WonderAcademyElement, defenderElements: WonderAcademyElement[]): number` → most favorable (max) multiplier across the defender's elements; `1` if the array is empty.

- [ ] **Step 1: Write the failing test**

Create `src/components/LittleGames/wonder-academy/logic/typeChart.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { getEffectiveness, getEffectivenessAgainst } from "./typeChart";

describe("Wonder Academy type chart", () => {
  it("makes each element strong against the next two in the cycle", () => {
    expect(getEffectiveness("spark", "tide")).toBe(2);
    expect(getEffectiveness("spark", "ember")).toBe(2);
    expect(getEffectiveness("ember", "leaf")).toBe(2);
    expect(getEffectiveness("tide", "ember")).toBe(2);
  });

  it("makes each element weak against the previous two in the cycle", () => {
    expect(getEffectiveness("spark", "light")).toBe(0.5);
    expect(getEffectiveness("spark", "star")).toBe(0.5);
    expect(getEffectiveness("ember", "tide")).toBe(0.5);
  });

  it("is neutral otherwise", () => {
    expect(getEffectiveness("spark", "leaf")).toBe(1);
    expect(getEffectiveness("spark", "spark")).toBe(1);
    expect(getEffectiveness("light", "crystal")).toBe(1);
  });

  it("takes the most favorable multiplier against a dual-type defender", () => {
    // spark is weak to light (0.5) but strong vs tide (2) -> attacker gets the best
    expect(getEffectivenessAgainst("spark", ["light", "tide"])).toBe(2);
    expect(getEffectivenessAgainst("spark", ["light", "star"])).toBe(0.5);
    expect(getEffectivenessAgainst("spark", ["leaf"])).toBe(1);
    expect(getEffectivenessAgainst("spark", [])).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/LittleGames/wonder-academy/logic/typeChart.test.ts`
Expected: FAIL — `Failed to resolve import "./typeChart"` (module does not exist yet).

- [ ] **Step 3: Write minimal implementation**

Create `src/components/LittleGames/wonder-academy/logic/typeChart.ts`:

```ts
import type { WonderAcademyElement } from "../../../../types/wonderAcademy";

// Cycle: each element is 2x against the next two, 0.5x against the previous two.
// spark -> tide -> ember -> leaf -> crystal -> dream -> star -> light -> (spark)
const STRONG_AGAINST: Record<WonderAcademyElement, WonderAcademyElement[]> = {
  spark: ["tide", "ember"],
  tide: ["ember", "leaf"],
  ember: ["leaf", "crystal"],
  leaf: ["crystal", "dream"],
  crystal: ["dream", "star"],
  dream: ["star", "light"],
  star: ["light", "spark"],
  light: ["spark", "tide"],
};

export function getEffectiveness(
  attacking: WonderAcademyElement,
  defending: WonderAcademyElement,
): number {
  if (STRONG_AGAINST[attacking].includes(defending)) return 2;
  if (STRONG_AGAINST[defending].includes(attacking)) return 0.5;
  return 1;
}

export function getEffectivenessAgainst(
  attacking: WonderAcademyElement,
  defenderElements: WonderAcademyElement[],
): number {
  if (defenderElements.length === 0) return 1;
  return Math.max(
    ...defenderElements.map((element) => getEffectiveness(attacking, element)),
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/LittleGames/wonder-academy/logic/typeChart.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/LittleGames/wonder-academy/logic/typeChart.ts \
        src/components/LittleGames/wonder-academy/logic/typeChart.test.ts
git commit -m "feat(wonder-academy): add element type chart"
```

---

### Task 2: Seeded RNG

**Files:**
- Create: `src/components/LittleGames/wonder-academy/logic/rng.ts`
- Test: `src/components/LittleGames/wonder-academy/logic/rng.test.ts`

**Interfaces:**
- Produces:
  - `type Rng = () => number` — each call returns a float in `[0, 1)`.
  - `createRng(seed: number): Rng` — deterministic; same seed yields the same sequence.

- [ ] **Step 1: Write the failing test**

Create `src/components/LittleGames/wonder-academy/logic/rng.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createRng } from "./rng";

describe("seeded rng", () => {
  it("returns floats in [0, 1)", () => {
    const rng = createRng(123);
    for (let i = 0; i < 50; i += 1) {
      const value = rng();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it("is deterministic for the same seed", () => {
    const a = createRng(42);
    const b = createRng(42);
    const seqA = [a(), a(), a(), a()];
    const seqB = [b(), b(), b(), b()];
    expect(seqA).toEqual(seqB);
  });

  it("produces different sequences for different seeds", () => {
    const a = createRng(1);
    const b = createRng(2);
    expect(a()).not.toBe(b());
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/LittleGames/wonder-academy/logic/rng.test.ts`
Expected: FAIL — `Failed to resolve import "./rng"`.

- [ ] **Step 3: Write minimal implementation**

Create `src/components/LittleGames/wonder-academy/logic/rng.ts`:

```ts
export type Rng = () => number;

// mulberry32 — small, fast, deterministic PRNG. Returns a float in [0, 1).
export function createRng(seed: number): Rng {
  let a = seed >>> 0;
  return function next(): number {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/LittleGames/wonder-academy/logic/rng.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/LittleGames/wonder-academy/logic/rng.ts \
        src/components/LittleGames/wonder-academy/logic/rng.test.ts
git commit -m "feat(wonder-academy): add seeded rng helper"
```

---

### Task 3: Moves data

**Files:**
- Create: `src/data/wonderAcademyMoves.ts`
- Test: `src/data/wonderAcademyMoves.test.ts`

**Interfaces:**
- Consumes: `WonderAcademyElement` from `../types/wonderAcademy`.
- Produces:
  - `type MoveDef = { id: string; name: string; element: WonderAcademyElement; power: number }`
  - `WONDER_ACADEMY_MOVES: Record<string, MoveDef>` — keyed by move id; covers the 4 starters' `learnableSkillIds` plus wild moves.
  - `getMoveById(id: string): MoveDef | null`

- [ ] **Step 1: Write the failing test**

Create `src/data/wonderAcademyMoves.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  WONDER_ACADEMY_MOVES,
  getMoveById,
} from "./wonderAcademyMoves";

describe("Wonder Academy moves data", () => {
  it("defines every starter learnable skill", () => {
    const required = [
      // Lumi
      "tiny-flash", "zip-spark", "wink-feint", "starstep-dash", "aurora-parade",
      // Momo
      "bubble-pat", "cozy-shield", "nap-song", "moon-drizzle", "dreamcloud-haven",
      // Pico
      "leaf-wink", "stardust-peek", "clover-patch", "secret-signal", "wishbloom-spiral",
      // Nibi
      "warm-puff", "crystal-brace", "brave-bump", "hearth-guard", "hearth-crystal-roar",
    ];
    for (const id of required) {
      expect(WONDER_ACADEMY_MOVES[id], `missing move ${id}`).toBeDefined();
    }
  });

  it("gives every move a positive power and a display name", () => {
    for (const move of Object.values(WONDER_ACADEMY_MOVES)) {
      expect(move.power).toBeGreaterThan(0);
      expect(move.name.length).toBeGreaterThan(0);
      expect(move.id.length).toBeGreaterThan(0);
    }
  });

  it("looks up a move by id and returns null for unknown ids", () => {
    expect(getMoveById("zip-spark")?.element).toBe("spark");
    expect(getMoveById("zip-spark")?.name).toBe("電光衝");
    expect(getMoveById("does-not-exist")).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/data/wonderAcademyMoves.test.ts`
Expected: FAIL — `Failed to resolve import "./wonderAcademyMoves"`.

- [ ] **Step 3: Write minimal implementation**

Create `src/data/wonderAcademyMoves.ts`:

```ts
import type { WonderAcademyElement } from "../types/wonderAcademy";

export type MoveDef = {
  id: string;
  name: string;
  element: WonderAcademyElement;
  power: number;
};

const move = (
  id: string,
  name: string,
  element: WonderAcademyElement,
  power: number,
): MoveDef => ({ id, name, element, power });

export const WONDER_ACADEMY_MOVES: Record<string, MoveDef> = {
  // Lumi — light / spark
  "tiny-flash": move("tiny-flash", "微光閃", "light", 6),
  "zip-spark": move("zip-spark", "電光衝", "spark", 9),
  "wink-feint": move("wink-feint", "眨眼佯攻", "spark", 5),
  "starstep-dash": move("starstep-dash", "星步衝刺", "light", 9),
  "aurora-parade": move("aurora-parade", "極光遊行", "light", 14),

  // Momo — dream / tide
  "bubble-pat": move("bubble-pat", "泡泡輕拍", "tide", 6),
  "cozy-shield": move("cozy-shield", "暖暖護盾", "tide", 4),
  "nap-song": move("nap-song", "搖籃小曲", "dream", 5),
  "moon-drizzle": move("moon-drizzle", "月光細雨", "tide", 9),
  "dreamcloud-haven": move("dreamcloud-haven", "夢雲庇護", "dream", 14),

  // Pico — star / leaf
  "leaf-wink": move("leaf-wink", "葉影眨眼", "leaf", 6),
  "stardust-peek": move("stardust-peek", "星塵窺探", "star", 6),
  "clover-patch": move("clover-patch", "幸運草叢", "leaf", 5),
  "secret-signal": move("secret-signal", "祕密信號", "star", 9),
  "wishbloom-spiral": move("wishbloom-spiral", "願花螺旋", "star", 14),

  // Nibi — ember / crystal
  "warm-puff": move("warm-puff", "暖暖噴氣", "ember", 6),
  "crystal-brace": move("crystal-brace", "晶石護身", "crystal", 4),
  "brave-bump": move("brave-bump", "勇氣撞擊", "ember", 7),
  "hearth-guard": move("hearth-guard", "爐心守衛", "crystal", 6),
  "hearth-crystal-roar": move("hearth-crystal-roar", "爐心晶吼", "ember", 14),

  // Wild creature moves
  "mossy-tackle": move("mossy-tackle", "苔蘚衝撞", "leaf", 6),
  "spore-puff": move("spore-puff", "孢子噴霧", "leaf", 5),
};

export function getMoveById(id: string): MoveDef | null {
  return WONDER_ACADEMY_MOVES[id] ?? null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/data/wonderAcademyMoves.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/data/wonderAcademyMoves.ts src/data/wonderAcademyMoves.test.ts
git commit -m "feat(wonder-academy): add move definitions"
```

---

### Task 4: Battle logic

**Files:**
- Create: `src/components/LittleGames/wonder-academy/logic/battleLogic.ts`
- Test: `src/components/LittleGames/wonder-academy/logic/battleLogic.test.ts`

**Interfaces:**
- Consumes: `getEffectivenessAgainst` from `./typeChart` (Task 1); `MoveDef`, `getMoveById` from `../../../../data/wonderAcademyMoves` (Task 3); `WonderAcademyElement` from `../../../../types/wonderAcademy`.
- Produces:
  - `type BattleCombatant = { ownedId: string; speciesId: string; name: string; elements: WonderAcademyElement[]; level: number; maxHp: number; hp: number; attack: number; moveIds: string[] }`
  - `SLEEPY_HP_RATIO: number` (= 0.25)
  - `computeDamage(attacker: BattleCombatant, defender: BattleCombatant, move: MoveDef): { damage: number; effectiveness: number }`
  - `applyDamage(combatant: BattleCombatant, amount: number): BattleCombatant` (returns a new object; hp floored at 0)
  - `performMove(attacker: BattleCombatant, defender: BattleCombatant, moveId: string): { defender: BattleCombatant; damage: number; effectiveness: number }` (throws on unknown move id)
  - `isFainted(combatant: BattleCombatant): boolean`
  - `isSleepy(combatant: BattleCombatant): boolean` (catch-eligible: alive and at/below `SLEEPY_HP_RATIO` of maxHp)

- [ ] **Step 1: Write the failing test**

Create `src/components/LittleGames/wonder-academy/logic/battleLogic.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { BattleCombatant } from "./battleLogic";
import {
  applyDamage,
  computeDamage,
  isFainted,
  isSleepy,
  performMove,
} from "./battleLogic";
import type { MoveDef } from "../../../../data/wonderAcademyMoves";

const combatant = (
  overrides: Partial<BattleCombatant> = {},
): BattleCombatant => ({
  ownedId: "owned-1",
  speciesId: "lumi",
  name: "Lumi",
  elements: ["light", "spark"],
  level: 5,
  maxHp: 40,
  hp: 40,
  attack: 8,
  moveIds: ["zip-spark"],
  ...overrides,
});

const sparkMove: MoveDef = { id: "x", name: "測試", element: "spark", power: 10 };

describe("battle damage", () => {
  it("doubles damage when super effective and halves when resisted", () => {
    const attacker = combatant({ attack: 8 }); // base = 10 + floor(8/2) = 14
    const superHit = computeDamage(attacker, combatant({ elements: ["tide"] }), sparkMove);
    const neutralHit = computeDamage(attacker, combatant({ elements: ["leaf"] }), sparkMove);
    const resistedHit = computeDamage(attacker, combatant({ elements: ["light"] }), sparkMove);

    expect(neutralHit.effectiveness).toBe(1);
    expect(neutralHit.damage).toBe(14);
    expect(superHit.effectiveness).toBe(2);
    expect(superHit.damage).toBe(28);
    expect(resistedHit.effectiveness).toBe(0.5);
    expect(resistedHit.damage).toBe(7);
  });

  it("never deals less than 1 damage", () => {
    const weak = { id: "w", name: "弱", element: "spark", power: 1 } as MoveDef;
    const hit = computeDamage(
      combatant({ attack: 0 }),
      combatant({ elements: ["light"] }), // resisted
      weak,
    );
    expect(hit.damage).toBeGreaterThanOrEqual(1);
  });
});

describe("hp transitions", () => {
  it("floors hp at zero and reports fainted", () => {
    const hurt = applyDamage(combatant({ hp: 5 }), 9999);
    expect(hurt.hp).toBe(0);
    expect(isFainted(hurt)).toBe(true);
  });

  it("flags sleepy (catch-eligible) at or below 25% hp while still alive", () => {
    expect(isSleepy(combatant({ hp: 10, maxHp: 40 }))).toBe(true); // 25%
    expect(isSleepy(combatant({ hp: 11, maxHp: 40 }))).toBe(false); // 27.5%
    expect(isSleepy(combatant({ hp: 0, maxHp: 40 }))).toBe(false); // fainted, not sleepy
  });
});

describe("performMove", () => {
  it("applies a real move to the defender and reports effectiveness", () => {
    // zip-spark is spark; defender tide -> super effective
    const defender = combatant({ elements: ["tide"], hp: 40, maxHp: 40 });
    const result = performMove(combatant({ attack: 8 }), defender, "zip-spark");
    expect(result.effectiveness).toBe(2);
    expect(result.defender.hp).toBeLessThan(40);
    expect(result.damage).toBeGreaterThan(0);
  });

  it("throws on an unknown move id", () => {
    expect(() => performMove(combatant(), combatant(), "nope")).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/LittleGames/wonder-academy/logic/battleLogic.test.ts`
Expected: FAIL — `Failed to resolve import "./battleLogic"`.

- [ ] **Step 3: Write minimal implementation**

Create `src/components/LittleGames/wonder-academy/logic/battleLogic.ts`:

```ts
import type { WonderAcademyElement } from "../../../../types/wonderAcademy";
import {
  getMoveById,
  type MoveDef,
} from "../../../../data/wonderAcademyMoves";
import { getEffectivenessAgainst } from "./typeChart";

export type BattleCombatant = {
  ownedId: string;
  speciesId: string;
  name: string;
  elements: WonderAcademyElement[];
  level: number;
  maxHp: number;
  hp: number;
  attack: number;
  moveIds: string[];
};

export const SLEEPY_HP_RATIO = 0.25;

export function computeDamage(
  attacker: BattleCombatant,
  defender: BattleCombatant,
  move: MoveDef,
): { damage: number; effectiveness: number } {
  const effectiveness = getEffectivenessAgainst(move.element, defender.elements);
  const base = move.power + Math.floor(attacker.attack / 2);
  const damage = Math.max(1, Math.round(base * effectiveness));
  return { damage, effectiveness };
}

export function applyDamage(
  combatant: BattleCombatant,
  amount: number,
): BattleCombatant {
  return { ...combatant, hp: Math.max(0, combatant.hp - amount) };
}

export function performMove(
  attacker: BattleCombatant,
  defender: BattleCombatant,
  moveId: string,
): { defender: BattleCombatant; damage: number; effectiveness: number } {
  const move = getMoveById(moveId);
  if (!move) throw new Error(`Unknown move: ${moveId}`);
  const { damage, effectiveness } = computeDamage(attacker, defender, move);
  return { defender: applyDamage(defender, damage), damage, effectiveness };
}

export function isFainted(combatant: BattleCombatant): boolean {
  return combatant.hp <= 0;
}

export function isSleepy(combatant: BattleCombatant): boolean {
  return combatant.hp > 0 && combatant.hp <= combatant.maxHp * SLEEPY_HP_RATIO;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/LittleGames/wonder-academy/logic/battleLogic.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/LittleGames/wonder-academy/logic/battleLogic.ts \
        src/components/LittleGames/wonder-academy/logic/battleLogic.test.ts
git commit -m "feat(wonder-academy): add battle damage and turn helpers"
```

---

### Task 5: Catch logic

**Files:**
- Create: `src/components/LittleGames/wonder-academy/logic/catchLogic.ts`
- Test: `src/components/LittleGames/wonder-academy/logic/catchLogic.test.ts`

**Interfaces:**
- Consumes: `Rng` from `./rng` (Task 2); `WonderAcademyRarity` from `../../../../types/wonderAcademy`.
- Produces:
  - `type CatchContext = { hpRatio: number; rarity: WonderAcademyRarity; treatTier: number; isFavoriteSnack: boolean }` — `hpRatio` is defender hp / maxHp in `[0, 1]`; `treatTier` is the snack strength (1–3).
  - `computeCatchChance(ctx: CatchContext): number` — clamped to `[0.05, 0.95]`.
  - `attemptCatch(ctx: CatchContext, rng: Rng): { caught: boolean; chance: number }`

- [ ] **Step 1: Write the failing test**

Create `src/components/LittleGames/wonder-academy/logic/catchLogic.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { CatchContext } from "./catchLogic";
import { attemptCatch, computeCatchChance } from "./catchLogic";
import { createRng } from "./rng";

const ctx = (overrides: Partial<CatchContext> = {}): CatchContext => ({
  hpRatio: 0.15,
  rarity: "common",
  treatTier: 1,
  isFavoriteSnack: false,
  ...overrides,
});

describe("computeCatchChance", () => {
  it("rises as the target's hp drops", () => {
    const low = computeCatchChance(ctx({ hpRatio: 0.1 }));
    const high = computeCatchChance(ctx({ hpRatio: 0.8 }));
    expect(low).toBeGreaterThan(high);
  });

  it("rewards bringing the favorite snack", () => {
    expect(
      computeCatchChance(ctx({ isFavoriteSnack: true })),
    ).toBeGreaterThan(computeCatchChance(ctx({ isFavoriteSnack: false })));
  });

  it("makes rarer creatures harder to catch", () => {
    expect(computeCatchChance(ctx({ rarity: "mythling" }))).toBeLessThan(
      computeCatchChance(ctx({ rarity: "common" })),
    );
  });

  it("stays within [0.05, 0.95]", () => {
    const guaranteedish = computeCatchChance(
      ctx({ hpRatio: 0, rarity: "common", treatTier: 3, isFavoriteSnack: true }),
    );
    const nearImpossible = computeCatchChance(
      ctx({ hpRatio: 1, rarity: "mythling", treatTier: 1, isFavoriteSnack: false }),
    );
    expect(guaranteedish).toBeLessThanOrEqual(0.95);
    expect(nearImpossible).toBeGreaterThanOrEqual(0.05);
  });
});

describe("attemptCatch", () => {
  it("is deterministic for a given seed and reports the chance used", () => {
    const a = attemptCatch(ctx(), createRng(7));
    const b = attemptCatch(ctx(), createRng(7));
    expect(a).toEqual(b);
    expect(a.chance).toBe(computeCatchChance(ctx()));
    expect(typeof a.caught).toBe("boolean");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/LittleGames/wonder-academy/logic/catchLogic.test.ts`
Expected: FAIL — `Failed to resolve import "./catchLogic"`.

- [ ] **Step 3: Write minimal implementation**

Create `src/components/LittleGames/wonder-academy/logic/catchLogic.ts`:

```ts
import type { WonderAcademyRarity } from "../../../../types/wonderAcademy";
import type { Rng } from "./rng";

export type CatchContext = {
  hpRatio: number;
  rarity: WonderAcademyRarity;
  treatTier: number;
  isFavoriteSnack: boolean;
};

const RARITY_FACTOR: Record<WonderAcademyRarity, number> = {
  common: 1,
  uncommon: 0.85,
  rare: 0.65,
  warden: 0.4,
  mythling: 0.3,
};

const MIN_CHANCE = 0.05;
const MAX_CHANCE = 0.95;
const FAVORITE_SNACK_BONUS = 0.25;
const TREAT_BONUS_PER_TIER = 0.08;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function computeCatchChance(ctx: CatchContext): number {
  const hpFactor = 1 - clamp(ctx.hpRatio, 0, 1);
  let chance = hpFactor * RARITY_FACTOR[ctx.rarity];
  chance += ctx.treatTier * TREAT_BONUS_PER_TIER;
  if (ctx.isFavoriteSnack) chance += FAVORITE_SNACK_BONUS;
  return clamp(chance, MIN_CHANCE, MAX_CHANCE);
}

export function attemptCatch(
  ctx: CatchContext,
  rng: Rng,
): { caught: boolean; chance: number } {
  const chance = computeCatchChance(ctx);
  return { caught: rng() < chance, chance };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/LittleGames/wonder-academy/logic/catchLogic.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Run the full suite and commit**

Run: `npm test`
Expected: PASS — all Wonder Academy logic specs plus the pre-existing suite.

```bash
git add src/components/LittleGames/wonder-academy/logic/catchLogic.ts \
        src/components/LittleGames/wonder-academy/logic/catchLogic.test.ts
git commit -m "feat(wonder-academy): add catch chance logic"
```

---

## Self-Review

**1. Spec coverage (this plan's slice):**
- §5 屬性相剋(2×/1×/0.5×)→ Task 1. ✓
- §5 戰鬥:傷害、faint、想睡(catch-eligible)→ Task 4. ✓
- §5 招式(每隻 4 招、無 PP)→ Task 3 (MoveDef has no `pp`). ✓
- §5 捕捉:HP 越低 + 稀有度 + 點心 + 最愛零食加成、seeded → Task 5. ✓
- §6 8 屬性循環(beats next 2 / weak to prev 2)→ Task 1, matches the spec's table. ✓
- Deterministic randomness via injected seeded RNG → Task 2, used by Task 5. ✓
- **Out of scope for this plan (later plans):** schema v2 + reset, progression/evolution, exploration/encounter rolls, dex, the reducer/action set, and all UI/canvas. These are intentionally not here.

**2. Placeholder scan:** No TBD/TODO; every code step shows complete code; every run step gives an exact command and expected result. ✓

**3. Type consistency:** `BattleCombatant`, `MoveDef`, `CatchContext`, `Rng` are each defined once and imported by name where reused. `computeDamage`/`performMove`/`applyDamage`/`isFainted`/`isSleepy`/`getEffectiveness`/`getEffectivenessAgainst`/`getMoveById`/`createRng`/`computeCatchChance`/`attemptCatch` are referenced with the same signatures in tests and implementations. The damage formula in the Task 4 test (`base = power + floor(attack/2)`, `damage = round(base * eff)`) matches the implementation. ✓
