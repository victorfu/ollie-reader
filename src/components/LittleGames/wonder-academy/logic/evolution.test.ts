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
