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
