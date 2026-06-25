# Wonder Academy — Battle Session Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the pure, fully-tested battle-session engine — the stateful-but-pure orchestrator that runs one wild encounter to completion (attack → enemy turn → catch → switch → flee, with win/lose/caught/fled outcomes) by composing the already-built combat & catch primitives. No UI, no persistence.

**Architecture:** One pure module `battleSession.ts` under `src/components/LittleGames/wonder-academy/logic/`. A `BattleSession` is an immutable snapshot; each player action returns a NEW session. Damage is deterministic (the wild AI always uses its first move, and `battleLogic` damage has no RNG), so the ONLY RNG consumer is the catch attempt — making the whole engine deterministic and trivially testable. The UI layer (a later plan) drives this engine and renders its event log.

**Tech Stack:** TypeScript (strict), Vitest 4.x (`npm test` → `vitest run`).

## Global Constraints

- **TypeScript strict**, functional style, **2-space indentation**.
- **Test runner:** Vitest. Tests **co-located** as `<name>.test.ts`. Import as: `import { describe, expect, it } from "vitest";`.
- **Run a single test file:** `npx vitest run <path>`. **Whole suite:** `npm test`.
- **Pure logic only** — no DOM, React, Firebase, audio, `Math.random()`. Every action returns a NEW `BattleSession`; never mutate inputs. The injected `Rng` is consumed ONLY by `playerCatch`.
- **Wild AI rule (MVP):** the wild creature always uses `moveIds[0]` on its turn — deterministic, no RNG.
- **Outcome rule:** if the wild faints from a player attack the battle ends as `"won"` (too tired to befriend — no catch). The catch window is the `"sleepy"` state (hp ≤ 25%), per the combat spec.
- **Conventional Commits**; one focused commit per task.

## File Structure

| File | Responsibility |
|---|---|
| `src/components/LittleGames/wonder-academy/logic/battleSession.ts` | `BattleSession`/`BattleEvent`/`WildInfo` types, `startBattle`, `playerAttack`, `playerCatch`, `playerSwitch`, `playerFlee`, and the internal `enemyRetaliate` helper. |

A co-located `battleSession.test.ts` covers it. Depends on the already-committed `./battleLogic`, `./catchLogic`, `./rng`, and `WonderAcademyRarity` from types.

Tasks build the one module incrementally: Task 1 lays down types + `startBattle` + `enemyRetaliate`; Task 2 adds `playerAttack`; Task 3 adds `playerCatch`/`playerSwitch`/`playerFlee`.

---

### Task 1: Session types, startBattle, enemyRetaliate

**Files:**
- Create: `src/components/LittleGames/wonder-academy/logic/battleSession.ts`
- Test: `src/components/LittleGames/wonder-academy/logic/battleSession.test.ts`

**Interfaces:**
- Consumes: `BattleCombatant`, `performMove`, `isFainted`, `isSleepy` from `./battleLogic`; `WonderAcademyRarity` from `../../../../types/wonderAcademy`.
- Produces:
  - `type BattleOutcome = "ongoing" | "won" | "caught" | "fled" | "lost"`
  - `type BattleEvent =`
    - `| { kind: "playerMove"; moveId: string; damage: number; effectiveness: number }`
    - `| { kind: "wildMove"; moveId: string; damage: number; effectiveness: number }`
    - `| { kind: "wildSleepy" }`
    - `| { kind: "playerFainted"; ownedId: string }`
    - `| { kind: "switch"; toOwnedId: string }`
    - `| { kind: "catchAttempt"; chance: number; caught: boolean }`
    - `| { kind: "outcome"; outcome: BattleOutcome }`
  - `type WildInfo = { combatant: BattleCombatant; rarity: WonderAcademyRarity; favoriteSnack: string }`
  - `type BattleSession = { active: BattleCombatant; bench: BattleCombatant[]; wild: BattleCombatant; wildRarity: WonderAcademyRarity; wildFavoriteSnack: string; turn: number; outcome: BattleOutcome; log: BattleEvent[] }`
  - `startBattle(team: BattleCombatant[], wild: WildInfo): BattleSession` — `active = team[0]`, `bench = team.slice(1)`, `turn = 1`, `outcome = "ongoing"`, empty log. Throws if `team` is empty.
  - `enemyRetaliate(session: BattleSession): BattleSession` — the wild attacks the active creature with `wild.moveIds[0]`; logs a `wildMove`; if the active faints, logs `playerFainted` and auto-switches to `bench[0]` (logging `switch`) or sets `outcome: "lost"` (logging `outcome`) when the bench is empty. Returns the same session unchanged if `outcome !== "ongoing"`.

