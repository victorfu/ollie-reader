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
