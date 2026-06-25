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