- [ ] **Step 1: Write the failing test**

Create `src/components/LittleGames/wonder-academy/logic/battleSession.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { BattleCombatant } from "./battleLogic";
import type { WildInfo } from "./battleSession";
import { enemyRetaliate, startBattle } from "./battleSession";

const mon = (overrides: Partial<BattleCombatant> = {}): BattleCombatant => ({
  ownedId: "p1",
  speciesId: "lumi",
  name: "Lumi",
  elements: ["light"],
  level: 5,
  maxHp: 40,
  hp: 40,
  attack: 8,
  moveIds: ["zip-spark"],
  ...overrides,
});

const wildInfo = (overrides: Partial<BattleCombatant> = {}): WildInfo => ({
  combatant: mon({ ownedId: "w1", speciesId: "mossmew", name: "Mossmew", elements: ["leaf"], moveIds: ["mossy-tackle"], ...overrides }),
  rarity: "common",
  favoriteSnack: "clover-macaron",
});

describe("startBattle", () => {
  it("seats the first team member as active and benches the rest", () => {
    const s = startBattle([mon({ ownedId: "a" }), mon({ ownedId: "b" })], wildInfo());
    expect(s.active.ownedId).toBe("a");
    expect(s.bench.map((m) => m.ownedId)).toEqual(["b"]);
    expect(s.outcome).toBe("ongoing");
    expect(s.turn).toBe(1);
    expect(s.log).toEqual([]);
  });

  it("throws on an empty team", () => {
    expect(() => startBattle([], wildInfo())).toThrow();
  });
});

describe("enemyRetaliate", () => {
  it("damages the active creature and logs a wildMove", () => {
    const s = startBattle([mon()], wildInfo());
    const next = enemyRetaliate(s);
    expect(next.active.hp).toBeLessThan(40);
    expect(next.log.at(-1)?.kind).toBe("wildMove");
    expect(next.outcome).toBe("ongoing");
  });

  it("auto-switches to the bench when the active faints", () => {
    const s = startBattle([mon({ ownedId: "a", hp: 1 }), mon({ ownedId: "b" })], wildInfo());
    const next = enemyRetaliate(s);
    expect(next.active.ownedId).toBe("b");
    expect(next.bench).toEqual([]);
    expect(next.log.map((e) => e.kind)).toEqual(["wildMove", "playerFainted", "switch"]);
    expect(next.outcome).toBe("ongoing");
  });

  it("loses when the active faints and the bench is empty", () => {
    const s = startBattle([mon({ ownedId: "a", hp: 1 })], wildInfo());
    const next = enemyRetaliate(s);
    expect(next.outcome).toBe("lost");
    expect(next.log.map((e) => e.kind)).toEqual(["wildMove", "playerFainted", "outcome"]);
  });

  it("is a no-op once the battle is over", () => {
    const s = { ...startBattle([mon()], wildInfo()), outcome: "won" as const };
    expect(enemyRetaliate(s)).toBe(s);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/LittleGames/wonder-academy/logic/battleSession.test.ts`
Expected: FAIL — `Failed to resolve import "./battleSession"`.

- [ ] **Step 3: Write minimal implementation**

Create `src/components/LittleGames/wonder-academy/logic/battleSession.ts`:

