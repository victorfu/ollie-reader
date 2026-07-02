import { describe, expect, it } from "vitest";
import type { BattleCombatant } from "./battleLogic";
import type { Rng } from "./rng";
import type { WildInfo } from "./battleSession";
import { enemyRetaliate, playerAttack, playerCatch, playerFlee, playerSwitch, startBattle } from "./battleSession";

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

describe("playerAttack", () => {
  it("damages the wild, flags sleepy, and lets the wild retaliate", () => {
    // wild at low-ish hp so the hit leaves it alive but sleepy (<=25% of 40 = 10)
    // zip-spark deals 13 dmg (power 9 + floor(8/2)=4, 1x vs leaf), so hp:20 → 7 (sleepy)
    const s = startBattle([mon()], wildInfo({ hp: 20, maxHp: 40 }));
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

  it("is a no-op when the requested move is not equipped", () => {
    const s = startBattle([mon({ moveIds: ["zip-spark"] })], wildInfo());

    expect(playerAttack(s, "bubble-pat")).toBe(s);
  });

  it("is a no-op when the requested move is unknown", () => {
    const s = startBattle([mon({ moveIds: ["zip-spark"] })], wildInfo());

    expect(playerAttack(s, "missing-move")).toBe(s);
  });
});

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
