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