```ts
import type { WonderAcademyRarity } from "../../../../types/wonderAcademy";
import type { BattleCombatant } from "./battleLogic";
import { isFainted, performMove } from "./battleLogic";

export type BattleOutcome = "ongoing" | "won" | "caught" | "fled" | "lost";

export type BattleEvent =
  | { kind: "playerMove"; moveId: string; damage: number; effectiveness: number }
  | { kind: "wildMove"; moveId: string; damage: number; effectiveness: number }
  | { kind: "wildSleepy" }
  | { kind: "playerFainted"; ownedId: string }
  | { kind: "switch"; toOwnedId: string }
  | { kind: "catchAttempt"; chance: number; caught: boolean }
  | { kind: "outcome"; outcome: BattleOutcome };

export type WildInfo = {
  combatant: BattleCombatant;
  rarity: WonderAcademyRarity;
  favoriteSnack: string;
};

export type BattleSession = {
  active: BattleCombatant;
  bench: BattleCombatant[];
  wild: BattleCombatant;
  wildRarity: WonderAcademyRarity;
  wildFavoriteSnack: string;
  turn: number;
  outcome: BattleOutcome;
  log: BattleEvent[];
};

export function startBattle(
  team: BattleCombatant[],
  wild: WildInfo,
): BattleSession {
  if (team.length === 0) {
    throw new Error("startBattle: team must not be empty");
  }
  return {
    active: team[0],
    bench: team.slice(1),
    wild: wild.combatant,
    wildRarity: wild.rarity,
    wildFavoriteSnack: wild.favoriteSnack,
    turn: 1,
    outcome: "ongoing",
    log: [],
  };
}

export function enemyRetaliate(session: BattleSession): BattleSession {
  if (session.outcome !== "ongoing") return session;

  const moveId = session.wild.moveIds[0];
  const { defender, damage, effectiveness } = performMove(
    session.wild,
    session.active,
    moveId,
  );
  const log: BattleEvent[] = [
    ...session.log,
    { kind: "wildMove", moveId, damage, effectiveness },
  ];

  if (!isFainted(defender)) {
    return { ...session, active: defender, log };
  }

  log.push({ kind: "playerFainted", ownedId: defender.ownedId });

  if (session.bench.length > 0) {
    const [next, ...rest] = session.bench;
    log.push({ kind: "switch", toOwnedId: next.ownedId });
    return { ...session, active: next, bench: rest, log };
  }

  log.push({ kind: "outcome", outcome: "lost" });
  return { ...session, active: defender, outcome: "lost", log };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/LittleGames/wonder-academy/logic/battleSession.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/LittleGames/wonder-academy/logic/battleSession.ts \
        src/components/LittleGames/wonder-academy/logic/battleSession.test.ts
git commit -m "feat(wonder-academy): add battle session start and enemy turn"
```

---

### Task 2: playerAttack

**Files:**
- Modify: `src/components/LittleGames/wonder-academy/logic/battleSession.ts`
- Modify (add tests): `src/components/LittleGames/wonder-academy/logic/battleSession.test.ts`

**Interfaces:**
- Consumes: `isSleepy` from `./battleLogic` (add to the existing import) plus everything from Task 1.
- Produces:
  - `playerAttack(session: BattleSession, moveId: string): BattleSession` — the active creature uses `moveId` on the wild; logs a `playerMove`. If the wild faints, sets `outcome: "won"` (logs `outcome`) and the wild does NOT retaliate. Otherwise, logs `wildSleepy` when the wild is now sleepy, then runs `enemyRetaliate`, then increments `turn`. No-op (returns the same session) when `outcome !== "ongoing"`.

- [ ] **Step 1: Write the failing test**

Append to `src/components/LittleGames/wonder-academy/logic/battleSession.test.ts`:

```ts
import { playerAttack } from "./battleSession";

describe("playerAttack", () => {
  it("damages the wild, flags sleepy, and lets the wild retaliate", () => {
    // wild at low-ish hp so the hit leaves it alive but sleepy (<=25% of 40 = 10)
    const s = startBattle([mon()], wildInfo({ hp: 12, maxHp: 40 }));
    const next = playerAttack(s, "zip-spark");
    expect(next.wild.hp).toBeLessThan(12);
    const kinds = next.log.map((e) => e.kind);
    expect(kinds).toContain("playerMove");
    expect(kinds).toContain("wildSleepy");
    expect(kinds).toContain("wildMove"); // retaliation happened
    expect(next.turn).toBe(2);
    expect(next.outcome).toBe("ongoing");
  });

  it("wins without retaliation when the wild faints", () => {
    const s = startBattle([mon()], wildInfo({ hp: 1, maxHp: 40 }));
    const next = playerAttack(s, "zip-spark");
    expect(next.outcome).toBe("won");
    expect(next.wild.hp).toBe(0);
    const kinds = next.log.map((e) => e.kind);
    expect(kinds).toEqual(["playerMove", "outcome"]); // no wildMove
    expect(next.turn).toBe(1); // turn not advanced on a finishing blow
  });

  it("is a no-op once the battle is over", () => {
    const s = { ...startBattle([mon()], wildInfo()), outcome: "caught" as const };
    expect(playerAttack(s, "zip-spark")).toBe(s);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/LittleGames/wonder-academy/logic/battleSession.test.ts`
Expected: FAIL — `playerAttack` is not exported / not a function.

- [ ] **Step 3: Write minimal implementation**

In `battleSession.ts`, update the `battleLogic` import to include `isSleepy`:

```ts
import { isFainted, isSleepy, performMove } from "./battleLogic";
```

Then add this function (below `enemyRetaliate`):

