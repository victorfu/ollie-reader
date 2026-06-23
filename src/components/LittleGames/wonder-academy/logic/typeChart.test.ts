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
