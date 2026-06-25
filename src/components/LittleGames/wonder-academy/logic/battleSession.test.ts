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