```ts
export function playerAttack(
  session: BattleSession,
  moveId: string,
): BattleSession {
  if (session.outcome !== "ongoing") return session;

  const { defender, damage, effectiveness } = performMove(
    session.active,
    session.wild,
    moveId,
  );
  const log: BattleEvent[] = [
    ...session.log,
    { kind: "playerMove", moveId, damage, effectiveness },
  ];

  if (isFainted(defender)) {
    log.push({ kind: "outcome", outcome: "won" });
    return { ...session, wild: defender, outcome: "won", log };
  }

  if (isSleepy(defender)) {
    log.push({ kind: "wildSleepy" });
  }

  const afterPlayer: BattleSession = { ...session, wild: defender, log };
  const afterEnemy = enemyRetaliate(afterPlayer);
  return { ...afterEnemy, turn: afterEnemy.turn + 1 };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/LittleGames/wonder-academy/logic/battleSession.test.ts`
Expected: PASS (9 tests total).

- [ ] **Step 5: Commit**

```bash
git add src/components/LittleGames/wonder-academy/logic/battleSession.ts \
        src/components/LittleGames/wonder-academy/logic/battleSession.test.ts
git commit -m "feat(wonder-academy): add player attack to battle session"
```

---

### Task 3: playerCatch, playerSwitch, playerFlee

**Files:**
- Modify: `src/components/LittleGames/wonder-academy/logic/battleSession.ts`
- Modify (add tests): `src/components/LittleGames/wonder-academy/logic/battleSession.test.ts`

**Interfaces:**
- Consumes: `attemptCatch` from `./catchLogic`; `Rng` from `./rng`; plus everything prior.
- Produces:
  - `playerCatch(session: BattleSession, treatTier: number, isFavorite: boolean, rng: Rng): BattleSession` — attempts to befriend the wild using its current hp ratio, `wildRarity`, `treatTier`, and `isFavorite`; logs a `catchAttempt`. On success sets `outcome: "caught"` (logs `outcome`). On failure the wild retaliates and `turn` increments. No-op when not `ongoing`.
  - `playerSwitch(session: BattleSession, ownedId: string): BattleSession` — swaps the active creature with the benched `ownedId` (active goes to the back of the bench); logs a `switch`; the wild then retaliates and `turn` increments. Returns the session unchanged if not `ongoing` or the id is not on the bench.
  - `playerFlee(session: BattleSession): BattleSession` — sets `outcome: "fled"` (logs `outcome`). No-op when not `ongoing`.

- [ ] **Step 1: Write the failing test**

Append to `src/components/LittleGames/wonder-academy/logic/battleSession.test.ts`:

```ts
import type { Rng } from "./rng";
import { playerCatch, playerFlee, playerSwitch } from "./battleSession";

const seq = (values: number[]): Rng => {
  let i = 0;
  return () => values[i++];
};

describe("playerCatch", () => {
  it("catches when the roll succeeds", () => {
    // wild at 10% hp, favorite snack -> high chance; rng 0.01 succeeds
    const s = startBattle([mon()], wildInfo({ hp: 4, maxHp: 40 }));
    const next = playerCatch(s, 2, true, seq([0.01]));
    expect(next.outcome).toBe("caught");
    expect(next.log.map((e) => e.kind)).toEqual(["catchAttempt", "outcome"]);
  });

  it("lets the wild retaliate when the catch fails", () => {
    const s = startBattle([mon()], wildInfo({ hp: 30, maxHp: 40 }));
    const next = playerCatch(s, 1, false, seq([0.99]));
    expect(next.outcome).toBe("ongoing");
    const kinds = next.log.map((e) => e.kind);
    expect(kinds[0]).toBe("catchAttempt");
    expect(kinds).toContain("wildMove");
    expect(next.turn).toBe(2);
  });
});

describe("playerSwitch", () => {
  it("swaps active with a benched creature and lets the wild retaliate", () => {
    const s = startBattle([mon({ ownedId: "a" }), mon({ ownedId: "b" })], wildInfo());
    const next = playerSwitch(s, "b");
    expect(next.active.ownedId).toBe("b");
    expect(next.bench.map((m) => m.ownedId)).toEqual(["a"]);
    expect(next.log.some((e) => e.kind === "switch")).toBe(true);
    expect(next.log.some((e) => e.kind === "wildMove")).toBe(true);
    expect(next.turn).toBe(2);
  });

  it("is a no-op when the id is not on the bench", () => {
    const s = startBattle([mon({ ownedId: "a" })], wildInfo());
    expect(playerSwitch(s, "nope")).toBe(s);
  });
});

describe("playerFlee", () => {
  it("ends the battle as fled", () => {
    const s = startBattle([mon()], wildInfo());
    const next = playerFlee(s);
    expect(next.outcome).toBe("fled");
    expect(next.log.at(-1)).toEqual({ kind: "outcome", outcome: "fled" });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/LittleGames/wonder-academy/logic/battleSession.test.ts`
Expected: FAIL — `playerCatch`/`playerSwitch`/`playerFlee` are not exported.

- [ ] **Step 3: Write minimal implementation**

In `battleSession.ts`, add these imports at the top:

```ts
import type { Rng } from "./rng";
import { attemptCatch } from "./catchLogic";
```

Then add these functions (below `playerAttack`):

```ts
export function playerCatch(
  session: BattleSession,
  treatTier: number,
  isFavorite: boolean,
  rng: Rng,
): BattleSession {
  if (session.outcome !== "ongoing") return session;

  const { caught, chance } = attemptCatch(
    {
      hpRatio: session.wild.hp / session.wild.maxHp,
      rarity: session.wildRarity,
      treatTier,
      isFavoriteSnack: isFavorite,
    },
    rng,
  );
  const log: BattleEvent[] = [
    ...session.log,
    { kind: "catchAttempt", chance, caught },
  ];

  if (caught) {
    log.push({ kind: "outcome", outcome: "caught" });
    return { ...session, outcome: "caught", log };
  }

  const afterEnemy = enemyRetaliate({ ...session, log });
  return { ...afterEnemy, turn: afterEnemy.turn + 1 };
}

export function playerSwitch(
  session: BattleSession,
  ownedId: string,
): BattleSession {
  if (session.outcome !== "ongoing") return session;

  const index = session.bench.findIndex((m) => m.ownedId === ownedId);
  if (index === -1) return session;

  const next = session.bench[index];
  const bench = [
    ...session.bench.slice(0, index),
    ...session.bench.slice(index + 1),
    session.active,
  ];
  const log: BattleEvent[] = [
    ...session.log,
    { kind: "switch", toOwnedId: next.ownedId },
  ];

  const afterEnemy = enemyRetaliate({ ...session, active: next, bench, log });
  return { ...afterEnemy, turn: afterEnemy.turn + 1 };
}

export function playerFlee(session: BattleSession): BattleSession {
  if (session.outcome !== "ongoing") return session;
  return {
    ...session,
    outcome: "fled",
    log: [...session.log, { kind: "outcome", outcome: "fled" }],
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/LittleGames/wonder-academy/logic/battleSession.test.ts`
Expected: PASS (15 tests total).

- [ ] **Step 5: Run the full suite and commit**

Run: `npm test`
Expected: PASS — the battle-session specs plus all earlier suites.

```bash
git add src/components/LittleGames/wonder-academy/logic/battleSession.ts \
        src/components/LittleGames/wonder-academy/logic/battleSession.test.ts
git commit -m "feat(wonder-academy): add catch, switch, and flee to battle session"
```

---

## Self-Review

**1. Spec coverage (§5 ② 戰鬥 + 捕捉 — the turn engine):**
- 回合制 1v1 + 切換隊伍 → `playerAttack`/`playerSwitch` + `enemyRetaliate`. ✓
- 屬性相剋傷害(透過 `performMove`)、想睡窗口、收服(`attemptCatch`)、最愛零食加成(`isFavorite`)→ composed. ✓
- 勝/負/逃/收服判定 → `BattleOutcome`. ✓
- **Out of scope (later):** the wild AI is intentionally trivial (`moveIds[0]`); persisting battle results to `ownedWonderlings` (XP/bond) and the dex (`recordDex`) happens in the reducer-integration plan; the UI renders the `BattleEvent` log.

**2. Placeholder scan:** No TBD/TODO; complete code in every step; exact commands with expected results. ✓

**3. Type consistency:** `BattleSession`/`BattleEvent`/`WildInfo`/`BattleOutcome` defined once in Task 1 and extended only by adding functions in Tasks 2–3. `enemyRetaliate` (Task 1) is reused by `playerAttack` (Task 2) and `playerCatch`/`playerSwitch` (Task 3). The RNG is consumed only in `playerCatch` via `attemptCatch(ctx, rng)`, matching `catchLogic`'s signature. `performMove`/`isFainted`/`isSleepy` are used with the signatures from `battleLogic`. ✓
